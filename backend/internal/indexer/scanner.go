package indexer

import (
	"context"
	"io/fs"
	"path/filepath"
	"sort"
	"strings"
	"sync"

	"tracelens/backend/internal/ast"
)

// FileInfo represents a scanned source file.
type FileInfo struct {
	Path     string `json:"path"`     // Relative path to workspace root
	FullPath string `json:"fullPath"` // Absolute path on disk
	Language string `json:"language"` // "go", "typescript", "javascript"
	Size     int64  `json:"size"`
}

// TreeNode represents a file or directory node in the workspace file tree.
type TreeNode struct {
	Name        string      `json:"name"`
	Path        string      `json:"path"` // Relative path from root
	IsDir       bool        `json:"isDir"`
	Children    []*TreeNode `json:"children,omitempty"`
	Language    string      `json:"language,omitempty"`
	SymbolCount int         `json:"symbolCount,omitempty"`
}

// Scanner scans directories for source code files.
type Scanner struct {
	ignoredDirs  map[string]bool
	ignoredFiles map[string]bool
	maxFileSize  int64
}

// NewScanner creates a new scanner with default exclusion rules.
func NewScanner() *Scanner {
	return &Scanner{
		ignoredDirs: map[string]bool{
			".git":         true,
			"node_modules": true,
			"vendor":       true,
			"dist":         true,
			"build":        true,
			".next":        true,
			".cache":       true,
			".idea":        true,
			".vscode":      true,
		},
		ignoredFiles: map[string]bool{
			"package-lock.json": true,
			"yarn.lock":         true,
			"pnpm-lock.yaml":    true,
			"go.sum":            true,
		},
		maxFileSize: 2 * 1024 * 1024, // 2MB limit
	}
}

// ScanWorkspace walks rootDir and returns all indexable source files and a TreeNode hierarchy.
func (s *Scanner) ScanWorkspace(ctx context.Context, rootDir string) ([]FileInfo, *TreeNode, error) {
	absRoot, err := filepath.Abs(rootDir)
	if err != nil {
		return nil, nil, err
	}

	var files []FileInfo
	var mu sync.Mutex

	rootNode := &TreeNode{
		Name:     filepath.Base(absRoot),
		Path:     "",
		IsDir:    true,
		Children: make([]*TreeNode, 0),
	}

	dirMap := make(map[string]*TreeNode)
	dirMap[""] = rootNode

	err = filepath.WalkDir(absRoot, func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			return nil // Skip unreadable items
		}

		select {
		case <-ctx.Done():
			return ctx.Err()
		default:
		}

		relPath, err := filepath.Rel(absRoot, path)
		if err != nil || relPath == "." {
			return nil
		}

		name := d.Name()

		if d.IsDir() {
			if s.ignoredDirs[name] || strings.HasPrefix(name, ".") {
				return filepath.SkipDir
			}
			node := &TreeNode{
				Name:     name,
				Path:     filepath.ToSlash(relPath),
				IsDir:    true,
				Children: make([]*TreeNode, 0),
			}
			parentRel := filepath.Dir(relPath)
			if parentRel == "." {
				parentRel = ""
			}
			parentRel = filepath.ToSlash(parentRel)

			mu.Lock()
			dirMap[filepath.ToSlash(relPath)] = node
			if parent, ok := dirMap[parentRel]; ok {
				parent.Children = append(parent.Children, node)
			}
			mu.Unlock()
			return nil
		}

		// File handling
		if s.ignoredFiles[name] {
			return nil
		}

		lang := ast.DetectLanguage(path)
		if lang == ast.LangUnknown {
			return nil
		}

		info, err := d.Info()
		if err != nil || info.Size() > s.maxFileSize {
			return nil
		}

		cleanRel := filepath.ToSlash(relPath)
		fileInfo := FileInfo{
			Path:     cleanRel,
			FullPath: path,
			Language: lang,
			Size:     info.Size(),
		}

		mu.Lock()
		files = append(files, fileInfo)

		fileNode := &TreeNode{
			Name:     name,
			Path:     cleanRel,
			IsDir:    false,
			Language: lang,
		}

		parentRel := filepath.Dir(relPath)
		if parentRel == "." {
			parentRel = ""
		}
		parentRel = filepath.ToSlash(parentRel)

		if parent, ok := dirMap[parentRel]; ok {
			parent.Children = append(parent.Children, fileNode)
		}
		mu.Unlock()

		return nil
	})

	if err != nil {
		return nil, nil, err
	}

	sortTree(rootNode)
	return files, rootNode, nil
}

func sortTree(node *TreeNode) {
	if !node.IsDir || len(node.Children) == 0 {
		return
	}

	sort.Slice(node.Children, func(i, j int) bool {
		// Directories first, then alphabetical
		if node.Children[i].IsDir != node.Children[j].IsDir {
			return node.Children[i].IsDir
		}
		return strings.ToLower(node.Children[i].Name) < strings.ToLower(node.Children[j].Name)
	})

	for _, child := range node.Children {
		sortTree(child)
	}
}
