package ast

import (
	"bytes"
	"context"
	"fmt"
	"strings"

	sitter "github.com/smacker/go-tree-sitter"
)

// Extractor handles source code AST inspection and symbol extraction.
type Extractor struct {
	lm *LanguageManager
}

// NewExtractor creates a new Extractor instance.
func NewExtractor(lm *LanguageManager) *Extractor {
	if lm == nil {
		lm = NewLanguageManager()
	}
	return &Extractor{lm: lm}
}

// ExtractFile processes source bytes and returns extracted symbols, calls, type usages, and variable accesses.
func (e *Extractor) ExtractFile(ctx context.Context, filePath string, content []byte) (*FileAST, error) {
	lang := DetectLanguage(filePath)
	if lang == LangUnknown {
		return nil, fmt.Errorf("unsupported language for file: %s", filePath)
	}

	tree, _, err := e.lm.ParseSource(ctx, lang, content)
	if err != nil {
		return nil, err
	}
	defer tree.Close()

	root := tree.RootNode()
	lineCount := bytes.Count(content, []byte("\n")) + 1

	fileAST := &FileAST{
		File:        filePath,
		Language:    lang,
		Symbols:     make([]*Symbol, 0),
		Calls:       make([]*CallSite, 0),
		TypeUsages:  make([]*TypeUsage, 0),
		VarAccesses: make([]*VarAccess, 0),
		Imports:     make([]ImportInfo, 0),
		LineCount:   lineCount,
	}

	walker := &astWalker{
		filePath: filePath,
		lang:     lang,
		content:  content,
		fileAST:  fileAST,
		stack:    make([]*Symbol, 0),
	}

	walker.walk(root)

	return fileAST, nil
}

type astWalker struct {
	filePath string
	lang     string
	content  []byte
	fileAST  *FileAST
	stack    []*Symbol
}

func (w *astWalker) currentScope() string {
	if len(w.stack) == 0 {
		return ""
	}
	return w.stack[len(w.stack)-1].Name
}

func (w *astWalker) currentCaller() string {
	for i := len(w.stack) - 1; i >= 0; i-- {
		s := w.stack[i]
		if s.Kind == KindFunction || s.Kind == KindMethod {
			return s.Name
		}
	}
	return ""
}

func (w *astWalker) walk(node *sitter.Node) {
	if node == nil {
		return
	}

	nodeType := node.Type()
	var pushedSymbol *Symbol

	switch w.lang {
	case LangGo:
		pushedSymbol = w.handleGoNode(node, nodeType)
	case LangTypeScript, LangJavaScript:
		pushedSymbol = w.handleTSNode(node, nodeType)
	case LangC, LangCpp:
		pushedSymbol = w.handleCNode(node, nodeType)
	case LangPython:
		pushedSymbol = w.handlePyNode(node, nodeType)
	}

	if pushedSymbol != nil {
		w.stack = append(w.stack, pushedSymbol)
	}

	// Recurse into children
	childCount := int(node.ChildCount())
	for i := 0; i < childCount; i++ {
		child := node.Child(i)
		w.walk(child)
	}

	if pushedSymbol != nil {
		w.stack = w.stack[:len(w.stack)-1]
	}
}

// -----------------------------------------------------------------------------
// Go Handler
// -----------------------------------------------------------------------------

func (w *astWalker) handleGoNode(node *sitter.Node, nodeType string) *Symbol {
	switch nodeType {
	case "import_spec":
		w.extractGoImport(node)
		return nil

	case "function_declaration":
		nameNode := node.ChildByFieldName("name")
		if nameNode == nil {
			return nil
		}
		name := nameNode.Content(w.content)
		sym := &Symbol{
			ID:        fmt.Sprintf("%s:%s:%d", w.filePath, name, node.StartPoint().Row+1),
			Name:      name,
			Kind:      KindFunction,
			Category:  CategoryFunction,
			File:      w.filePath,
			Range:     nodeRange(node),
			Scope:     w.currentScope(),
			Signature: w.extractGoSignature(node),
			Doc:       w.extractLeadingDoc(node),
		}
		w.addSymbol(sym)
		return sym

	case "method_declaration":
		nameNode := node.ChildByFieldName("name")
		if nameNode == nil {
			return nil
		}
		name := nameNode.Content(w.content)
		receiver := w.extractGoReceiver(node)
		scope := receiver
		if scope == "" {
			scope = w.currentScope()
		}
		sym := &Symbol{
			ID:        fmt.Sprintf("%s:%s:%d", w.filePath, name, node.StartPoint().Row+1),
			Name:      name,
			Kind:      KindMethod,
			Category:  CategoryFunction,
			File:      w.filePath,
			Range:     nodeRange(node),
			Scope:     scope,
			Signature: w.extractGoSignature(node),
			Doc:       w.extractLeadingDoc(node),
		}
		w.addSymbol(sym)
		return sym

	case "type_spec":
		nameNode := node.ChildByFieldName("name")
		if nameNode == nil {
			return nil
		}
		name := nameNode.Content(w.content)
		kind := KindType
		typeNode := node.ChildByFieldName("type")
		if typeNode != nil {
			switch typeNode.Type() {
			case "struct_type":
				kind = KindStruct
			case "interface_type":
				kind = KindInterface
			}
		}
		sym := &Symbol{
			ID:        fmt.Sprintf("%s:%s:%d", w.filePath, name, node.StartPoint().Row+1),
			Name:      name,
			Kind:      kind,
			Category:  CategoryType,
			File:      w.filePath,
			Range:     nodeRange(node),
			Scope:     w.currentScope(),
			Signature: fmt.Sprintf("type %s", name),
			Doc:       w.extractLeadingDoc(node),
		}
		w.addSymbol(sym)
		return sym

	case "call_expression":
		w.extractGoCall(node)
		return nil
	}

	return nil
}

// -----------------------------------------------------------------------------
// TypeScript / JavaScript Handler
// -----------------------------------------------------------------------------

func (w *astWalker) handleTSNode(node *sitter.Node, nodeType string) *Symbol {
	switch nodeType {
	case "import_statement":
		w.extractTSImport(node)
		return nil

	case "function_declaration":
		nameNode := node.ChildByFieldName("name")
		if nameNode == nil {
			return nil
		}
		name := nameNode.Content(w.content)
		sym := &Symbol{
			ID:        fmt.Sprintf("%s:%s:%d", w.filePath, name, node.StartPoint().Row+1),
			Name:      name,
			Kind:      KindFunction,
			Category:  CategoryFunction,
			File:      w.filePath,
			Range:     nodeRange(node),
			Scope:     w.currentScope(),
			Signature: w.extractTSSignature(node),
			Doc:       w.extractLeadingDoc(node),
		}
		w.addSymbol(sym)
		return sym

	case "method_definition":
		nameNode := node.ChildByFieldName("name")
		if nameNode == nil {
			return nil
		}
		name := nameNode.Content(w.content)
		sym := &Symbol{
			ID:        fmt.Sprintf("%s:%s:%d", w.filePath, name, node.StartPoint().Row+1),
			Name:      name,
			Kind:      KindMethod,
			Category:  CategoryFunction,
			File:      w.filePath,
			Range:     nodeRange(node),
			Scope:     w.currentScope(),
			Signature: w.extractTSSignature(node),
			Doc:       w.extractLeadingDoc(node),
		}
		w.addSymbol(sym)
		return sym

	case "class_declaration":
		nameNode := node.ChildByFieldName("name")
		if nameNode == nil {
			return nil
		}
		name := nameNode.Content(w.content)
		sym := &Symbol{
			ID:        fmt.Sprintf("%s:%s:%d", w.filePath, name, node.StartPoint().Row+1),
			Name:      name,
			Kind:      KindClass,
			Category:  CategoryType,
			File:      w.filePath,
			Range:     nodeRange(node),
			Scope:     w.currentScope(),
			Signature: fmt.Sprintf("class %s", name),
			Doc:       w.extractLeadingDoc(node),
		}
		w.addSymbol(sym)
		return sym

	case "interface_declaration":
		nameNode := node.ChildByFieldName("name")
		if nameNode == nil {
			return nil
		}
		name := nameNode.Content(w.content)
		sym := &Symbol{
			ID:        fmt.Sprintf("%s:%s:%d", w.filePath, name, node.StartPoint().Row+1),
			Name:      name,
			Kind:      KindInterface,
			Category:  CategoryType,
			File:      w.filePath,
			Range:     nodeRange(node),
			Scope:     w.currentScope(),
			Signature: fmt.Sprintf("interface %s", name),
			Doc:       w.extractLeadingDoc(node),
		}
		w.addSymbol(sym)
		return sym

	case "type_alias_declaration":
		nameNode := node.ChildByFieldName("name")
		if nameNode == nil {
			return nil
		}
		name := nameNode.Content(w.content)
		sym := &Symbol{
			ID:        fmt.Sprintf("%s:%s:%d", w.filePath, name, node.StartPoint().Row+1),
			Name:      name,
			Kind:      KindType,
			Category:  CategoryType,
			File:      w.filePath,
			Range:     nodeRange(node),
			Scope:     w.currentScope(),
			Signature: fmt.Sprintf("type %s", name),
			Doc:       w.extractLeadingDoc(node),
		}
		w.addSymbol(sym)
		return sym

	case "variable_declarator":
		nameNode := node.ChildByFieldName("name")
		valNode := node.ChildByFieldName("value")
		if nameNode != nil && valNode != nil {
			valType := valNode.Type()
			if valType == "arrow_function" || valType == "function_expression" {
				name := nameNode.Content(w.content)
				sym := &Symbol{
					ID:        fmt.Sprintf("%s:%s:%d", w.filePath, name, node.StartPoint().Row+1),
					Name:      name,
					Kind:      KindFunction,
					Category:  CategoryFunction,
					File:      w.filePath,
					Range:     nodeRange(node),
					Scope:     w.currentScope(),
					Signature: fmt.Sprintf("const %s = %s", name, valType),
					Doc:       w.extractLeadingDoc(node),
				}
				w.addSymbol(sym)
				return sym
			}
		}

	case "call_expression":
		w.extractTSCall(node)
		return nil
	}

	return nil
}

// -----------------------------------------------------------------------------
// C and C++ Handler (CPython Core)
// -----------------------------------------------------------------------------

func (w *astWalker) handleCNode(node *sitter.Node, nodeType string) *Symbol {
	switch nodeType {
	case "function_definition":
		name := w.extractCFunctionName(node)
		if name == "" {
			return nil
		}
		kind := KindFunction
		scope := w.currentScope()
		if scope != "" {
			kind = KindMethod
		}
		sym := &Symbol{
			ID:        fmt.Sprintf("%s:%s:%d", w.filePath, name, node.StartPoint().Row+1),
			Name:      name,
			Kind:      kind,
			Category:  CategoryFunction,
			File:      w.filePath,
			Range:     nodeRange(node),
			Scope:     scope,
			Signature: w.extractCSignature(node),
			Doc:       w.extractLeadingDoc(node),
		}
		w.addSymbol(sym)
		return sym

	case "struct_specifier", "union_specifier", "enum_specifier", "class_specifier":
		nameNode := node.ChildByFieldName("name")
		if nameNode == nil {
			return nil
		}
		name := nameNode.Content(w.content)
		kind := KindStruct
		switch nodeType {
		case "class_specifier":
			kind = KindClass
		case "union_specifier":
			kind = KindUnion
		case "enum_specifier":
			kind = KindEnum
		}

		sym := &Symbol{
			ID:        fmt.Sprintf("%s:%s:%d", w.filePath, name, node.StartPoint().Row+1),
			Name:      name,
			Kind:      kind,
			Category:  CategoryType,
			File:      w.filePath,
			Range:     nodeRange(node),
			Scope:     w.currentScope(),
			Signature: fmt.Sprintf("%s %s", strings.TrimSuffix(nodeType, "_specifier"), name),
			Doc:       w.extractLeadingDoc(node),
		}
		w.addSymbol(sym)
		return sym

	case "type_definition":
		// typedef struct ... PyObject;
		nameNode := node.ChildByFieldName("declarator")
		if nameNode == nil {
			// fallback search for type_identifier child
			for i := 0; i < int(node.ChildCount()); i++ {
				c := node.Child(i)
				if c.Type() == "type_identifier" {
					nameNode = c
					break
				}
			}
		}
		if nameNode != nil {
			name := nameNode.Content(w.content)
			sym := &Symbol{
				ID:        fmt.Sprintf("%s:%s:%d", w.filePath, name, node.StartPoint().Row+1),
				Name:      name,
				Kind:      KindTypedef,
				Category:  CategoryType,
				File:      w.filePath,
				Range:     nodeRange(node),
				Scope:     w.currentScope(),
				Signature: fmt.Sprintf("typedef ... %s", name),
				Doc:       w.extractLeadingDoc(node),
			}
			w.addSymbol(sym)
			return sym
		}

	case "preproc_def", "preproc_function_def":
		nameNode := node.ChildByFieldName("name")
		if nameNode != nil {
			name := nameNode.Content(w.content)
			sym := &Symbol{
				ID:        fmt.Sprintf("%s:%s:%d", w.filePath, name, node.StartPoint().Row+1),
				Name:      name,
				Kind:      KindMacro,
				Category:  CategoryVariable,
				File:      w.filePath,
				Range:     nodeRange(node),
				Scope:     w.currentScope(),
				Signature: fmt.Sprintf("#define %s", name),
				Doc:       w.extractLeadingDoc(node),
			}
			w.addSymbol(sym)
			return sym
		}

	case "declaration":
		// Check for global variable / PyTypeObject descriptors: PyTypeObject PyLong_Type = ...;
		if len(w.stack) == 0 {
			declNode := node.ChildByFieldName("declarator")
			if declNode != nil && declNode.Type() == "init_declarator" {
				varNode := declNode.ChildByFieldName("declarator")
				if varNode != nil {
					name := varNode.Content(w.content)
					typeNode := node.ChildByFieldName("type")
					sig := name
					if typeNode != nil {
						sig = fmt.Sprintf("%s %s", typeNode.Content(w.content), name)
					}
					sym := &Symbol{
						ID:        fmt.Sprintf("%s:%s:%d", w.filePath, name, node.StartPoint().Row+1),
						Name:      name,
						Kind:      KindVariable,
						Category:  CategoryVariable,
						File:      w.filePath,
						Range:     nodeRange(node),
						Signature: sig,
						Doc:       w.extractLeadingDoc(node),
					}
					w.addSymbol(sym)
					return sym
				}
			}
		}

	case "type_identifier":
		// Record Type Usage (e.g. PyObject*, PyTypeObject)
		caller := w.currentCaller()
		if caller != "" {
			typeName := node.Content(w.content)
			if !isPrimitiveCType(typeName) {
				w.fileAST.TypeUsages = append(w.fileAST.TypeUsages, &TypeUsage{
					UserSymbol: caller,
					TypeName:   typeName,
					File:       w.filePath,
					Range:      nodeRange(node),
				})
			}
		}

	case "call_expression":
		w.extractCCall(node)
		return nil

	case "field_expression":
		w.extractCField(node)
		return nil
	}

	return nil
}

func isPrimitiveCType(t string) bool {
	switch t {
	case "int", "char", "void", "float", "double", "short", "long", "unsigned", "signed", "size_t", "bool":
		return true
	default:
		return false
	}
}

func (w *astWalker) extractCFunctionName(node *sitter.Node) string {
	declNode := node.ChildByFieldName("declarator")
	for declNode != nil {
		switch declNode.Type() {
		case "function_declarator":
			inner := declNode.ChildByFieldName("declarator")
			if inner != nil {
				return inner.Content(w.content)
			}
			return ""
		case "pointer_declarator":
			declNode = declNode.ChildByFieldName("declarator")
		default:
			return declNode.Content(w.content)
		}
	}
	return ""
}

func (w *astWalker) extractCSignature(node *sitter.Node) string {
	bodyNode := node.ChildByFieldName("body")
	start := node.StartByte()
	var end uint32
	if bodyNode != nil {
		end = bodyNode.StartByte()
	} else {
		end = node.EndByte()
	}
	if end > start && int(end) <= len(w.content) {
		return strings.TrimSpace(string(w.content[start:end]))
	}
	return ""
}

func (w *astWalker) extractCCall(node *sitter.Node) {
	fnNode := node.ChildByFieldName("function")
	if fnNode == nil {
		return
	}

	caller := w.currentCaller()
	var callee, receiver string

	switch fnNode.Type() {
	case "identifier":
		callee = fnNode.Content(w.content)
	case "field_expression":
		argNode := fnNode.ChildByFieldName("argument")
		fieldNode := fnNode.ChildByFieldName("field")
		if fieldNode != nil {
			callee = fieldNode.Content(w.content)
		}
		if argNode != nil {
			receiver = argNode.Content(w.content)
		}
	}

	if callee != "" {
		w.fileAST.Calls = append(w.fileAST.Calls, &CallSite{
			Caller:   caller,
			Callee:   callee,
			Receiver: receiver,
			File:     w.filePath,
			Range:    nodeRange(node),
		})
	}
}

func (w *astWalker) extractCField(node *sitter.Node) {
	caller := w.currentCaller()
	if caller == "" {
		return
	}
	argNode := node.ChildByFieldName("argument")
	if argNode != nil && argNode.Type() == "identifier" {
		argName := argNode.Content(w.content)
		// Check for global descriptor or macro access like PyLong_Type or _Py_NoneStruct
		if strings.HasPrefix(argName, "Py") || strings.HasPrefix(argName, "_Py") {
			w.fileAST.VarAccesses = append(w.fileAST.VarAccesses, &VarAccess{
				UserSymbol: caller,
				VarName:    argName,
				File:       w.filePath,
				Range:      nodeRange(node),
			})
		}
	}
}

// -----------------------------------------------------------------------------
// Python Handler
// -----------------------------------------------------------------------------

func (w *astWalker) handlePyNode(node *sitter.Node, nodeType string) *Symbol {
	switch nodeType {
	case "class_definition":
		nameNode := node.ChildByFieldName("name")
		if nameNode == nil {
			return nil
		}
		name := nameNode.Content(w.content)
		sym := &Symbol{
			ID:        fmt.Sprintf("%s:%s:%d", w.filePath, name, node.StartPoint().Row+1),
			Name:      name,
			Kind:      KindClass,
			Category:  CategoryType,
			File:      w.filePath,
			Range:     nodeRange(node),
			Scope:     w.currentScope(),
			Signature: fmt.Sprintf("class %s", name),
			Doc:       w.extractLeadingDoc(node),
		}
		w.addSymbol(sym)
		return sym

	case "function_definition":
		nameNode := node.ChildByFieldName("name")
		if nameNode == nil {
			return nil
		}
		name := nameNode.Content(w.content)
		kind := KindFunction
		scope := w.currentScope()
		if scope != "" {
			kind = KindMethod
		}
		sym := &Symbol{
			ID:        fmt.Sprintf("%s:%s:%d", w.filePath, name, node.StartPoint().Row+1),
			Name:      name,
			Kind:      kind,
			Category:  CategoryFunction,
			File:      w.filePath,
			Range:     nodeRange(node),
			Scope:     scope,
			Signature: w.extractPySignature(node),
			Doc:       w.extractLeadingDoc(node),
		}
		w.addSymbol(sym)
		return sym

	case "expression_statement":
		// Check for module-level variable assignment: FOO = 42
		if len(w.stack) == 0 {
			for i := 0; i < int(node.ChildCount()); i++ {
				child := node.Child(i)
				if child.Type() == "assignment" {
					leftNode := child.ChildByFieldName("left")
					if leftNode != nil && leftNode.Type() == "identifier" {
						name := leftNode.Content(w.content)
						sym := &Symbol{
							ID:        fmt.Sprintf("%s:%s:%d", w.filePath, name, child.StartPoint().Row+1),
							Name:      name,
							Kind:      KindVariable,
							Category:  CategoryVariable,
							File:      w.filePath,
							Range:     nodeRange(child),
							Signature: name,
							Doc:       w.extractLeadingDoc(node),
						}
						w.addSymbol(sym)
						return sym
					}
				}
			}
		}

	case "type":
		// Type annotations e.g. def foo(x: int) -> MyClass:
		caller := w.currentCaller()
		if caller != "" {
			typeName := node.Content(w.content)
			w.fileAST.TypeUsages = append(w.fileAST.TypeUsages, &TypeUsage{
				UserSymbol: caller,
				TypeName:   typeName,
				File:       w.filePath,
				Range:      nodeRange(node),
			})
		}

	case "call":
		w.extractPyCall(node)
		return nil
	}

	return nil
}

func (w *astWalker) extractPySignature(node *sitter.Node) string {
	bodyNode := node.ChildByFieldName("body")
	start := node.StartByte()
	var end uint32
	if bodyNode != nil {
		end = bodyNode.StartByte()
	} else {
		end = node.EndByte()
	}
	if end > start && int(end) <= len(w.content) {
		return strings.TrimSpace(string(w.content[start:end]))
	}
	return ""
}

func (w *astWalker) extractPyCall(node *sitter.Node) {
	fnNode := node.ChildByFieldName("function")
	if fnNode == nil {
		return
	}

	caller := w.currentCaller()
	var callee, receiver string

	switch fnNode.Type() {
	case "identifier":
		callee = fnNode.Content(w.content)
	case "attribute":
		attrNode := fnNode.ChildByFieldName("attribute")
		objNode := fnNode.ChildByFieldName("object")
		if attrNode != nil {
			callee = attrNode.Content(w.content)
		}
		if objNode != nil {
			receiver = objNode.Content(w.content)
		}
	}

	if callee != "" {
		w.fileAST.Calls = append(w.fileAST.Calls, &CallSite{
			Caller:   caller,
			Callee:   callee,
			Receiver: receiver,
			File:     w.filePath,
			Range:    nodeRange(node),
		})
	}
}

// -----------------------------------------------------------------------------
// Common Helpers
// -----------------------------------------------------------------------------

func (w *astWalker) addSymbol(sym *Symbol) {
	if len(w.stack) > 0 {
		parent := w.stack[len(w.stack)-1]
		parent.Children = append(parent.Children, sym)
	}
	w.fileAST.Symbols = append(w.fileAST.Symbols, sym)
}

func (w *astWalker) extractGoReceiver(node *sitter.Node) string {
	rcvNode := node.ChildByFieldName("receiver")
	if rcvNode == nil {
		return ""
	}
	raw := rcvNode.Content(w.content)
	raw = strings.Trim(raw, "()")
	parts := strings.Fields(raw)
	if len(parts) >= 2 {
		typ := parts[len(parts)-1]
		return strings.TrimPrefix(typ, "*")
	}
	return strings.TrimPrefix(raw, "*")
}

func (w *astWalker) extractGoSignature(node *sitter.Node) string {
	bodyNode := node.ChildByFieldName("body")
	start := node.StartByte()
	var end uint32
	if bodyNode != nil {
		end = bodyNode.StartByte()
	} else {
		end = node.EndByte()
	}
	if end > start && int(end) <= len(w.content) {
		return strings.TrimSpace(string(w.content[start:end]))
	}
	return ""
}

func (w *astWalker) extractTSSignature(node *sitter.Node) string {
	bodyNode := node.ChildByFieldName("body")
	start := node.StartByte()
	var end uint32
	if bodyNode != nil {
		end = bodyNode.StartByte()
	} else {
		end = node.EndByte()
	}
	if end > start && int(end) <= len(w.content) {
		return strings.TrimSpace(string(w.content[start:end]))
	}
	return ""
}

func (w *astWalker) extractLeadingDoc(node *sitter.Node) string {
	prev := node.PrevSibling()
	var comments []string
	for prev != nil && (prev.Type() == "comment" || prev.Type() == "line_comment" || prev.Type() == "block_comment") {
		text := strings.TrimSpace(prev.Content(w.content))
		comments = append([]string{text}, comments...)
		prev = prev.PrevSibling()
	}
	return strings.Join(comments, "\n")
}

func (w *astWalker) extractGoImport(node *sitter.Node) {
	pathNode := node.ChildByFieldName("path")
	if pathNode == nil {
		return
	}
	path := strings.Trim(pathNode.Content(w.content), "\"")
	var alias string
	aliasNode := node.ChildByFieldName("name")
	if aliasNode != nil {
		alias = aliasNode.Content(w.content)
	}

	w.fileAST.Imports = append(w.fileAST.Imports, ImportInfo{
		Alias: alias,
		Path:  path,
		Range: nodeRange(node),
	})
}

func (w *astWalker) extractTSImport(node *sitter.Node) {
	sourceNode := node.ChildByFieldName("source")
	if sourceNode == nil {
		return
	}
	path := strings.Trim(sourceNode.Content(w.content), "\"'")
	w.fileAST.Imports = append(w.fileAST.Imports, ImportInfo{
		Path:  path,
		Range: nodeRange(node),
	})
}

func (w *astWalker) extractGoCall(node *sitter.Node) {
	fnNode := node.ChildByFieldName("function")
	if fnNode == nil {
		return
	}

	caller := w.currentCaller()
	var callee, receiver string

	switch fnNode.Type() {
	case "identifier":
		callee = fnNode.Content(w.content)
	case "selector_expression":
		fieldNode := fnNode.ChildByFieldName("field")
		operandNode := fnNode.ChildByFieldName("operand")
		if fieldNode != nil {
			callee = fieldNode.Content(w.content)
		}
		if operandNode != nil {
			receiver = operandNode.Content(w.content)
		}
	}

	if callee != "" {
		w.fileAST.Calls = append(w.fileAST.Calls, &CallSite{
			Caller:   caller,
			Callee:   callee,
			Receiver: receiver,
			File:     w.filePath,
			Range:    nodeRange(node),
		})
	}
}

func (w *astWalker) extractTSCall(node *sitter.Node) {
	fnNode := node.ChildByFieldName("function")
	if fnNode == nil {
		return
	}

	caller := w.currentCaller()
	var callee, receiver string

	switch fnNode.Type() {
	case "identifier":
		callee = fnNode.Content(w.content)
	case "member_expression":
		propNode := fnNode.ChildByFieldName("property")
		objNode := fnNode.ChildByFieldName("object")
		if propNode != nil {
			callee = propNode.Content(w.content)
		}
		if objNode != nil {
			receiver = objNode.Content(w.content)
		}
	}

	if callee != "" {
		w.fileAST.Calls = append(w.fileAST.Calls, &CallSite{
			Caller:   caller,
			Callee:   callee,
			Receiver: receiver,
			File:     w.filePath,
			Range:    nodeRange(node),
		})
	}
}

func nodeRange(n *sitter.Node) Range {
	start := n.StartPoint()
	end := n.EndPoint()
	return Range{
		Start: Position{
			Line:   int(start.Row) + 1,
			Column: int(start.Column) + 1,
			Offset: int(n.StartByte()),
		},
		End: Position{
			Line:   int(end.Row) + 1,
			Column: int(end.Column) + 1,
			Offset: int(n.EndByte()),
		},
	}
}
