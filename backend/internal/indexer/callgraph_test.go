package indexer

import (
	"fmt"
	"testing"
	"time"

	"tracelens/backend/internal/ast"
)

func TestBuildCallGraph_140Callers_DualColumnAndCache(t *testing.T) {
	idx := NewIndex(nil)

	// Simulate a central CPython engine function (e.g. _PyEval_EvalFrameDefault)
	engineName := "_PyEval_EvalFrameDefault"
	idx.defsByName[engineName] = []*ast.Symbol{
		{
			ID:       "cpython:ceval.c:_PyEval_EvalFrameDefault",
			Name:     engineName,
			Kind:     ast.KindFunction,
			Category: ast.CategoryFunction,
			File:     "Python/ceval.c",
			Range:    ast.Range{Start: ast.Position{Line: 1000, Column: 1}},
		},
	}

	// Inject 140 callers calling the engine
	const callerCount = 140
	calls := make([]*ast.CallSite, 0, callerCount)
	for i := 1; i <= callerCount; i++ {
		callerName := fmt.Sprintf("py_eval_caller_%03d", i)
		call := &ast.CallSite{
			Caller: callerName,
			Callee: engineName,
			File:   fmt.Sprintf("Objects/func_%03d.c", i),
			Range:  ast.Range{Start: ast.Position{Line: i * 10, Column: 5}},
		}
		calls = append(calls, call)

		idx.defsByName[callerName] = []*ast.Symbol{
			{
				ID:       fmt.Sprintf("caller:%s", callerName),
				Name:     callerName,
				Kind:     ast.KindFunction,
				Category: ast.CategoryFunction,
				File:     call.File,
				Range:    call.Range,
			},
		}
	}
	idx.callsByCallee[engineName] = calls

	// 1. Test with default limit = 50
	resp50, err := idx.BuildCallGraph(engineName, "Python/ceval.c", 1, 50)
	if err != nil {
		t.Fatalf("BuildCallGraph with limit 50 failed: %v", err)
	}

	if resp50.Counts["callers"] != 140 {
		t.Errorf("Expected total callers 140, got %d", resp50.Counts["callers"])
	}
	if resp50.Counts["shownCallers"] != 50 {
		t.Errorf("Expected shown callers 50, got %d", resp50.Counts["shownCallers"])
	}

	// 2. Test with limit = 0 (All 140 callers rendered)
	start := time.Now()
	respAll, err := idx.BuildCallGraph(engineName, "Python/ceval.c", 1, 0)
	elapsed1 := time.Since(start)
	if err != nil {
		t.Fatalf("BuildCallGraph for 140 callers failed: %v", err)
	}

	if respAll.Counts["callers"] != 140 || respAll.Counts["shownCallers"] != 140 {
		t.Errorf("Expected 140 callers rendered, got total=%d shown=%d",
			respAll.Counts["callers"], respAll.Counts["shownCallers"])
	}

	// 3. Test LRU Cache Hit on second access (should be < 1ms)
	start = time.Now()
	cachedResp, err := idx.BuildCallGraph(engineName, "Python/ceval.c", 1, 0)
	elapsedCache := time.Since(start)
	if err != nil {
		t.Fatalf("Cached BuildCallGraph failed: %v", err)
	}

	if cachedResp != respAll {
		t.Fatalf("Expected exact pointer match from LRU cache")
	}
	t.Logf("140-caller graph first compute: %v, cache hit: %v (speedup: %.1fx)",
		elapsed1, elapsedCache, float64(elapsed1)/float64(elapsedCache+1))

	// 4. Verify Overlap-Free layout across all 140 nodes in dual columns
	// Verify that nodes in Column 0a (X: -380) and Column 0b (X: 60) have vertical clearance >= 150px
	nodesByX := make(map[float64][]GraphNode)
	for _, node := range respAll.Nodes {
		nodesByX[node.Position.X] = append(nodesByX[node.Position.X], node)
	}

	col0a := nodesByX[-380.0]
	col0b := nodesByX[60.0]

	if len(col0a) != 70 {
		t.Errorf("Expected 70 nodes in sub-column 0a (X: -380), got %d", len(col0a))
	}
	if len(col0b) != 70 {
		t.Errorf("Expected 70 nodes in sub-column 0b (X: 60), got %d", len(col0b))
	}

	// Check vertical clearance >= 150px in column 0a
	for i := 0; i < len(col0a); i++ {
		for j := i + 1; j < len(col0a); j++ {
			yDiff := col0a[i].Position.Y - col0a[j].Position.Y
			if yDiff < 0 {
				yDiff = -yDiff
			}
			if yDiff < 150.0 {
				t.Fatalf("Overlap detected in Column 0a: nodes %s and %s Y diff %.1f < 150",
					col0a[i].Data.Label, col0a[j].Data.Label, yDiff)
			}
		}
	}

	// Check vertical clearance >= 150px in column 0b
	for i := 0; i < len(col0b); i++ {
		for j := i + 1; j < len(col0b); j++ {
			yDiff := col0b[i].Position.Y - col0b[j].Position.Y
			if yDiff < 0 {
				yDiff = -yDiff
			}
			if yDiff < 150.0 {
				t.Fatalf("Overlap detected in Column 0b: nodes %s and %s Y diff %.1f < 150",
					col0b[i].Data.Label, col0b[j].Data.Label, yDiff)
			}
		}
	}
}

func TestCallGraphCache_TTL(t *testing.T) {
	cache := NewCallGraphCache(10)
	resp := &CallGraphResponse{RootSymbol: "ttlTest"}

	// Put with 20ms TTL
	cache.PutWithTTL("fastKey", resp, 20*time.Millisecond)

	// Immediate hit
	if val, ok := cache.Get("fastKey"); !ok || val.RootSymbol != "ttlTest" {
		t.Fatalf("Expected immediate hit for fastKey")
	}

	// Wait for expiration
	time.Sleep(30 * time.Millisecond)

	if _, ok := cache.Get("fastKey"); ok {
		t.Fatalf("Expected fastKey to be expired after 30ms")
	}
}

