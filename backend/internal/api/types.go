package api

import (
	"tracelens/backend/internal/ast"
	"tracelens/backend/internal/indexer"
)

// OpenWorkspaceRequest payload.
type OpenWorkspaceRequest struct {
	Path string `json:"path"`
}

// OpenWorkspaceResponse payload.
type OpenWorkspaceResponse struct {
	Path  string             `json:"path"`
	Stats indexer.IndexStats `json:"stats"`
}

// DefinitionResponse payload.
type DefinitionResponse struct {
	Query       string        `json:"query"`
	Definitions []*ast.Symbol `json:"definitions"`
}

// ReferencesResponse payload.
type ReferencesResponse struct {
	Symbol     string          `json:"symbol"`
	References []*ast.CallSite `json:"references"`
}

// SymbolSearchResponse payload.
type SymbolSearchResponse struct {
	Query   string        `json:"query"`
	Symbols []*ast.Symbol `json:"symbols"`
}

// ErrorResponse for consistent API error reporting.
type ErrorResponse struct {
	Error   string `json:"error"`
	Details string `json:"details,omitempty"`
}

