package testdata

import (
	"fmt"
	"strings"
)

// Greeter handles greeting formatting.
type Greeter struct {
	Prefix string
}

// NewGreeter creates a new Greeter.
func NewGreeter(prefix string) *Greeter {
	return &Greeter{Prefix: prefix}
}

// Greet formats a greeting message.
func (g *Greeter) Greet(name string) string {
	formatted := g.formatName(name)
	return fmt.Sprintf("%s, %s!", g.Prefix, formatted)
}

func (g *Greeter) formatName(name string) string {
	return strings.TrimSpace(name)
}

// RunGreeting demonstrates callers.
func RunGreeting() {
	greeter := NewGreeter("Hello")
	msg := greeter.Greet("World")
	fmt.Println(msg)
}

