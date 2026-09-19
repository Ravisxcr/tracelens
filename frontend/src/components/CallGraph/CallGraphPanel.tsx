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
import {
  X,
  GitGraph,
  Filter,
  Play,
  Database,
  Box,
  Search,
  Layers,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import { useTraceStore } from '../../store/useTraceStore';
import { useTheme } from '../../store/useTheme';
import { CustomSymbolNode } from './CustomNode';

export const CallGraphPanel: React.FC = () => {
  const {
    isGraphOpen,
    closeCallGraph,
    callGraphData,
    callGraphSymbol,
    openCallGraph,
    graphWidth,
    isGraphFullScreen,
    toggleGraphFullScreen,
  } = useTraceStore();

  const { resolvedTheme } = useTheme();

  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  // Category filter toggles
  const [filterFunctions, setFilterFunctions] = useState(true);
  const [filterTypes, setFilterTypes] = useState(true);
  const [filterVars, setFilterVars] = useState(true);

  // In-graph instant search query
  const [searchQuery, setSearchQuery] = useState('');

  const nodeTypes = useMemo(() => ({ customSymbol: CustomSymbolNode }), []);

  // Keyboard shortcut: Esc to exit full screen
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isGraphFullScreen) {
        e.preventDefault();
        toggleGraphFullScreen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isGraphFullScreen, toggleGraphFullScreen]);

  useEffect(() => {
    if (!callGraphData) return;

    const q = searchQuery.trim().toLowerCase();

    // Filter nodes based on active category toggles and search query
    const activeNodes = callGraphData.nodes.filter((node) => {
      if (node.data.isRoot) return true;
      if (node.data.category === 'function' && !filterFunctions) return false;
      if (node.data.category === 'type' && !filterTypes) return false;
      if (node.data.category === 'variable' && !filterVars) return false;
      if (q && !node.data.label.toLowerCase().includes(q)) return false;
      return true;
    });

    const activeNodeIds = new Set(activeNodes.map((n) => n.id));
    const matchingEdges = callGraphData.edges.filter(
      (edge) => activeNodeIds.has(edge.source) && activeNodeIds.has(edge.target)
    );

    // Disable SVG continuous stroke animation when edge count is large (prevents compositor lag on 140+ edges)
    const shouldAnimate = matchingEdges.length <= 20;

    // Filter and style edges
    const activeEdges = matchingEdges.map((edge) => {
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
        animated: shouldAnimate && (edge.animated ?? isCall),
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
  }, [
    callGraphData,
    filterFunctions,
    filterTypes,
    filterVars,
    searchQuery,
    resolvedTheme,
    setNodes,
    setEdges,
  ]);

  if (!isGraphOpen) {
    return null;
  }

  const counts = callGraphData?.counts || {};
  const totalCallers = counts.callers ?? 0;
  const shownCallers = counts.shownCallers ?? totalCallers;
  const totalCallees = counts.callees ?? 0;
  const totalTypes = counts.types ?? 0;
  const totalVars = counts.vars ?? 0;

  const hasHiddenCallers = totalCallers > shownCallers;
  const isAllCallersLoaded = totalCallers > 50 && shownCallers >= totalCallers;

  return (
    <div
      style={isGraphFullScreen ? undefined : { width: `${graphWidth}px` }}
      className={
        isGraphFullScreen
          ? 'absolute inset-0 z-50 bg-slate-50 dark:bg-[#181818] flex flex-col h-full w-full select-none shadow-2xl'
          : 'bg-slate-50 dark:bg-[#181818] border-l border-slate-200 dark:border-[#2b2b2b] flex flex-col h-full select-none shrink-0 z-20 overflow-hidden'
      }
    >
      {/* Panel Header - compact h-7 matching EditorTabs and Explorer */}
      <div className="h-7 bg-slate-100 dark:bg-[#181818] border-b border-slate-200 dark:border-[#252526] px-2.5 flex items-center justify-between shrink-0">
        <div className="flex items-center space-x-1.5 truncate">
          <GitGraph className="w-3.5 h-3.5 text-blue-500 dark:text-blue-400 shrink-0" />
          <span className="font-semibold text-[11px] tracking-wider uppercase text-slate-600 dark:text-[#bbbbbb]">
            {isGraphFullScreen ? 'Execution Graph (Full)' : 'Execution Graph'}
          </span>
          {callGraphSymbol && (
            <span className="font-mono text-[10px] bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 px-1.5 py-0.5 rounded border border-blue-200 dark:border-blue-800/50 truncate max-w-[140px] leading-tight">
              {callGraphSymbol}
            </span>
          )}
        </div>

        <div className="flex items-center space-x-1.5">
          {/* Quick Filter Search Input */}
          <div className="relative flex items-center">
            <Search className="w-2.5 h-2.5 absolute left-1.5 text-slate-400 dark:text-[#666666] pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter graph..."
              className="h-5 pl-5 pr-4 bg-white dark:bg-[#26262a] border border-slate-200 dark:border-[#3a3a3e] rounded text-[10.5px] text-slate-800 dark:text-[#dddddd] placeholder:text-slate-400 dark:placeholder:text-[#666666] focus:outline-none focus:border-blue-500 w-24 transition-all focus:w-36"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="w-2.5 h-2.5" />
              </button>
            )}
          </div>

          {/* Full Screen Toggle Button */}
          <button
            onClick={() => toggleGraphFullScreen()}
            className={`h-5 flex items-center space-x-1 px-2 rounded text-[10.5px] font-medium transition-colors cursor-pointer border ${
              isGraphFullScreen
                ? 'bg-blue-600 hover:bg-blue-700 text-white border-blue-600 shadow-xs'
                : 'bg-white dark:bg-[#28282b] hover:bg-slate-50 dark:hover:bg-[#333336] text-slate-700 dark:text-[#cccccc] border-slate-200 dark:border-[#3a3a3d]'
            }`}
            title={isGraphFullScreen ? 'Exit Full Screen (Esc)' : 'Enter Full Screen'}
          >
            {isGraphFullScreen ? (
              <>
                <Minimize2 className="w-3 h-3" />
                <span className="hidden sm:inline">Exit Fullscreen</span>
              </>
            ) : (
              <>
                <Maximize2 className="w-3 h-3 text-blue-500 dark:text-blue-400" />
                <span className="hidden sm:inline">Fullscreen</span>
              </>
            )}
          </button>

          {/* Close panel */}
          <button
            onClick={closeCallGraph}
            className="h-5 w-5 flex items-center justify-center hover:bg-slate-200 dark:hover:bg-[#2d2d30] rounded text-slate-400 dark:text-[#888888] hover:text-slate-800 dark:hover:text-white transition-colors cursor-pointer"
            title="Close graph panel"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Category Filter Chips Bar & Fan-In Controls */}
      <div className="px-3 py-1.5 bg-slate-100 dark:bg-[#161618] border-b border-slate-200 dark:border-[#2b2b2b] flex items-center justify-between text-[11px] flex-wrap gap-y-1">
        <div className="flex items-center space-x-1.5 flex-wrap">
          <Filter className="w-3 h-3 text-slate-400 dark:text-[#666666] mr-0.5" />

          {/* Functions toggle */}
          <button
            onClick={() => setFilterFunctions(!filterFunctions)}
            className={`flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full border transition-all cursor-pointer ${
              filterFunctions
                ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-700/60 shadow-xs'
                : 'bg-slate-200/50 dark:bg-[#222224] text-slate-400 dark:text-[#666666] border-transparent opacity-60'
            }`}
            title="Toggle function callers and callees"
          >
            <Play className="w-2.5 h-2.5" />
            <span>Functions ({totalCallers + totalCallees})</span>
          </button>

          {/* Types / Structs toggle */}
          <button
            onClick={() => setFilterTypes(!filterTypes)}
            className={`flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full border transition-all cursor-pointer ${
              filterTypes
                ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700/60 shadow-xs'
                : 'bg-slate-200/50 dark:bg-[#222224] text-slate-400 dark:text-[#666666] border-transparent opacity-60'
            }`}
            title="Toggle datatypes, structs, typedefs, classes"
          >
            <Database className="w-2.5 h-2.5" />
            <span>Datatypes ({totalTypes})</span>
          </button>

          {/* Variables / Objects toggle */}
          <button
            onClick={() => setFilterVars(!filterVars)}
            className={`flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full border transition-all cursor-pointer ${
              filterVars
                ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-700/60 shadow-xs'
                : 'bg-slate-200/50 dark:bg-[#222224] text-slate-400 dark:text-[#666666] border-transparent opacity-60'
            }`}
            title="Toggle global variables, runtime objects, macros"
          >
            <Box className="w-2.5 h-2.5" />
            <span>Variables ({totalVars})</span>
          </button>
        </div>

        <div className="flex items-center space-x-2">
          {/* High Fan-In (140+ calls) pagination & toggle */}
          {hasHiddenCallers && (
            <button
              onClick={() => openCallGraph(callGraphSymbol!, undefined, 0)}
              className="flex items-center space-x-1 px-2.5 py-0.5 rounded bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 border border-blue-300 dark:border-blue-700/60 hover:bg-blue-100 dark:hover:bg-blue-900/70 transition-colors cursor-pointer text-[10.5px] font-semibold"
              title="Show all callers without truncation"
            >
              <Layers className="w-2.5 h-2.5" />
              <span>Show all {totalCallers} callers (+{totalCallers - shownCallers})</span>
            </button>
          )}

          {isAllCallersLoaded && (
            <button
              onClick={() => openCallGraph(callGraphSymbol!, undefined, 50)}
              className="px-2 py-0.5 rounded bg-slate-200/70 dark:bg-[#26262a] text-slate-600 dark:text-[#aaaaaa] border border-slate-300 dark:border-[#38383c] hover:bg-slate-300/80 dark:hover:bg-[#333336] transition-colors cursor-pointer text-[10px]"
              title="Limit to top 50 callers"
            >
              Limit to top 50
            </button>
          )}

          <span className="text-[10px] text-slate-400 dark:text-[#777777] font-mono">
            {nodes.length} nodes
          </span>
        </div>
      </div>

      {/* Canvas Area with Virtualization & Zoom Optimization */}
      <div className="flex-1 relative bg-slate-100/70 dark:bg-[#101012]">
        {nodes.length === 0 ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-xs text-slate-400 dark:text-[#666666] p-6 text-center space-y-1">
            <p>No symbols match current filters or search query.</p>
            <p className="text-[11px] text-slate-400 dark:text-[#555555]">
              {searchQuery
                ? `Clear search query "${searchQuery}" or enable category toggles.`
                : 'Try selecting a function or method in the Monaco editor.'}
            </p>
          </div>
        ) : (
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            nodeTypes={nodeTypes}
            colorMode={resolvedTheme}
            fitView
            fitViewOptions={{ padding: 0.2 }}
            minZoom={0.05}
            maxZoom={1.5}
            onlyRenderVisibleElements={true}
            elevateNodesOnSelect={false}
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
