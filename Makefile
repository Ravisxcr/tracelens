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

.PHONY: help
help: ## Display available make commands
	@echo -e "$(CYAN)TraceLens (tlens) Single Binary Distribution Makefile$(RESET)"
	@echo -e "Usage: make $(GREEN)<target>$(RESET)\n"
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "  $(GREEN)%-18s$(RESET) %s\n", $$1, $$2}' $(MAKEFILE_LIST)

# ------------------------------------------------------------------------------
# Build Single Standalone Binary
# ------------------------------------------------------------------------------

.PHONY: build
build: build-frontend-assets ## Build complete self-contained single binary (bin/tlens)
	@echo -e "$(CYAN)==> Compiling self-contained Go binary with embedded frontend...$(RESET)"
	@mkdir -p bin $(BACKEND_DIR)/bin
	@cd $(BACKEND_DIR) && GOTOOLCHAIN=local go build -ldflags="-s -w" -o bin/$(BINARY_NAME) ./cmd/server
	@cp $(BACKEND_DIR)/bin/$(BINARY_NAME) bin/$(BINARY_NAME)
	@echo -e "$(GREEN)=============================================================$(RESET)"
	@echo -e "$(GREEN)  Single standalone binary built successfully: bin/$(BINARY_NAME)$(RESET)"
	@echo -e "$(GREEN)  Run it with: ./bin/$(BINARY_NAME) .$(RESET)"
	@echo -e "$(GREEN)  Or:          ./bin/$(BINARY_NAME) /path/to/folder$(RESET)"
	@echo -e "$(GREEN)=============================================================$(RESET)"

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
	@rm -rf bin $(BACKEND_DIR)/bin
	@rm -rf $(FRONTEND_DIR)/dist $(FRONTEND_DIR)/dist-ssr $(FRONTEND_DIR)/.vite
	@rm -f $(BACKEND_DIR)/*.out $(BACKEND_DIR)/*.test
	@echo -e "$(GREEN)==> Clean complete.$(RESET)"
