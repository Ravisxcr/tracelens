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
      className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-start justify-center pt-20 z-50 select-none"
      onClick={() => toggleSearch(false)}
    >
      <div
        className="w-[600px] bg-[#252528] border border-[#3e3e42] rounded-xl shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input */}
        <div className="flex items-center px-4 py-3 border-b border-[#3e3e42] bg-[#1e1e20]">
          <Search className="w-4 h-4 text-[#888888] mr-3 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type symbol name (e.g. Greeter, Greet, fetchData)..."
            className="flex-1 bg-transparent text-sm text-white placeholder-[#666666] outline-none"
          />
          <button
            onClick={() => toggleSearch(false)}
            className="p-1 hover:bg-[#333336] rounded text-[#888888] hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Results List */}
        <div className="max-h-80 overflow-y-auto p-1.5 space-y-0.5">
          {results.length === 0 ? (
            <div className="p-4 text-center text-xs text-[#777777]">
              {query ? 'No matching symbols found' : 'Type to search all functions, methods, and types'}
            </div>
          ) : (
            results.map((sym, idx) => (
              <div
                key={sym.id}
                onClick={() => handleSelect(sym)}
                className={`flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer transition-colors text-xs ${
                  idx === selectedIndex ? 'bg-[#3b82f6]/20 text-white border border-[#3b82f6]/40' : 'hover:bg-[#2d2d30] text-[#cccccc]'
                }`}
              >
                <div className="flex items-center space-x-2 truncate">
                  <SymbolBadge kind={sym.kind} />
                  <span className="font-mono font-semibold truncate">{sym.name}</span>
                  {sym.scope && (
                    <span className="text-[10px] text-[#888888] font-mono truncate">
                      ({sym.scope})
                    </span>
                  )}
                </div>

                <div className="flex items-center space-x-2 text-[10px] text-[#777777] font-mono shrink-0 pl-3">
                  <span>{sym.file.split('/').pop()}:{sym.range.start.line}</span>
                  {idx === selectedIndex && (
                    <CornerDownLeft className="w-3 h-3 text-blue-400 shrink-0" />
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="px-3 py-1.5 bg-[#1a1a1c] border-t border-[#333336] flex items-center justify-between text-[10px] text-[#777777]">
          <div className="flex items-center space-x-2">
            <span>Navigation:</span>
            <kbd className="bg-[#2a2a2d] px-1 py-0.5 rounded text-[#999999] border border-[#3e3e42]">↑</kbd>
            <kbd className="bg-[#2a2a2d] px-1 py-0.5 rounded text-[#999999] border border-[#3e3e42]">↓</kbd>
            <span>Select:</span>
            <kbd className="bg-[#2a2a2d] px-1 py-0.5 rounded text-[#999999] border border-[#3e3e42]">↵</kbd>
          </div>
          <span>TraceLens Global Index</span>
        </div>
      </div>
    </div>
  );
};

