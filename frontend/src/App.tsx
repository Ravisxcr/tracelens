import React, { useEffect } from 'react';
import { Header } from './components/UI/Header';
import { FileExplorer } from './components/FileExplorer/FileExplorer';
import { CodeViewer } from './components/Editor/CodeViewer';
import { CallGraphPanel } from './components/CallGraph/CallGraphPanel';
import { SymbolSearch } from './components/UI/SymbolSearch';
import { useTraceStore } from './store/useTraceStore';

export const App: React.FC = () => {
  const { loadWorkspace, isLoading } = useTraceStore();

  useEffect(() => {
    loadWorkspace();
  }, []);

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[#181818] text-[#cccccc]">
      {/* Top Navigation Bar */}
      <Header />

      {/* Main 3-Pane Code Exploration View */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Left: Workspace Tree & Symbol Hierarchy */}
        <FileExplorer />

        {/* Center: Read-Only Monaco Editor & Breadcrumbs */}
        <CodeViewer />

        {/* Right: Interactive Call Graph Panel (@xyflow/react) */}
        <CallGraphPanel />
      </div>

      {/* Quick Symbol Search Modal (Cmd+P) */}
      <SymbolSearch />

      {/* Background loading spinner overlay */}
      {isLoading && (
        <div className="fixed bottom-3 right-3 bg-[#252528]/90 backdrop-blur-xs border border-[#3e3e42] px-3 py-1.5 rounded-md shadow-lg text-[11px] text-[#aaaaaa] flex items-center space-x-2 z-50 pointer-events-none">
          <div className="w-3 h-3 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
          <span>Indexing / Tracing...</span>
        </div>
      )}
    </div>
  );
};

export default App;

