import React from 'react';
import { ChevronRight, FileCode2, Layers } from 'lucide-react';
import { useTraceStore } from '../../store/useTraceStore';

export const Breadcrumbs: React.FC = () => {
  const { breadcrumbs, cursorLine, activeFile } = useTraceStore();

  if (!activeFile) {
    return null;
  }

  return (
    <div className="h-7 bg-[#1e1e1e] border-b border-[#2d2d30] flex items-center justify-between px-3 text-xs text-[#888888] select-none shrink-0">
      {/* Scope path breadcrumbs */}
      <div className="flex items-center space-x-1.5 overflow-x-auto no-scrollbar">
        <FileCode2 className="w-3.5 h-3.5 text-blue-400 shrink-0" />
        {breadcrumbs.map((crumb, idx) => (
          <React.Fragment key={idx}>
            {idx > 0 && <ChevronRight className="w-3 h-3 text-[#555555] shrink-0" />}
            <span
              className={`truncate max-w-[200px] ${
                idx === breadcrumbs.length - 1 ? 'text-[#cccccc] font-medium' : 'text-[#888888]'
              }`}
            >
              {crumb}
            </span>
          </React.Fragment>
        ))}
      </div>

      {/* Line position indicator */}
      <div className="flex items-center space-x-3 text-[11px] text-[#777777] font-mono shrink-0 pl-2">
        <span>
          Ln {cursorLine}, Col 1
        </span>
        <span>•</span>
        <span>
          {activeFile.lineCount} lines
        </span>
        <span>•</span>
        <span className="uppercase text-[10px] bg-[#2a2a2e] px-1 py-0.5 rounded text-blue-400">
          {activeFile.language}
        </span>
      </div>
    </div>
  );
};

