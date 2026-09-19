import React, { useEffect, useState } from 'react';
import { Header } from './components/UI/Header';
import { FileExplorer } from './components/FileExplorer/FileExplorer';
import { CodeViewer } from './components/Editor/CodeViewer';
import { CallGraphPanel } from './components/CallGraph/CallGraphPanel';
import { ResizeGrip } from './components/UI/ResizeGrip';
import { SymbolSearch } from './components/UI/SymbolSearch';
import { ShortcutsModal } from './components/UI/ShortcutsModal';
import { useTraceStore } from './store/useTraceStore';

export const App: React.FC = () => {
  const {
    loadWorkspace,
    isSidebarOpen,
    isGraphOpen,
    isGraphFullScreen,
    sidebarWidth,
    setSidebarWidth,
    saveSidebarWidth,
    graphWidth,
    setGraphWidth,
    saveGraphWidth,
  } = useTraceStore();

  const [showShortcuts, setShowShortcuts] = useState(false);

  useEffect(() => {
    loadWorkspace();
  }, []);

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-white dark:bg-[#181818] text-slate-800 dark:text-[#cccccc]">
      {/* Top Navigation & Command Bar */}
      <Header onOpenShortcuts={() => setShowShortcuts(true)} />

      {/* Main Resizable Workspace Area */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Left: Resizable File Explorer Sidebar */}
        <FileExplorer />

        {/* Resize Handle between Sidebar & Code Viewer */}
        {isSidebarOpen && (
          <ResizeGrip
            initialWidth={sidebarWidth}
            minWidth={160}
            maxWidth={600}
            direction="right"
            onResize={setSidebarWidth}
            onResizeEnd={saveSidebarWidth}
          />
        )}

        {/* Center: Flexible Code Viewer Area */}
        <CodeViewer />

        {/* Resize Handle between Code Viewer & Graph Viewer */}
        {isGraphOpen && !isGraphFullScreen && (
          <ResizeGrip
            initialWidth={graphWidth}
            minWidth={340}
            maxWidth={typeof window !== 'undefined' ? window.innerWidth - 200 : 1200}
            direction="left"
            onResize={setGraphWidth}
            onResizeEnd={saveGraphWidth}
          />
        )}

        {/* Right / Fullscreen: Call Graph Engine */}
        <CallGraphPanel />
      </div>

      {/* Quick Symbol Search Modal (Cmd+P) */}
      <SymbolSearch />

      {/* Keyboard Shortcuts & Help Modal */}
      <ShortcutsModal
        isOpen={showShortcuts}
        onClose={() => setShowShortcuts(false)}
      />
    </div>
  );
};

export default App;
