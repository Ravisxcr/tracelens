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
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-white dark:bg-[#181818] text-slate-800 dark:text-[#cccccc] transition-colors">
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
        <div className="fixed bottom-3 right-3 bg-white/95 dark:bg-[#252528]/95 backdrop-blur-xs border border-slate-200 dark:border-[#3e3e42] px-2.5 py-1 rounded-md shadow-lg text-[10.5px] text-slate-700 dark:text-[#aaaaaa] flex items-center space-x-2 z-50 pointer-events-none">
          <div className="w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <span>Indexing / Tracing...</span>
        </div>
      )}
    </div>
  );
};

export default App;
