import React, { useRef, useEffect } from 'react';
import Editor, { Monaco, OnMount } from '@monaco-editor/react';
import type * as monacoEditor from 'monaco-editor';
import { useTraceStore, traceStore } from '../../store/useTraceStore';
import { useTheme } from '../../store/useTheme';
import { Breadcrumbs } from './Breadcrumbs';

export const CodeViewer: React.FC = () => {
  const {
    activeFile,
    targetLine,
    setCursorPosition,
    jumpToDefinition,
    openCallGraph,
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

    // Track cursor movement for breadcrumbs
    editor.onDidChangeCursorPosition((e) => {
      setCursorPosition(e.position.lineNumber);
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
          const activePath = traceStore.getState().activeFilePath || '';

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
          return null; // Navigation is handled smoothly by TraceLens store
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

  if (!activeFile) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-slate-50 dark:bg-[#1e1e1e] text-slate-500 dark:text-[#666666] select-none">
        <div className="text-center space-y-2">
          <p className="text-sm font-medium">Select a file from the explorer to begin tracing</p>
          <p className="text-xs text-slate-400 dark:text-[#555555]">
            Use <kbd className="bg-white dark:bg-[#2a2a2b] px-1.5 py-0.5 rounded text-slate-500 dark:text-[#888888] border border-slate-200 dark:border-[#3e3e42]">⌘P</kbd> to search symbols
          </p>
        </div>
      </div>
    );
  }

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
    <div className="flex-1 flex flex-col h-full bg-white dark:bg-[#1e1e1e] overflow-hidden transition-colors">
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
    </div>
  );
};

