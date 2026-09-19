import React from 'react';
import { X, Keyboard, Command, Sparkles } from 'lucide-react';

interface ShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ShortcutsModal: React.FC<ShortcutsModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const shortcuts = [
    { key: '⌘P / Ctrl+P', desc: 'Quick Open / Search symbols across workspace' },
    { key: '⌘B / Ctrl+B', desc: 'Toggle Primary Sidebar (Explorer & Outline)' },
    { key: 'F12 / ⌘Click', desc: 'Jump directly to symbol definition' },
    { key: 'Hover Symbol', desc: 'Show symbol documentation & trace action links' },
    { key: 'Trace Button', desc: 'Render execution call graph in right panel' },
    { key: 'Esc', desc: 'Close modals and search pickers' },
  ];

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 select-none p-4"
      onClick={onClose}
    >
      <div
        className="w-[520px] max-w-full bg-white dark:bg-[#252528] border border-slate-200 dark:border-[#3e3e42] rounded-xl shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-[#333333] bg-slate-50 dark:bg-[#1e1e20]">
          <div className="flex items-center space-x-2">
            <Keyboard className="w-4 h-4 text-blue-500" />
            <h3 className="font-bold text-xs uppercase tracking-wider text-slate-800 dark:text-white">
              Keyboard Shortcuts & Navigation
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-slate-200 dark:hover:bg-[#333336] rounded text-slate-400 dark:text-[#888888] hover:text-slate-800 dark:hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-2.5">
          {shortcuts.map((item, idx) => (
            <div
              key={idx}
              className="flex items-center justify-between py-1.5 px-2.5 rounded-lg bg-slate-50 dark:bg-[#1e1e20] border border-slate-200/60 dark:border-[#333336] text-xs"
            >
              <span className="text-slate-600 dark:text-[#cccccc]">{item.desc}</span>
              <kbd className="bg-white dark:bg-[#2a2a2d] px-2 py-0.5 rounded text-[11px] font-mono font-semibold text-slate-700 dark:text-[#dddddd] border border-slate-200 dark:border-[#444448]">
                {item.key}
              </kbd>
            </div>
          ))}

          <div className="mt-4 p-3 rounded-lg bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/50 flex items-start space-x-2.5 text-[11px] text-blue-800 dark:text-blue-300">
            <Sparkles className="w-4 h-4 shrink-0 mt-0.5 text-blue-500" />
            <span>
              TraceLens analyzes C, C++, Python, Go, and TypeScript/JavaScript ASTs in real-time. Click any node in the Call Graph to inspect callers, callees, datatypes, and variable usages.
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 py-2.5 bg-slate-50 dark:bg-[#1a1a1c] border-t border-slate-200 dark:border-[#333336] flex justify-end">
          <button
            onClick={onClose}
            className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-xs font-medium transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

