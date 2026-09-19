import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { ExternalLink, GitBranch } from 'lucide-react';
import { CallGraphNodeData } from '../../types';
import { SymbolBadge } from '../UI/SymbolBadge';
import { useTraceStore } from '../../store/useTraceStore';

interface CustomNodeProps {
  data: CallGraphNodeData;
}

export const CustomSymbolNode: React.FC<CustomNodeProps> = memo(({ data }) => {
  const { selectFile, jumpToLine, openCallGraph, activeFilePath } = useTraceStore();

  const handleJumpToCode = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (data.file) {
      if (data.file !== activeFilePath) {
        selectFile(data.file, data.line);
      } else {
        jumpToLine(data.line);
      }
    }
  };

  const handleReCenterGraph = (e: React.MouseEvent) => {
    e.stopPropagation();
    openCallGraph(data.label, data.file);
  };

  return (
    <div
      className={`min-w-[220px] max-w-[280px] rounded-lg border shadow-lg transition-all ${
        data.isRoot
          ? 'bg-[#1e293b] border-blue-500 shadow-blue-500/20'
          : 'bg-[#252528] border-[#3e3e42] hover:border-[#55555c]'
      }`}
    >
      {/* Target handle (incoming calls from callers) */}
      <Handle
        type="target"
        position={Position.Left}
        className="!bg-blue-400 !w-2.5 !h-2.5 !border-2 !border-[#181818]"
      />

      {/* Node Header */}
      <div className="px-3 py-1.5 border-b border-[#333336] flex items-center justify-between">
        <div className="flex items-center space-x-1.5">
          <SymbolBadge kind={data.kind} size="sm" />
          <span className="text-[10px] font-mono text-[#888888] uppercase tracking-wider">
            {data.kind}
          </span>
        </div>

        {data.isRoot && (
          <span className="text-[10px] bg-blue-500/20 text-blue-300 font-semibold px-1.5 py-0.5 rounded border border-blue-500/30">
            Target
          </span>
        )}
      </div>

      {/* Node Content */}
      <div className="p-3 space-y-1.5">
        <div className="font-mono text-xs font-semibold text-white truncate" title={data.label}>
          {data.label}
        </div>

        {data.file && (
          <div className="text-[10px] text-[#888888] font-mono truncate" title={`${data.file}:${data.line}`}>
            {data.file.split('/').pop()}:{data.line}
          </div>
        )}

        {data.signature && (
          <div
            className="text-[10px] text-[#aaaaaa] font-mono bg-[#18181a] p-1.5 rounded border border-[#2d2d30] truncate"
            title={data.signature}
          >
            {data.signature}
          </div>
        )}
      </div>

      {/* Node Footer Actions */}
      <div className="px-3 py-1.5 bg-[#1f1f22] rounded-b-lg border-t border-[#333336] flex items-center justify-between text-[11px]">
        <button
          onClick={handleJumpToCode}
          className="flex items-center space-x-1 text-blue-400 hover:text-blue-300 transition-colors cursor-pointer"
          title="Jump directly to source in Monaco"
        >
          <ExternalLink className="w-3 h-3" />
          <span>Jump to Code</span>
        </button>

        {!data.isRoot && (
          <button
            onClick={handleReCenterGraph}
            className="flex items-center space-x-1 text-[#aaaaaa] hover:text-white transition-colors cursor-pointer"
            title="Inspect call graph for this symbol"
          >
            <GitBranch className="w-3 h-3" />
            <span>Trace</span>
          </button>
        )}
      </div>

      {/* Source handle (outgoing calls to callees) */}
      <Handle
        type="source"
        position={Position.Right}
        className="!bg-purple-400 !w-2.5 !h-2.5 !border-2 !border-[#181818]"
      />
    </div>
  );
});

