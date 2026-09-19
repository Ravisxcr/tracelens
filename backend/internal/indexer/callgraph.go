package indexer

import (
	"fmt"
	"strings"

	"tracelens/backend/internal/ast"
)

// GraphNodeData holds symbol metadata for React Flow node representation.
type GraphNodeData struct {
	Label       string            `json:"label"`
	Kind        ast.SymbolKind     `json:"kind"`
	Category    ast.SymbolCategory `json:"category"` // "function", "type", "variable"
	File        string            `json:"file"`
	Line        int               `json:"line"`
	Signature   string            `json:"signature,omitempty"`
	Scope       string            `json:"scope,omitempty"`
	IsRoot      bool              `json:"isRoot"`
	CallerCount int               `json:"callerCount"`
	CalleeCount int               `json:"calleeCount"`
}

// NodePosition coordinates for React Flow rendering.
type NodePosition struct {
	X float64 `json:"x"`
	Y float64 `json:"y"`
}

// GraphNode is compatible with @xyflow/react Node interface.
type GraphNode struct {
	ID       string        `json:"id"`
	Type     string        `json:"type"` // "customSymbol"
	Data     GraphNodeData `json:"data"`
	Position NodePosition  `json:"position"`
}

// GraphEdge is compatible with @xyflow/react Edge interface.
type GraphEdge struct {
	ID           string `json:"id"`
	Source       string `json:"source"`
	Target       string `json:"target"`
	Relationship string `json:"relationship"` // "call", "type", "variable"
	Label        string `json:"label,omitempty"`
	Animated     bool   `json:"animated"`
}

// CallGraphResponse returns categorized nodes and edges ready for React Flow.
type CallGraphResponse struct {
	RootSymbol string         `json:"rootSymbol"`
	Nodes      []GraphNode    `json:"nodes"`
	Edges      []GraphEdge    `json:"edges"`
	Counts     map[string]int `json:"counts"`
}

// BuildCallGraph constructs a collision-free multi-column graph separating functions, datatypes, and variables.
func (idx *Index) BuildCallGraph(rootSymbol, file string, depth int) (*CallGraphResponse, error) {
	idx.mu.RLock()
	defer idx.mu.RUnlock()

	rootDefs := idx.FindDefinition(file, rootSymbol, 0, 0)
	var rootDef *ast.Symbol
	if len(rootDefs) > 0 {
		rootDef = rootDefs[0]
	} else {
		// Fallback synthetic root
		rootDef = &ast.Symbol{
			ID:       fmt.Sprintf("synth:%s", rootSymbol),
			Name:     rootSymbol,
			Kind:     ast.KindFunction,
			Category: ast.CategoryFunction,
			File:     file,
			Range:    ast.Range{Start: ast.Position{Line: 1, Column: 1}},
		}
	}

	nodesMap := make(map[string]GraphNode)
	edgesMap := make(map[string]GraphEdge)

	// Ingoing callers
	incomingCalls := idx.callsByCallee[rootSymbol]
	// Outgoing callee calls
	outgoingCalls := idx.callsByCaller[rootSymbol]
	// Referenced datatypes
	typeUsages := idx.typeUsagesBySymbol[rootSymbol]
	// Referenced variables / objects / macros
	varAccesses := idx.varAccessesBySymbol[rootSymbol]

	const targetY = 300.0
	const colSpacingX = 460.0
	const nodeSpacingY = 175.0 // Guaranteed clearance > node height (130-145px)

	// Column 1: Target Node (X: 520)
	rootNode := GraphNode{
		ID:   rootDef.ID,
		Type: "customSymbol",
		Data: GraphNodeData{
			Label:       rootSymbol,
			Kind:        rootDef.Kind,
			Category:    rootDef.Category,
			File:        rootDef.File,
			Line:        rootDef.Range.Start.Line,
			Signature:   rootDef.Signature,
			Scope:       rootDef.Scope,
			IsRoot:      true,
			CallerCount: len(incomingCalls),
			CalleeCount: len(outgoingCalls),
		},
		Position: NodePosition{X: 520, Y: targetY},
	}
	nodesMap[rootDef.ID] = rootNode

	// -------------------------------------------------------------------------
	// Column 0: Callers / Referrers (X: 60)
	// -------------------------------------------------------------------------
	uniqueCallers := make([]*ast.CallSite, 0)
	seenCallers := make(map[string]bool)
	for _, call := range incomingCalls {
		if call.Caller != "" && !seenCallers[call.Caller] {
			seenCallers[call.Caller] = true
			uniqueCallers = append(uniqueCallers, call)
		}
	}

	callerStartY := computeStartY(targetY, len(uniqueCallers), nodeSpacingY)
	for i, call := range uniqueCallers {
		callerID := fmt.Sprintf("%s:%s", call.File, call.Caller)
		callerDefs := idx.defsByName[call.Caller]
		kind := ast.KindFunction
		category := ast.CategoryFunction
		line := call.Range.Start.Line
		filePath := call.File
		sig := ""

		if len(callerDefs) > 0 {
			callerID = callerDefs[0].ID
			kind = callerDefs[0].Kind
			category = callerDefs[0].Category
			line = callerDefs[0].Range.Start.Line
			filePath = callerDefs[0].File
			sig = callerDefs[0].Signature
		}

		nodesMap[callerID] = GraphNode{
			ID:   callerID,
			Type: "customSymbol",
			Data: GraphNodeData{
				Label:     call.Caller,
				Kind:      kind,
				Category:  category,
				File:      filePath,
				Line:      line,
				Signature: sig,
				IsRoot:    false,
			},
			Position: NodePosition{
				X: 60,
				Y: callerStartY + float64(i)*nodeSpacingY,
			},
		}

		edgeID := fmt.Sprintf("edge:call:%s->%s", callerID, rootDef.ID)
		edgesMap[edgeID] = GraphEdge{
			ID:           edgeID,
			Source:       callerID,
			Target:       rootDef.ID,
			Relationship: "call",
			Label:        "calls",
			Animated:     true,
		}
	}

	// -------------------------------------------------------------------------
	// Column 2: Outgoing Function Calls (X: 980)
	// -------------------------------------------------------------------------
	uniqueCallees := make([]*ast.CallSite, 0)
	seenCallees := make(map[string]bool)
	for _, call := range outgoingCalls {
		if call.Callee != "" && !seenCallees[call.Callee] {
			seenCallees[call.Callee] = true
			uniqueCallees = append(uniqueCallees, call)
		}
	}

	calleeStartY := computeStartY(targetY, len(uniqueCallees), nodeSpacingY)
	for i, call := range uniqueCallees {
		calleeID := fmt.Sprintf("call:%s:%s", call.Callee, call.File)
		calleeDefs := idx.defsByName[call.Callee]
		kind := ast.KindFunction
		category := ast.CategoryFunction
		line := call.Range.Start.Line
		filePath := call.File
		sig := ""

		if len(calleeDefs) > 0 {
			calleeID = calleeDefs[0].ID
			kind = calleeDefs[0].Kind
			category = calleeDefs[0].Category
			line = calleeDefs[0].Range.Start.Line
			filePath = calleeDefs[0].File
			sig = calleeDefs[0].Signature
		}

		nodesMap[calleeID] = GraphNode{
			ID:   calleeID,
			Type: "customSymbol",
			Data: GraphNodeData{
				Label:     call.Callee,
				Kind:      kind,
				Category:  category,
				File:      filePath,
				Line:      line,
				Signature: sig,
				IsRoot:    false,
			},
			Position: NodePosition{
				X: 980,
				Y: calleeStartY + float64(i)*nodeSpacingY,
			},
		}

		edgeID := fmt.Sprintf("edge:call:%s->%s", rootDef.ID, calleeID)
		edgesMap[edgeID] = GraphEdge{
			ID:           edgeID,
			Source:       rootDef.ID,
			Target:       calleeID,
			Relationship: "call",
			Label:        "calls",
			Animated:     false,
		}
	}

	// -------------------------------------------------------------------------
	// Column 3: Referenced Datatypes & Structs (X: 1440)
	// -------------------------------------------------------------------------
	uniqueTypes := make([]*ast.TypeUsage, 0)
	seenTypes := make(map[string]bool)
	for _, tu := range typeUsages {
		cleanType := strings.Trim(tu.TypeName, "*& \t")
		if cleanType != "" && !seenTypes[cleanType] {
			seenTypes[cleanType] = true
			uniqueTypes = append(uniqueTypes, tu)
		}
	}

	typeStartY := computeStartY(targetY, len(uniqueTypes), nodeSpacingY)
	for i, tu := range uniqueTypes {
		cleanType := strings.Trim(tu.TypeName, "*& \t")
		typeID := fmt.Sprintf("type:%s", cleanType)
		typeDefs := idx.typesByName[cleanType]
		kind := ast.KindStruct
		category := ast.CategoryType
		line := tu.Range.Start.Line
		filePath := tu.File
		sig := fmt.Sprintf("type %s", cleanType)

		if len(typeDefs) > 0 {
			typeID = typeDefs[0].ID
			kind = typeDefs[0].Kind
			category = typeDefs[0].Category
			line = typeDefs[0].Range.Start.Line
			filePath = typeDefs[0].File
			sig = typeDefs[0].Signature
		}

		nodesMap[typeID] = GraphNode{
			ID:   typeID,
			Type: "customSymbol",
			Data: GraphNodeData{
				Label:     cleanType,
				Kind:      kind,
				Category:  category,
				File:      filePath,
				Line:      line,
				Signature: sig,
				IsRoot:    false,
			},
			Position: NodePosition{
				X: 1440,
				Y: typeStartY + float64(i)*nodeSpacingY,
			},
		}

		edgeID := fmt.Sprintf("edge:type:%s->%s", rootDef.ID, typeID)
		edgesMap[edgeID] = GraphEdge{
			ID:           edgeID,
			Source:       rootDef.ID,
			Target:       typeID,
			Relationship: "type",
			Label:        "uses type",
			Animated:     false,
		}
	}

	// -------------------------------------------------------------------------
	// Column 4: Referenced Variables & Objects (X: 1900)
	// -------------------------------------------------------------------------
	uniqueVars := make([]*ast.VarAccess, 0)
	seenVars := make(map[string]bool)
	for _, va := range varAccesses {
		if va.VarName != "" && !seenVars[va.VarName] {
			seenVars[va.VarName] = true
			uniqueVars = append(uniqueVars, va)
		}
	}

	varStartY := computeStartY(targetY, len(uniqueVars), nodeSpacingY)
	for i, va := range uniqueVars {
		varID := fmt.Sprintf("var:%s", va.VarName)
		varDefs := idx.varsByName[va.VarName]
		kind := ast.KindVariable
		category := ast.CategoryVariable
		line := va.Range.Start.Line
		filePath := va.File
		sig := va.VarName

		if len(varDefs) > 0 {
			varID = varDefs[0].ID
			kind = varDefs[0].Kind
			category = varDefs[0].Category
			line = varDefs[0].Range.Start.Line
			filePath = varDefs[0].File
			sig = varDefs[0].Signature
		}

		nodesMap[varID] = GraphNode{
			ID:   varID,
			Type: "customSymbol",
			Data: GraphNodeData{
				Label:     va.VarName,
				Kind:      kind,
				Category:  category,
				File:      filePath,
				Line:      line,
				Signature: sig,
				IsRoot:    false,
			},
			Position: NodePosition{
				X: 1900,
				Y: varStartY + float64(i)*nodeSpacingY,
			},
		}

		edgeID := fmt.Sprintf("edge:var:%s->%s", rootDef.ID, varID)
		edgesMap[edgeID] = GraphEdge{
			ID:           edgeID,
			Source:       rootDef.ID,
			Target:       varID,
			Relationship: "variable",
			Label:        "accesses",
			Animated:     false,
		}
	}

	// Flatten map to slice
	nodes := make([]GraphNode, 0, len(nodesMap))
	for _, node := range nodesMap {
		nodes = append(nodes, node)
	}

	edges := make([]GraphEdge, 0, len(edgesMap))
	for _, edge := range edgesMap {
		edges = append(edges, edge)
	}

	counts := map[string]int{
		"callers": len(uniqueCallers),
		"callees": len(uniqueCallees),
		"types":   len(uniqueTypes),
		"vars":    len(uniqueVars),
	}

	return &CallGraphResponse{
		RootSymbol: rootSymbol,
		Nodes:      nodes,
		Edges:      edges,
		Counts:     counts,
	}, nil
}

func computeStartY(centerY float64, count int, spacing float64) float64 {
	if count <= 0 {
		return centerY
	}
	totalHeight := float64(count-1) * spacing
	startY := centerY - totalHeight/2.0
	if startY < 60.0 {
		return 60.0
	}
	return startY
}
