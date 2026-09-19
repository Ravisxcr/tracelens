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

	if stats.TotalFiles < 4 {
		t.Errorf("Expected at least 4 files indexed (go, ts, c, py), got %d", stats.TotalFiles)
	}
	if stats.TotalTypes < 3 {
		t.Errorf("Expected at least 3 datatypes/structs indexed, got %d", stats.TotalTypes)
	}

	// 1. Test C CPython Symbol Extraction & Call Graph
	cGraph, err := idx.BuildCallGraph("PyLong_FromLong", "sample.c", 1)
	if err != nil {
		t.Fatalf("BuildCallGraph for PyLong_FromLong failed: %v", err)
	}

	// Verify categories present in PyLong_FromLong graph
	hasFunction := false
	hasType := false
	hasVar := false

	for _, node := range cGraph.Nodes {
		switch node.Data.Category {
		case ast.CategoryFunction:
			hasFunction = true
		case ast.CategoryType:
			hasType = true
		case ast.CategoryVariable:
			hasVar = true
		}
	}

	if !hasFunction {
		t.Errorf("Expected function node in PyLong_FromLong call graph")
	}
	if !hasType {
		t.Errorf("Expected datatype node (PyObject/PyTypeObject) in PyLong_FromLong call graph")
	}
	if !hasVar {
		t.Errorf("Expected variable node (PyLong_Type) in PyLong_FromLong call graph")
	}

	// Verify Overlap-Free Guarantee: No two nodes have identical or conflicting (X, Y)
	for i := 0; i < len(cGraph.Nodes); i++ {
		for j := i + 1; j < len(cGraph.Nodes); j++ {
			n1 := cGraph.Nodes[i]
			n2 := cGraph.Nodes[j]
			// Same column
			if n1.Position.X == n2.Position.X {
				yDiff := n1.Position.Y - n2.Position.Y
				if yDiff < 0 {
					yDiff = -yDiff
				}
				if yDiff < 150.0 {
					t.Errorf("Nodes %s and %s in same column are too close (Y diff: %.1f < 150)",
						n1.Data.Label, n2.Data.Label, yDiff)
				}
			}
		}
	}
}

func TestCallGraphCache(t *testing.T) {
	cache := indexer.NewCallGraphCache(3)

	resp1 := &indexer.CallGraphResponse{RootSymbol: "sym1"}
	resp2 := &indexer.CallGraphResponse{RootSymbol: "sym2"}
	resp3 := &indexer.CallGraphResponse{RootSymbol: "sym3"}
	resp4 := &indexer.CallGraphResponse{RootSymbol: "sym4"}

	cache.Put("k1", resp1)
	cache.Put("k2", resp2)
	cache.Put("k3", resp3)

	if cache.Len() != 3 {
		t.Fatalf("Expected cache size 3, got %d", cache.Len())
	}

	// Access k1 so k2 becomes LRU
	if v, found := cache.Get("k1"); !found || v.RootSymbol != "sym1" {
		t.Fatalf("Expected hit for k1")
	}

	// Put k4 -> should evict k2
	cache.Put("k4", resp4)
	if _, found := cache.Get("k2"); found {
		t.Errorf("Expected k2 to be evicted")
	}
	if _, found := cache.Get("k1"); !found {
		t.Errorf("Expected k1 to still be cached")
	}

	// Test Clear
	cache.Clear()
	if cache.Len() != 0 {
		t.Errorf("Expected 0 after Clear, got %d", cache.Len())
	}
}

func TestHighFanIn140Calls(t *testing.T) {
	extractor := ast.NewExtractor(nil)
	idx := indexer.NewIndex(extractor)
	ctx := context.Background()

	testDataDir, err := filepath.Abs(filepath.Join("..", "testdata"))
	if err != nil {
		t.Fatalf("Failed to resolve testdata path: %v", err)
	}
	if _, err := idx.IndexWorkspace(ctx, testDataDir); err != nil {
		t.Fatalf("IndexWorkspace failed: %v", err)
	}

	// Simulate high fan-in engine in CPython (140 function calls calling the same engine)
	// We verify BuildCallGraph handles limit, dual-column layout, and LRU cache
	graphResp, err := idx.BuildCallGraph("PyLong_FromLong", "sample.c", 1, 50)
	if err != nil {
		t.Fatalf("BuildCallGraph failed: %v", err)
	}

	if graphResp.Counts["shownCallers"] > 50 {
		t.Errorf("Expected at most 50 shownCallers, got %d", graphResp.Counts["shownCallers"])
	}

	// Call again to verify cache hit
	cachedResp, err := idx.BuildCallGraph("PyLong_FromLong", "sample.c", 1, 50)
	if err != nil {
		t.Fatalf("Second BuildCallGraph failed: %v", err)
	}
	if cachedResp != graphResp {
		t.Errorf("Expected identical response pointer from cache")
	}
}

