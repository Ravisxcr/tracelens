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
  HelpCircle,
  Loader2,
} from 'lucide-react';
import { useTraceStore } from '../../store/useTraceStore';
import { useTheme } from '../../store/useTheme';

interface HeaderProps {
  onOpenShortcuts?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onOpenShortcuts }) => {
  const {
    stats,
    isLoading,
    isGraphOpen,
    openCallGraph,
    closeCallGraph,
    toggleSearch,
    activeFile,
    callGraphSymbol,
    isSidebarOpen,
    toggleSidebar,
  } = useTraceStore();

  const { theme, resolvedTheme, cycleTheme } = useTheme();

  const handleToggleGraph = () => {
    if (isGraphOpen) {
      closeCallGraph();
    } else if (activeFile && activeFile.symbols.length > 0) {
      const target = callGraphSymbol ?? activeFile.symbols[0].name;
      openCallGraph(target, activeFile.path);
    }
  };

  return (
    <header className="h-8 bg-slate-100 dark:bg-[#181818] border-b border-slate-200 dark:border-[#2b2b2b] flex items-center justify-between px-2.5 select-none shrink-0 z-40 transition-none">
      {/* Left: Sidebar Toggle & Brand */}
      <div className="flex items-center space-x-2">
        <button
          onClick={() => toggleSidebar()}
          className="p-1 hover:bg-slate-200 dark:hover:bg-[#2d2d30] rounded text-slate-500 dark:text-[#888888] hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
          title={isSidebarOpen ? 'Collapse Explorer (⌘B)' : 'Expand Explorer (⌘B)'}
        >
          {isSidebarOpen ? (
            <PanelLeftClose className="w-3.5 h-3.5" />
          ) : (
            <PanelLeft className="w-3.5 h-3.5 text-blue-500 dark:text-blue-400" />
          )}
        </button>

        <div className="flex items-center space-x-1.5 font-semibold text-xs tracking-wide text-slate-800 dark:text-white">
          <div className="w-[18px] h-[18px] rounded bg-blue-600 dark:bg-blue-500 flex items-center justify-center text-white shadow-xs">
            <Network className="w-3 h-3" />
          </div>
          <span>TraceLens</span>
        </div>

        {/* Indexing / Stats pill */}
        {isLoading ? (
          <span className="hidden sm:inline-flex items-center space-x-1 text-[10px] text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/50 px-2 py-0.5 rounded-full border border-blue-200 dark:border-blue-900/50 animate-pulse">
            <Loader2 className="w-2.5 h-2.5 animate-spin" />
            <span>Indexing...</span>
          </span>
        ) : stats ? (
          <span className="hidden md:inline-flex items-center text-[10px] text-slate-500 dark:text-[#888888] bg-slate-200/50 dark:bg-[#252528] px-2 py-0.2 rounded-full border border-slate-300/50 dark:border-[#333333]">
            {stats.totalFiles} files • {stats.totalSymbols} symbols
          </span>
        ) : null}
      </div>

      {/* Center: Command Palette Trigger */}
      <div className="flex-1 max-w-sm mx-3">
        <button
          onClick={() => toggleSearch(true)}
          className="w-full h-6 flex items-center justify-between bg-white dark:bg-[#252528] hover:bg-slate-50 dark:hover:bg-[#2d2d30] border border-slate-200 dark:border-[#38383c] hover:border-blue-400 dark:hover:border-[#55555a] px-2.5 rounded text-[11px] text-slate-500 dark:text-[#999999] hover:text-slate-900 dark:hover:text-white transition-all cursor-pointer shadow-xs"
          title="Search symbols or files (⌘P)"
        >
          <div className="flex items-center space-x-1.5 truncate">
            <Search className="w-3 h-3 text-slate-400 dark:text-[#777777]" />
            <span className="truncate">Search symbols or files...</span>
          </div>
          <kbd className="bg-slate-100 dark:bg-[#18181a] px-1.5 py-0.2 rounded text-[9.5px] text-slate-400 dark:text-[#888888] border border-slate-200 dark:border-[#444448]">
            ⌘P
          </kbd>
        </button>
      </div>

      {/* Right: Layout actions, Help, Theme */}
      <div className="flex items-center space-x-1">
        {/* Call Graph Toggle Button */}
        <button
          onClick={handleToggleGraph}
          disabled={!activeFile || activeFile.symbols.length === 0}
          className={`flex items-center space-x-1 px-2 py-0.5 rounded text-[11px] font-medium border transition-colors cursor-pointer ${
            isGraphOpen
              ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-300 border-blue-300 dark:border-blue-700/60'
              : 'bg-white dark:bg-[#252528] hover:bg-slate-50 dark:hover:bg-[#2d2d30] text-slate-700 dark:text-[#cccccc] border-slate-200 dark:border-[#38383c]'
          } disabled:opacity-30 disabled:cursor-not-allowed`}
          title="Toggle execution call graph"
        >
          <GitGraph className="w-3 h-3 text-blue-500 dark:text-blue-400" />
          <span className="hidden sm:inline">Graph</span>
        </button>

        {/* Shortcuts & Help */}
        <button
          onClick={onOpenShortcuts}
          className="p-1 rounded hover:bg-slate-200 dark:hover:bg-[#2d2d30] text-slate-500 dark:text-[#888888] hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
          title="Keyboard Shortcuts & Help"
        >
          <HelpCircle className="w-3.5 h-3.5" />
        </button>

        {/* Theme Cycle Button */}
        <button
          onClick={cycleTheme}
          className="p-1 rounded hover:bg-slate-200 dark:hover:bg-[#2d2d30] text-slate-600 dark:text-[#aaaaaa] hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer border border-transparent hover:border-slate-200 dark:hover:border-[#3e3e42]"
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
