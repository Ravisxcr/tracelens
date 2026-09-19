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

	symMap := make(map[string]*ast.Symbol)
	for _, sym := range fileAST.Symbols {
		symMap[sym.Name] = sym
	}

	if _, found := symMap["Greeter"]; !found {
		t.Errorf("Greeter struct not found")
	}
	if _, found := symMap["Greet"]; !found {
		t.Errorf("Greet method not found")
	}
}

func TestExtractCFile(t *testing.T) {
	samplePath := filepath.Join("..", "testdata", "sample.c")
	content, err := os.ReadFile(samplePath)
	if err != nil {
		t.Fatalf("Failed to read sample.c: %v", err)
	}

	extractor := ast.NewExtractor(nil)
	ctx := context.Background()

	fileAST, err := extractor.ExtractFile(ctx, "sample.c", content)
	if err != nil {
		t.Fatalf("ExtractFile error: %v", err)
	}

	if fileAST.Language != ast.LangC {
		t.Errorf("Expected language 'c', got '%s'", fileAST.Language)
	}

	symMap := make(map[string]*ast.Symbol)
	for _, sym := range fileAST.Symbols {
		symMap[sym.Name] = sym
	}

	// Verify Datatypes
	if sym, found := symMap["PyObject"]; !found || sym.Category != ast.CategoryType {
		t.Errorf("PyObject typedef not properly extracted as CategoryType")
	}
	if sym, found := symMap["PyTypeObject"]; !found || sym.Category != ast.CategoryType {
		t.Errorf("PyTypeObject typedef not properly extracted as CategoryType")
	}

	// Verify Global Objects / Variables
	if sym, found := symMap["PyLong_Type"]; !found || sym.Category != ast.CategoryVariable {
		t.Errorf("PyLong_Type global object not extracted as CategoryVariable")
	}

	// Verify Macros
	if sym, found := symMap["Py_INCREF"]; !found || sym.Kind != ast.KindMacro {
		t.Errorf("Py_INCREF macro not extracted")
	}

	// Verify Functions
	if sym, found := symMap["PyLong_FromLong"]; !found || sym.Category != ast.CategoryFunction {
		t.Errorf("PyLong_FromLong function not extracted")
	}
	if sym, found := symMap["_PyLong_New"]; !found || sym.Category != ast.CategoryFunction {
		t.Errorf("_PyLong_New function not extracted")
	}

	// Verify Type Usages (e.g. PyObject, PyTypeObject used in function)
	typeNames := make(map[string]bool)
	for _, tu := range fileAST.TypeUsages {
		typeNames[tu.TypeName] = true
	}
	if !typeNames["PyObject"] && !typeNames["PyTypeObject"] {
		t.Errorf("Expected type usage of PyObject or PyTypeObject")
	}
}

func TestExtractPythonFile(t *testing.T) {
	samplePath := filepath.Join("..", "testdata", "sample.py")
	content, err := os.ReadFile(samplePath)
	if err != nil {
		t.Fatalf("Failed to read sample.py: %v", err)
	}

	extractor := ast.NewExtractor(nil)
	ctx := context.Background()

	fileAST, err := extractor.ExtractFile(ctx, "sample.py", content)
	if err != nil {
		t.Fatalf("ExtractFile error: %v", err)
	}

	if fileAST.Language != ast.LangPython {
		t.Errorf("Expected language 'python', got '%s'", fileAST.Language)
	}

	symMap := make(map[string]*ast.Symbol)
	for _, sym := range fileAST.Symbols {
		symMap[sym.Name] = sym
	}

	// Verify Class (Datatype)
	if sym, found := symMap["IntObject"]; !found || sym.Kind != ast.KindClass {
		t.Errorf("IntObject class not extracted")
	}

	// Verify Variable
	if sym, found := symMap["DEFAULT_FLAGS"]; !found || sym.Category != ast.CategoryVariable {
		t.Errorf("DEFAULT_FLAGS global variable not extracted")
	}

	// Verify Function and Method
	if sym, found := symMap["create_int"]; !found || sym.Kind != ast.KindFunction {
		t.Errorf("create_int function not extracted")
	}
	if sym, found := symMap["to_string"]; !found || sym.Kind != ast.KindMethod {
		t.Errorf("to_string method not extracted")
	}
}
