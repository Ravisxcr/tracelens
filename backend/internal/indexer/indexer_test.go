package indexer_test

import (
	"context"
	"path/filepath"
	"testing"

	"tracelens/backend/internal/ast"
	"tracelens/backend/internal/indexer"
)

func TestIndexerAndCallGraph(t *testing.T) {
	testDataDir, err := filepath.Abs(filepath.Join("..", "testdata"))
	if err != nil {
		t.Fatalf("Failed to resolve testdata path: %v", err)
	}

	extractor := ast.NewExtractor(nil)
	idx := indexer.NewIndex(extractor)
	ctx := context.Background()

	stats, err := idx.IndexWorkspace(ctx, testDataDir)
	if err != nil {
		t.Fatalf("IndexWorkspace failed: %v", err)
	}

	if stats.TotalFiles < 2 {
		t.Errorf("Expected at least 2 files indexed, got %d", stats.TotalFiles)
	}
	if stats.TotalSymbols < 5 {
		t.Errorf("Expected at least 5 symbols indexed, got %d", stats.TotalSymbols)
	}

	// Test FindDefinition
	defs := idx.FindDefinition("sample.go", "Greet", 0, 0)
	if len(defs) == 0 {
		t.Errorf("Expected to find definition for 'Greet', got none")
	} else if defs[0].Name != "Greet" {
		t.Errorf("Expected definition name 'Greet', got '%s'", defs[0].Name)
	}

	// Test FindReferences
	refs := idx.FindReferences("Greet")
	if len(refs) == 0 {
		t.Errorf("Expected references/callers for 'Greet', got none")
	} else {
		foundCaller := false
		for _, ref := range refs {
			if ref.Caller == "RunGreeting" {
				foundCaller = true
				break
			}
		}
		if !foundCaller {
			t.Errorf("Expected 'RunGreeting' to be a caller of 'Greet'")
		}
	}

	// Test CallGraph
	graph, err := idx.BuildCallGraph("Greet", "sample.go", 1)
	if err != nil {
		t.Fatalf("BuildCallGraph error: %v", err)
	}
	if graph.RootSymbol != "Greet" {
		t.Errorf("Expected root symbol 'Greet', got '%s'", graph.RootSymbol)
	}
	if len(graph.Nodes) < 2 {
		t.Errorf("Expected at least 2 nodes in call graph (root + caller), got %d", len(graph.Nodes))
	}
	if len(graph.Edges) < 1 {
		t.Errorf("Expected at least 1 edge in call graph, got %d", len(graph.Edges))
	}
}

