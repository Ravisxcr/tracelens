package ast

import (
	"context"
	"fmt"
	"path/filepath"
	"strings"
	"sync"

	sitter "github.com/smacker/go-tree-sitter"
	"github.com/smacker/go-tree-sitter/golang"
	"github.com/smacker/go-tree-sitter/javascript"
	"github.com/smacker/go-tree-sitter/typescript/typescript"
)

// Supported language identifiers.
const (
	LangGo         = "go"
	LangTypeScript = "typescript"
	LangJavaScript = "javascript"
	LangUnknown    = "unknown"
)

// LanguageManager coordinates Tree-sitter parsers and grammars.
type LanguageManager struct {
	mu      sync.RWMutex
	goLang  *sitter.Language
	tsLang  *sitter.Language
	jsLang  *sitter.Language
}

// NewLanguageManager initializes available Tree-sitter grammars.
func NewLanguageManager() *LanguageManager {
	return &LanguageManager{
		goLang: golang.GetLanguage(),
		tsLang: typescript.GetLanguage(),
		jsLang: javascript.GetLanguage(),
	}
}

// DetectLanguage resolves the language identifier based on file extension.
func DetectLanguage(filePath string) string {
	ext := strings.ToLower(filepath.Ext(filePath))
	switch ext {
	case ".go":
		return LangGo
	case ".ts", ".tsx":
		return LangTypeScript
	case ".js", ".jsx", ".mjs", ".cjs":
		return LangJavaScript
	default:
		return LangUnknown
	}
}

// GetGrammar returns the Tree-sitter grammar for the given language.
func (lm *LanguageManager) GetGrammar(lang string) (*sitter.Language, error) {
	switch lang {
	case LangGo:
		if lm.goLang == nil {
			return nil, fmt.Errorf("Go grammar not available")
		}
		return lm.goLang, nil
	case LangTypeScript:
		if lm.tsLang == nil {
			return nil, fmt.Errorf("TypeScript grammar not available")
		}
		return lm.tsLang, nil
	case LangJavaScript:
		if lm.jsLang == nil {
			return nil, fmt.Errorf("JavaScript grammar not available")
		}
		return lm.jsLang, nil
	default:
		return nil, fmt.Errorf("unsupported language: %s", lang)
	}
}

// ParseSource parses the source content into a Tree-sitter Tree.
func (lm *LanguageManager) ParseSource(ctx context.Context, lang string, content []byte) (*sitter.Tree, *sitter.Language, error) {
	grammar, err := lm.GetGrammar(lang)
	if err != nil {
		return nil, nil, err
	}

	parser := sitter.NewParser()
	parser.SetLanguage(grammar)

	tree, err := parser.ParseCtx(ctx, nil, content)
	if err != nil {
		return nil, nil, fmt.Errorf("tree-sitter parse error: %w", err)
	}

	return tree, grammar, nil
}

