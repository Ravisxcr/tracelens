package version

import "fmt"

var (
	// Version is the current semver release string (overridden via ldflags during build).
	Version = "0.1.0"

	// GitCommit is the short commit hash of the build (overridden via ldflags).
	GitCommit = "dev"

	// BuildDate is the timestamp when the binary was built (overridden via ldflags).
	BuildDate = "unknown"
)

// Info returns a formatted version string with build metadata.
func Info() string {
	if GitCommit == "dev" && BuildDate == "unknown" {
		return fmt.Sprintf("tlens v%s", Version)
	}
	return fmt.Sprintf("tlens v%s (commit: %s, built: %s)", Version, GitCommit, BuildDate)
}

