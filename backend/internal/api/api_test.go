package api_test

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"testing"

	"tracelens/backend/internal/api"
	"tracelens/backend/internal/ast"
	"tracelens/backend/internal/indexer"
)

func setupTestServer(t *testing.T) *httptest.Server {
	testDataDir, err := filepath.Abs(filepath.Join("..", "testdata"))
	if err != nil {
		t.Fatalf("Failed to resolve testdata: %v", err)
	}

	extractor := ast.NewExtractor(nil)
	idx := indexer.NewIndex(extractor)
	router := api.NewRouter(idx)

	ts := httptest.NewServer(router)

	// Open workspace
	payload, _ := json.Marshal(api.OpenWorkspaceRequest{Path: testDataDir})
	res, err := http.Post(ts.URL+"/api/workspace/open", "application/json", bytes.NewBuffer(payload))
	if err != nil || res.StatusCode != http.StatusOK {
		t.Fatalf("Failed to open workspace: %v, status: %d", err, res.StatusCode)
	}

	return ts
}

func TestAPIEndpoints(t *testing.T) {
	ts := setupTestServer(t)
	defer ts.Close()

	// 1. Health check
	resp, err := http.Get(ts.URL + "/api/health")
	if err != nil || resp.StatusCode != http.StatusOK {
		t.Fatalf("Health check failed: %v", err)
	}

	// 2. Tree check
	resp, err = http.Get(ts.URL + "/api/workspace/tree")
	if err != nil || resp.StatusCode != http.StatusOK {
		t.Fatalf("Tree endpoint failed: %v", err)
	}

	// 3. File content
	resp, err = http.Get(ts.URL + "/api/file?path=sample.go")
	if err != nil || resp.StatusCode != http.StatusOK {
		t.Fatalf("File endpoint failed: %v", err)
	}

	// 4. Definition lookup
	resp, err = http.Get(ts.URL + "/api/definition?name=Greet&file=sample.go")
	if err != nil || resp.StatusCode != http.StatusOK {
		t.Fatalf("Definition endpoint failed: %v", err)
	}

	// 5. References lookup
	resp, err = http.Get(ts.URL + "/api/references?name=Greet")
	if err != nil || resp.StatusCode != http.StatusOK {
		t.Fatalf("References endpoint failed: %v", err)
	}

	// 6. Call Graph
	resp, err = http.Get(ts.URL + "/api/callgraph?symbol=Greet&file=sample.go")
	if err != nil || resp.StatusCode != http.StatusOK {
		t.Fatalf("Callgraph endpoint failed: %v", err)
	}

	var graphResp indexer.CallGraphResponse
	_ = json.NewDecoder(resp.Body).Decode(&graphResp)
	if len(graphResp.Nodes) < 2 {
		t.Errorf("Expected at least 2 nodes in callgraph API response, got %d", len(graphResp.Nodes))
	}

	// 7. Symbol Search
	resp, err = http.Get(ts.URL + "/api/symbols/search?q=Greet")
	if err != nil || resp.StatusCode != http.StatusOK {
		t.Fatalf("Symbol search endpoint failed: %v", err)
	}
}

