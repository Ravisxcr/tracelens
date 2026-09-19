import React from 'react';
import { X, FileCode2 } from 'lucide-react';
import { useTraceStore } from '../../store/useTraceStore';

export const getFileIconColor = (filename: string): string => {
  const ext = filename.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'go':
      return 'text-cyan-500 dark:text-cyan-400';
    case 'py':
      return 'text-yellow-500 dark:text-yellow-400';
    case 'ts':
    case 'tsx':
      return 'text-blue-500 dark:text-blue-400';
    case 'js':
    case 'jsx':
      return 'text-amber-500 dark:text-amber-400';
    case 'c':
    case 'h':
      return 'text-orange-500 dark:text-orange-400';
    case 'cpp':
    case 'hpp':
    case 'cc':
      return 'text-indigo-500 dark:text-indigo-400';
    case 'json':
      return 'text-emerald-500 dark:text-emerald-400';
    case 'md':
      return 'text-slate-400 dark:text-slate-400';
    default:
      return 'text-blue-400 dark:text-blue-400';
  }
};

export const EditorTabs: React.FC = () => {
  const { openTabs, activeFilePath, selectFile, closeTab } = useTraceStore();

  if (openTabs.length === 0) {
    return null;
  }

  return (
    <div className="h-7 bg-slate-100 dark:bg-[#181818] border-b border-slate-200 dark:border-[#252526] flex items-center select-none shrink-0 overflow-hidden transition-none">
      {/* Scrollable Tabs Container */}
      <div className="flex items-center h-full overflow-x-auto no-scrollbar">
        {openTabs.map((path) => {
          const isActive = path === activeFilePath;
          const fileName = path.split('/').pop() || path;
          const iconColor = getFileIconColor(fileName);

          return (
            <div
              key={path}
              onClick={() => selectFile(path)}
              className={`group flex items-center space-x-1.5 px-2.5 h-full cursor-pointer text-[11.5px] border-r border-slate-200 dark:border-[#252526] transition-none ${
                isActive
                  ? 'bg-white dark:bg-[#1e1e1e] text-slate-900 dark:text-white font-medium border-t-2 border-t-[#007acc]'
                  : 'bg-transparent text-slate-500 dark:text-[#969696] hover:bg-slate-200/50 dark:hover:bg-[#1f1f1f] hover:text-slate-800 dark:hover:text-[#cccccc]'
              }`}
              title={path}
            >
              <FileCode2 className={`w-3.5 h-3.5 shrink-0 ${iconColor}`} />
              <span className="truncate max-w-[130px]">{fileName}</span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  closeTab(path);
                }}
                className={`p-0.5 rounded-sm hover:bg-slate-200 dark:hover:bg-[#333333] transition-colors cursor-pointer ${
                  isActive
                    ? 'opacity-70 hover:opacity-100 text-slate-600 dark:text-[#cccccc]'
                    : 'opacity-0 group-hover:opacity-100 text-slate-400 dark:text-[#888888]'
                }`}
                title="Close tab"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};
