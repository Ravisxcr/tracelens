import React from 'react';
import { Network, Search, FolderCode, GitGraph, FileCode2, Layers } from 'lucide-react';
import { useTraceStore } from '../../store/useTraceStore';

export const Header: React.FC = () => {
  const { stats, isGraphOpen, openCallGraph, toggleSearch, activeFile, callGraphSymbol } = useTraceStore();

  return (
    <header className="h-12 bg-[#1f1f20] border-b border-[#333333] flex items-center justify-between px-4 select-none shrink-0 z-20">
      {/* Brand & Project Info */}
      <div className="flex items-center space-x-3">
        <div className="flex items-center space-x-2 text-blue-400 font-semibold text-sm tracking-wide">
          <Network className="w-5 h-5 text-blue-400" />
          <span className="text-white font-bold">Trace<span className="text-blue-400">Lens</span></span>
        </div>

        <span className="text-[#555555]">|</span>

        {/* Stats indicators */}
        {stats && (
          <div className="flex items-center space-x-3 text-xs text-[#888888]">
            <span className="flex items-center space-x-1" title="Indexed files">
              <FileCode2 className="w-3.5 h-3.5 text-[#666666]" />
              <span>{stats.totalFiles} files</span>
            </span>
            <span className="flex items-center space-x-1" title="Extracted AST symbols">
              <Layers className="w-3.5 h-3.5 text-[#666666]" />
              <span>{stats.totalSymbols} symbols</span>
            </span>
            <span className="flex items-center space-x-1" title="Indexed call expressions">
              <GitGraph className="w-3.5 h-3.5 text-[#666666]" />
              <span>{stats.totalCalls} calls</span>
            </span>
          </div>
        )}
      </div>

      {/* Quick Search & Actions */}
      <div className="flex items-center space-x-2">
        <button
          onClick={() => toggleSearch(true)}
          className="flex items-center space-x-2 bg-[#2a2a2b] hover:bg-[#353538] border border-[#3e3e42] px-3 py-1 rounded text-xs text-[#aaaaaa] hover:text-white transition-colors cursor-pointer"
          title="Search symbols (Cmd+P)"
        >
          <Search className="w-3.5 h-3.5" />
          <span>Quick Symbol Search...</span>
          <kbd className="bg-[#1e1e1e] px-1.5 py-0.5 rounded text-[10px] text-[#777777] border border-[#3e3e42]">
            ⌘P
          </kbd>
        </button>

        {/* Call Graph Toggle Button */}
        <button
          onClick={() => {
            if (activeFile && activeFile.symbols.length > 0) {
              const target = callGraphSymbol ?? activeFile.symbols[0].name;
              openCallGraph(target, activeFile.path);
            }
          }}
          disabled={!activeFile || activeFile.symbols.length === 0}
          className={`flex items-center space-x-1.5 px-3 py-1 rounded text-xs font-medium border transition-colors cursor-pointer ${
            isGraphOpen
              ? 'bg-blue-600/30 text-blue-300 border-blue-500/50'
              : 'bg-[#2a2a2b] hover:bg-[#353538] text-[#cccccc] border-[#3e3e42]'
          } disabled:opacity-40 disabled:cursor-not-allowed`}
          title="Toggle execution / call graph panel"
        >
          <GitGraph className="w-3.5 h-3.5 text-blue-400" />
          <span>Call Graph</span>
        </button>
      </div>
    </header>
  );
};

