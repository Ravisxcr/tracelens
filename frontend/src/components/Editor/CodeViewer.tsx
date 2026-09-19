import React, { useRef, useEffect } from 'react';
import Editor, { Monaco, OnMount } from '@monaco-editor/react';
import type * as monacoEditor from 'monaco-editor';
import { Network, Search, GitGraph, BookOpen, Layers } from 'lucide-react';
import { useTraceStore, traceStore } from '../../store/useTraceStore';
import { useTheme } from '../../store/useTheme';
import { SymbolInfo } from '../../types';
import { EditorTabs } from './EditorTabs';
import { Breadcrumbs } from './Breadcrumbs';

// Common programming language keywords to ignore for hover tooltips
const LANGUAGE_KEYWORDS = new Set([
  'import', 'package', 'return', 'if', 'else', 'for', 'range', 'switch', 'case', 'default',
  'var', 'const', 'type', 'struct', 'interface', 'func', 'function', 'def', 'class', 'from',
  'as', 'true', 'false', 'nil', 'null', 'undefined', 'void', 'int', 'string', 'bool', 'float',
  'char', 'include', 'define', 'let', 'new', 'this', 'self', 'public', 'private', 'protected',
  'static', 'final', 'break', 'continue', 'goto', 'select', 'chan', 'map', 'make', 'len', 'cap',
  'print', 'println', 'panic', 'recover', 'try', 'catch', 'finally', 'throw', 'except', 'with',
  'yield', 'lambda', 'async', 'await', 'export', 'extends', 'implements', 'enum',
]);

// Module-level singleton tracking to prevent duplicate provider registrations across renders
let providerDisposables: monacoEditor.IDisposable[] = [];
let commandsRegistered = false;

export const CodeViewer: React.FC = () => {
  const {
    activeFile,
    targetLine,
    setCursorPosition,
    jumpToDefinition,
    openCallGraph,
    toggleSearch,
  } = useTraceStore();

  const { resolvedTheme } = useTheme();

  const editorRef = useRef<monacoEditor.editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<Monaco | null>(null);
  const decorationsRef = useRef<string[]>([]);

  // Configure editor on mount
  const handleEditorDidMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;

    // Register hover and command providers once without duplicates
    registerCustomProviders(monaco);

    // Track cursor movement for breadcrumbs
    editor.onDidChangeCursorPosition((e) => {
      setCursorPosition(e.position.lineNumber, e.position.column);
    });
  };

  // Register commands and providers in Monaco with strict deduplication
  const registerCustomProviders = (monaco: Monaco) => {
    // Register commands only once
    if (!commandsRegistered) {
      try {
        monaco.editor.registerCommand('tracelens.jumpDef', (_, name: string, file: string) => {
          traceStore.jumpToDefinition(name, file);
        });
        monaco.editor.registerCommand('tracelens.traceGraph', (_, symbol: string, file: string) => {
          traceStore.openCallGraph(symbol, file);
        });
        commandsRegistered = true;
      } catch {
        // Already registered
      }
    }

    // Clean up any previously registered providers to ensure zero duplicate popups
    providerDisposables.forEach((d) => d.dispose());
    providerDisposables = [];

    // Register Hover and Definition Providers once per supported language
    const languages = ['go', 'typescript', 'javascript', 'c', 'cpp', 'python'];
    languages.forEach((lang) => {
      const hoverDisp = monaco.languages.registerHoverProvider(lang, {
        provideHover: (model, position) => {
          const word = model.getWordAtPosition(position);
          if (!word) return null;

          const symbolName = word.word;
          if (!symbolName || symbolName.length <= 1 || LANGUAGE_KEYWORDS.has(symbolName.toLowerCase())) {
            return null;
          }

          const state = traceStore.getState();
          const currentFile = state.activeFile;

          // Look for symbol in active file
          let matchedSymbol: SymbolInfo | undefined;
          if (currentFile && currentFile.symbols) {
            const findInSymbols = (syms: SymbolInfo[]): SymbolInfo | undefined => {
              for (const s of syms) {
                if (s.name === symbolName) return s;
                if (s.children && s.children.length > 0) {
                  const found = findInSymbols(s.children);
                  if (found) return found;
                }
              }
              return undefined;
            };
            matchedSymbol = findInSymbols(currentFile.symbols);
          }

          const lines: string[] = [];
          if (matchedSymbol) {
            const langMode = currentFile?.language || 'plaintext';
            if (matchedSymbol.signature) {
              lines.push(`\`\`\`${langMode}\n${matchedSymbol.signature}\n\`\`\``);
            } else {
              lines.push(`\`\`\`${langMode}\n${matchedSymbol.name}\n\`\`\``);
            }
            lines.push(`*${matchedSymbol.kind}*${matchedSymbol.scope ? ` • (${matchedSymbol.scope})` : ''}`);
          } else {
            lines.push(`**TraceLens Symbol**: \`${symbolName}\``);
          }

          lines.push(
            `---\n[Jump to Definition](command:tracelens.jumpDef?${encodeURIComponent(
              JSON.stringify([symbolName, ''])
            )}) • [Trace Call Graph](command:tracelens.traceGraph?${encodeURIComponent(
              JSON.stringify([symbolName, ''])
            )})`
          );

          return {
            range: new monaco.Range(
              position.lineNumber,
              word.startColumn,
              position.lineNumber,
              word.endColumn
            ),
            contents: [
              {
                value: lines.join('\n\n'),
                isTrusted: true,
              },
            ],
          };
        },
      });
      providerDisposables.push(hoverDisp);

      // Register Definition Provider for Cmd+Click / F12
      const defDisp = monaco.languages.registerDefinitionProvider(lang, {
        provideDefinition: async (model, position) => {
          const word = model.getWordAtPosition(position);
          if (!word) return null;
          const name = word.word;
          if (LANGUAGE_KEYWORDS.has(name.toLowerCase())) return null;

          traceStore.jumpToDefinition(name);
          return null;
        },
      });
      providerDisposables.push(defDisp);
    });
  };

  // Clean up providers on unmount
  useEffect(() => {
    return () => {
      providerDisposables.forEach((d) => d.dispose());
      providerDisposables = [];
    };
  }, []);

  // Synchronize Monaco editor theme immediately when resolvedTheme changes
  useEffect(() => {
    if (monacoRef.current) {
      monacoRef.current.editor.setTheme(resolvedTheme === 'dark' ? 'vs-dark' : 'vs');
    }
  }, [resolvedTheme]);

  // React to targetLine jumps (e.g. from FileExplorer or Definition Jumps)
  useEffect(() => {
    if (!editorRef.current || !monacoRef.current || !targetLine) return;

    const editor = editorRef.current;
    const monaco = monacoRef.current;

    editor.revealLineInCenter(targetLine);
    editor.setPosition({ lineNumber: targetLine, column: 1 });

    // Apply temporary line highlight
    decorationsRef.current = editor.deltaDecorations(decorationsRef.current, [
      {
        range: new monaco.Range(targetLine, 1, targetLine, 1),
        options: {
          isWholeLine: true,
          className: 'symbol-jump-highlight',
        },
      },
    ]);

    const timer = setTimeout(() => {
      if (editorRef.current) {
        decorationsRef.current = editorRef.current.deltaDecorations(decorationsRef.current, []);
      }
    }, 2000);

    return () => clearTimeout(timer);
  }, [targetLine, activeFile]);

  // Map file language to Monaco language
  const getMonacoLanguage = (lang: string) => {
    switch (lang) {
      case 'go':
        return 'go';
      case 'typescript':
        return 'typescript';
      case 'javascript':
        return 'javascript';
      case 'c':
        return 'c';
      case 'cpp':
        return 'cpp';
      case 'python':
        return 'python';
      default:
        return 'plaintext';
    }
  };

  return (
    <main className="flex-1 flex flex-col h-full bg-[#1e1e1e] dark:bg-[#1e1e1e] bg-white overflow-hidden transition-none">
      <EditorTabs />

      {activeFile ? (
        <>
          <Breadcrumbs />

          <div className="flex-1 relative">
            <Editor
              height="100%"
              theme={resolvedTheme === 'dark' ? 'vs-dark' : 'vs'}
              language={getMonacoLanguage(activeFile.language)}
              value={activeFile.content}
              onMount={handleEditorDidMount}
              options={{
                readOnly: true,
                domReadOnly: true,
                fontSize: 13,
                lineHeight: 20,
                fontFamily: "'JetBrains Mono', 'Fira Code', Menlo, Monaco, Consolas, monospace",
                minimap: {
                  enabled: true,
                  maxColumn: 60,
                  renderCharacters: false,
                },
                stickyScroll: {
                  enabled: true,
                  maxLineCount: 5,
                },
                scrollBeyondLastLine: false,
                smoothScrolling: true,
                cursorBlinking: 'smooth',
                lineNumbers: 'on',
                glyphMargin: true,
                folding: true,
                renderLineHighlight: 'all',
                automaticLayout: true,
                contextmenu: true,
                links: true,
              }}
            />
          </div>
        </>
      ) : (
        /* Empty / Welcome State */
        <div className="flex-1 flex flex-col items-center justify-center bg-slate-50 dark:bg-[#1e1e1e] text-slate-500 dark:text-[#888888] select-none p-6">
          <div className="max-w-md w-full text-center space-y-6">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-blue-500/10 dark:bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/20 shadow-inner">
              <Network className="w-8 h-8" />
            </div>

            <div>
              <h2 className="text-xl font-bold text-slate-800 dark:text-white tracking-tight">
                TraceLens Workbench
              </h2>
              <p className="text-xs text-slate-500 dark:text-[#888888] mt-1.5">
                Fast code comprehension, call graphs, and symbol tracing
              </p>
            </div>

            <div className="grid grid-cols-1 gap-2.5 text-left text-xs bg-white dark:bg-[#252528] p-4 rounded-xl border border-slate-200 dark:border-[#333333] shadow-sm">
              <div
                onClick={() => toggleSearch(true)}
                className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-[#2e2e32] cursor-pointer transition-colors"
              >
                <div className="flex items-center space-x-2.5">
                  <Search className="w-4 h-4 text-blue-500 dark:text-blue-400" />
                  <span className="font-medium text-slate-700 dark:text-[#cccccc]">Quick Open Symbol</span>
                </div>
                <kbd className="bg-slate-100 dark:bg-[#18181a] px-2 py-0.5 rounded text-[10px] text-slate-500 dark:text-[#888888] border border-slate-200 dark:border-[#444448]">
                  ⌘P
                </kbd>
              </div>

              <div className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-[#2e2e32] transition-colors">
                <div className="flex items-center space-x-2.5">
                  <Layers className="w-4 h-4 text-amber-500 dark:text-amber-400" />
                  <span className="font-medium text-slate-700 dark:text-[#cccccc]">Toggle Sidebar</span>
                </div>
                <kbd className="bg-slate-100 dark:bg-[#18181a] px-2 py-0.5 rounded text-[10px] text-slate-500 dark:text-[#888888] border border-slate-200 dark:border-[#444448]">
                  ⌘B
                </kbd>
              </div>

              <div className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-[#2e2e32] transition-colors">
                <div className="flex items-center space-x-2.5">
                  <GitGraph className="w-4 h-4 text-purple-500 dark:text-purple-400" />
                  <span className="font-medium text-slate-700 dark:text-[#cccccc]">Jump to Definition</span>
                </div>
                <kbd className="bg-slate-100 dark:bg-[#18181a] px-2 py-0.5 rounded text-[10px] text-slate-500 dark:text-[#888888] border border-slate-200 dark:border-[#444448]">
                  F12 / ⌘Click
                </kbd>
              </div>

              <div className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-[#2e2e32] transition-colors">
                <div className="flex items-center space-x-2.5">
                  <BookOpen className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
                  <span className="font-medium text-slate-700 dark:text-[#cccccc]">Select file to start</span>
                </div>
                <span className="text-[10.5px] text-slate-400">File Tree</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
};
