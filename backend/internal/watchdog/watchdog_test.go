package watchdog_test

import (
	"context"
	"os"
	"path/filepath"
	"testing"
	"time"

	"tracelens/backend/internal/ast"
	"tracelens/backend/internal/indexer"
	"tracelens/backend/internal/watchdog"
)

func setupTestWatchdog(t *testing.T) (string, *watchdog.Watchdog, *indexer.Index, func()) {
	tmpDir, err := os.MkdirTemp("", "tracelens-watchdog-test-*")
	if err != nil {
		t.Fatalf("Failed to create temp dir: %v", err)
	}

	// Create an initial sample Go file
	initialFile := filepath.Join(tmpDir, "hello.go")
	initialContent := []byte("package main\n\nfunc Hello() string { return \"world\" }\n")
	if err := os.WriteFile(initialFile, initialContent, 0644); err != nil {
		t.Fatalf("Failed to write initial file: %v", err)
	}

	lm := ast.NewLanguageManager()
	extractor := ast.NewExtractor(lm)
	idx := indexer.NewIndex(extractor)

	// Perform initial index
	ctx := context.Background()
	if _, err := idx.IndexWorkspace(ctx, tmpDir); err != nil {
		t.Fatalf("Failed initial index: %v", err)
	}

	cfg := watchdog.Config{
		RootDir:  tmpDir,
		Interval: 50 * time.Millisecond,
		Debounce: 50 * time.Millisecond,
	}
	wd := watchdog.NewWatchdog(cfg, idx)

	cleanup := func() {
		wd.Stop()
		_ = os.RemoveAll(tmpDir)
	}

	return tmpDir, wd, idx, cleanup
}

func TestWatchdog_DetectsFileCreationAndModification(t *testing.T) {
	tmpDir, wd, idx, cleanup := setupTestWatchdog(t)
	defer cleanup()

	ctx := context.Background()
	if err := wd.Start(ctx); err != nil {
		t.Fatalf("Failed to start watchdog: %v", err)
	}

	subCh, unsub := wd.Hub().Subscribe()
	defer unsub()

	// 1. Initial status check
	status := wd.Status()
	if !status.Enabled {
		t.Errorf("Expected watchdog to be enabled")
	}
	if status.WatchedFiles != 1 {
		t.Errorf("Expected 1 watched file, got %d", status.WatchedFiles)
	}

	// 2. Add a new file
	newFile := filepath.Join(tmpDir, "sample2.go")
	newContent := []byte("package main\n\nfunc Calculate(a, b int) int { return a + b }\n")
	if err := os.WriteFile(newFile, newContent, 0644); err != nil {
		t.Fatalf("Failed to create sample2.go: %v", err)
	}

	// Wait for change event
	select {
	case evt, ok := <-subCh:
		if !ok {
			t.Fatalf("Subscriber channel closed prematurely")
		}
		if evt.Type != "change" {
			t.Errorf("Expected event type 'change', got '%s'", evt.Type)
		}
		found := false
		for _, f := range evt.Files {
			if f == "sample2.go" {
				found = true
				break
			}
		}
		if !found {
			t.Errorf("Expected sample2.go in changed files, got %v", evt.Files)
		}
	case <-time.After(1 * time.Second):
		t.Fatalf("Timeout waiting for file creation event")
	}

	// Verify index updated with new symbol
	defs := idx.FindDefinition("", "Calculate", 0, 0)
	if len(defs) == 0 {
		t.Fatalf("Expected Calculate symbol in updated index")
	}

	// 3. Modify existing file
	modContent := []byte("package main\n\nfunc Hello() string { return \"updated\" }\nfunc Goodbye() {}\n")
	if err := os.WriteFile(filepath.Join(tmpDir, "hello.go"), modContent, 0644); err != nil {
		t.Fatalf("Failed to modify hello.go: %v", err)
	}

	select {
	case evt := <-subCh:
		if evt.Type != "change" {
			t.Errorf("Expected event type 'change', got '%s'", evt.Type)
		}
		found := false
		for _, f := range evt.Files {
			if f == "hello.go" {
				found = true
				break
			}
		}
		if !found {
			t.Errorf("Expected hello.go in changed files, got %v", evt.Files)
		}
	case <-time.After(1 * time.Second):
		t.Fatalf("Timeout waiting for file modification event")
	}

	// Verify Goodbye symbol is present
	goodbyeDefs := idx.FindDefinition("", "Goodbye", 0, 0)
	if len(goodbyeDefs) == 0 {
		t.Fatalf("Expected Goodbye symbol in updated index after modification")
	}
}

func TestWatchdog_ManualRescan(t *testing.T) {
	tmpDir, wd, _, cleanup := setupTestWatchdog(t)
	defer cleanup()

	ctx := context.Background()
	subCh, unsub := wd.Hub().Subscribe()
	defer unsub()

	// Write another file before manual rescan
	extraFile := filepath.Join(tmpDir, "extra.go")
	_ = os.WriteFile(extraFile, []byte("package main\nfunc Extra() {}\n"), 0644)

	stats, err := wd.Rescan(ctx)
	if err != nil {
		t.Fatalf("Rescan failed: %v", err)
	}
	if stats.TotalFiles < 2 {
		t.Errorf("Expected at least 2 files after rescan, got %d", stats.TotalFiles)
	}

	select {
	case evt := <-subCh:
		if evt.Type != "rescan" {
			t.Errorf("Expected event type 'rescan', got '%s'", evt.Type)
		}
	case <-time.After(500 * time.Millisecond):
		t.Fatalf("Timeout waiting for rescan event")
	}
}

