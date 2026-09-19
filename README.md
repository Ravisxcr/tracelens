# TraceLens

**TraceLens** is a lightweight, read-only code exploration tool designed for rapid code comprehension, call graphs, and fast symbol tracing without the overhead of editing or full language server protocol (LSP) setups.

## Tech Stack

- **Backend**: Go (Chi router, Tree-sitter bindings via `smacker/go-tree-sitter`)
- **Frontend**: React 18, Vite, TypeScript, Tailwind CSS, Monaco Editor (read-only mode), and React Flow (`@xyflow/react`)

---

## Features

- **Fast Recursive AST Scanner**: Indexes Go, TypeScript, and JavaScript source files using Tree-sitter.
- **In-Memory Symbol & Call Inverted Index**: Instant $O(1)$ symbol definition lookups and caller/callee resolutions.
- **Read-Only Monaco Viewer**:
  - Pinned sticky scroll (`stickyScroll: { enabled: true }`)
  - Live breadcrumbs tracking cursor scope (`path > struct > method`)
  - Hover provider with "Jump to Definition" and "Trace Call Graph"
  - Pulse highlight decoration on definition jumps
- **Interactive Call Graph Panel**:
  - Powered by `@xyflow/react`
  - Automatic horizontal layered layout (incoming callers $\rightarrow$ target symbol $\rightarrow$ outgoing callees)
  - "Jump to Code" and "Trace" buttons on every graph node
- **Global Quick Symbol Search**: `⌘P` / `Ctrl+P` modal with keyboard navigation.

---

## Quick Start

### 1. Backend

```bash
cd backend
go run ./cmd/server/main.go -port 8080 -dir ..
```

Run test suite:
```bash
go test -v ./...
```

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

Visit `http://localhost:5173` to explore your codebase.