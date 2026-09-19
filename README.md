# TraceLens (`tlens`)

**TraceLens** is an ultra-fast, read-only code exploration tool and execution graph engine designed for instant code comprehension, call graphs, and symbol tracing across **C**, **C++**, **Python** (optimized for **CPython**), **Go**, and **TypeScript/JavaScript** codebases.

Distributed as a **single self-contained binary** with the frontend UI fully embedded.

---

## Releases & Pre-Built Binaries

Pre-compiled standalone binaries for **Linux (x86_64)**, **macOS (Apple Silicon & Intel)**, and **Windows (x86_64)** are available on the [GitHub Releases page](https://github.com/Ravisxcr/tracelens/releases).

Every release binary includes the frontend UI bundled directly into the executable—simply download, unpack, and run without needing Node.js or Go installed.

---

## Quick Start (Single Binary)

### 1. Build the standalone binary from source
```bash
make build
```
This builds `bin/tlens` with the version injected from the `VERSION` file and the embedded production web application.

### 2. Run anywhere
```bash
# Explore the current folder
./bin/tlens .

# Explore a target project or repo
./bin/tlens /path/to/cpython

# Check version
./bin/tlens -version
./bin/tlens -v

# Specify custom port
./bin/tlens -port 3000 my-project

# Run with custom watchdog polling interval (or disable with -watch=false)
./bin/tlens -watch=true -watch-interval 500ms .
```
TraceLens will index the codebase, start the live filesystem watchdog, and automatically open your default browser to `http://localhost:8080`.

### 3. Install globally to PATH
```bash
make install-bin
```
Then simply run:
```bash
tlens .
```

### 4. Package distribution archive locally
```bash
make package
```
Generates a `.tar.gz` (or `.zip` on Windows) along with its SHA-256 checksum in `dist/`.

---

## Features

- **Live Filesystem Watchdog**: Continuously monitors the target workspace for code changes, additions, and deletions with debounced reindexing and real-time Server-Sent Events (SSE) synchronization to the web UI.
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

# Check current version and build metadata
make version

# Run test suite
make test

# Start fullstack dev server (Go backend + Vite hot-reload)
make dev
```

---

## Release & Versioning Workflow

TraceLens uses the root `VERSION` file as the single source of truth for version numbering:

1. **Bump Version**: Update `VERSION` (e.g. `0.2.0`).
2. **Push to `main` or Tag**:
   - Pushing a commit that modifies `VERSION` on `main` triggers the **Release Distribution** GitHub Actions pipeline.
   - Alternatively, pushing a git tag (e.g. `git tag v0.2.0 && git push origin v0.2.0`) triggers the release pipeline.
   - The workflow can also be dispatched manually via the GitHub Actions tab (`workflow_dispatch`).
3. **Automated Cross-Platform Matrix Build**:
   - The pipeline builds standalone executables across native runners: Linux x86_64, macOS Apple Silicon (arm64), macOS Intel (x86_64), and Windows x86_64.
   - Releases are automatically packaged (`.tar.gz` and `.zip`), checksummed with SHA-256 (`checksums.txt`), and published directly to GitHub Releases.