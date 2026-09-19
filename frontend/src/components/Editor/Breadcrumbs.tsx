import React from 'react';
import { ChevronRight } from 'lucide-react';
import { useTraceStore } from '../../store/useTraceStore';

export const Breadcrumbs: React.FC = () => {
  const { breadcrumbs, cursorLine, cursorCol, activeFile } = useTraceStore();

  if (!activeFile || breadcrumbs.length === 0) {
    return null;
  }

  return (
    <div className="h-5 bg-white dark:bg-[#1e1e1e] border-b border-slate-200/60 dark:border-[#2b2b2b] flex items-center justify-between px-2 text-[11px] text-slate-400 dark:text-[#888888] select-none shrink-0 transition-none overflow-hidden">
      {/* Scope path breadcrumbs */}
      <div className="flex items-center space-x-0.5 overflow-x-auto no-scrollbar">
        {breadcrumbs.map((crumb, idx) => (
          <React.Fragment key={idx}>
            {idx > 0 && (
              <ChevronRight className="w-3 h-3 text-slate-400 dark:text-[#555555] shrink-0 mx-0.5" />
            )}
            <span
              className={`truncate max-w-[160px] px-1 py-0.2 rounded hover:bg-slate-100 dark:hover:bg-[#2a2d2e] transition-colors cursor-default ${
                idx === breadcrumbs.length - 1
                  ? 'text-slate-800 dark:text-[#cccccc] font-medium'
                  : 'text-slate-400 dark:text-[#777777]'
              }`}
            >
              {crumb}
            </span>
          </React.Fragment>
        ))}
      </div>

      {/* Line & column position */}
      <div className="text-[10px] text-slate-400 dark:text-[#666666] font-mono shrink-0 pl-2">
        <span>Ln {cursorLine}, Col {cursorCol}</span>
      </div>
    </div>
  );
};
