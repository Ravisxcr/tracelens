# ==============================================================================
# TraceLens (tlens) — Single Binary Distribution & Automation Makefile
# ==============================================================================

SHELL := /bin/bash
.DEFAULT_GOAL := help

CYAN   := \033[36m
GREEN  := \033[32m
YELLOW := \033[33m
RESET  := \033[0m

BACKEND_DIR  := backend
FRONTEND_DIR := frontend
BINARY_NAME  := tlens
PORT         ?= 8080
TARGET_DIR   ?= .
DIST_DIR     := dist

# Versioning extracted from root VERSION file
VERSION_FILE := VERSION
VERSION      ?= $(shell cat $(VERSION_FILE) 2>/dev/null | tr -d '[:space:]')
ifeq ($(VERSION),)
	VERSION := 0.1.0
endif
GIT_COMMIT   ?= $(shell git rev-parse --short HEAD 2>/dev/null || echo "unknown")
BUILD_DATE   ?= $(shell date -u +'%Y-%m-%dT%H:%M:%SZ')

LDFLAGS := -s -w \
	-X 'tracelens/backend/internal/version.Version=$(VERSION)' \
	-X 'tracelens/backend/internal/version.GitCommit=$(GIT_COMMIT)' \
	-X 'tracelens/backend/internal/version.BuildDate=$(BUILD_DATE)'

GOOS         ?= $(shell go env GOOS)
GOARCH       ?= $(shell go env GOARCH)
ARCHIVE_NAME := $(BINARY_NAME)-v$(VERSION)-$(GOOS)-$(GOARCH)

.PHONY: help
help: ## Display available make commands
	@echo -e "$(CYAN)TraceLens (tlens) Single Binary Distribution Makefile (v$(VERSION))$(RESET)"
	@echo -e "Usage: make $(GREEN)<target>$(RESET)\n"
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "  $(GREEN)%-18s$(RESET) %s\n", $$1, $$2}' $(MAKEFILE_LIST)

.PHONY: version
version: ## Display current version from VERSION file and build metadata
	@echo -e "Version:    $(GREEN)$(VERSION)$(RESET)"
	@echo -e "Git Commit: $(CYAN)$(GIT_COMMIT)$(RESET)"
	@echo -e "Build Date: $(YELLOW)$(BUILD_DATE)$(RESET)"

# ------------------------------------------------------------------------------
# Build Single Standalone Binary
# ------------------------------------------------------------------------------

.PHONY: build
build: build-frontend-assets ## Build complete self-contained single binary (bin/tlens)
	@echo -e "$(CYAN)==> Compiling self-contained Go binary (v$(VERSION)) with embedded frontend...$(RESET)"
	@mkdir -p bin $(BACKEND_DIR)/bin
	@cd $(BACKEND_DIR) && GOTOOLCHAIN=local go build -ldflags="$(LDFLAGS)" -o bin/$(BINARY_NAME) ./cmd/server
	@cp $(BACKEND_DIR)/bin/$(BINARY_NAME) bin/$(BINARY_NAME)
	@echo -e "$(GREEN)=============================================================$(RESET)"
	@echo -e "$(GREEN)  Single standalone binary built successfully: bin/$(BINARY_NAME) (v$(VERSION))$(RESET)"
	@echo -e "$(GREEN)  Run it with: ./bin/$(BINARY_NAME) .$(RESET)"
	@echo -e "$(GREEN)  Or:          ./bin/$(BINARY_NAME) /path/to/folder$(RESET)"
	@echo -e "$(GREEN)=============================================================$(RESET)"

.PHONY: package
package: build ## Package binary and docs into release archive in dist/
	@echo -e "$(CYAN)==> Packaging distribution archive for $(ARCHIVE_NAME)...$(RESET)"
	@mkdir -p $(DIST_DIR)/$(ARCHIVE_NAME)
	@cp bin/$(BINARY_NAME) $(DIST_DIR)/$(ARCHIVE_NAME)/
	@cp README.md $(DIST_DIR)/$(ARCHIVE_NAME)/ 2>/dev/null || true
	@cp $(VERSION_FILE) $(DIST_DIR)/$(ARCHIVE_NAME)/ 2>/dev/null || true
	@if [ "$(GOOS)" = "windows" ]; then \
		(cd $(DIST_DIR) && zip -r $(ARCHIVE_NAME).zip $(ARCHIVE_NAME) && sha256sum $(ARCHIVE_NAME).zip > $(ARCHIVE_NAME).zip.sha256); \
		echo -e "$(GREEN)==> Created $(DIST_DIR)/$(ARCHIVE_NAME).zip$(RESET)"; \
	else \
		tar -czf $(DIST_DIR)/$(ARCHIVE_NAME).tar.gz -C $(DIST_DIR) $(ARCHIVE_NAME); \
		(cd $(DIST_DIR) && sha256sum $(ARCHIVE_NAME).tar.gz > $(ARCHIVE_NAME).tar.gz.sha256); \
		echo -e "$(GREEN)==> Created $(DIST_DIR)/$(ARCHIVE_NAME).tar.gz$(RESET)"; \
	fi
	@rm -rf $(DIST_DIR)/$(ARCHIVE_NAME)

.PHONY: build-frontend-assets
build-frontend-assets: ## Build Vite frontend bundle and sync to Go embed directory
	@echo -e "$(CYAN)==> Building production frontend assets...$(RESET)"
	@cd $(FRONTEND_DIR) && npm run build
	@echo -e "$(CYAN)==> Syncing frontend assets to backend embed directory...$(RESET)"
	@rm -rf $(BACKEND_DIR)/internal/web/dist/*
	@cp -r $(FRONTEND_DIR)/dist/* $(BACKEND_DIR)/internal/web/dist/

GOPATH_BIN ?= $(shell go env GOPATH)/bin
ifeq ($(GOPATH_BIN),/bin)
	GOPATH_BIN := $(HOME)/go/bin
endif

.PHONY: install-bin
install-bin: build ## Build and install tlens to $GOPATH/bin
	@mkdir -p $(GOPATH_BIN)
	@cp bin/$(BINARY_NAME) $(GOPATH_BIN)/$(BINARY_NAME)
	@echo -e "$(GREEN)==> Installed $(BINARY_NAME) to $(GOPATH_BIN)/$(BINARY_NAME)$(RESET)"
	@echo -e "Make sure $(GOPATH_BIN) is in your PATH. Then you can run: $(CYAN)tlens .$(RESET)"

# ------------------------------------------------------------------------------
# Development
# ------------------------------------------------------------------------------

.PHONY: dev
dev: ## Run fullstack development environment (backend + Vite hot reload)
	@echo -e "$(GREEN)==> Launching TraceLens fullstack development environment...$(RESET)"
	@trap 'kill 0' EXIT; \
	(cd $(BACKEND_DIR) && GOTOOLCHAIN=local go run ./cmd/server/main.go -port $(PORT) -no-browser $(TARGET_DIR)) & \
	(cd $(FRONTEND_DIR) && npm run dev) & \
	wait

.PHONY: dev-backend
dev-backend: ## Run backend server only
	@cd $(BACKEND_DIR) && GOTOOLCHAIN=local go run ./cmd/server/main.go -port $(PORT) -no-browser $(TARGET_DIR)

.PHONY: dev-frontend
dev-frontend: ## Start Vite frontend dev server
	@cd $(FRONTEND_DIR) && npm run dev

# ------------------------------------------------------------------------------
# Testing & Verification
# ------------------------------------------------------------------------------

.PHONY: test
test: test-backend test-frontend ## Run backend unit/integration tests and frontend type check

.PHONY: test-backend
test-backend: ## Run Go unit and integration test suite
	@cd $(BACKEND_DIR) && GOTOOLCHAIN=local go test -v ./...

.PHONY: test-frontend
test-frontend: ## Run TypeScript type check on frontend
	@cd $(FRONTEND_DIR) && npx tsc --noEmit

.PHONY: lint
lint: ## Run go vet and static analyzers
	@cd $(BACKEND_DIR) && GOTOOLCHAIN=local go vet ./...

# ------------------------------------------------------------------------------
# Cleanup
# ------------------------------------------------------------------------------

.PHONY: clean
clean: ## Remove compiled binaries and build artifacts
	@echo -e "$(YELLOW)==> Cleaning build artifacts...$(RESET)"
	@rm -rf bin $(BACKEND_DIR)/bin $(DIST_DIR)
	@rm -rf $(FRONTEND_DIR)/dist $(FRONTEND_DIR)/dist-ssr $(FRONTEND_DIR)/.vite
	@rm -f $(BACKEND_DIR)/*.out $(BACKEND_DIR)/*.test
	@echo -e "$(GREEN)==> Clean complete.$(RESET)"
