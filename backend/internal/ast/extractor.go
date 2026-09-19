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

// ExtractFile processes source bytes and returns extracted symbols, calls, and imports.
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
		File:      filePath,
		Language:  lang,
		Symbols:   make([]*Symbol, 0),
		Calls:     make([]*CallSite, 0),
		Imports:   make([]ImportInfo, 0),
		LineCount: lineCount,
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
			File:      w.filePath,
			Range:     nodeRange(node),
			Scope:     w.currentScope(),
			Signature: fmt.Sprintf("type %s", name),
			Doc:       w.extractLeadingDoc(node),
		}
		w.addSymbol(sym)
		return sym

	case "variable_declarator":
		// Check for arrow function / function expression assignment: const foo = () => ...
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

