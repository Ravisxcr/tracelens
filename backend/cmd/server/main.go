package main

import (
	"context"
	"flag"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/exec"
	"os/signal"
	"path/filepath"
	"runtime"
	"syscall"
	"time"

	"tracelens/backend/internal/api"
	"tracelens/backend/internal/ast"
	"tracelens/backend/internal/indexer"
	"tracelens/backend/internal/watchdog"
)

func main() {
	flag.Usage = func() {
		fmt.Fprintf(os.Stderr, "TraceLens (tlens) — Fast Read-Only Code Exploration & Call Graph Engine\n\n")
		fmt.Fprintf(os.Stderr, "Usage:\n")
		fmt.Fprintf(os.Stderr, "  tlens [flags] [directory]\n\n")
		fmt.Fprintf(os.Stderr, "Examples:\n")
		fmt.Fprintf(os.Stderr, "  tlens .                 # Open current directory\n")
		fmt.Fprintf(os.Stderr, "  tlens /path/to/cpython  # Open target project\n")
		fmt.Fprintf(os.Stderr, "  tlens -port 3000 .      # Specify custom port\n\n")
		fmt.Fprintf(os.Stderr, "Flags:\n")
		flag.PrintDefaults()
	}

	port := flag.Int("port", 8080, "HTTP server port to listen on")
	dirFlag := flag.String("dir", "", "Target directory path to scan and index")
	noBrowser := flag.Bool("no-browser", false, "Do not automatically launch web browser")
	watch := flag.Bool("watch", true, "Enable live filesystem watchdog (auto-reindex on change)")
	watchInterval := flag.Duration("watch-interval", 1000*time.Millisecond, "Filesystem watchdog polling interval")
	flag.Parse()

	// Resolve target directory from positional arg first, then -dir flag, defaulting to "."
	targetPath := "."
	if flag.NArg() > 0 {
		targetPath = flag.Arg(0)
	} else if *dirFlag != "" {
		targetPath = *dirFlag
	}

	absDir, err := filepath.Abs(targetPath)
	if err != nil {
		log.Fatalf("Error resolving path '%s': %v\n", targetPath, err)
	}

	fileInfo, err := os.Stat(absDir)
	if err != nil || !fileInfo.IsDir() {
		log.Fatalf("Error: '%s' is not a valid directory\n", absDir)
	}

	fmt.Println("==============================================================================")
	fmt.Println("  TraceLens (tlens) — Read-Only Code Exploration & Call Graph Engine         ")
	fmt.Println("==============================================================================")
	fmt.Printf("  Target Workspace : %s\n", absDir)

	lm := ast.NewLanguageManager()
	extractor := ast.NewExtractor(lm)
	idx := indexer.NewIndex(extractor)

	// Perform initial fast indexing
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	stats, err := idx.IndexWorkspace(ctx, absDir)
	cancel()

	if err != nil {
		fmt.Printf("  Warning          : Indexing finished with notice: %v\n", err)
	} else {
		fmt.Printf("  Indexed          : %d files, %d symbols, %d calls (in %v)\n",
			stats.TotalFiles, stats.TotalSymbols, stats.TotalCalls, stats.Duration.Round(time.Millisecond))
	}

	var wd *watchdog.Watchdog
	if *watch {
		wd = watchdog.NewWatchdog(watchdog.Config{
			RootDir:  absDir,
			Interval: *watchInterval,
			Debounce: 300 * time.Millisecond,
		}, idx)
		if err := wd.Start(context.Background()); err != nil {
			fmt.Printf("  Watchdog Warning : Failed to start watchdog: %v\n", err)
		} else {
			fmt.Printf("  Watchdog         : Active (auto-reindex on change, interval: %v)\n", *watchInterval)
		}
	} else {
		fmt.Println("  Watchdog         : Disabled")
	}

	router := api.NewRouter(idx, wd)
	serverAddr := fmt.Sprintf(":%d", *port)
	srv := &http.Server{
		Addr:         serverAddr,
		Handler:      router,
		ReadTimeout:  30 * time.Second,
		WriteTimeout: 30 * time.Second,
		IdleTimeout:  120 * time.Second,
	}

	url := fmt.Sprintf("http://localhost:%d", *port)
	fmt.Printf("  Web Interface    : %s\n", url)
	fmt.Println("------------------------------------------------------------------------------")
	fmt.Println("  Server running. Press Ctrl+C to exit.")
	fmt.Println("==============================================================================")

	// Launch browser in background unless -no-browser is set
	if !*noBrowser {
		go func() {
			time.Sleep(200 * time.Millisecond)
			openBrowser(url)
		}()
	}

	go func() {
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Server error: %v", err)
		}
	}()

	// Graceful shutdown
	stop := make(chan os.Signal, 1)
	signal.Notify(stop, os.Interrupt, syscall.SIGTERM)
	<-stop

	fmt.Println("\nShutting down TraceLens server...")
	if wd != nil {
		wd.Stop()
	}
	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer shutdownCancel()

	if err := srv.Shutdown(shutdownCtx); err != nil {
		log.Fatalf("Forced shutdown: %v", err)
	}
	fmt.Println("TraceLens stopped cleanly.")
}

func openBrowser(url string) {
	var cmd *exec.Cmd
	switch runtime.GOOS {
	case "linux":
		cmd = exec.Command("xdg-open", url)
	case "darwin":
		cmd = exec.Command("open", url)
	case "windows":
		cmd = exec.Command("rundll32", "url.dll,FileProtocolHandler", url)
	}
	if cmd != nil {
		_ = cmd.Start()
	}
}
