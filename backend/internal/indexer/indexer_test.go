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
