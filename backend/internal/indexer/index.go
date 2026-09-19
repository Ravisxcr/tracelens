package indexer

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"tracelens/backend/internal/ast"
)

// IndexStats provides metadata about the indexed workspace.
type IndexStats struct {
	TotalFiles   int           `json:"totalFiles"`
	TotalSymbols int           `json:"totalSymbols"`
	TotalCalls   int           `json:"totalCalls"`
	TotalTypes   int           `json:"totalTypes"`
	TotalVars    int           `json:"totalVars"`
	Duration     time.Duration `json:"duration"`
	IndexedAt    time.Time     `json:"indexedAt"`
}

// Index maintains in-memory symbol tables, call graphs, type graphs, and variable references.
type Index struct {
	mu                   sync.RWMutex
	rootDir              string
	scanner              *Scanner
	extractor            *ast.Extractor
	tree                 *TreeNode
	fileList             []FileInfo
	fileMap              map[string]FileInfo
	fileASTs             map[string]*ast.FileAST
	defsByName           map[string][]*ast.Symbol
	typesByName          map[string][]*ast.Symbol
	varsByName           map[string][]*ast.Symbol
	defsByFile           map[string][]*ast.Symbol
	callsByCaller        map[string][]*ast.CallSite
	callsByCallee        map[string][]*ast.CallSite
	typeUsagesBySymbol   map[string][]*ast.TypeUsage
	varAccessesBySymbol  map[string][]*ast.VarAccess
	stats                IndexStats
}

// NewIndex initializes an empty Index.
func NewIndex(extractor *ast.Extractor) *Index {
	if extractor == nil {
		extractor = ast.NewExtractor(nil)
	}
	return &Index{
		scanner:             NewScanner(),
		extractor:           extractor,
		fileMap:             make(map[string]FileInfo),
		fileASTs:            make(map[string]*ast.FileAST),
		defsByName:          make(map[string][]*ast.Symbol),
		typesByName:         make(map[string][]*ast.Symbol),
		varsByName:          make(map[string][]*ast.Symbol),
		defsByFile:          make(map[string][]*ast.Symbol),
		callsByCaller:       make(map[string][]*ast.CallSite),
		callsByCallee:       make(map[string][]*ast.CallSite),
		typeUsagesBySymbol:  make(map[string][]*ast.TypeUsage),
		varAccessesBySymbol: make(map[string][]*ast.VarAccess),
	}
}

// IndexWorkspace scans and indexes all supported source files within rootDir.
func (idx *Index) IndexWorkspace(ctx context.Context, rootDir string) (*IndexStats, error) {
	start := time.Now()
	absRoot, err := filepath.Abs(rootDir)
	if err != nil {
		return nil, err
	}

	files, tree, err := idx.scanner.ScanWorkspace(ctx, absRoot)
	if err != nil {
		return nil, fmt.Errorf("scan error: %w", err)
	}

	newFileMap := make(map[string]FileInfo)
	newFileASTs := make(map[string]*ast.FileAST)
	newDefsByName := make(map[string][]*ast.Symbol)
	newTypesByName := make(map[string][]*ast.Symbol)
	newVarsByName := make(map[string][]*ast.Symbol)
	newDefsByFile := make(map[string][]*ast.Symbol)
	newCallsByCaller := make(map[string][]*ast.CallSite)
	newCallsByCallee := make(map[string][]*ast.CallSite)
	newTypeUsages := make(map[string][]*ast.TypeUsage)
	newVarAccesses := make(map[string][]*ast.VarAccess)

	totalSymbols := 0
	totalCalls := 0
	totalTypes := 0
	totalVars := 0

	type parseResult struct {
		fileInfo FileInfo
		ast      *ast.FileAST
		err      error
	}

	resultCh := make(chan parseResult, len(files))
	sem := make(chan struct{}, 8)
	var wg sync.WaitGroup

	for _, fi := range files {
		wg.Add(1)
		go func(f FileInfo) {
			defer wg.Done()
			sem <- struct{}{}
			defer func() { <-sem }()

			content, err := os.ReadFile(f.FullPath)
			if err != nil {
				resultCh <- parseResult{fileInfo: f, err: err}
				return
			}

			fast, err := idx.extractor.ExtractFile(ctx, f.Path, content)
			resultCh <- parseResult{fileInfo: f, ast: fast, err: err}
		}(fi)
	}

	wg.Wait()
	close(resultCh)

	for res := range resultCh {
		if res.err != nil || res.ast == nil {
			continue
		}

		newFileMap[res.fileInfo.Path] = res.fileInfo
		newFileASTs[res.fileInfo.Path] = res.ast
		newDefsByFile[res.fileInfo.Path] = res.ast.Symbols

		for _, sym := range res.ast.Symbols {
			newDefsByName[sym.Name] = append(newDefsByName[sym.Name], sym)
			totalSymbols++

			switch sym.Category {
			case ast.CategoryType:
				newTypesByName[sym.Name] = append(newTypesByName[sym.Name], sym)
				totalTypes++
			case ast.CategoryVariable:
				newVarsByName[sym.Name] = append(newVarsByName[sym.Name], sym)
				totalVars++
			}
		}

		for _, call := range res.ast.Calls {
			if call.Caller != "" {
				newCallsByCaller[call.Caller] = append(newCallsByCaller[call.Caller], call)
			}
			if call.Callee != "" {
				newCallsByCallee[call.Callee] = append(newCallsByCallee[call.Callee], call)
			}
			totalCalls++
		}

		for _, tu := range res.ast.TypeUsages {
			if tu.UserSymbol != "" {
				newTypeUsages[tu.UserSymbol] = append(newTypeUsages[tu.UserSymbol], tu)
			}
		}

		for _, va := range res.ast.VarAccesses {
			if va.UserSymbol != "" {
				newVarAccesses[va.UserSymbol] = append(newVarAccesses[va.UserSymbol], va)
			}
		}
	}

	annotateTreeSymbols(tree, newDefsByFile)

	idx.mu.Lock()
	idx.rootDir = absRoot
	idx.tree = tree
	idx.fileList = files
	idx.fileMap = newFileMap
	idx.fileASTs = newFileASTs
	idx.defsByName = newDefsByName
	idx.typesByName = newTypesByName
	idx.varsByName = newVarsByName
	idx.defsByFile = newDefsByFile
	idx.callsByCaller = newCallsByCaller
	idx.callsByCallee = newCallsByCallee
	idx.typeUsagesBySymbol = newTypeUsages
	idx.varAccessesBySymbol = newVarAccesses
	idx.stats = IndexStats{
		TotalFiles:   len(newFileMap),
		TotalSymbols: totalSymbols,
		TotalCalls:   totalCalls,
		TotalTypes:   totalTypes,
		TotalVars:    totalVars,
		Duration:     time.Since(start),
		IndexedAt:    time.Now(),
	}
	statsCopy := idx.stats
	idx.mu.Unlock()

	return &statsCopy, nil
}

func annotateTreeSymbols(node *TreeNode, defsByFile map[string][]*ast.Symbol) int {
	if node == nil {
		return 0
	}
	if !node.IsDir {
		count := len(defsByFile[node.Path])
		node.SymbolCount = count
		return count
	}

	sum := 0
	for _, child := range node.Children {
		sum += annotateTreeSymbols(child, defsByFile)
	}
	node.SymbolCount = sum
	return sum
}

// GetTree returns the file tree hierarchy.
func (idx *Index) GetTree() *TreeNode {
	idx.mu.RLock()
	defer idx.mu.RUnlock()
	return idx.tree
}

// GetStats returns current index statistics.
func (idx *Index) GetStats() IndexStats {
	idx.mu.RLock()
	defer idx.mu.RUnlock()
	return idx.stats
}

// FileContentResponse holds file details for code viewer.
type FileContentResponse struct {
	Path      string          `json:"path"`
	Language  string          `json:"language"`
	Content   string          `json:"content"`
	LineCount int             `json:"lineCount"`
	Symbols   []*ast.Symbol   `json:"symbols"`
	Calls     []*ast.CallSite `json:"calls"`
}

// GetFileContent retrieves content and AST metadata for a file.
func (idx *Index) GetFileContent(relPath string) (*FileContentResponse, error) {
	idx.mu.RLock()
	defer idx.mu.RUnlock()

	cleanRel := filepath.ToSlash(relPath)
	fi, ok := idx.fileMap[cleanRel]
	if !ok {
		return nil, fmt.Errorf("file not found in index: %s", relPath)
	}

	contentBytes, err := os.ReadFile(fi.FullPath)
	if err != nil {
		return nil, fmt.Errorf("unable to read file: %w", err)
	}

	fast := idx.fileASTs[cleanRel]
	var symbols []*ast.Symbol
	var calls []*ast.CallSite
	lineCount := 0

	if fast != nil {
		symbols = fast.Symbols
		calls = fast.Calls
		lineCount = fast.LineCount
	}

	return &FileContentResponse{
		Path:      cleanRel,
		Language:  fi.Language,
		Content:   string(contentBytes),
		LineCount: lineCount,
		Symbols:   symbols,
		Calls:     calls,
	}, nil
}

// FindDefinition resolves a symbol name or location to its definition(s).
func (idx *Index) FindDefinition(file, name string, line, col int) []*ast.Symbol {
	idx.mu.RLock()
	defer idx.mu.RUnlock()

	if name == "" && file != "" {
		if fast, ok := idx.fileASTs[filepath.ToSlash(file)]; ok {
			for _, call := range fast.Calls {
				if isPositionInRange(line, col, call.Range) {
					name = call.Callee
					break
				}
			}
			if name == "" {
				for _, tu := range fast.TypeUsages {
					if isPositionInRange(line, col, tu.Range) {
						name = tu.TypeName
						break
					}
				}
			}
			if name == "" {
				for _, va := range fast.VarAccesses {
					if isPositionInRange(line, col, va.Range) {
						name = va.VarName
						break
					}
				}
			}
		}
	}

	if name == "" {
		return nil
	}

	defs := idx.defsByName[name]
	if len(defs) == 0 {
		return nil
	}

	if file != "" {
		cleanFile := filepath.ToSlash(file)
		var sameFile, otherFiles []*ast.Symbol
		for _, d := range defs {
			if d.File == cleanFile {
				sameFile = append(sameFile, d)
			} else {
				otherFiles = append(otherFiles, d)
			}
		}
		if len(sameFile) > 0 {
			return append(sameFile, otherFiles...)
		}
	}

	return defs
}

// FindReferences finds all callers / references to a symbol across the project.
func (idx *Index) FindReferences(name string) []*ast.CallSite {
	idx.mu.RLock()
	defer idx.mu.RUnlock()

	return idx.callsByCallee[name]
}

// SearchSymbols performs prefix/substring matching across all indexed symbols.
func (idx *Index) SearchSymbols(query string, limit int) []*ast.Symbol {
	idx.mu.RLock()
	defer idx.mu.RUnlock()

	if limit <= 0 {
		limit = 30
	}

	q := strings.ToLower(strings.TrimSpace(query))
	var results []*ast.Symbol

	for name, defs := range idx.defsByName {
		if strings.Contains(strings.ToLower(name), q) {
			for _, d := range defs {
				results = append(results, d)
				if len(results) >= limit {
					return results
				}
			}
		}
	}

	return results
}

func isPositionInRange(line, col int, r ast.Range) bool {
	if line < r.Start.Line || line > r.End.Line {
		return false
	}
	if line == r.Start.Line && col < r.Start.Column {
		return false
	}
	if line == r.End.Line && col > r.End.Column {
		return false
	}
	return true
}
