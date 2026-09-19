package ast_test

import (
	"context"
	"os"
	"path/filepath"
	"testing"

	"tracelens/backend/internal/ast"
)

func TestExtractGoFile(t *testing.T) {
	samplePath := filepath.Join("..", "testdata", "sample.go")
	content, err := os.ReadFile(samplePath)
	if err != nil {
		t.Fatalf("Failed to read sample.go: %v", err)
	}

	extractor := ast.NewExtractor(nil)
	ctx := context.Background()

	fileAST, err := extractor.ExtractFile(ctx, "sample.go", content)
	if err != nil {
		t.Fatalf("ExtractFile error: %v", err)
	}

	if fileAST.Language != ast.LangGo {
		t.Errorf("Expected language 'go', got '%s'", fileAST.Language)
	}

	// Verify expected symbols
	symMap := make(map[string]*ast.Symbol)
	for _, sym := range fileAST.Symbols {
		symMap[sym.Name] = sym
	}

	expectedSymbols := []struct {
		name string
		kind ast.SymbolKind
	}{
		{"Greeter", ast.KindStruct},
		{"NewGreeter", ast.KindFunction},
		{"Greet", ast.KindMethod},
		{"formatName", ast.KindMethod},
		{"RunGreeting", ast.KindFunction},
	}

	for _, exp := range expectedSymbols {
		sym, found := symMap[exp.name]
		if !found {
			t.Errorf("Expected symbol '%s' not found in extracted symbols", exp.name)
			continue
		}
		if sym.Kind != exp.kind {
			t.Errorf("Symbol '%s': expected kind '%s', got '%s'", exp.name, exp.kind, sym.Kind)
		}
	}

	// Check calls
	callNames := make(map[string]bool)
	for _, call := range fileAST.Calls {
		callNames[call.Callee] = true
	}

	if !callNames["NewGreeter"] {
		t.Errorf("Expected call to 'NewGreeter' not found")
	}
	if !callNames["Greet"] {
		t.Errorf("Expected call to 'Greet' not found")
	}
	if !callNames["formatName"] {
		t.Errorf("Expected call to 'formatName' not found")
	}
}

func TestExtractTypeScriptFile(t *testing.T) {
	samplePath := filepath.Join("..", "testdata", "sample.ts")
	content, err := os.ReadFile(samplePath)
	if err != nil {
		t.Fatalf("Failed to read sample.ts: %v", err)
	}

	extractor := ast.NewExtractor(nil)
	ctx := context.Background()

	fileAST, err := extractor.ExtractFile(ctx, "sample.ts", content)
	if err != nil {
		t.Fatalf("ExtractFile error: %v", err)
	}

	if fileAST.Language != ast.LangTypeScript {
		t.Errorf("Expected language 'typescript', got '%s'", fileAST.Language)
	}

	symMap := make(map[string]*ast.Symbol)
	for _, sym := range fileAST.Symbols {
		symMap[sym.Name] = sym
	}

	expectedSymbols := []struct {
		name string
		kind ast.SymbolKind
	}{
		{"Config", ast.KindInterface},
		{"ServiceClient", ast.KindClass},
		{"fetchData", ast.KindMethod},
		{"buildUrl", ast.KindMethod},
		{"executeRequest", ast.KindMethod},
		{"runService", ast.KindFunction},
	}

	for _, exp := range expectedSymbols {
		sym, found := symMap[exp.name]
		if !found {
			t.Errorf("Expected symbol '%s' not found in extracted symbols", exp.name)
			continue
		}
		if sym.Kind != exp.kind {
			t.Errorf("Symbol '%s': expected kind '%s', got '%s'", exp.name, exp.kind, sym.Kind)
		}
	}

	// Check calls
	callNames := make(map[string]bool)
	for _, call := range fileAST.Calls {
		callNames[call.Callee] = true
	}

	if !callNames["fetchData"] {
		t.Errorf("Expected call to 'fetchData' not found")
	}
	if !callNames["buildUrl"] {
		t.Errorf("Expected call to 'buildUrl' not found")
	}
	if !callNames["executeRequest"] {
		t.Errorf("Expected call to 'executeRequest' not found")
	}
}

