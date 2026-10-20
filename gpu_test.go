package main

import (
	"os"
	"testing"
)

// TestSetupCompositingEnv checks that the user's setting wins over the GPU
// detection, which is what decides whether the page animates.
func TestSetupCompositingEnv(t *testing.T) {
	cases := []struct {
		value string
		want  bool
	}{
		{"0", true},
		{"1", false},
		{"", false}, // empty: MyGo sets it, the page keeps its animations off
	}
	for _, c := range cases {
		t.Setenv("WEBKIT_DISABLE_DMABUF_RENDERER", c.value)
		if got := setupCompositing(); got != c.want {
			t.Fatalf("with WEBKIT_DISABLE_DMABUF_RENDERER=%q, compositing = %v, want %v", c.value, got, c.want)
		}
	}
	// An unset variable is the GPU's decision: here, Intel, so on.
	t.Setenv("WEBKIT_DISABLE_DMABUF_RENDERER", "")
	os.Unsetenv("WEBKIT_DISABLE_DMABUF_RENDERER")
	got := setupCompositing()
	if got != intelOrAMD() {
		t.Fatalf("without the variable, compositing = %v, intelOrAMD = %v", got, intelOrAMD())
	}
	if got {
		if v := os.Getenv("WEBKIT_DISABLE_DMABUF_RENDERER"); v != "0" {
			t.Fatalf("compositing without setting the renderer to 0: %q", v)
		}
	}
}
