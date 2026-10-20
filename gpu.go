package main

import (
	"os"
	"path/filepath"
	"strings"
)

// compositing is whether the app expects WebKitGTK to draw on the GPU.
//
// MyGo sets WEBKIT_DISABLE_DMABUF_RENDERER=1 unless the environment already
// has it, to avoid blank windows on NVIDIA, virtual machines and containers.
// Without that renderer WebKitGTK falls back to software: an animated page
// then repaints the whole window per frame, at about 3 fps. On the GPUs the
// renderer works with, Intel and AMD, letting it through gives the app its
// animations at 60 fps; everywhere else MyGo's default stays, and the page
// keeps its animations off (see src/index.css).
//
// The user's own setting wins: WEBKIT_DISABLE_DMABUF_RENDERER=0 turns the
// renderer on, any other value turns it off.
func setupCompositing() bool {
	if value, ok := os.LookupEnv("WEBKIT_DISABLE_DMABUF_RENDERER"); ok {
		return value == "0"
	}
	if !intelOrAMD() {
		return false
	}
	_ = os.Setenv("WEBKIT_DISABLE_DMABUF_RENDERER", "0")
	return true
}

// intelOrAMD reports whether a graphics device of the machine is Intel's or
// AMD's, the vendors WebKitGTK's DMA-BUF renderer works with, as the PCI
// vendor IDs of its DRM cards say.
func intelOrAMD() bool {
	cards, err := filepath.Glob("/sys/class/drm/card[0-9]*/device/vendor")
	if err != nil {
		return false
	}
	for _, card := range cards {
		vendor, err := os.ReadFile(card)
		if err != nil {
			continue
		}
		switch strings.TrimSpace(string(vendor)) {
		case "0x8086", "0x1002": // Intel, AMD
			return true
		}
	}
	return false
}
