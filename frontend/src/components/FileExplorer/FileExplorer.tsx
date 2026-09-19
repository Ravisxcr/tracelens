import React, { useState, useEffect } from 'react';
import {
  ChevronRight,
  ChevronDown,
  Folder,
  FolderOpen,
  FileCode2,
  GitGraph,
  Search,
  X,
} from 'lucide-react';
import { TreeNode } from '../../types';
import { useTraceStore } from '../../store/useTraceStore';
import { SymbolBadge } from '../UI/SymbolBadge';
import { getFileIconColor } from '../Editor/EditorTabs';

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
    sidebarWidth,
  } = useTraceStore();

  const [isWorkspaceOpen, setIsWorkspaceOpen] = useState(true);
  const [isOutlineOpen, setIsOutlineOpen] = useState(true);
  const [outlineFilter, setOutlineFilter] = useState('');
  const [showFilterInput, setShowFilterInput] = useState(false);

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
      <aside
        style={{ width: `${sidebarWidth}px` }}
        className="bg-slate-50 dark:bg-[#181818] border-r border-slate-200 dark:border-[#2b2b2b] p-3 text-xs text-slate-400 dark:text-[#777777] italic shrink-0"
      >
        Loading workspace...
      </aside>
    );
  }

  // Determine workspace root display name (e.g. TRACELENS)
  const workspaceName =
    tree.name && tree.name !== 'root'
      ? tree.name.toUpperCase()
      : tree.path
      ? tree.path.split('/').filter(Boolean).pop()?.toUpperCase() || 'TRACELENS'
      : 'WORKSPACE';

  // Extract root children so we never show an extra redundant "root" folder row
  const rootChildren = tree.isDir && tree.children ? tree.children : [tree];

  // Active file symbols for outline
  const activeSymbols = activeFile ? activeFile.symbols : [];
  const filteredSymbols = outlineFilter.trim()
    ? activeSymbols.filter(
        (s) =>
          s.name.toLowerCase().includes(outlineFilter.toLowerCase()) ||
          (s.scope && s.scope.toLowerCase().includes(outlineFilter.toLowerCase()))
      )
    : activeSymbols;

  return (
    <aside
      style={{ width: `${sidebarWidth}px` }}
      className="bg-slate-50 dark:bg-[#181818] border-r border-slate-200 dark:border-[#2b2b2b] flex flex-col h-full select-none text-xs shrink-0 transition-none z-20 overflow-hidden"
    >
      {/* VS Code Explorer Top Title Bar (Compact h-7) */}
      <div className="h-7 px-3 border-b border-slate-200 dark:border-[#2b2b2b] flex items-center text-slate-500 dark:text-[#bbbbbb] shrink-0 bg-transparent">
        <span className="uppercase font-bold text-[11px] tracking-wider text-slate-500 dark:text-[#999999]">
          Explorer
        </span>
      </div>

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* WORKSPACE FILES SECTION (VS Code style ▾ TRACELENS header) */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <button
            onClick={() => setIsWorkspaceOpen(!isWorkspaceOpen)}
            className="h-[22px] px-2 bg-transparent hover:bg-slate-200/50 dark:hover:bg-[#2a2d2e] flex items-center justify-between text-[11px] font-bold text-slate-700 dark:text-[#cccccc] uppercase tracking-wide cursor-pointer shrink-0"
          >
            <div className="flex items-center space-x-1 truncate">
              {isWorkspaceOpen ? (
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              )}
              <span className="truncate">{workspaceName}</span>
            </div>
            {tree.symbolCount !== undefined && tree.symbolCount > 0 && (
              <span className="text-[9.5px] font-mono font-normal text-slate-400 dark:text-[#666666]">
                {tree.symbolCount}
              </span>
            )}
          </button>

          {/* Tree list directly under TRACELENS (no extra "root" folder) */}
          {isWorkspaceOpen && (
            <div className="flex-1 overflow-y-auto py-0.5 select-none">
              {rootChildren.map((child) => (
                <TreeItem
                  key={child.path || child.name}
                  node={child}
                  activePath={activeFilePath}
                  onSelectFile={selectFile}
                  level={0}
                />
              ))}
            </div>
          )}
        </div>

        {/* OUTLINE SECTION (VS Code style collapsible section at bottom) */}
        <div className="border-t border-slate-200 dark:border-[#2b2b2b] flex flex-col shrink-0">
          <div className="h-[22px] px-2 bg-transparent hover:bg-slate-200/50 dark:hover:bg-[#2a2d2e] flex items-center justify-between text-[11px] font-bold text-slate-700 dark:text-[#cccccc] uppercase tracking-wide cursor-pointer shrink-0">
            <div
              onClick={() => setIsOutlineOpen(!isOutlineOpen)}
              className="flex items-center space-x-1 truncate flex-1 h-full"
            >
              {isOutlineOpen ? (
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              )}
              <span>Outline</span>
            </div>

            <div className="flex items-center space-x-1.5 text-[10px] text-slate-400 font-mono">
              {activeSymbols.length > 5 && isOutlineOpen && (
                <button
                  onClick={() => setShowFilterInput(!showFilterInput)}
                  className="p-0.5 rounded hover:bg-slate-200 dark:hover:bg-[#333336] text-slate-400 hover:text-slate-700 dark:hover:text-white"
                  title="Filter outline symbols"
                >
                  <Search className="w-3 h-3" />
                </button>
              )}
              {activeSymbols.length > 0 && <span>{activeSymbols.length}</span>}
            </div>
          </div>

          {/* Outline filter input (only if toggled) */}
          {isOutlineOpen && showFilterInput && (
            <div className="px-2 py-1 border-b border-slate-200 dark:border-[#2b2b2b] bg-slate-100/50 dark:bg-[#1e1e20]">
              <div className="relative flex items-center">
                <input
                  type="text"
                  value={outlineFilter}
                  onChange={(e) => setOutlineFilter(e.target.value)}
                  placeholder="Filter symbols..."
                  autoFocus
                  className="w-full h-5 px-1.5 bg-white dark:bg-[#26262a] border border-slate-200 dark:border-[#38383c] rounded text-[11px] text-slate-800 dark:text-[#dddddd] placeholder:text-slate-400 dark:placeholder:text-[#666666] outline-none"
                />
                {outlineFilter && (
                  <button
                    onClick={() => setOutlineFilter('')}
                    className="absolute right-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                  >
                    <X className="w-2.5 h-2.5" />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Outline symbols list */}
          {isOutlineOpen && (
            <div className="max-h-56 overflow-y-auto py-0.5 select-none divide-y divide-transparent">
              {activeSymbols.length === 0 ? (
                <div className="px-3 py-2 text-center text-slate-400 dark:text-[#666666] italic text-[11px]">
                  {activeFile ? 'No symbols in this file' : 'No file open'}
                </div>
              ) : filteredSymbols.length === 0 ? (
                <div className="px-3 py-2 text-center text-slate-400 dark:text-[#666666] text-[11px]">
                  No matching symbols
                </div>
              ) : (
                filteredSymbols.map((sym) => (
                  <div
                    key={sym.id}
                    onClick={() => jumpToLine(sym.range.start.line)}
                    className="group/sym h-[22px] flex items-center justify-between px-2 hover:bg-slate-200/50 dark:hover:bg-[#2a2d2e] cursor-pointer text-slate-700 dark:text-[#cccccc] hover:text-slate-900 dark:hover:text-white transition-colors"
                    title={`${sym.signature || sym.name} (Line ${sym.range.start.line})`}
                  >
                    <div className="flex items-center space-x-1.5 truncate">
                      <SymbolBadge kind={sym.kind} size="sm" />
                      <span className="truncate font-mono text-[11px]">{sym.name}</span>
                    </div>

                    <div className="flex items-center space-x-1 shrink-0 pl-1.5">
                      <span className="text-[10px] font-mono text-slate-400 dark:text-[#666666]">
                        :{sym.range.start.line}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          openCallGraph(sym.name, sym.file);
                        }}
                        className="opacity-0 group-hover/sym:opacity-100 p-0.5 hover:bg-blue-500/20 text-blue-600 dark:text-blue-400 rounded transition-opacity"
                        title="Trace in Call Graph"
                      >
                        <GitGraph className="w-2.5 h-2.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </aside>
  );
};

interface TreeItemProps {
  node: TreeNode;
  activePath: string | null;
  onSelectFile: (path: string) => Promise<void>;
  level: number;
}

const TreeItem: React.FC<TreeItemProps> = ({
  node,
  activePath,
  onSelectFile,
  level,
}) => {
  const [isOpen, setIsOpen] = useState<boolean>(level === 0);
  const isSelected = activePath === node.path;
  const paddingLeft = `${level * 10 + 12}px`;

  if (node.isDir) {
    return (
      <div>
        <div
          onClick={() => setIsOpen(!isOpen)}
          style={{ paddingLeft }}
          className="h-[22px] flex items-center space-x-1.5 px-2 hover:bg-slate-200/50 dark:hover:bg-[#2a2d2e] cursor-pointer text-slate-700 dark:text-[#cccccc] transition-colors"
        >
          {isOpen ? (
            <ChevronDown className="w-3 h-3 text-slate-400 shrink-0" />
          ) : (
            <ChevronRight className="w-3 h-3 text-slate-400 shrink-0" />
          )}
          {isOpen ? (
            <FolderOpen className="w-3.5 h-3.5 text-amber-500 dark:text-[#dcb67a] shrink-0" />
          ) : (
            <Folder className="w-3.5 h-3.5 text-amber-500 dark:text-[#dcb67a] shrink-0" />
          )}
          <span className="truncate text-[12px]">{node.name}</span>
          {node.symbolCount !== undefined && node.symbolCount > 0 && (
            <span className="text-[9.5px] text-slate-400 dark:text-[#666666] ml-auto pr-1 font-mono">
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
                onSelectFile={onSelectFile}
                level={level + 1}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  // File item
  const fileIconColor = getFileIconColor(node.name);

  return (
    <div
      style={{ paddingLeft }}
      className={`group h-[22px] flex items-center space-x-1.5 px-2 cursor-pointer transition-colors ${
        isSelected
          ? 'bg-blue-500/10 dark:bg-[#37373d] text-blue-600 dark:text-white font-medium border-l-2 border-blue-500'
          : 'text-slate-700 dark:text-[#cccccc] hover:bg-slate-200/50 dark:hover:bg-[#2a2d2e]'
      }`}
      onClick={() => onSelectFile(node.path)}
      title={node.path}
    >
      <FileCode2 className={`w-3.5 h-3.5 shrink-0 ${fileIconColor}`} />
      <span className="truncate text-[12px]">{node.name}</span>

      {node.symbolCount !== undefined && node.symbolCount > 0 && (
        <span className="text-[9px] text-slate-400 dark:text-[#666666] ml-auto pr-1 font-mono opacity-60 group-hover:opacity-100">
          {node.symbolCount}
        </span>
      )}
    </div>
  );
};
