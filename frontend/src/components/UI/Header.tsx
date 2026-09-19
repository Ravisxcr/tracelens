import React from 'react';
import {
  Network,
  Search,
  GitGraph,
  PanelLeftClose,
  PanelLeft,
  Sun,
  Moon,
  Laptop,
} from 'lucide-react';
import { useTraceStore } from '../../store/useTraceStore';
import { useTheme } from '../../store/useTheme';

export const Header: React.FC = () => {
  const {
    stats,
    isGraphOpen,
    openCallGraph,
    toggleSearch,
    activeFile,
    callGraphSymbol,
    isSidebarOpen,
    toggleSidebar,
  } = useTraceStore();

  const { theme, resolvedTheme, cycleTheme } = useTheme();

  return (
    <header className="h-8.5 bg-white dark:bg-[#1f1f22] border-b border-slate-200 dark:border-[#333333] flex items-center justify-between px-2.5 select-none shrink-0 z-20 transition-colors">
      {/* Left: Sidebar Toggle & Brand */}
      <div className="flex items-center space-x-2">
        <button
          onClick={() => toggleSidebar()}
          className="p-1 hover:bg-slate-100 dark:hover:bg-[#2d2d30] rounded text-slate-500 dark:text-[#888888] hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
          title={isSidebarOpen ? 'Collapse Explorer (⌘B)' : 'Expand Explorer (⌘B)'}
        >
          {isSidebarOpen ? (
            <PanelLeftClose className="w-3.5 h-3.5" />
          ) : (
            <PanelLeft className="w-3.5 h-3.5 text-blue-500 dark:text-blue-400" />
          )}
        </button>

        <div className="flex items-center space-x-1.5 font-semibold text-xs tracking-wide text-slate-800 dark:text-white">
          <Network className="w-3.5 h-3.5 text-blue-500 dark:text-blue-400 shrink-0" />
          <span>Trace<span className="text-blue-500 dark:text-blue-400">Lens</span></span>
        </div>

        {/* Compact stats pill */}
        {stats && (
          <span className="hidden sm:inline-flex items-center text-[10px] text-slate-500 dark:text-[#777777] bg-slate-100 dark:bg-[#28282b] px-1.5 py-0.5 rounded border border-slate-200 dark:border-[#3a3a3d]">
            {stats.totalFiles} files • {stats.totalSymbols} symbols
          </span>
        )}
      </div>

      {/* Center: Quick Search Trigger */}
      <div className="flex items-center">
        <button
          onClick={() => toggleSearch(true)}
          className="flex items-center space-x-1.5 bg-slate-100 dark:bg-[#28282b] hover:bg-slate-200 dark:hover:bg-[#323236] border border-slate-200 dark:border-[#3a3a3d] px-2.5 py-0.5 rounded text-[11px] text-slate-500 dark:text-[#999999] hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
          title="Search symbols (⌘P)"
        >
          <Search className="w-3 h-3 text-slate-400 dark:text-[#777777]" />
          <span className="hidden md:inline">Quick Symbol Search...</span>
          <kbd className="bg-white dark:bg-[#1e1e20] px-1 py-0.2 rounded text-[9px] text-slate-400 dark:text-[#777777] border border-slate-200 dark:border-[#444448]">
            ⌘P
          </kbd>
        </button>
      </div>

      {/* Right: Call Graph & Theme Toggle */}
      <div className="flex items-center space-x-1.5">
        {/* Call Graph Toggle Button */}
        <button
          onClick={() => {
            if (activeFile && activeFile.symbols.length > 0) {
              const target = callGraphSymbol ?? activeFile.symbols[0].name;
              openCallGraph(target, activeFile.path);
            }
          }}
          disabled={!activeFile || activeFile.symbols.length === 0}
          className={`flex items-center space-x-1 px-2 py-0.5 rounded text-[11px] font-medium border transition-colors cursor-pointer ${
            isGraphOpen
              ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-300 border-blue-300 dark:border-blue-700/60'
              : 'bg-slate-100 dark:bg-[#28282b] hover:bg-slate-200 dark:hover:bg-[#323236] text-slate-700 dark:text-[#cccccc] border-slate-200 dark:border-[#3a3a3d]'
          } disabled:opacity-40 disabled:cursor-not-allowed`}
          title="Toggle execution call graph"
        >
          <GitGraph className="w-3 h-3 text-blue-500 dark:text-blue-400" />
          <span className="hidden sm:inline">Graph</span>
        </button>

        {/* Theme Cycle Button */}
        <button
          onClick={cycleTheme}
          className="p-1 rounded hover:bg-slate-100 dark:hover:bg-[#2d2d30] text-slate-600 dark:text-[#aaaaaa] hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer border border-transparent hover:border-slate-200 dark:hover:border-[#3e3e42]"
          title={`Theme: ${theme.toUpperCase()} (Click to toggle)`}
        >
          {theme === 'system' ? (
            <Laptop className="w-3.5 h-3.5" />
          ) : resolvedTheme === 'dark' ? (
            <Moon className="w-3.5 h-3.5 text-amber-300" />
          ) : (
            <Sun className="w-3.5 h-3.5 text-amber-500" />
          )}
        </button>
      </div>
    </header>
  );
};
