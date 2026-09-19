import React from 'react';
import { ChevronRight, FileCode2 } from 'lucide-react';
import { useTraceStore } from '../../store/useTraceStore';

export const Breadcrumbs: React.FC = () => {
  const { breadcrumbs, cursorLine, activeFile } = useTraceStore();

  if (!activeFile) {
    return null;
  }

  return (
    <div className="h-6 bg-slate-100 dark:bg-[#1e1e1e] border-b border-slate-200 dark:border-[#2d2d30] flex items-center justify-between px-2 text-xs text-slate-500 dark:text-[#888888] select-none shrink-0 transition-colors">
      {/* Scope path breadcrumbs */}
      <div className="flex items-center space-x-1 overflow-x-auto no-scrollbar text-[11px]">
        <FileCode2 className="w-3 h-3 text-blue-500 dark:text-blue-400 shrink-0" />
        {breadcrumbs.map((crumb, idx) => (
          <React.Fragment key={idx}>
            {idx > 0 && <ChevronRight className="w-2.5 h-2.5 text-slate-400 dark:text-[#555555] shrink-0" />}
            <span
              className={`truncate max-w-[180px] ${
                idx === breadcrumbs.length - 1
                  ? 'text-slate-900 dark:text-[#cccccc] font-medium'
                  : 'text-slate-500 dark:text-[#888888]'
              }`}
            >
              {crumb}
            </span>
          </React.Fragment>
        ))}
      </div>

      {/* Line position indicator */}
      <div className="flex items-center space-x-2 text-[10px] text-slate-400 dark:text-[#777777] font-mono shrink-0 pl-2">
        <span>Ln {cursorLine}</span>
        <span>•</span>
        <span>{activeFile.lineCount} lines</span>
        <span>•</span>
        <span className="uppercase text-[9px] bg-slate-200/80 dark:bg-[#2a2a2e] px-1 py-0.2 rounded text-blue-600 dark:text-blue-400 font-semibold">
          {activeFile.language}
        </span>
      </div>
    </div>
  );
};
