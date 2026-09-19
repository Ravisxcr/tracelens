import React, { useState, useEffect, useRef } from 'react';
import { Search, X, CornerDownLeft } from 'lucide-react';
import { SymbolInfo } from '../../types';
import { searchSymbols } from '../../api/client';
import { useTraceStore } from '../../store/useTraceStore';
import { SymbolBadge } from './SymbolBadge';

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
    }, 150);

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
      className="fixed inset-0 bg-black/50 dark:bg-black/60 backdrop-blur-xs flex items-start justify-center pt-20 z-50 select-none"
      onClick={() => toggleSearch(false)}
    >
      <div
        className="w-[580px] bg-white dark:bg-[#252528] border border-slate-200 dark:border-[#3e3e42] rounded-xl shadow-2xl overflow-hidden flex flex-col transition-colors"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input */}
        <div className="flex items-center px-3.5 py-2.5 border-b border-slate-200 dark:border-[#3e3e42] bg-slate-50 dark:bg-[#1e1e20]">
          <Search className="w-4 h-4 text-slate-400 dark:text-[#888888] mr-2.5 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type symbol name (e.g. PyLong_FromLong, IntObject, Greeter)..."
            className="flex-1 bg-transparent text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-[#666666] outline-none"
          />
          <button
            onClick={() => toggleSearch(false)}
            className="p-1 hover:bg-slate-200 dark:hover:bg-[#333336] rounded text-slate-400 dark:text-[#888888] hover:text-slate-800 dark:hover:text-white transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Results List */}
        <div className="max-h-80 overflow-y-auto p-1.5 space-y-0.5">
          {results.length === 0 ? (
            <div className="p-4 text-center text-xs text-slate-400 dark:text-[#777777]">
              {query ? 'No matching symbols found' : 'Type to search functions, structs, classes, variables'}
            </div>
          ) : (
            results.map((sym, idx) => (
              <div
                key={sym.id}
                onClick={() => handleSelect(sym)}
                className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg cursor-pointer transition-colors text-xs ${
                  idx === selectedIndex
                    ? 'bg-blue-50 dark:bg-[#3b82f6]/20 text-blue-900 dark:text-white border border-blue-200 dark:border-[#3b82f6]/40'
                    : 'hover:bg-slate-100 dark:hover:bg-[#2d2d30] text-slate-700 dark:text-[#cccccc]'
                }`}
              >
                <div className="flex items-center space-x-2 truncate">
                  <SymbolBadge kind={sym.kind} />
                  <span className="font-mono font-semibold truncate text-[11.5px]">{sym.name}</span>
                  {sym.scope && (
                    <span className="text-[10px] text-slate-400 dark:text-[#888888] font-mono truncate">
                      ({sym.scope})
                    </span>
                  )}
                </div>

                <div className="flex items-center space-x-2 text-[10px] text-slate-400 dark:text-[#777777] font-mono shrink-0 pl-3">
                  <span>{sym.file.split('/').pop()}:{sym.range.start.line}</span>
                  {idx === selectedIndex && (
                    <CornerDownLeft className="w-3 h-3 text-blue-500 dark:text-blue-400 shrink-0" />
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="px-3 py-1.5 bg-slate-50 dark:bg-[#1a1a1c] border-t border-slate-200 dark:border-[#333336] flex items-center justify-between text-[10px] text-slate-400 dark:text-[#777777]">
          <div className="flex items-center space-x-2">
            <span>Navigation:</span>
            <kbd className="bg-white dark:bg-[#2a2a2d] px-1 py-0.5 rounded text-slate-500 dark:text-[#999999] border border-slate-200 dark:border-[#3e3e42]">↑</kbd>
            <kbd className="bg-white dark:bg-[#2a2a2d] px-1 py-0.5 rounded text-slate-500 dark:text-[#999999] border border-slate-200 dark:border-[#3e3e42]">↓</kbd>
            <span>Select:</span>
            <kbd className="bg-white dark:bg-[#2a2a2d] px-1 py-0.5 rounded text-slate-500 dark:text-[#999999] border border-slate-200 dark:border-[#3e3e42]">↵</kbd>
          </div>
          <span>TraceLens Global Index</span>
        </div>
      </div>
    </div>
  );
};
