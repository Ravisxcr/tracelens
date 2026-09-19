package main

import (
	"context"
	"flag"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"syscall"
	"time"

	"tracelens/backend/internal/api"
	"tracelens/backend/internal/ast"
	"tracelens/backend/internal/indexer"
)

func main() {
	port := flag.Int("port", 8080, "HTTP server port")
	targetDir := flag.String("dir", ".", "Directory path to scan and index")
	flag.Parse()

	absDir, err := filepath.Abs(*targetDir)
	if err != nil {
		log.Fatalf("Invalid directory path: %v", err)
	}

	fmt.Println("==================================================")
	fmt.Println("  TraceLens — Read-Only Code Exploration Engine   ")
	fmt.Println("==================================================")
	fmt.Printf("Indexing target: %s\n", absDir)

	lm := ast.NewLanguageManager()
	extractor := ast.NewExtractor(lm)
	idx := indexer.NewIndex(extractor)

	// Perform initial index
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	stats, err := idx.IndexWorkspace(ctx, absDir)
	if err != nil {
		log.Printf("Warning: initial index completed with warning: %v\n", err)
	} else {
		fmt.Printf("Indexed %d files, %d symbols, %d calls in %v\n",
			stats.TotalFiles, stats.TotalSymbols, stats.TotalCalls, stats.Duration)
	}

	router := api.NewRouter(idx)
	serverAddr := fmt.Sprintf(":%d", *port)
	srv := &http.Server{
		Addr:         serverAddr,
		Handler:      router,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	go func() {
		fmt.Printf("TraceLens server listening on http://localhost:%d\n", *port)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Server listen error: %v", err)
		}
	}()

	// Graceful shutdown
	stop := make(chan os.Signal, 1)
	signal.Notify(stop, os.Interrupt, syscall.SIGTERM)
	<-stop

	fmt.Println("\nShutting down TraceLens server...")
	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer shutdownCancel()

	if err := srv.Shutdown(shutdownCtx); err != nil {
		log.Fatalf("Server forced to shutdown: %v", err)
	}
	fmt.Println("TraceLens server stopped cleanly.")
}

