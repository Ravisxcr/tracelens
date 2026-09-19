package ast

// SymbolKind represents the classification of a symbol.
type SymbolKind string

const (
	KindFunction  SymbolKind = "function"
	KindMethod    SymbolKind = "method"
	KindType      SymbolKind = "type"
	KindStruct    SymbolKind = "struct"
	KindInterface SymbolKind = "interface"
	KindClass     SymbolKind = "class"
	KindVariable  SymbolKind = "variable"
	KindConstant  SymbolKind = "constant"
	KindImport    SymbolKind = "import"
	KindCall      SymbolKind = "call"
)

// Position represents a 1-indexed line and column position within a source file.
type Position struct {
	Line   int `json:"line"`   // 1-indexed
	Column int `json:"column"` // 1-indexed
	Offset int `json:"offset"` // 0-indexed byte offset
}

// Range defines the start and end span of a code element.
type Range struct {
	Start Position `json:"start"`
	End   Position `json:"end"`
}

// Symbol represents an extracted code definition (function, method, type, etc.).
type Symbol struct {
	ID        string     `json:"id"`
	Name      string     `json:"name"`
	Kind      SymbolKind `json:"kind"`
	File      string     `json:"file"`
	Range     Range      `json:"range"`
	Scope     string     `json:"scope,omitempty"`     // Enclosing namespace, struct, or parent symbol
	Signature string     `json:"signature,omitempty"` // Full signature or definition header
	Doc       string     `json:"doc,omitempty"`       // Associated comments or docstrings
	Children  []*Symbol  `json:"children,omitempty"` // Nested symbols (methods, fields, inner declarations)
}

// CallSite represents an invocation / call expression found inside code.
type CallSite struct {
	Caller    string `json:"caller"`             // Enclosing symbol ID or name
	Callee    string `json:"callee"`             // Called function / method name
	Receiver  string `json:"receiver,omitempty"` // Receiver identifier (e.g. "scanner" in "scanner.Walk()")
	File      string `json:"file"`
	Range     Range  `json:"range"`
	IsDynamic bool   `json:"isDynamic,omitempty"`
}

// ImportInfo records an imported package or module.
type ImportInfo struct {
	Alias string `json:"alias,omitempty"`
	Path  string `json:"path"`
	Range Range  `json:"range"`
}

// FileAST encapsulates all extracted AST elements for a single file.
type FileAST struct {
	File      string       `json:"file"`
	Language  string       `json:"language"`
	Symbols   []*Symbol    `json:"symbols"`
	Calls     []*CallSite  `json:"calls"`
	Imports   []ImportInfo `json:"imports"`
	LineCount int          `json:"lineCount"`
}

