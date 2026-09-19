# TraceLens (`tlens`)

**TraceLens** is an ultra-fast, read-only code exploration tool and execution graph engine designed for instant code comprehension, call graphs, and symbol tracing across **C**, **C++**, **Python** (optimized for **CPython**), **Go**, and **TypeScript/JavaScript** codebases.

Distributed as a **single self-contained binary** with the frontend UI fully embedded.

---

## Quick Start (Single Binary)

### 1. Build the standalone binary
```bash
make build
```
This builds `bin/tlens` with the embedded production web application.

### 2. Run anywhere
```bash
# Explore the current folder
./bin/tlens .

# Explore a target project or repo
./bin/tlens /path/to/cpython

# Specify custom port
./bin/tlens -port 3000 my-project
```
TraceLens will index the codebase and automatically open your default browser to `http://localhost:8080`.

### 3. Install globally to PATH
```bash
make install-bin
```
Then simply run:
```bash
tlens .
```

---

## Features

- **Single Self-Contained Binary**: Zero external runtime dependencies. Frontend HTML/JS/CSS assets are embedded directly into the executable via Go `//go:embed`.
- **Positional Folder Syntax**: Pass `.` or any directory path as the first positional argument (`tlens .`, `tlens ../cpython`).
- **CPython C & Python AST Support**: Parses C/C++ structs, typedefs, enums, macros (`#define`), global type descriptors (`PyTypeObject`), Python classes, methods, and type annotations.
- **Overlap-Free 5-Column Graph Engine**:
  - Differentiates **Control Flow** (`calls`), **Datatypes & Structs** (`uses_type`), and **Variables & Objects** (`accesses_var`).
  - Strict horizontal column tracks and vertical clearance guarantees zero card overlap.
- **Interactive Graph Filtering**: Filter chips to toggle Functions, Datatypes, or Variables on/off in real-time.
- **Collapsible Sidebar**: Toggle with `⌘B` / `Ctrl+B` or the navbar button to expand Monaco and the Graph canvas to full screen.
- **Ultra-Compact Space-Efficient Navbar**: Reclaims vertical space for code reading.
- **Light, Dark & System Themes**: High-contrast theme cycler compatible with Monaco and React Flow.

---

## Development

```bash
# View all available make targets
make help

# Run test suite
make test

# Start fullstack dev server (Go backend + Vite hot-reload)
make dev
```