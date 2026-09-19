import React, { useRef, useEffect } from 'react';
import Editor, { Monaco, OnMount } from '@monaco-editor/react';
import type * as monacoEditor from 'monaco-editor';
import { Network, Search, GitGraph, BookOpen, Layers } from 'lucide-react';
import { useTraceStore, traceStore } from '../../store/useTraceStore';
import { useTheme } from '../../store/useTheme';
import { EditorTabs } from './EditorTabs';
import { Breadcrumbs } from './Breadcrumbs';

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

    // Register hover and command providers once
    registerCustomProviders(monaco);

    // Track cursor movement for breadcrumbs and status bar
    editor.onDidChangeCursorPosition((e) => {
      setCursorPosition(e.position.lineNumber, e.position.column);
    });
  };

  // Register commands and providers in Monaco
  const registerCustomProviders = (monaco: Monaco) => {
    // Command: Jump to Definition
    monaco.editor.registerCommand('tracelens.jumpDef', (_, name: string, file: string) => {
      jumpToDefinition(name, file);
    });

    // Command: Open Call Graph
    monaco.editor.registerCommand('tracelens.traceGraph', (_, symbol: string, file: string) => {
      openCallGraph(symbol, file);
    });

    // Register Hover Provider for Go, TS/JS, C, C++, Python
    const languages = ['go', 'typescript', 'javascript', 'c', 'cpp', 'python'];
    languages.forEach((lang) => {
      monaco.languages.registerHoverProvider(lang, {
        provideHover: (model, position) => {
          const word = model.getWordAtPosition(position);
          if (!word) return null;

          const symbolName = word.word;

          return {
            range: new monaco.Range(
              position.lineNumber,
              word.startColumn,
              position.lineNumber,
              word.endColumn
            ),
            contents: [
              { value: `**TraceLens Symbol**: \`${symbolName}\`` },
              {
                value: `[Jump to Definition](command:tracelens.jumpDef?${encodeURIComponent(
                  JSON.stringify([symbolName, ''])
                )}) • [Trace Call Graph](command:tracelens.traceGraph?${encodeURIComponent(
                  JSON.stringify([symbolName, ''])
                )})`,
                isTrusted: true,
              },
            ],
          };
        },
      });

      // Register Definition Provider for Cmd+Click / F12
      monaco.languages.registerDefinitionProvider(lang, {
        provideDefinition: async (model, position) => {
          const word = model.getWordAtPosition(position);
          if (!word) return null;

          jumpToDefinition(word.word);
          return null; // Navigation handled smoothly by TraceLens store
        },
      });
    });
  };

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
        /* Empty / Welcome State styled like VS Code / code-server */
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
