import React, { useState } from 'react';
import {
  ChevronRight,
  ChevronDown,
  Folder,
  FolderOpen,
  FileCode,
  Network,
  GitGraph,
} from 'lucide-react';
import { TreeNode, SymbolInfo } from '../../types';
import { useTraceStore } from '../../store/useTraceStore';
import { SymbolBadge } from '../UI/SymbolBadge';

export const FileExplorer: React.FC = () => {
  const { tree, activeFilePath, activeFile, selectFile, jumpToLine, openCallGraph } = useTraceStore();

  if (!tree) {
    return (
      <div className="p-4 text-xs text-[#777777] italic">
        Loading workspace tree...
      </div>
    );
  }

  return (
    <div className="w-64 bg-[#252526] border-r border-[#333333] flex flex-col h-full select-none text-xs">
      <div className="px-3 py-2 uppercase font-bold text-[11px] text-[#888888] tracking-wider border-b border-[#333333] flex items-center justify-between">
        <span>Explorer</span>
        <span className="text-[10px] bg-[#333333] px-1.5 py-0.5 rounded text-[#aaaaaa]">
          read-only
        </span>
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
    </div>
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
  const paddingLeft = `${level * 12 + 10}px`;

  if (node.isDir) {
    return (
      <div>
        <div
          onClick={() => setIsOpen(!isOpen)}
          style={{ paddingLeft }}
          className="flex items-center space-x-1.5 py-1 px-2 hover:bg-[#2a2d2e] cursor-pointer text-[#cccccc] transition-colors"
        >
          {isOpen ? (
            <ChevronDown className="w-3.5 h-3.5 text-[#888888] shrink-0" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5 text-[#888888] shrink-0" />
          )}
          {isOpen ? (
            <FolderOpen className="w-4 h-4 text-[#dcb67a] shrink-0" />
          ) : (
            <Folder className="w-4 h-4 text-[#dcb67a] shrink-0" />
          )}
          <span className="truncate font-medium">{node.name || 'root'}</span>
          {node.symbolCount !== undefined && node.symbolCount > 0 && (
            <span className="text-[10px] text-[#666666] ml-auto pr-1">
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
        className={`group flex items-center space-x-1.5 py-1 px-2 cursor-pointer transition-colors ${
          isSelected
            ? 'bg-[#37373d] text-white font-medium'
            : 'text-[#cccccc] hover:bg-[#2a2d2e]'
        }`}
        onClick={() => onSelectFile(node.path)}
      >
        {isSelected && activeSymbols.length > 0 ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsSymbolsOpen(!isSymbolsOpen);
            }}
            className="p-0.5 hover:bg-[#444449] rounded"
          >
            {isSymbolsOpen ? (
              <ChevronDown className="w-3 h-3 text-[#aaaaaa]" />
            ) : (
              <ChevronRight className="w-3 h-3 text-[#aaaaaa]" />
            )}
          </button>
        ) : (
          <span className="w-3 h-3 shrink-0" />
        )}

        <FileCode className="w-4 h-4 text-[#519aba] shrink-0" />
        <span className="truncate">{node.name}</span>

        {node.symbolCount !== undefined && node.symbolCount > 0 && (
          <span className="text-[10px] text-[#777777] bg-[#1e1e1e] px-1 rounded ml-auto">
            {node.symbolCount}
          </span>
        )}
      </div>

      {/* Expanded Symbols inside current active file */}
      {isSelected && isSymbolsOpen && activeSymbols.length > 0 && (
        <div className="bg-[#1e1e1f] py-0.5 border-y border-[#2d2d30]">
          {activeSymbols.map((sym) => (
            <div
              key={sym.id}
              style={{ paddingLeft: `${(level + 2) * 12}px` }}
              className="group/sym flex items-center justify-between py-0.5 px-2 hover:bg-[#2a2d2e] cursor-pointer text-[#aaaaaa] hover:text-white"
              onClick={() => onJumpLine(sym.range.start.line)}
              title={`${sym.signature || sym.name} (Line ${sym.range.start.line})`}
            >
              <div className="flex items-center space-x-1.5 truncate">
                <SymbolBadge kind={sym.kind} />
                <span className="truncate font-mono text-[11px]">{sym.name}</span>
              </div>

              {/* Call graph launcher icon */}
              {(sym.kind === 'function' || sym.kind === 'method') && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenGraph(sym.name, sym.file);
                  }}
                  className="opacity-0 group-hover/sym:opacity-100 p-0.5 hover:bg-blue-600/30 text-blue-400 rounded transition-opacity"
                  title="Trace in Call Graph"
                >
                  <GitGraph className="w-3 h-3" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

