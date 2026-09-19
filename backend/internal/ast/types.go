package ast

// SymbolKind represents the classification of a symbol.
type SymbolKind string

const (
	// Control flow / Invokable
	KindFunction SymbolKind = "function"
	KindMethod   SymbolKind = "method"

	// Datatypes & Structures
	KindStruct    SymbolKind = "struct"
	KindTypedef   SymbolKind = "typedef"
	KindUnion     SymbolKind = "union"
	KindEnum      SymbolKind = "enum"
	KindClass     SymbolKind = "class"
	KindInterface SymbolKind = "interface"
	KindType      SymbolKind = "type"

	// Variables, Objects & Macros
	KindVariable SymbolKind = "variable"
	KindConstant SymbolKind = "constant"
	KindMacro    SymbolKind = "macro"
	KindField    SymbolKind = "field"

	// Organization & General
	KindNamespace SymbolKind = "namespace"
	KindModule    SymbolKind = "module"
	KindImport    SymbolKind = "import"
	KindCall      SymbolKind = "call"
)

// SymbolCategory classifies symbols for graph layout and filtering.
type SymbolCategory string

const (
	CategoryFunction SymbolCategory = "function"
	CategoryType     SymbolCategory = "type"
	CategoryVariable SymbolCategory = "variable"
	CategoryOther    SymbolCategory = "other"
)

// GetCategory returns the broad category for a given symbol kind.
func GetCategory(kind SymbolKind) SymbolCategory {
	switch kind {
	case KindFunction, KindMethod:
		return CategoryFunction
	case KindStruct, KindTypedef, KindUnion, KindEnum, KindClass, KindInterface, KindType:
		return CategoryType
	case KindVariable, KindConstant, KindMacro, KindField:
		return CategoryVariable
	default:
		return CategoryOther
	}
}

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
	ID        string         `json:"id"`
	Name      string         `json:"name"`
	Kind      SymbolKind     `json:"kind"`
	Category  SymbolCategory `json:"category"`
	File      string         `json:"file"`
	Range     Range          `json:"range"`
	Scope     string         `json:"scope,omitempty"`     // Enclosing namespace, class, or parent
	Signature string         `json:"signature,omitempty"` // Full signature or definition header
	Doc       string         `json:"doc,omitempty"`       // Associated comments or docstrings
	Children  []*Symbol      `json:"children,omitempty"` // Nested symbols (methods, fields, inner declarations)
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

// TypeUsage represents a reference to a datatype / struct / class (e.g. in parameter, return type, cast, or field).
type TypeUsage struct {
	UserSymbol string `json:"userSymbol"` // Enclosing function, method, or struct
	TypeName   string `json:"typeName"`   // Referenced datatype / struct / class name
	File       string `json:"file"`
	Range      Range  `json:"range"`
}

// VarAccess represents a reference / read / write of a global variable, constant, macro, or PyObject descriptor.
type VarAccess struct {
	UserSymbol string `json:"userSymbol"` // Enclosing function or method
	VarName    string `json:"varName"`    // Referenced variable / macro / object name
	File       string `json:"file"`
	Range      Range  `json:"range"`
}

// ImportInfo records an imported package, module, or header file.
type ImportInfo struct {
	Alias string `json:"alias,omitempty"`
	Path  string `json:"path"`
	Range Range  `json:"range"`
}

// FileAST encapsulates all extracted AST elements for a single file.
type FileAST struct {
	File        string         `json:"file"`
	Language    string         `json:"language"`
	Symbols     []*Symbol      `json:"symbols"`
	Calls       []*CallSite    `json:"calls"`
	TypeUsages  []*TypeUsage   `json:"typeUsages"`
	VarAccesses []*VarAccess   `json:"varAccesses"`
	Imports     []ImportInfo   `json:"imports"`
	LineCount   int            `json:"lineCount"`
}
