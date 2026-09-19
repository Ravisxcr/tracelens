package indexer

import (
	"fmt"
	"tracelens/backend/internal/ast"
)

// GraphNodeData holds symbol metadata for React Flow node representation.
type GraphNodeData struct {
	Label       string        `json:"label"`
	Kind        ast.SymbolKind `json:"kind"`
	File        string        `json:"file"`
	Line        int           `json:"line"`
	Signature   string        `json:"signature,omitempty"`
	Scope       string        `json:"scope,omitempty"`
	IsRoot      bool          `json:"isRoot"`
	CallerCount int           `json:"callerCount"`
	CalleeCount int           `json:"calleeCount"`
}

// Position coordinates for node rendering.
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
	ID       string `json:"id"`
	Source   string `json:"source"`
	Target   string `json:"target"`
	Label    string `json:"label,omitempty"`
	Animated bool   `json:"animated"`
}

// CallGraphResponse returns nodes and edges ready for React Flow.
type CallGraphResponse struct {
	RootSymbol string      `json:"rootSymbol"`
	Nodes      []GraphNode `json:"nodes"`
	Edges      []GraphEdge `json:"edges"`
}

// BuildCallGraph constructs a multi-depth call graph centered around rootSymbol.
func (idx *Index) BuildCallGraph(rootSymbol, file string, depth int) (*CallGraphResponse, error) {
	idx.mu.RLock()
	defer idx.mu.RUnlock()

	if depth <= 0 {
		depth = 1
	}
	if depth > 3 {
		depth = 3 // prevent graph explosion
	}

	rootDefs := idx.FindDefinition(file, rootSymbol, 0, 0)
	var rootDef *ast.Symbol
	if len(rootDefs) > 0 {
		rootDef = rootDefs[0]
	} else {
		// Fallback synthetic root if no definition found
		rootDef = &ast.Symbol{
			ID:    fmt.Sprintf("synth:%s", rootSymbol),
			Name:  rootSymbol,
			Kind:  ast.KindFunction,
			File:  file,
			Range: ast.Range{Start: ast.Position{Line: 1, Column: 1}},
		}
	}

	nodesMap := make(map[string]GraphNode)
	edgesMap := make(map[string]GraphEdge)

	// Ingoing callers (who calls root)
	incomingCalls := idx.callsByCallee[rootSymbol]
	// Outgoing callees (who root calls)
	outgoingCalls := idx.callsByCaller[rootSymbol]

	// Add root node
	rootNode := GraphNode{
		ID:   rootDef.ID,
		Type: "customSymbol",
		Data: GraphNodeData{
			Label:       rootSymbol,
			Kind:        rootDef.Kind,
			File:        rootDef.File,
			Line:        rootDef.Range.Start.Line,
			Signature:   rootDef.Signature,
			Scope:       rootDef.Scope,
			IsRoot:      true,
			CallerCount: len(incomingCalls),
			CalleeCount: len(outgoingCalls),
		},
		Position: NodePosition{X: 400, Y: 250},
	}
	nodesMap[rootDef.ID] = rootNode

	// Process Callers (Layer -1, X: 50)
	callerSpacing := 100.0
	callerStartY := 250.0 - float64(len(incomingCalls)-1)*callerSpacing/2.0
	if callerStartY < 50 {
		callerStartY = 50
	}

	seenCallers := make(map[string]bool)
	callerIdx := 0
	for _, call := range incomingCalls {
		if call.Caller == "" || seenCallers[call.Caller] {
			continue
		}
		seenCallers[call.Caller] = true

		callerID := fmt.Sprintf("%s:%s", call.File, call.Caller)
		callerDefs := idx.defsByName[call.Caller]
		kind := ast.KindFunction
		line := call.Range.Start.Line
		file := call.File
		sig := ""

		if len(callerDefs) > 0 {
			callerID = callerDefs[0].ID
			kind = callerDefs[0].Kind
			line = callerDefs[0].Range.Start.Line
			file = callerDefs[0].File
			sig = callerDefs[0].Signature
		}

		nodesMap[callerID] = GraphNode{
			ID:   callerID,
			Type: "customSymbol",
			Data: GraphNodeData{
				Label:     call.Caller,
				Kind:      kind,
				File:      file,
				Line:      line,
				Signature: sig,
				IsRoot:    false,
			},
			Position: NodePosition{
				X: 50,
				Y: callerStartY + float64(callerIdx)*callerSpacing,
			},
		}

		edgeID := fmt.Sprintf("edge:%s->%s", callerID, rootDef.ID)
		edgesMap[edgeID] = GraphEdge{
			ID:       edgeID,
			Source:   callerID,
			Target:   rootDef.ID,
			Label:    "calls",
			Animated: true,
		}
		callerIdx++
	}

	// Process Callees (Layer +1, X: 750)
	calleeSpacing := 100.0
	calleeStartY := 250.0 - float64(len(outgoingCalls)-1)*calleeSpacing/2.0
	if calleeStartY < 50 {
		calleeStartY = 50
	}

	seenCallees := make(map[string]bool)
	calleeIdx := 0
	for _, call := range outgoingCalls {
		if call.Callee == "" || seenCallees[call.Callee] {
			continue
		}
		seenCallees[call.Callee] = true

		calleeID := fmt.Sprintf("call:%s:%s", call.Callee, call.File)
		calleeDefs := idx.defsByName[call.Callee]
		kind := ast.KindFunction
		line := call.Range.Start.Line
		file := call.File
		sig := ""

		if len(calleeDefs) > 0 {
			calleeID = calleeDefs[0].ID
			kind = calleeDefs[0].Kind
			line = calleeDefs[0].Range.Start.Line
			file = calleeDefs[0].File
			sig = calleeDefs[0].Signature
		}

		nodesMap[calleeID] = GraphNode{
			ID:   calleeID,
			Type: "customSymbol",
			Data: GraphNodeData{
				Label:     call.Callee,
				Kind:      kind,
				File:      file,
				Line:      line,
				Signature: sig,
				IsRoot:    false,
			},
			Position: NodePosition{
				X: 750,
				Y: calleeStartY + float64(calleeIdx)*calleeSpacing,
			},
		}

		edgeID := fmt.Sprintf("edge:%s->%s", rootDef.ID, calleeID)
		edgesMap[edgeID] = GraphEdge{
			ID:       edgeID,
			Source:   rootDef.ID,
			Target:   calleeID,
			Label:    "calls",
			Animated: false,
		}
		calleeIdx++
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

	return &CallGraphResponse{
		RootSymbol: rootSymbol,
		Nodes:      nodes,
		Edges:      edges,
	}, nil
}

