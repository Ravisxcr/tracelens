import React, { useState, useEffect } from 'react';
import {
  ChevronRight,
  ChevronDown,
  Folder,
  FolderOpen,
  FileCode,
  GitGraph,
  PanelLeftClose,
} from 'lucide-react';
import { TreeNode, SymbolInfo } from '../../types';
import { useTraceStore } from '../../store/useTraceStore';
import { SymbolBadge } from '../UI/SymbolBadge';

export const FileExplorer: React.FC = () => {
  const {
    tree,
    activeFilePath,
    activeFile,
    selectFile,
    jumpToLine,
    openCallGraph,
    isSidebarOpen,
    toggleSidebar,
  } = useTraceStore();

  // Keyboard shortcut: Cmd+B / Ctrl+B to toggle sidebar
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        toggleSidebar();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleSidebar]);

  if (!isSidebarOpen) {
    return null;
  }

  if (!tree) {
    return (
      <div className="w-56 bg-slate-50 dark:bg-[#252526] border-r border-slate-200 dark:border-[#333333] p-3 text-xs text-slate-400 dark:text-[#777777] italic">
        Loading workspace tree...
      </div>
    );
  }

  return (
    <aside className="w-60 bg-slate-50 dark:bg-[#252526] border-r border-slate-200 dark:border-[#333333] flex flex-col h-full select-none text-xs shrink-0 transition-colors">
      <div className="px-2.5 py-1.5 uppercase font-bold text-[10px] text-slate-500 dark:text-[#888888] tracking-wider border-b border-slate-200 dark:border-[#333333] flex items-center justify-between">
        <span className="truncate">Files & Symbols</span>
        <button
          onClick={() => toggleSidebar(false)}
          className="p-0.5 rounded hover:bg-slate-200 dark:hover:bg-[#333336] text-slate-400 dark:text-[#777777] hover:text-slate-800 dark:hover:text-white transition-colors cursor-pointer"
          title="Collapse Explorer (⌘B)"
        >
          <PanelLeftClose className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto py-1">
        <TreeItem
          node={tree}
          activePath={activeFilePath}
          activeSymbols={activeFile ? activeFile.symbols : []}
          onSelectFile={selectFile}
          onJumpLine={jumpToLine}
          onOpenGraph={openCallGraph}
          level={0}
        />
      </div>
    </aside>
  );
};

interface TreeItemProps {
  node: TreeNode;
  activePath: string | null;
  activeSymbols: SymbolInfo[];
  onSelectFile: (path: string) => Promise<void>;
  onJumpLine: (line: number) => void;
  onOpenGraph: (symbol: string, file?: string) => Promise<void>;
  level: number;
}

const TreeItem: React.FC<TreeItemProps> = ({
  node,
  activePath,
  activeSymbols,
  onSelectFile,
  onJumpLine,
  onOpenGraph,
  level,
}) => {
  const [isOpen, setIsOpen] = useState<boolean>(level === 0 || level === 1);
  const [isSymbolsOpen, setIsSymbolsOpen] = useState<boolean>(false);

  const isSelected = activePath === node.path;
  const paddingLeft = `${level * 10 + 8}px`;

  if (node.isDir) {
    return (
      <div>
        <div
          onClick={() => setIsOpen(!isOpen)}
          style={{ paddingLeft }}
          className="flex items-center space-x-1.5 py-0.8 px-2 hover:bg-slate-200/60 dark:hover:bg-[#2a2d2e] cursor-pointer text-slate-700 dark:text-[#cccccc] transition-colors"
        >
          {isOpen ? (
            <ChevronDown className="w-3 h-3 text-slate-400 dark:text-[#888888] shrink-0" />
          ) : (
            <ChevronRight className="w-3 h-3 text-slate-400 dark:text-[#888888] shrink-0" />
          )}
          {isOpen ? (
            <FolderOpen className="w-3.5 h-3.5 text-amber-500 dark:text-[#dcb67a] shrink-0" />
          ) : (
            <Folder className="w-3.5 h-3.5 text-amber-500 dark:text-[#dcb67a] shrink-0" />
          )}
          <span className="truncate font-medium">{node.name || 'root'}</span>
          {node.symbolCount !== undefined && node.symbolCount > 0 && (
            <span className="text-[9px] text-slate-400 dark:text-[#666666] ml-auto pr-1 font-mono">
              {node.symbolCount}
            </span>
          )}
        </div>

        {isOpen && node.children && (
          <div>
            {node.children.map((child) => (
              <TreeItem
                key={child.path || child.name}
                node={child}
                activePath={activePath}
                activeSymbols={activeSymbols}
                onSelectFile={onSelectFile}
                onJumpLine={onJumpLine}
                onOpenGraph={onOpenGraph}
                level={level + 1}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  // File item
  return (
    <div>
      <div
        style={{ paddingLeft }}
        className={`group flex items-center space-x-1.5 py-0.8 px-2 cursor-pointer transition-colors ${
          isSelected
            ? 'bg-blue-100 dark:bg-[#37373d] text-blue-900 dark:text-white font-medium'
            : 'text-slate-700 dark:text-[#cccccc] hover:bg-slate-200/60 dark:hover:bg-[#2a2d2e]'
        }`}
        onClick={() => onSelectFile(node.path)}
      >
        {isSelected && activeSymbols.length > 0 ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsSymbolsOpen(!isSymbolsOpen);
            }}
            className="p-0.5 hover:bg-slate-300 dark:hover:bg-[#444449] rounded"
          >
            {isSymbolsOpen ? (
              <ChevronDown className="w-2.5 h-2.5 text-slate-500 dark:text-[#aaaaaa]" />
            ) : (
              <ChevronRight className="w-2.5 h-2.5 text-slate-500 dark:text-[#aaaaaa]" />
            )}
          </button>
        ) : (
          <span className="w-2.5 h-2.5 shrink-0" />
        )}

        <FileCode className="w-3.5 h-3.5 text-blue-500 dark:text-[#519aba] shrink-0" />
        <span className="truncate">{node.name}</span>

        {node.symbolCount !== undefined && node.symbolCount > 0 && (
          <span className="text-[9px] text-slate-500 dark:text-[#777777] bg-slate-200/70 dark:bg-[#1e1e1e] px-1 rounded ml-auto font-mono">
            {node.symbolCount}
          </span>
        )}
      </div>

      {/* Expanded Symbols inside current active file */}
      {isSelected && isSymbolsOpen && activeSymbols.length > 0 && (
        <div className="bg-slate-100 dark:bg-[#1e1e1f] py-0.5 border-y border-slate-200 dark:border-[#2d2d30]">
          {activeSymbols.map((sym) => (
            <div
              key={sym.id}
              style={{ paddingLeft: `${(level + 2) * 10}px` }}
              className="group/sym flex items-center justify-between py-0.5 px-2 hover:bg-slate-200/80 dark:hover:bg-[#2a2d2e] cursor-pointer text-slate-600 dark:text-[#aaaaaa] hover:text-slate-900 dark:hover:text-white"
              onClick={() => onJumpLine(sym.range.start.line)}
              title={`${sym.signature || sym.name} (Line ${sym.range.start.line})`}
            >
              <div className="flex items-center space-x-1.5 truncate">
                <SymbolBadge kind={sym.kind} />
                <span className="truncate font-mono text-[10.5px]">{sym.name}</span>
              </div>

              {/* Call graph launcher icon */}
              {(sym.category === 'function' || sym.category === 'type' || sym.category === 'variable') && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenGraph(sym.name, sym.file);
                  }}
                  className="opacity-0 group-hover/sym:opacity-100 p-0.5 hover:bg-blue-500/20 text-blue-600 dark:text-blue-400 rounded transition-opacity"
                  title="Trace in Graph"
                >
                  <GitGraph className="w-2.5 h-2.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
