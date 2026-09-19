export type SymbolKind =
  | 'function'
  | 'method'
  | 'type'
  | 'struct'
  | 'typedef'
  | 'union'
  | 'enum'
  | 'interface'
  | 'class'
  | 'variable'
  | 'constant'
  | 'macro'
  | 'field'
  | 'namespace'
  | 'module'
  | 'import'
  | 'call';

export type SymbolCategory = 'function' | 'type' | 'variable' | 'other';

export interface Position {
  line: number;
  column: number;
  offset: number;
}

export interface Range {
  start: Position;
  end: Position;
}

export interface SymbolInfo {
  id: string;
  name: string;
  kind: SymbolKind;
  category?: SymbolCategory;
  file: string;
  range: Range;
  scope?: string;
  signature?: string;
  doc?: string;
  children?: SymbolInfo[];
}

export interface CallSite {
  caller: string;
  callee: string;
  receiver?: string;
  file: string;
  range: Range;
}

export interface TreeNode {
  name: string;
  path: string;
  isDir: boolean;
  children?: TreeNode[];
  language?: string;
  symbolCount?: number;
}

export interface FileContentResponse {
  path: string;
  language: string;
  content: string;
  lineCount: number;
  symbols: SymbolInfo[];
  calls: CallSite[];
}

export interface IndexStats {
  totalFiles: number;
  totalSymbols: number;
  totalCalls: number;
  totalTypes?: number;
  totalVars?: number;
  duration: number;
  indexedAt: string;
}

export interface CallGraphNodeData {
  label: string;
  kind: SymbolKind;
  category: SymbolCategory;
  file: string;
  line: number;
  signature?: string;
  scope?: string;
  isRoot: boolean;
  callerCount?: number;
  calleeCount?: number;
}

export interface CallGraphResponse {
  rootSymbol: string;
  nodes: Array<{
    id: string;
    type: string;
    data: CallGraphNodeData;
    position: { x: number; y: number };
  }>;
  edges: Array<{
    id: string;
    source: string;
    target: string;
    relationship?: 'call' | 'type' | 'variable';
    label?: string;
    animated?: boolean;
  }>;
  counts?: {
    callers?: number;
    callees?: number;
    types?: number;
    vars?: number;
  };
}
