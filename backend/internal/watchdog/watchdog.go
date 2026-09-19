package watchdog

import (
	"context"
	"io/fs"
	"log"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"tracelens/backend/internal/ast"
	"tracelens/backend/internal/indexer"
)

// WatchdogEvent represents a notification sent over SSE when changes occur.
type WatchdogEvent struct {
	Type      string              `json:"type"`      // "connected", "change", "rescan", "heartbeat"
	Files     []string            `json:"files"`     // List of relative file paths changed
	Stats     *indexer.IndexStats `json:"stats"`     // Updated index statistics
	Timestamp time.Time           `json:"timestamp"` // Event timestamp
}

// LastChangeInfo records details of the most recent change event.
type LastChangeInfo struct {
	Files      []string  `json:"files"`
	Timestamp  time.Time `json:"timestamp"`
	DurationMs int64     `json:"durationMs"`
}

// WatchdogStatus reports current status for API consumers.
type WatchdogStatus struct {
	Enabled      bool            `json:"enabled"`
	RootDir      string          `json:"rootDir"`
	WatchedFiles int             `json:"watchedFiles"`
	IntervalMs   int64           `json:"intervalMs"`
	LastChange   *LastChangeInfo `json:"lastChange,omitempty"`
}

// Config holds options for the filesystem watchdog.
type Config struct {
	RootDir  string
	Interval time.Duration
	Debounce time.Duration
}

// fileMeta records size and mtime for change detection.
type fileMeta struct {
	size    int64
	modTime time.Time
}

// Hub coordinates real-time event broadcasting to SSE subscribers.
type Hub struct {
	mu      sync.RWMutex
	clients map[chan WatchdogEvent]struct{}
	closed  bool
}

// NewHub creates a new SSE event hub.
func NewHub() *Hub {
	return &Hub{
		clients: make(map[chan WatchdogEvent]struct{}),
	}
}

// Subscribe registers a new event channel and returns a cleanup function.
func (h *Hub) Subscribe() (<-chan WatchdogEvent, func()) {
	ch := make(chan WatchdogEvent, 32)
	h.mu.Lock()
	defer h.mu.Unlock()

	if h.closed {
		close(ch)
		return ch, func() {}
	}

	h.clients[ch] = struct{}{}
	cleanup := func() {
		h.mu.Lock()
		defer h.mu.Unlock()
		if _, ok := h.clients[ch]; ok {
			delete(h.clients, ch)
			close(ch)
		}
	}
	return ch, cleanup
}

// Broadcast sends an event to all active subscribers.
func (h *Hub) Broadcast(event WatchdogEvent) {
	h.mu.RLock()
	defer h.mu.RUnlock()

	for ch := range h.clients {
		select {
		case ch <- event:
		default:
			// Non-blocking drop if consumer is slow
		}
	}
}

// Close terminates all client channels.
func (h *Hub) Close() {
	h.mu.Lock()
	defer h.mu.Unlock()

	if h.closed {
		return
	}
	h.closed = true
	for ch := range h.clients {
		close(ch)
	}
	h.clients = make(map[chan WatchdogEvent]struct{})
}

// Watchdog continuously monitors the workspace for source code modifications, additions, and deletions.
type Watchdog struct {
	mu           sync.RWMutex
	cfg          Config
	index        *indexer.Index
	hub          *Hub
	snapshot     map[string]fileMeta
	lastChange   *LastChangeInfo
	ignoredDirs  map[string]bool
	ignoredFiles map[string]bool
	maxFileSize  int64
	stopCh       chan struct{}
	running      bool
	wg           sync.WaitGroup
}

// NewWatchdog creates a new Watchdog instance configured to watch rootDir.
func NewWatchdog(cfg Config, index *indexer.Index) *Watchdog {
	if cfg.Interval <= 0 {
		cfg.Interval = 1000 * time.Millisecond
	}
	if cfg.Debounce <= 0 {
		cfg.Debounce = 300 * time.Millisecond
	}

	return &Watchdog{
		cfg:      cfg,
		index:    index,
		hub:      NewHub(),
		snapshot: make(map[string]fileMeta),
		ignoredDirs: map[string]bool{
			".git":         true,
			"node_modules": true,
			"vendor":       true,
			"dist":         true,
			"build":        true,
			".next":        true,
			".cache":       true,
			".idea":        true,
			".vscode":      true,
		},
		ignoredFiles: map[string]bool{
			"package-lock.json": true,
			"yarn.lock":         true,
			"pnpm-lock.yaml":    true,
			"go.sum":            true,
		},
		maxFileSize: 2 * 1024 * 1024, // 2MB
		stopCh:      make(chan struct{}),
	}
}

// Hub returns the SSE event hub.
func (w *Watchdog) Hub() *Hub {
	return w.hub
}

// Status returns the current watchdog status.
func (w *Watchdog) Status() WatchdogStatus {
	w.mu.RLock()
	defer w.mu.RUnlock()

	var lc *LastChangeInfo
	if w.lastChange != nil {
		copyFiles := make([]string, len(w.lastChange.Files))
		copy(copyFiles, w.lastChange.Files)
		lc = &LastChangeInfo{
			Files:      copyFiles,
			Timestamp:  w.lastChange.Timestamp,
			DurationMs: w.lastChange.DurationMs,
		}
	}

	return WatchdogStatus{
		Enabled:      w.running,
		RootDir:      w.cfg.RootDir,
		WatchedFiles: len(w.snapshot),
		IntervalMs:   w.cfg.Interval.Milliseconds(),
		LastChange:   lc,
	}
}

// SetRootDir updates the target directory to watch.
func (w *Watchdog) SetRootDir(rootDir string) {
	w.mu.Lock()
	defer w.mu.Unlock()
	abs, err := filepath.Abs(rootDir)
	if err == nil {
		w.cfg.RootDir = abs
	}
	w.snapshot = make(map[string]fileMeta)
}

// Start begins filesystem polling in background goroutines.
func (w *Watchdog) Start(ctx context.Context) error {
	w.mu.Lock()
	if w.running {
		w.mu.Unlock()
		return nil
	}
	w.running = true
	w.stopCh = make(chan struct{})
	w.mu.Unlock()

	// Perform initial snapshot
	initialSnapshot, err := w.scanFiles(w.cfg.RootDir)
	if err == nil {
		w.mu.Lock()
		w.snapshot = initialSnapshot
		w.mu.Unlock()
	}

	w.wg.Add(2)
	go w.watchLoop()
	go w.heartbeatLoop()

	return nil
}

// Stop terminates the background watching goroutines.
func (w *Watchdog) Stop() {
	w.mu.Lock()
	if !w.running {
		w.mu.Unlock()
		return
	}
	w.running = false
	close(w.stopCh)
	w.mu.Unlock()

	w.wg.Wait()
	w.hub.Close()
}

// Rescan triggers an immediate forced scan, workspace reindex, and broadcast.
func (w *Watchdog) Rescan(ctx context.Context) (*indexer.IndexStats, error) {
	w.mu.RLock()
	rootDir := w.cfg.RootDir
	w.mu.RUnlock()

	start := time.Now()
	stats, err := w.index.IndexWorkspace(ctx, rootDir)
	if err != nil {
		return nil, err
	}

	// Update snapshot
	newSnapshot, err := w.scanFiles(rootDir)
	if err == nil {
		w.mu.Lock()
		w.snapshot = newSnapshot
		w.lastChange = &LastChangeInfo{
			Files:      []string{"(manual rescan)"},
			Timestamp:  time.Now(),
			DurationMs: time.Since(start).Milliseconds(),
		}
		w.mu.Unlock()
	}

	w.hub.Broadcast(WatchdogEvent{
		Type:      "rescan",
		Files:     []string{"*"},
		Stats:     stats,
		Timestamp: time.Now(),
	})

	return stats, nil
}

// scanFiles walks rootDir and records metadata for supported source files.
func (w *Watchdog) scanFiles(rootDir string) (map[string]fileMeta, error) {
	absRoot, err := filepath.Abs(rootDir)
	if err != nil {
		return nil, err
	}

	results := make(map[string]fileMeta)

	err = filepath.WalkDir(absRoot, func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			return nil // Skip unreadable
		}

		name := d.Name()
		if d.IsDir() {
			if w.ignoredDirs[name] || strings.HasPrefix(name, ".") {
				return filepath.SkipDir
			}
			return nil
		}

		if w.ignoredFiles[name] {
			return nil
		}

		if ast.DetectLanguage(path) == ast.LangUnknown {
			return nil
		}

		info, err := d.Info()
		if err != nil || info.Size() > w.maxFileSize {
			return nil
		}

		relPath, err := filepath.Rel(absRoot, path)
		if err != nil {
			return nil
		}

		results[filepath.ToSlash(relPath)] = fileMeta{
			size:    info.Size(),
			modTime: info.ModTime(),
		}

		return nil
	})

	return results, err
}

// watchLoop periodically checks for filesystem changes with debouncing.
func (w *Watchdog) watchLoop() {
	defer w.wg.Done()

	ticker := time.NewTicker(w.cfg.Interval)
	defer ticker.Stop()

	for {
		select {
		case <-w.stopCh:
			return
		case <-ticker.C:
			w.checkAndHandleChanges()
		}
	}
}

// checkAndHandleChanges detects file differences and triggers debounced reindexing.
func (w *Watchdog) checkAndHandleChanges() {
	w.mu.RLock()
	rootDir := w.cfg.RootDir
	prevSnapshot := w.snapshot
	w.mu.RUnlock()

	currentSnapshot, err := w.scanFiles(rootDir)
	if err != nil {
		return
	}

	var changedFiles []string

	// Detect modified and added files
	for path, curr := range currentSnapshot {
		prev, exists := prevSnapshot[path]
		if !exists {
			changedFiles = append(changedFiles, path)
		} else if curr.size != prev.size || !curr.modTime.Equal(prev.modTime) {
			changedFiles = append(changedFiles, path)
		}
	}

	// Detect deleted files
	for path := range prevSnapshot {
		if _, exists := currentSnapshot[path]; !exists {
			changedFiles = append(changedFiles, path)
		}
	}

	if len(changedFiles) == 0 {
		return
	}

	// Debounce wait to let batch saves complete
	if w.cfg.Debounce > 0 {
		select {
		case <-w.stopCh:
			return
		case <-time.After(w.cfg.Debounce):
		}
	}

	// Re-scan right after debounce to catch trailing file writes
	finalSnapshot, err := w.scanFiles(rootDir)
	if err == nil {
		currentSnapshot = finalSnapshot
	}

	start := time.Now()
	reindexCtx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	stats, err := w.index.IndexWorkspace(reindexCtx, rootDir)
	cancel()

	durationMs := time.Since(start).Milliseconds()

	w.mu.Lock()
	w.snapshot = currentSnapshot
	w.lastChange = &LastChangeInfo{
		Files:      changedFiles,
		Timestamp:  time.Now(),
		DurationMs: durationMs,
	}
	w.mu.Unlock()

	if err != nil {
		log.Printf("[Watchdog] Reindex warning: %v\n", err)
	} else {
		log.Printf("[Watchdog] Detected change in %d file(s) (%v) -> Reindexed in %dms\n",
			len(changedFiles), changedFiles, durationMs)
	}

	w.hub.Broadcast(WatchdogEvent{
		Type:      "change",
		Files:     changedFiles,
		Stats:     stats,
		Timestamp: time.Now(),
	})
}

// heartbeatLoop periodically sends SSE ping events to keep connections active.
func (w *Watchdog) heartbeatLoop() {
	defer w.wg.Done()

	ticker := time.NewTicker(15 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-w.stopCh:
			return
		case <-ticker.C:
			w.hub.Broadcast(WatchdogEvent{
				Type:      "heartbeat",
				Timestamp: time.Now(),
			})
		}
	}
}
