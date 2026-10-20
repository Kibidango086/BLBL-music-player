package main

import (
	"log"
	"runtime"

	"github.com/egoist/mygo"
)

func main() {
	// Before App.Run, which starts the webview: whether it may draw on the GPU
	// decides whether the page animates (gpu.go).
	compositing = setupCompositing()

	core := newCore()

	// The services the page calls: bilibili's API, and the desktop's own
	// calls (the browser, the proxy). `mygo generate` writes their typed
	// TypeScript client to src/mygo.ts.
	mygo.Bind(&Bilibili{core: core})
	mygo.Bind(&System{core: core})
	mygo.Bind(&Music{core: core})

	// The menu bar is hidden until Alt, as the app's was; its Edit menu is
	// what gives the page's fields copy and paste.
	menu := mygo.NewMenu([]*mygo.MenuItem{
		{Role: mygo.RoleAppMenu},
		{Role: mygo.RoleEditMenu},
		{Role: mygo.RoleWindowMenu},
	})
	mygo.App.SetMenu(menu)

	mygo.App.WhenReady(func() {
		core.init()
		newMainWindow()
	})

	// Clicking the Dock icon with no window open shows one again.
	mygo.App.OnActivate(func(hasVisibleWindows bool) {
		if !hasVisibleWindows {
			newMainWindow()
		}
	})

	if err := mygo.App.Run(); err != nil {
		log.Fatal(err)
	}
}

// newMainWindow shows the app's window: frameless, as the Electron app's was,
// with the title bar the page draws, and the menu bar hidden until Alt.
func newMainWindow() *mygo.Window {
	opts := mygo.WindowOptions{
		Title:           "BLBL Music Player",
		URL:             "/",
		Width:           1280,
		Height:          800,
		MinWidth:        900,
		MinHeight:       600,
		Frameless:       true,
		AutoHideMenuBar: true,
		Hidden:          true, // shown once the page is ready, without a white flash
		BackgroundColor: "light-dark(#ffffff, #0a0a0a)",
	}
	// macOS keeps its traffic lights, as the Electron app did with a hidden
	// title bar; the page draws the rest of the title bar around them.
	if runtime.GOOS == "darwin" {
		opts.Frameless = false
		opts.TitleBarStyle = mygo.TitleBarHidden
		opts.TitleBarHeight = 36
	}
	win := mygo.NewWindow(opts)
	win.OnReadyToShow(win.Show)

	// Links that ask for a window open in the user's browser, as before.
	win.Page().SetWindowOpenHandler(func(req mygo.WindowOpenRequest) *mygo.WindowOptions {
		go func() {
			if err := mygo.Shell.OpenExternal(req.URL); err != nil {
				log.Printf("blbl: open %s: %v", req.URL, err)
			}
		}()
		return nil
	})

	log.Printf("blbl: window opened on %s", runtime.GOOS)
	return win
}
