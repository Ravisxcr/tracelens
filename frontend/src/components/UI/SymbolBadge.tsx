import React from 'react';
import { SymbolKind } from '../../types';

interface SymbolBadgeProps {
  kind: SymbolKind;
  size?: 'sm' | 'md';
}

export const SymbolBadge: React.FC<SymbolBadgeProps> = ({ kind, size = 'sm' }) => {
  const getBadgeStyle = () => {
    switch (kind) {
      case 'function':
        return { label: 'fn', bg: 'bg-purple-900/60 text-purple-300 border-purple-700/50' };
      case 'method':
        return { label: 'm', bg: 'bg-blue-900/60 text-blue-300 border-blue-700/50' };
      case 'struct':
        return { label: 'S', bg: 'bg-emerald-900/60 text-emerald-300 border-emerald-700/50' };
      case 'interface':
        return { label: 'I', bg: 'bg-teal-900/60 text-teal-300 border-teal-700/50' };
      case 'class':
        return { label: 'C', bg: 'bg-amber-900/60 text-amber-300 border-amber-700/50' };
      case 'type':
        return { label: 'T', bg: 'bg-cyan-900/60 text-cyan-300 border-cyan-700/50' };
      case 'import':
        return { label: 'imp', bg: 'bg-neutral-800 text-neutral-400 border-neutral-700' };
      default:
        return { label: '•', bg: 'bg-neutral-800 text-neutral-300 border-neutral-700' };
    }
  };

  const { label, bg } = getBadgeStyle();
  const sizeClasses = size === 'sm' ? 'text-[10px] w-4 h-4' : 'text-xs w-5 h-5';

  return (
    <span
      className={`inline-flex items-center justify-center font-mono font-bold rounded border ${bg} ${sizeClasses} shrink-0`}
      title={kind}
    >
      {label}
    </span>
  );
};

