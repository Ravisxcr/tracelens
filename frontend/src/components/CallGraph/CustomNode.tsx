import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { ExternalLink, GitBranch, Play, Database, Box } from 'lucide-react';
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

  // Determine styling based on category
  const getCategoryStyles = () => {
    if (data.isRoot) {
      return {
        cardBg: 'bg-blue-50/90 dark:bg-[#1b2533]',
        borderColor: 'border-blue-500 ring-2 ring-blue-500/30 shadow-lg shadow-blue-500/10',
        headerText: 'TARGET SYMBOL',
        headerColor: 'text-blue-700 dark:text-blue-300',
        icon: <Play className="w-3 h-3 text-blue-500 dark:text-blue-400" />,
      };
    }

    switch (data.category) {
      case 'type':
        return {
          cardBg: 'bg-emerald-50/90 dark:bg-[#12241d]',
          borderColor: 'border-emerald-500/70 hover:border-emerald-500 shadow-md shadow-emerald-500/5',
          headerText: 'DATATYPE / STRUCT',
          headerColor: 'text-emerald-700 dark:text-emerald-300',
          icon: <Database className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />,
        };
      case 'variable':
        return {
          cardBg: 'bg-amber-50/90 dark:bg-[#261f14]',
          borderColor: 'border-amber-500/70 hover:border-amber-500 shadow-md shadow-amber-500/5',
          headerText: 'VARIABLE / OBJECT',
          headerColor: 'text-amber-700 dark:text-amber-300',
          icon: <Box className="w-3 h-3 text-amber-600 dark:text-amber-400" />,
        };
      case 'function':
      default:
        return {
          cardBg: 'bg-white dark:bg-[#1e1e24]',
          borderColor: 'border-blue-400/70 dark:border-blue-700/60 hover:border-blue-500 shadow-md shadow-blue-500/5',
          headerText: 'FUNCTION / METHOD',
          headerColor: 'text-blue-700 dark:text-blue-300',
          icon: <Play className="w-3 h-3 text-blue-600 dark:text-blue-400" />,
        };
    }
  };

  const styles = getCategoryStyles();

  return (
    <div
      className={`w-[260px] rounded-lg border backdrop-blur-xs transition-all ${styles.cardBg} ${styles.borderColor}`}
    >
      {/* Target handle (incoming calls from callers) */}
      <Handle
        type="target"
        position={Position.Left}
        className="!bg-blue-500 dark:!bg-blue-400 !w-2.5 !h-2.5 !border-2 !border-white dark:!border-[#121214]"
      />

      {/* Node Header with Category Indicator */}
      <div className="px-2.5 py-1 border-b border-slate-200 dark:border-white/10 flex items-center justify-between">
        <div className="flex items-center space-x-1.5 truncate">
          {styles.icon}
          <span className={`text-[9.5px] font-mono font-bold tracking-wider truncate ${styles.headerColor}`}>
            {styles.headerText}
          </span>
        </div>

        <SymbolBadge kind={data.kind} size="sm" />
      </div>

      {/* Main Symbol Info */}
      <div className="p-2.5 space-y-1">
        <div className="font-mono text-xs font-bold text-slate-900 dark:text-white truncate" title={data.label}>
          {data.label}
        </div>

        {data.file && (
          <div className="text-[10px] text-slate-500 dark:text-[#888888] font-mono truncate" title={`${data.file}:${data.line}`}>
            {data.file.split('/').pop()}:{data.line}
          </div>
        )}

        {data.signature && (
          <div
            className="text-[10px] text-slate-700 dark:text-[#cccccc] font-mono bg-slate-100 dark:bg-black/40 px-2 py-0.5 rounded border border-slate-200 dark:border-white/5 truncate"
            title={data.signature}
          >
            {data.signature}
          </div>
        )}
      </div>

      {/* Node Footer Actions */}
      <div className="px-2.5 py-1 bg-slate-100/80 dark:bg-black/30 rounded-b-lg border-t border-slate-200 dark:border-white/10 flex items-center justify-between text-[10.5px]">
        <button
          onClick={handleJumpToCode}
          className="flex items-center space-x-1 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium transition-colors cursor-pointer"
          title="Jump directly to source in Monaco"
        >
          <ExternalLink className="w-3 h-3" />
          <span>Jump</span>
        </button>

        {!data.isRoot && (
          <button
            onClick={handleReCenterGraph}
            className="flex items-center space-x-1 text-slate-600 dark:text-[#aaaaaa] hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
            title="Inspect call graph for this symbol"
          >
            <GitBranch className="w-3 h-3" />
            <span>Trace</span>
          </button>
        )}
      </div>

      {/* Source handle (outgoing references) */}
      <Handle
        type="source"
        position={Position.Right}
        className="!bg-purple-500 dark:!bg-purple-400 !w-2.5 !h-2.5 !border-2 !border-white dark:!border-[#121214]"
      />
    </div>
  );
});
