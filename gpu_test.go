package main

import (
	"os"
	"testing"
)

// TestSetupCompositingEnv checks that the renderer is opt-in, since the page
// animates only where it is on.
func TestSetupCompositingEnv(t *testing.T) {
	cases := []struct {
		value string
		want  bool
	}{
		{"0", true},
		{"1", false},
		{"", false}, // MyGo sets it, the page keeps its animations off
	}
	for _, c := range cases {
		t.Setenv("WEBKIT_DISABLE_DMABUF_RENDERER", c.value)
		if got := setupCompositing(); got != c.want {
			t.Fatalf("with WEBKIT_DISABLE_DMABUF_RENDERER=%q, compositing = %v, want %v", c.value, got, c.want)
		}
	}
	// Unset means MyGo's safe default: no compositing, no animations.
	t.Setenv("WEBKIT_DISABLE_DMABUF_RENDERER", "")
	os.Unsetenv("WEBKIT_DISABLE_DMABUF_RENDERER")
	if setupCompositing() {
		t.Fatal("compositing is on without WEBKIT_DISABLE_DMABUF_RENDERER=0")
	}
}
