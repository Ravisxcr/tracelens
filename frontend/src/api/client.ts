import { CallGraphResponse, FileContentResponse, IndexStats, SymbolInfo, TreeNode } from '../types';

const API_BASE = '/api';

export async function fetchTree(): Promise<{ tree: TreeNode; stats: IndexStats }> {
  const res = await fetch(`${API_BASE}/workspace/tree`);
  if (!res.ok) throw new Error(`Failed to fetch workspace tree: ${res.statusText}`);
  return res.json();
}

export async function fetchFile(path: string): Promise<FileContentResponse> {
  const res = await fetch(`${API_BASE}/file?path=${encodeURIComponent(path)}`);
  if (!res.ok) throw new Error(`Failed to fetch file ${path}: ${res.statusText}`);
  return res.json();
}

export async function fetchDefinition(
  name?: string,
  file?: string,
  line?: number,
  col?: number
): Promise<{ query: string; definitions: SymbolInfo[] }> {
  const params = new URLSearchParams();
  if (name) params.set('name', name);
  if (file) params.set('file', file);
  if (line !== undefined) params.set('line', line.toString());
  if (col !== undefined) params.set('col', col.toString());

  const res = await fetch(`${API_BASE}/definition?${params.toString()}`);
  if (!res.ok) throw new Error(`Failed to resolve definition: ${res.statusText}`);
  return res.json();
}

export async function fetchReferences(name: string): Promise<{ symbol: string; references: any[] }> {
  const res = await fetch(`${API_BASE}/references?name=${encodeURIComponent(name)}`);
  if (!res.ok) throw new Error(`Failed to fetch references: ${res.statusText}`);
  return res.json();
}

export async function fetchCallGraph(
  symbol: string,
  file?: string,
  depth = 1
): Promise<CallGraphResponse> {
  const params = new URLSearchParams();
  params.set('symbol', symbol);
  if (file) params.set('file', file);
  params.set('depth', depth.toString());

  const res = await fetch(`${API_BASE}/callgraph?${params.toString()}`);
  if (!res.ok) throw new Error(`Failed to fetch call graph: ${res.statusText}`);
  return res.json();
}

export async function searchSymbols(query: string): Promise<{ query: string; symbols: SymbolInfo[] }> {
  const res = await fetch(`${API_BASE}/symbols/search?q=${encodeURIComponent(query)}`);
  if (!res.ok) throw new Error(`Failed to search symbols: ${res.statusText}`);
  return res.json();
}

export async function openWorkspace(path: string): Promise<{ path: string; stats: IndexStats }> {
  const res = await fetch(`${API_BASE}/workspace/open`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path }),
  });
  if (!res.ok) throw new Error(`Failed to open workspace: ${res.statusText}`);
  return res.json();
}

