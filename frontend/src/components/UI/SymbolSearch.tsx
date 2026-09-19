import React, { useState, useEffect, useRef } from 'react';
import { Search, X, CornerDownLeft } from 'lucide-react';
import { SymbolInfo } from '../../types';
import { searchSymbols } from '../../api/client';
import { useTraceStore } from '../../store/useTraceStore';
import { SymbolBadge } from './SymbolBadge';
import { getFileIconColor } from '../Editor/EditorTabs';

export const SymbolSearch: React.FC = () => {
  const { isSearching, toggleSearch, selectFile, jumpToLine, activeFilePath } = useTraceStore();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SymbolInfo[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Global keydown listener for Cmd+P / Ctrl+P
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'p') {
        e.preventDefault();
        toggleSearch();
      }
      if (e.key === 'Escape' && isSearching) {
        toggleSearch(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSearching, toggleSearch]);

  // Focus input when opened
  useEffect(() => {
    if (isSearching) {
      setQuery('');
      setResults([]);
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isSearching]);

  // Query search endpoint
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const res = await searchSymbols(query);
        setResults(res.symbols || []);
        setSelectedIndex(0);
      } catch (err) {
        console.error('Search error:', err);
      }
    }, 120);

    return () => clearTimeout(timer);
  }, [query]);

  const handleSelect = (sym: SymbolInfo) => {
    if (sym.file !== activeFilePath) {
      selectFile(sym.file, sym.range.start.line);
    } else {
      jumpToLine(sym.range.start.line);
    }
    toggleSearch(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % Math.max(1, results.length));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + results.length) % Math.max(1, results.length));
    } else if (e.key === 'Enter' && results.length > 0) {
      e.preventDefault();
      handleSelect(results[selectedIndex]);
    }
  };

  if (!isSearching) return null;

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-start justify-center pt-14 z-50 select-none animate-in fade-in duration-100"
      onClick={() => toggleSearch(false)}
    >
      <div
        className="w-[620px] max-w-[90vw] bg-white dark:bg-[#252528] border border-slate-300 dark:border-[#3e3e42] rounded-xl shadow-2xl overflow-hidden flex flex-col transition-colors"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Command Palette Input */}
        <div className="flex items-center px-4 py-3 border-b border-slate-200 dark:border-[#333333] bg-slate-50/50 dark:bg-[#1e1e20]">
          <Search className="w-4 h-4 text-blue-500 mr-3 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a symbol name to open (e.g. PyLong_FromLong, Greet, Node)..."
            className="flex-1 bg-transparent text-[13px] text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-[#777777] outline-none"
          />
          <button
            onClick={() => toggleSearch(false)}
            className="p-1 hover:bg-slate-200 dark:hover:bg-[#333336] rounded text-slate-400 dark:text-[#888888] hover:text-slate-800 dark:hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Results List */}
        <div className="max-h-88 overflow-y-auto p-1.5 space-y-0.5">
          {results.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-400 dark:text-[#777777]">
              {query
                ? `No symbols matching "${query}"`
                : 'Search functions, structs, types, methods across codebase'}
            </div>
          ) : (
            results.map((sym, idx) => {
              const isSelected = idx === selectedIndex;
              const fileName = sym.file.split('/').pop() || sym.file;
              const iconColor = getFileIconColor(fileName);

              return (
                <div
                  key={sym.id}
                  onClick={() => handleSelect(sym)}
                  className={`flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer transition-colors text-xs ${
                    isSelected
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'hover:bg-slate-100 dark:hover:bg-[#2d2d30] text-slate-700 dark:text-[#cccccc]'
                  }`}
                >
                  <div className="flex items-center space-x-2.5 truncate">
                    <SymbolBadge kind={sym.kind} size="sm" />
                    <span className="font-mono font-semibold truncate text-[12px]">
                      {sym.name}
                    </span>
                    {sym.scope && (
                      <span
                        className={`text-[10.5px] font-mono truncate ${
                          isSelected
                            ? 'text-blue-100'
                            : 'text-slate-400 dark:text-[#888888]'
                        }`}
                      >
                        ({sym.scope})
                      </span>
                    )}
                  </div>

                  <div
                    className={`flex items-center space-x-2 text-[10.5px] font-mono shrink-0 pl-3 ${
                      isSelected
                        ? 'text-blue-100'
                        : 'text-slate-400 dark:text-[#777777]'
                    }`}
                  >
                    <span className={isSelected ? 'text-white' : iconColor}>
                      {fileName}:{sym.range.start.line}
                    </span>
                    {isSelected && (
                      <CornerDownLeft className="w-3.5 h-3.5 text-white shrink-0" />
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-3.5 py-2 bg-slate-50 dark:bg-[#1a1a1c] border-t border-slate-200 dark:border-[#333336] flex items-center justify-between text-[10.5px] text-slate-400 dark:text-[#777777]">
          <div className="flex items-center space-x-2.5">
            <span>Navigate:</span>
            <kbd className="bg-white dark:bg-[#2a2a2d] px-1.5 py-0.5 rounded text-slate-600 dark:text-[#999999] border border-slate-200 dark:border-[#3e3e42]">
              ↑
            </kbd>
            <kbd className="bg-white dark:bg-[#2a2a2d] px-1.5 py-0.5 rounded text-slate-600 dark:text-[#999999] border border-slate-200 dark:border-[#3e3e42]">
              ↓
            </kbd>
            <span>Open:</span>
            <kbd className="bg-white dark:bg-[#2a2a2d] px-1.5 py-0.5 rounded text-slate-600 dark:text-[#999999] border border-slate-200 dark:border-[#3e3e42]">
              ↵
            </kbd>
            <span>Dismiss:</span>
            <kbd className="bg-white dark:bg-[#2a2a2d] px-1.5 py-0.5 rounded text-slate-600 dark:text-[#999999] border border-slate-200 dark:border-[#3e3e42]">
              esc
            </kbd>
          </div>
          <span className="font-medium">Quick Open</span>
        </div>
      </div>
    </div>
  );
};
