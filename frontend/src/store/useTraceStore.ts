import { useState, useEffect } from 'react';
import { CallGraphResponse, FileContentResponse, IndexStats, SymbolInfo, TreeNode } from '../types';
import * as api from '../api/client';

export interface TraceState {
  tree: TreeNode | null;
  stats: IndexStats | null;
  activeFilePath: string | null;
  activeFile: FileContentResponse | null;
  targetLine: number | null;
  selectedSymbol: SymbolInfo | null;
  callGraphSymbol: string | null;
  callGraphData: CallGraphResponse | null;
  isGraphOpen: boolean;
  isSearching: boolean;
  cursorLine: number;
  breadcrumbs: string[];
  isLoading: boolean;
}

type Listener = () => void;

class TraceStore {
  private state: TraceState = {
    tree: null,
    stats: null,
    activeFilePath: null,
    activeFile: null,
    targetLine: null,
    selectedSymbol: null,
    callGraphSymbol: null,
    callGraphData: null,
    isGraphOpen: false,
    isSearching: false,
    cursorLine: 1,
    breadcrumbs: [],
    isLoading: false,
  };

  private listeners = new Set<Listener>();

  getState(): TraceState {
    return this.state;
  }

  private setState(partial: Partial<TraceState>) {
    this.state = { ...this.state, ...partial };
    this.listeners.forEach((l) => l());
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  async loadWorkspace() {
    this.setState({ isLoading: true });
    try {
      const data = await api.fetchTree();
      this.setState({ tree: data.tree, stats: data.stats, isLoading: false });

      // Automatically open the first source file if available
      const firstFile = this.findFirstFile(data.tree);
      if (firstFile) {
        await this.selectFile(firstFile);
      }
    } catch (err) {
      console.error('Failed to load workspace:', err);
      this.setState({ isLoading: false });
    }
  }

  private findFirstFile(node: TreeNode | null): string | null {
    if (!node) return null;
    if (!node.isDir) return node.path;
    if (node.children) {
      for (const child of node.children) {
        const found = this.findFirstFile(child);
        if (found) return found;
      }
    }
    return null;
  }

  async selectFile(path: string, line?: number) {
    this.setState({ isLoading: true });
    try {
      const fileData = await api.fetchFile(path);
      this.setState({
        activeFilePath: path,
        activeFile: fileData,
        targetLine: line ?? 1,
        cursorLine: line ?? 1,
        isLoading: false,
      });
      this.updateBreadcrumbs(line ?? 1, fileData.symbols);
    } catch (err) {
      console.error('Failed to load file:', err);
      this.setState({ isLoading: false });
    }
  }

  jumpToLine(line: number) {
    this.setState({ targetLine: line, cursorLine: line });
    if (this.state.activeFile) {
      this.updateBreadcrumbs(line, this.state.activeFile.symbols);
    }
  }

  setCursorPosition(line: number) {
    this.setState({ cursorLine: line });
    if (this.state.activeFile) {
      this.updateBreadcrumbs(line, this.state.activeFile.symbols);
    }
  }

  private updateBreadcrumbs(line: number, symbols: SymbolInfo[]) {
    const chain: string[] = [];
    if (this.state.activeFilePath) {
      chain.push(this.state.activeFilePath);
    }

    // Traverse symbols to find enclosing symbol
    const findEnclosing = (syms: SymbolInfo[]) => {
      for (const s of syms) {
        if (line >= s.range.start.line && line <= s.range.end.line) {
          if (s.scope) chain.push(s.scope);
          chain.push(`${s.name} (${s.kind})`);
          if (s.children && s.children.length > 0) {
            findEnclosing(s.children);
          }
          break;
        }
      }
    };

    findEnclosing(symbols);
    this.setState({ breadcrumbs: chain });
  }

  async openCallGraph(symbol: string, file?: string) {
    this.setState({ isGraphOpen: true, callGraphSymbol: symbol, isLoading: true });
    try {
      const graph = await api.fetchCallGraph(symbol, file ?? this.state.activeFilePath ?? undefined);
      this.setState({ callGraphData: graph, isLoading: false });
    } catch (err) {
      console.error('Failed to load call graph:', err);
      this.setState({ isLoading: false });
    }
  }

  closeCallGraph() {
    this.setState({ isGraphOpen: false });
  }

  toggleSearch(open?: boolean) {
    this.setState({ isSearching: open ?? !this.state.isSearching });
  }

  async jumpToDefinition(name: string, file?: string, line?: number, col?: number) {
    try {
      const res = await api.fetchDefinition(name, file ?? this.state.activeFilePath ?? undefined, line, col);
      if (res.definitions && res.definitions.length > 0) {
        const target = res.definitions[0];
        if (target.file !== this.state.activeFilePath) {
          await this.selectFile(target.file, target.range.start.line);
        } else {
          this.jumpToLine(target.range.start.line);
        }
      }
    } catch (err) {
      console.error('Failed to jump to definition:', err);
    }
  }
}

export const traceStore = new TraceStore();

export function useTraceStore(): TraceState & {
  loadWorkspace: () => Promise<void>;
  selectFile: (path: string, line?: number) => Promise<void>;
  jumpToLine: (line: number) => void;
  setCursorPosition: (line: number) => void;
  openCallGraph: (symbol: string, file?: string) => Promise<void>;
  closeCallGraph: () => void;
  toggleSearch: (open?: boolean) => void;
  jumpToDefinition: (name: string, file?: string, line?: number, col?: number) => Promise<void>;
} {
  const [state, setState] = useState<TraceState>(traceStore.getState());

  useEffect(() => {
    return traceStore.subscribe(() => {
      setState(traceStore.getState());
    });
  }, []);

  return {
    ...state,
    loadWorkspace: () => traceStore.loadWorkspace(),
    selectFile: (p, l) => traceStore.selectFile(p, l),
    jumpToLine: (l) => traceStore.jumpToLine(l),
    setCursorPosition: (l) => traceStore.setCursorPosition(l),
    openCallGraph: (s, f) => traceStore.openCallGraph(s, f),
    closeCallGraph: () => traceStore.closeCallGraph(),
    toggleSearch: (o) => traceStore.toggleSearch(o),
    jumpToDefinition: (n, f, l, c) => traceStore.jumpToDefinition(n, f, l, c),
  };
}

