package api

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"

	"tracelens/backend/internal/indexer"
)

// NewRouter sets up the Chi router with middleware and endpoints.
func NewRouter(index *indexer.Index) http.Handler {
	r := chi.NewRouter()

	// Base middleware
	r.Use(middleware.RequestID)
	r.Use(middleware.RealIP)
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)

	// Permissive CORS for local Vite dev server
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   []string{"http://localhost:*", "http://127.0.0.1:*", "*"},
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type", "X-CSRF-Token"},
		ExposedHeaders:   []string{"Link"},
		AllowCredentials: false,
		MaxAge:           300,
	}))

	h := NewHandlers(index)

	r.Route("/api", func(api chi.Router) {
		api.Get("/health", h.Health)

		// Workspace routes
		api.Post("/workspace/open", h.OpenWorkspace)
		api.Get("/workspace/tree", h.GetTree)

		// Code exploration routes
		api.Get("/file", h.GetFile)
		api.Get("/definition", h.FindDefinition)
		api.Get("/references", h.FindReferences)
		api.Get("/callgraph", h.CallGraph)
		api.Get("/symbols/search", h.SearchSymbols)
	})

	return r
}

