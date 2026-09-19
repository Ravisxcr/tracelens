import React, { useEffect, useMemo, useState } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  BackgroundVariant,
  MarkerType,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { X, GitGraph, Filter, Play, Database, Box } from 'lucide-react';
import { useTraceStore } from '../../store/useTraceStore';
import { useTheme } from '../../store/useTheme';
import { CustomSymbolNode } from './CustomNode';

export const CallGraphPanel: React.FC = () => {
  const { isGraphOpen, closeCallGraph, callGraphData, callGraphSymbol } = useTraceStore();
  const { resolvedTheme } = useTheme();

  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  // Category filter toggles
  const [filterFunctions, setFilterFunctions] = useState(true);
  const [filterTypes, setFilterTypes] = useState(true);
  const [filterVars, setFilterVars] = useState(true);

  const nodeTypes = useMemo(() => ({ customSymbol: CustomSymbolNode }), []);

  useEffect(() => {
    if (!callGraphData) return;

    // Filter nodes based on active category toggles
    const activeNodes = callGraphData.nodes.filter((node) => {
      if (node.data.isRoot) return true;
      if (node.data.category === 'function' && !filterFunctions) return false;
      if (node.data.category === 'type' && !filterTypes) return false;
      if (node.data.category === 'variable' && !filterVars) return false;
      return true;
    });

    const activeNodeIds = new Set(activeNodes.map((n) => n.id));

    // Filter and style edges
    const activeEdges = callGraphData.edges
      .filter((edge) => activeNodeIds.has(edge.source) && activeNodeIds.has(edge.target))
      .map((edge) => {
        const isCall = edge.relationship === 'call' || !edge.relationship;
        const isType = edge.relationship === 'type';
        const isVar = edge.relationship === 'variable';

        let strokeColor = '#3b82f6';
        let strokeDasharray: string | undefined;

        if (isType) {
          strokeColor = '#10b981'; // emerald
          strokeDasharray = '5 5';
        } else if (isVar) {
          strokeColor = '#f59e0b'; // amber
          strokeDasharray = '2 2';
        }

        return {
          ...edge,
          type: 'smoothstep',
          animated: edge.animated ?? isCall,
          style: {
            stroke: strokeColor,
            strokeWidth: 2,
            strokeDasharray,
          },
          labelStyle: {
            fill: strokeColor,
            fontSize: 10,
            fontFamily: 'monospace',
            fontWeight: 600,
          },
          labelBgStyle: {
            fill: resolvedTheme === 'dark' ? '#18181a' : '#ffffff',
            fillOpacity: 0.9,
            rx: 4,
            ry: 4,
          },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: strokeColor,
          },
        };
      });

    setNodes(activeNodes as any);
    setEdges(activeEdges as any);
  }, [callGraphData, filterFunctions, filterTypes, filterVars, resolvedTheme, setNodes, setEdges]);

  if (!isGraphOpen) {
    return null;
  }

  const counts = callGraphData?.counts || {};
  const totalCallers = counts.callers ?? 0;
  const totalCallees = counts.callees ?? 0;
  const totalTypes = counts.types ?? 0;
  const totalVars = counts.vars ?? 0;

  return (
    <div className="w-[620px] bg-slate-50 dark:bg-[#181818] border-l border-slate-200 dark:border-[#333333] flex flex-col h-full select-none shrink-0 z-10 transition-colors">
      {/* Panel Header */}
      <div className="h-8.5 bg-white dark:bg-[#1e1e22] border-b border-slate-200 dark:border-[#333333] px-2.5 flex items-center justify-between">
        <div className="flex items-center space-x-1.5 truncate">
          <GitGraph className="w-3.5 h-3.5 text-blue-500 dark:text-blue-400 shrink-0" />
          <span className="font-bold text-xs text-slate-800 dark:text-white">Execution & Object Graph</span>
          {callGraphSymbol && (
            <span className="font-mono text-[10.5px] bg-slate-100 dark:bg-[#2a2a2e] text-blue-600 dark:text-blue-300 px-1.5 py-0.2 rounded border border-slate-200 dark:border-[#3e3e42] truncate max-w-[160px]">
              {callGraphSymbol}
            </span>
          )}
        </div>

        <button
          onClick={closeCallGraph}
          className="p-1 hover:bg-slate-100 dark:hover:bg-[#2d2d30] rounded text-slate-400 dark:text-[#888888] hover:text-slate-800 dark:hover:text-white transition-colors cursor-pointer"
          title="Close graph panel"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Category Filter Chips Bar */}
      <div className="px-2.5 py-1 bg-slate-100 dark:bg-[#161618] border-b border-slate-200 dark:border-[#2d2d30] flex items-center justify-between text-[10.5px]">
        <div className="flex items-center space-x-1.5">
          <Filter className="w-3 h-3 text-slate-400 dark:text-[#666666] mr-0.5" />

          {/* Functions toggle */}
          <button
            onClick={() => setFilterFunctions(!filterFunctions)}
            className={`flex items-center space-x-1 px-2 py-0.5 rounded-full border transition-all cursor-pointer ${
              filterFunctions
                ? 'bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 border-blue-300 dark:border-blue-700/60'
                : 'bg-slate-200/60 dark:bg-[#222224] text-slate-400 dark:text-[#666666] border-transparent opacity-60'
            }`}
            title="Toggle function callers and callees"
          >
            <Play className="w-2.5 h-2.5" />
            <span>Functions ({totalCallers + totalCallees})</span>
          </button>

          {/* Types / Structs toggle */}
          <button
            onClick={() => setFilterTypes(!filterTypes)}
            className={`flex items-center space-x-1 px-2 py-0.5 rounded-full border transition-all cursor-pointer ${
              filterTypes
                ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700/60'
                : 'bg-slate-200/60 dark:bg-[#222224] text-slate-400 dark:text-[#666666] border-transparent opacity-60'
            }`}
            title="Toggle datatypes, structs, typedefs, classes"
          >
            <Database className="w-2.5 h-2.5" />
            <span>Datatypes ({totalTypes})</span>
          </button>

          {/* Variables / Objects toggle */}
          <button
            onClick={() => setFilterVars(!filterVars)}
            className={`flex items-center space-x-1 px-2 py-0.5 rounded-full border transition-all cursor-pointer ${
              filterVars
                ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-700/60'
                : 'bg-slate-200/60 dark:bg-[#222224] text-slate-400 dark:text-[#666666] border-transparent opacity-60'
            }`}
            title="Toggle global variables, runtime objects, macros"
          >
            <Box className="w-2.5 h-2.5" />
            <span>Variables ({totalVars})</span>
          </button>
        </div>

        <span className="text-[9.5px] text-slate-400 dark:text-[#777777] font-mono">5 Columns</span>
      </div>

      {/* Canvas Area */}
      <div className="flex-1 relative bg-slate-100/70 dark:bg-[#101012]">
        {nodes.length === 0 ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-xs text-slate-400 dark:text-[#666666] p-6 text-center space-y-1">
            <p>No symbols match current category filters or no data available.</p>
            <p className="text-[11px] text-slate-400 dark:text-[#555555]">
              Try re-enabling filters or selecting a function/method from Monaco.
            </p>
          </div>
        ) : (
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            nodeTypes={nodeTypes}
            fitView
            fitViewOptions={{ padding: 0.2 }}
            minZoom={0.15}
            maxZoom={1.5}
            proOptions={{ hideAttribution: true }}
          >
            <Background
              color={resolvedTheme === 'dark' ? '#242428' : '#cbd5e1'}
              gap={24}
              size={1}
              variant={BackgroundVariant.Dots}
            />
            <Controls
              className="!bg-white dark:!bg-[#1e1e20] !border-slate-200 dark:!border-[#333333] !rounded-md overflow-hidden [&>button]:!bg-white dark:[&>button]:!bg-[#1e1e20] [&>button]:!border-slate-200 dark:[&>button]:!border-[#333333] [&>button]:!text-slate-600 dark:[&>button]:!text-[#cccccc] [&>button:hover]:!bg-slate-100 dark:[&>button:hover]:!bg-[#2a2a2e]"
              showInteractive={false}
            />
            <MiniMap
              nodeColor={(node) => {
                const cat = (node.data as any)?.category;
                if ((node.data as any)?.isRoot) return '#3b82f6';
                if (cat === 'type') return '#10b981';
                if (cat === 'variable') return '#f59e0b';
                return '#6366f1';
              }}
              maskColor={resolvedTheme === 'dark' ? 'rgba(16, 16, 18, 0.75)' : 'rgba(241, 245, 249, 0.75)'}
              className="!bg-white dark:!bg-[#18181a] !border !border-slate-200 dark:!border-[#333333] !rounded-md"
            />
          </ReactFlow>
        )}
      </div>
    </div>
  );
};
