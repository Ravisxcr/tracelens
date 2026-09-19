package web

import (
	"embed"
	"io/fs"
	"net/http"
	"strings"
)

//go:embed all:dist
var embeddedFS embed.FS

// Handler returns an http.Handler that serves the embedded frontend single-page application.
func Handler() http.Handler {
	distFS, err := fs.Sub(embeddedFS, "dist")
	if err != nil {
		return http.NotFoundHandler()
	}

	fileServer := http.FileServer(http.FS(distFS))

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		cleanPath := strings.TrimPrefix(r.URL.Path, "/")
		if cleanPath == "" {
			fileServer.ServeHTTP(w, r)
			return
		}

		// Check if the requested file exists in the embedded assets
		if f, err := distFS.Open(cleanPath); err == nil {
			_ = f.Close()
			fileServer.ServeHTTP(w, r)
			return
		}

		// SPA fallback: serve index.html for frontend client routing
		r.URL.Path = "/"
		fileServer.ServeHTTP(w, r)
	})
}

