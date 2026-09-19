package api

import (
	"encoding/json"
	"net/http"
	"strconv"

	"tracelens/backend/internal/indexer"
)

// Handlers bundles HTTP handler methods with the underlying symbol index.
type Handlers struct {
	index *indexer.Index
}

// NewHandlers creates a new Handlers instance.
func NewHandlers(index *indexer.Index) *Handlers {
	return &Handlers{index: index}
}

// writeJSON helper writes JSON responses with status code and headers.
func writeJSON(w http.ResponseWriter, status int, data any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(data)
}

// writeError helper sends standardized error JSON.
func writeError(w http.ResponseWriter, status int, msg string, details ...string) {
	resp := ErrorResponse{Error: msg}
	if len(details) > 0 {
		resp.Details = details[0]
	}
	writeJSON(w, status, resp)
}

// OpenWorkspace handles opening and indexing a source directory.
func (h *Handlers) OpenWorkspace(w http.ResponseWriter, r *http.Request) {
	var req OpenWorkspaceRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body", err.Error())
		return
	}

	if req.Path == "" {
		req.Path = "."
	}

	stats, err := h.index.IndexWorkspace(r.Context(), req.Path)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to index workspace", err.Error())
		return
	}

	writeJSON(w, http.StatusOK, OpenWorkspaceResponse{
		Path:  req.Path,
		Stats: *stats,
	})
}

// GetTree returns the full directory and file hierarchy with symbol counts.
func (h *Handlers) GetTree(w http.ResponseWriter, r *http.Request) {
	tree := h.index.GetTree()
	stats := h.index.GetStats()

	writeJSON(w, http.StatusOK, map[string]any{
		"tree":  tree,
		"stats": stats,
	})
}

// GetFile returns file content, language, and extracted AST symbols/calls.
func (h *Handlers) GetFile(w http.ResponseWriter, r *http.Request) {
	filePath := r.URL.Query().Get("path")
	if filePath == "" {
		writeError(w, http.StatusBadRequest, "path query parameter is required")
		return
	}

	fileResp, err := h.index.GetFileContent(filePath)
	if err != nil {
		writeError(w, http.StatusNotFound, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, fileResp)
}

// FindDefinition resolves a symbol or cursor position to its definition(s).
func (h *Handlers) FindDefinition(w http.ResponseWriter, r *http.Request) {
	name := r.URL.Query().Get("name")
	file := r.URL.Query().Get("file")
	lineStr := r.URL.Query().Get("line")
	colStr := r.URL.Query().Get("col")

	line, _ := strconv.Atoi(lineStr)
	col, _ := strconv.Atoi(colStr)

	defs := h.index.FindDefinition(file, name, line, col)
	writeJSON(w, http.StatusOK, DefinitionResponse{
		Query:       name,
		Definitions: defs,
	})
}

// FindReferences finds all callers / call sites of a symbol.
func (h *Handlers) FindReferences(w http.ResponseWriter, r *http.Request) {
	name := r.URL.Query().Get("name")
	if name == "" {
		writeError(w, http.StatusBadRequest, "name query parameter is required")
		return
	}

	refs := h.index.FindReferences(name)
	writeJSON(w, http.StatusOK, ReferencesResponse{
		Symbol:     name,
		References: refs,
	})
}

// CallGraph returns React Flow compatible nodes and edges for the call hierarchy.
func (h *Handlers) CallGraph(w http.ResponseWriter, r *http.Request) {
	symbol := r.URL.Query().Get("symbol")
	if symbol == "" {
		symbol = r.URL.Query().Get("name")
	}
	if symbol == "" {
		writeError(w, http.StatusBadRequest, "symbol or name query parameter is required")
		return
	}

	file := r.URL.Query().Get("file")
	depthStr := r.URL.Query().Get("depth")
	depth := 1
	if depthStr != "" {
		if d, err := strconv.Atoi(depthStr); err == nil && d > 0 {
			depth = d
		}
	}

	limitStr := r.URL.Query().Get("limit")
	limit := 50
	if limitStr != "" {
		if l, err := strconv.Atoi(limitStr); err == nil {
			limit = l
		}
	}

	graphResp, err := h.index.BuildCallGraph(symbol, file, depth, limit)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to build call graph", err.Error())
		return
	}

	writeJSON(w, http.StatusOK, graphResp)
}

// SearchSymbols performs fast search across all symbols.
func (h *Handlers) SearchSymbols(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query().Get("q")
	limitStr := r.URL.Query().Get("limit")
	limit := 30
	if limitStr != "" {
		if l, err := strconv.Atoi(limitStr); err == nil && l > 0 {
			limit = l
		}
	}

	symbols := h.index.SearchSymbols(q, limit)
	writeJSON(w, http.StatusOK, SymbolSearchResponse{
		Query:   q,
		Symbols: symbols,
	})
}

// Health returns basic server health status.
func (h *Handlers) Health(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{
		"status": "ok",
		"engine": "tracelens",
	})
}

