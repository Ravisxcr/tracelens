import React, { useEffect, useMemo } from 'react';
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
import { X, GitGraph, ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { useTraceStore } from '../../store/useTraceStore';
import { CustomSymbolNode } from './CustomNode';

export const CallGraphPanel: React.FC = () => {
  const { isGraphOpen, closeCallGraph, callGraphData, callGraphSymbol } = useTraceStore();

  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  const nodeTypes = useMemo(() => ({ customSymbol: CustomSymbolNode }), []);

  useEffect(() => {
    if (callGraphData) {
      // Map edges to include arrows and dark theme styling
      const formattedEdges = callGraphData.edges.map((edge) => ({
        ...edge,
        type: 'smoothstep',
        animated: edge.animated,
        style: { stroke: edge.animated ? '#3b82f6' : '#a855f7', strokeWidth: 2 },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: edge.animated ? '#3b82f6' : '#a855f7',
        },
      }));

      setNodes(callGraphData.nodes as any);
      setEdges(formattedEdges as any);
    }
  }, [callGraphData, setNodes, setEdges]);

  if (!isGraphOpen) {
    return null;
  }

  const callerCount = callGraphData?.nodes.filter((n) => (n.position as any).x < 400).length ?? 0;
  const calleeCount = callGraphData?.nodes.filter((n) => (n.position as any).x > 400).length ?? 0;

  return (
    <div className="w-[520px] bg-[#181818] border-l border-[#333333] flex flex-col h-full select-none shrink-0 z-10">
      {/* Panel Header */}
      <div className="h-10 bg-[#1f1f22] border-b border-[#333333] px-3 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <GitGraph className="w-4 h-4 text-blue-400" />
          <span className="font-semibold text-xs text-white">Call Graph</span>
          {callGraphSymbol && (
            <span className="font-mono text-[11px] bg-[#2d2d30] text-blue-300 px-1.5 py-0.5 rounded border border-[#3e3e42] truncate max-w-[180px]">
              {callGraphSymbol}
            </span>
          )}
        </div>

        <div className="flex items-center space-x-2">
          {/* Quick Metrics */}
          <div className="flex items-center space-x-2 text-[10px] text-[#888888]">
            <span className="flex items-center text-blue-400">
              <ArrowDownRight className="w-3 h-3 mr-0.5" />
              {callerCount} callers
            </span>
            <span>•</span>
            <span className="flex items-center text-purple-400">
              <ArrowUpRight className="w-3 h-3 mr-0.5" />
              {calleeCount} callees
            </span>
          </div>

          <button
            onClick={closeCallGraph}
            className="p-1 hover:bg-[#2d2d30] rounded text-[#888888] hover:text-white transition-colors cursor-pointer"
            title="Close call graph panel"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Canvas Area */}
      <div className="flex-1 relative bg-[#121214]">
        {nodes.length === 0 ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-xs text-[#666666] p-6 text-center space-y-1">
            <p>No call graph data available for this symbol.</p>
            <p className="text-[11px] text-[#555555]">
              Select a function or method from the code viewer or explorer to inspect calls.
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
            minZoom={0.2}
            maxZoom={1.5}
            proOptions={{ hideAttribution: true }}
          >
            <Background color="#2a2a2e" gap={20} size={1} variant={BackgroundVariant.Dots} />
            <Controls
              className="!bg-[#1e1e20] !border-[#333333] !rounded-md overflow-hidden [&>button]:!bg-[#1e1e20] [&>button]:!border-[#333333] [&>button]:!text-[#cccccc] [&>button:hover]:!bg-[#2a2a2e]"
              showInteractive={false}
            />
            <MiniMap
              nodeColor={(node) => ((node.data as any)?.isRoot ? '#3b82f6' : '#475569')}
              maskColor="rgba(24, 24, 24, 0.7)"
              className="!bg-[#18181a] !border !border-[#333333] !rounded-md"
            />
          </ReactFlow>
        )}
      </div>
    </div>
  );
};

