package main

import "os"

// compositing is whether the app expects WebKitGTK to draw on the GPU.
//
// MyGo disables WebKitGTK's DMA-BUF renderer by default, to avoid blank
// windows on NVIDIA, virtual machines and containers, and without it WebKitGTK
// paints in software: an animated page then costs a whole-window repaint per
// frame, at about 3 fps. With the renderer the same page runs at 60 fps, so
// the page animates only when it is on (src/index.css, ImmersivePlayer).
//
// It is opt-in, because with it this WebKitGTK build draws the immersive
// player black on the Intel + Wayland machine the port was tested on: set
// WEBKIT_DISABLE_DMABUF_RENDERER=0 to turn it on where it works.
func setupCompositing() bool {
	return os.Getenv("WEBKIT_DISABLE_DMABUF_RENDERER") == "0"
}
