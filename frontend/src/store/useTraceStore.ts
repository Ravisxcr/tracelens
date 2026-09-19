import { useState, useEffect } from 'react';
import { CallGraphResponse, FileContentResponse, IndexStats, SymbolInfo, TreeNode } from '../types';
import * as api from '../api/client';

export type SidebarTab = 'explorer' | 'outline';

export interface TraceState {
  tree: TreeNode | null;
  stats: IndexStats | null;
  activeFilePath: string | null;
  activeFile: FileContentResponse | null;
  openTabs: string[];
  targetLine: number | null;
  selectedSymbol: SymbolInfo | null;
  callGraphSymbol: string | null;
  callGraphData: CallGraphResponse | null;
  isGraphOpen: boolean;
  isGraphFullScreen: boolean;
  isSearching: boolean;
  isSidebarOpen: boolean;
  sidebarWidth: number;
  graphWidth: number;
  activeSidebarTab: SidebarTab;
  cursorLine: number;
  cursorCol: number;
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
    openTabs: [],
    targetLine: null,
    selectedSymbol: null,
    callGraphSymbol: null,
    callGraphData: null,
    isGraphOpen: false,
    isGraphFullScreen: false,
    isSearching: false,
    isSidebarOpen: true,
    sidebarWidth: Number(localStorage.getItem('tracelens-sidebar-width')) || 260,
    graphWidth: Number(localStorage.getItem('tracelens-graph-width')) || 660,
    activeSidebarTab: 'explorer',
    cursorLine: 1,
    cursorCol: 1,
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

  setSidebarWidth(width: number) {
    const clamped = Math.max(160, Math.min(600, width));
    this.setState({ sidebarWidth: clamped });
  }

  saveSidebarWidth(width: number) {
    const clamped = Math.max(160, Math.min(600, width));
    localStorage.setItem('tracelens-sidebar-width', String(clamped));
  }

  setGraphWidth(width: number) {
    const maxWidth = typeof window !== 'undefined' ? window.innerWidth - 200 : 1200;
    const clamped = Math.max(340, Math.min(maxWidth, width));
    this.setState({ graphWidth: clamped });
  }

  saveGraphWidth(width: number) {
    const maxWidth = typeof window !== 'undefined' ? window.innerWidth - 200 : 1200;
    const clamped = Math.max(340, Math.min(maxWidth, width));
    localStorage.setItem('tracelens-graph-width', String(clamped));
  }

  toggleGraphFullScreen(fullscreen?: boolean) {
    const next = fullscreen ?? !this.state.isGraphFullScreen;
    this.setState({ isGraphFullScreen: next, isGraphOpen: true });
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

  async selectFile(path: string, line?: number, col?: number) {
    this.setState({ isLoading: true });
    try {
      const fileData = await api.fetchFile(path);
      const tabs = this.state.openTabs.includes(path)
        ? this.state.openTabs
        : [...this.state.openTabs, path];

      this.setState({
        activeFilePath: path,
        activeFile: fileData,
        openTabs: tabs,
        targetLine: line ?? 1,
        cursorLine: line ?? 1,
        cursorCol: col ?? 1,
        isLoading: false,
      });
      this.updateBreadcrumbs(line ?? 1, fileData.symbols);
    } catch (err) {
      console.error('Failed to load file:', err);
      this.setState({ isLoading: false });
    }
  }

  closeTab(path: string) {
    const newTabs = this.state.openTabs.filter((t) => t !== path);
    if (path === this.state.activeFilePath) {
      if (newTabs.length > 0) {
        const nextPath = newTabs[newTabs.length - 1];
        this.selectFile(nextPath);
      } else {
        this.setState({
          openTabs: [],
          activeFilePath: null,
          activeFile: null,
          breadcrumbs: [],
        });
      }
    } else {
      this.setState({ openTabs: newTabs });
    }
  }

  jumpToLine(line: number) {
    this.setState({ targetLine: line, cursorLine: line });
    if (this.state.activeFile) {
      this.updateBreadcrumbs(line, this.state.activeFile.symbols);
    }
  }

  setCursorPosition(line: number, col: number = 1) {
    this.setState({ cursorLine: line, cursorCol: col });
    if (this.state.activeFile) {
      this.updateBreadcrumbs(line, this.state.activeFile.symbols);
    }
  }

  setActiveSidebarTab(tab: SidebarTab) {
    this.setState({ activeSidebarTab: tab, isSidebarOpen: true });
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

  async openCallGraph(symbol: string, file?: string, limit?: number) {
    this.setState({ isGraphOpen: true, callGraphSymbol: symbol, isLoading: true });
    try {
      const graph = await api.fetchCallGraph(
        symbol,
        file ?? this.state.activeFilePath ?? undefined,
        1,
        limit ?? 50
      );
      this.setState({ callGraphData: graph, isLoading: false });
    } catch (err) {
      console.error('Failed to load call graph:', err);
      this.setState({ isLoading: false });
    }
  }

  closeCallGraph() {
    this.setState({ isGraphOpen: false, isGraphFullScreen: false });
  }

  toggleSearch(open?: boolean) {
    this.setState({ isSearching: open ?? !this.state.isSearching });
  }

  toggleSidebar(open?: boolean) {
    this.setState({ isSidebarOpen: open ?? !this.state.isSidebarOpen });
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
  selectFile: (path: string, line?: number, col?: number) => Promise<void>;
  closeTab: (path: string) => void;
  jumpToLine: (line: number) => void;
  setCursorPosition: (line: number, col?: number) => void;
  setActiveSidebarTab: (tab: SidebarTab) => void;
  openCallGraph: (symbol: string, file?: string, limit?: number) => Promise<void>;
  closeCallGraph: () => void;
  toggleSearch: (open?: boolean) => void;
  toggleSidebar: (open?: boolean) => void;
  setSidebarWidth: (width: number) => void;
  saveSidebarWidth: (width: number) => void;
  setGraphWidth: (width: number) => void;
  saveGraphWidth: (width: number) => void;
  toggleGraphFullScreen: (fullscreen?: boolean) => void;
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
    selectFile: (p, l, c) => traceStore.selectFile(p, l, c),
    closeTab: (p) => traceStore.closeTab(p),
    jumpToLine: (l) => traceStore.jumpToLine(l),
    setCursorPosition: (l, c) => traceStore.setCursorPosition(l, c),
    setActiveSidebarTab: (t) => traceStore.setActiveSidebarTab(t),
    openCallGraph: (s, f, l) => traceStore.openCallGraph(s, f, l),
    closeCallGraph: () => traceStore.closeCallGraph(),
    toggleSearch: (o) => traceStore.toggleSearch(o),
    toggleSidebar: (o) => traceStore.toggleSidebar(o),
    setSidebarWidth: (w) => traceStore.setSidebarWidth(w),
    saveSidebarWidth: (w) => traceStore.saveSidebarWidth(w),
    setGraphWidth: (w) => traceStore.setGraphWidth(w),
    saveGraphWidth: (w) => traceStore.saveGraphWidth(w),
    toggleGraphFullScreen: (f) => traceStore.toggleGraphFullScreen(f),
    jumpToDefinition: (n, f, l, c) => traceStore.jumpToDefinition(n, f, l, c),
  };
}
