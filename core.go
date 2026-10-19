package main

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/egoist/mygo"
)

// Core is what the app keeps outside its windows: the cookies, the HTTP
// client, the settings and the directories. The services the page binds share
// it, and it sets itself up the first time one of them is called.
type Core struct {
	initOnce     sync.Once
	sessionOnce  sync.Once
	jar          *cookieJar
	client       *biliClient
	userDir      string
	cacheDirPath string
	settingsFile string
	streams      streamServer

	mu          sync.Mutex
	wbiKeyValue string
	wbiKeyTime  time.Time
}

func newCore() *Core { return &Core{} }

func (c *Core) init() {
	c.initOnce.Do(func() {
		userDir, err := mygo.App.Path(mygo.PathUserData)
		if err != nil || userDir == "" {
			userDir = filepath.Join(os.TempDir(), "blbl-music-player")
		}
		cacheDir, err := mygo.App.Path(mygo.PathCache)
		if err != nil || cacheDir == "" {
			cacheDir = filepath.Join(userDir, "cache")
		}
		c.configure(userDir, cacheDir)
	})
}

// configure sets the directories and the client up, which init reads from the
// app, and which tests point elsewhere.
func (c *Core) configure(userDir, cacheDir string) {
	c.userDir = userDir
	c.cacheDirPath = cacheDir
	c.settingsFile = filepath.Join(userDir, "settings.json")
	c.jar = newCookieJar(filepath.Join(userDir, "cookies.json"))
	c.client = newBiliClient(c.jar)
	c.loadSettings()
}

func (c *Core) cacheDir() string {
	c.init()
	return c.cacheDirPath
}

// ---------------------------------------------------------------------------
// Settings: the proxy, which the page applies on startup
// ---------------------------------------------------------------------------

type appSettings struct {
	ProxyRules string `json:"proxyRules,omitempty"`
	ProxyUser  string `json:"proxyUser,omitempty"`
	ProxyPass  string `json:"proxyPass,omitempty"`
}

func (c *Core) loadSettings() {
	data, err := os.ReadFile(c.settingsFile)
	if err != nil {
		return
	}
	var s appSettings
	if err := json.Unmarshal(data, &s); err != nil {
		return
	}
	if s.ProxyRules != "" {
		if err := c.client.setProxy(s.ProxyRules, s.ProxyUser, s.ProxyPass); err != nil {
			log.Printf("blbl: ignoring saved proxy: %v", err)
		}
	}
}

func (c *Core) saveSettings(s appSettings) {
	if c.settingsFile == "" {
		return
	}
	data, err := json.MarshalIndent(s, "", "  ")
	if err != nil {
		return
	}
	_ = os.MkdirAll(filepath.Dir(c.settingsFile), 0o755)
	_ = os.WriteFile(c.settingsFile, data, 0o600)
}

func (c *Core) currentSettings() appSettings {
	data, err := os.ReadFile(c.settingsFile)
	if err != nil {
		return appSettings{}
	}
	var s appSettings
	_ = json.Unmarshal(data, &s)
	return s
}

// ---------------------------------------------------------------------------
// Sessions
// ---------------------------------------------------------------------------

// ensureSession visits bilibili once, so that the jar has the cookies a
// browser gets on its first visit (buvid3 and buvid4), which its API wants
// for searches and for the pages of a video.
func (c *Core) ensureSession() {
	c.init()
	c.sessionOnce.Do(func() {
		if c.jar.value("bilibili.com", "buvid3") != "" {
			return
		}
		ctx, cancel := context.WithTimeout(context.Background(), 8*time.Second)
		defer cancel()
		_, _, _ = c.client.get(ctx, "https://www.bilibili.com/")
	})
}

// importWebviewCookies copies the cookies the app's pages have, the ones the
// login window set, into the Go side's jar.
func (c *Core) importWebviewCookies() {
	c.init()
	list, err := mygo.Cookies.List(mygo.CookieFilter{URL: "https://www.bilibili.com"})
	if err != nil {
		return
	}
	for _, ck := range list {
		if ck.Name == "" || ck.Value == "" {
			continue
		}
		var exp int64
		if !ck.Expires.IsZero() {
			exp = ck.Expires.Unix()
		}
		c.jar.set(storedCookie{
			Name:     ck.Name,
			Value:    ck.Value,
			Domain:   strings.TrimPrefix(ck.Domain, "."),
			Path:     ck.Path,
			Expires:  exp,
			Secure:   ck.Secure,
			HTTPOnly: ck.HTTPOnly,
			HostOnly: !strings.HasPrefix(ck.Domain, "."),
		})
	}
}

func (c *Core) loginStatus(ctx context.Context) LoginStatus {
	c.init()
	data, err := c.client.getJSON(ctx, apiBase+"/x/web-interface/nav")
	if err != nil {
		return LoginStatus{IsLogin: false}
	}
	isLogin, _ := data["isLogin"].(bool)
	return LoginStatus{
		IsLogin: isLogin,
		Mid:     asInt(data["mid"]),
		Uname:   asString(data["uname"]),
		Face:    asString(data["face"]),
	}
}

// openLogin shows bilibili's login page in a window of its own, as the app
// did, and waits for the user to sign in: the cookies of the page are copied
// into the Go side's jar when they show a signed-in user.
func (c *Core) openLogin(ctx context.Context) LoginResult {
	c.init()
	parent := mygo.CallerWindow(ctx)

	done := make(chan LoginResult, 1)
	var once sync.Once
	finish := func(r LoginResult) {
		once.Do(func() { done <- r })
	}

	win := mygo.NewWindow(mygo.WindowOptions{
		Title:           "登录 Bilibili",
		URL:             "https://passport.bilibili.com/h5-app/passport/login",
		Width:           520,
		Height:          720,
		Parent:          parent,
		Modal:           parent != nil,
		BackgroundColor: "#ffffff",
	})
	win.OnClosed(func() { finish(LoginResult{Success: false, Message: "登录窗口已关闭"}) })

	go func() {
		ticker := time.NewTicker(1500 * time.Millisecond)
		defer ticker.Stop()
		for {
			select {
			case <-ctx.Done():
				finish(LoginResult{Success: false, Message: "已取消"})
				win.Close()
				return
			case <-ticker.C:
				if len(done) > 0 {
					return
				}
				c.importWebviewCookies()
				if status := c.loginStatus(ctx); status.IsLogin {
					// Settle before closing: the window's own close would
					// otherwise report that the user closed it.
					finish(LoginResult{Success: true})
					win.Close()
					return
				}
			}
		}
	}()

	return <-done
}

// ---------------------------------------------------------------------------
// Audio streams
//
// The page plays the audio of a video from a server on this machine: the
// request leaves from Go with bilibili's Referer, with the app's cookies and
// through the app's proxy, and its response carries the CORS headers that let
// Web Audio read the samples, which the surround effect needs.
//
// It is HTTP over the loopback interface rather than a custom scheme because
// the webview's media pipeline (GStreamer in WebKitGTK) plays http and file
// URLs only: an audio element cannot load a custom scheme. The server listens
// on 127.0.0.1, at a port the system picks, under a path with a token this run
// made, and refuses every host but bilibili's CDNs.
// ---------------------------------------------------------------------------

type streamServer struct {
	once  sync.Once
	base  string
	token string
	err   error
}

// baseURL starts the server, once, and returns the URL its streams have.
func (c *Core) baseURL() (string, error) {
	c.init()
	c.streams.once.Do(func() {
		var raw [16]byte
		if _, err := rand.Read(raw[:]); err != nil {
			c.streams.err = err
			return
		}
		c.streams.token = hex.EncodeToString(raw[:])
		ln, err := net.Listen("tcp", "127.0.0.1:0")
		if err != nil {
			c.streams.err = err
			return
		}
		mux := http.NewServeMux()
		mux.HandleFunc("/s/"+c.streams.token+"/stream", c.serveStream)
		mux.HandleFunc("/s/"+c.streams.token+"/img", c.serveImage)
		srv := &http.Server{Handler: mux, ReadHeaderTimeout: 10 * time.Second}
		go func() {
			if err := srv.Serve(ln); err != nil && err != http.ErrServerClosed {
				log.Printf("blbl: the audio server: %v", err)
			}
		}()
		c.streams.base = "http://127.0.0.1:" + strconv.Itoa(ln.Addr().(*net.TCPAddr).Port) + "/s/" + c.streams.token
	})
	return c.streams.base, c.streams.err
}

// streamURL is the address the page plays a CDN URL from.
func (c *Core) streamURL(raw string) (string, error) {
	if !allowedMediaURL(raw) {
		return "", fmt.Errorf("不是 B 站音源地址: %s", raw)
	}
	base, err := c.baseURL()
	if err != nil {
		return "", err
	}
	return base + "/stream?u=" + url.QueryEscape(raw), nil
}

func (c *Core) serveStream(w http.ResponseWriter, r *http.Request) {
	c.init()
	raw := r.URL.Query().Get("u")
	if raw == "" {
		http.Error(w, "missing u", http.StatusBadRequest)
		return
	}
	if !allowedMediaURL(raw) {
		http.Error(w, "this host is not a bilibili media host", http.StatusForbidden)
		return
	}

	req, err := http.NewRequestWithContext(r.Context(), http.MethodGet, raw, nil)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	req.Header.Set("User-Agent", userAgent)
	req.Header.Set("Referer", referer)
	req.Header.Set("Origin", "https://www.bilibili.com")
	if rng := r.Header.Get("Range"); rng != "" {
		req.Header.Set("Range", rng)
	}
	if ir := r.Header.Get("If-Range"); ir != "" {
		req.Header.Set("If-Range", ir)
	}

	res, err := c.client.client().Do(req)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadGateway)
		return
	}
	defer res.Body.Close()

	for _, h := range []string{"Content-Type", "Content-Length", "Content-Range", "Accept-Ranges", "Last-Modified", "ETag"} {
		if v := res.Header.Get(h); v != "" {
			w.Header().Set(h, v)
		}
	}
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Expose-Headers", "Content-Length, Content-Range, Accept-Ranges")
	w.Header().Set("Cache-Control", "no-store")
	w.WriteHeader(res.StatusCode)
	_, _ = io.Copy(w, res.Body)
}

func allowedMediaURL(raw string) bool {
	u, err := url.Parse(raw)
	if err != nil || u.Scheme != "https" && u.Scheme != "http" {
		return false
	}
	host := strings.ToLower(u.Hostname())
	if host == "" {
		return false
	}
	for _, suffix := range []string{"bilivideo.com", "bilivideo.cn", "hdslb.com", "bilibili.com", "szbdyd.com", "akamaized.net", "mcdn.bilivideo.cn"} {
		if host == suffix || strings.HasSuffix(host, "."+suffix) {
			return true
		}
	}
	return false
}

// ---------------------------------------------------------------------------
// System: the desktop calls the page makes
// ---------------------------------------------------------------------------

// System is the service of the desktop itself: the browser, the proxy.
type System struct {
	core *Core
}

// ProxyResult is the outcome of setting the proxy.
type ProxyResult struct {
	Success bool   `json:"success"`
	Error   string `json:"error,omitempty"`
}

// ProxyInfo is the proxy the app uses.
type ProxyInfo struct {
	Rules string `json:"rules"`
}

// ImageURL returns the prefix the page loads a bilibili picture from: the raw
// URL, encoded, goes after it. The page rewrites the pictures it shows with
// it, since the CDN wants bilibili's Referer.
func (s *System) ImageURL() (string, error) {
	base, err := s.core.baseURL()
	if err != nil {
		return "", err
	}
	return base + "/img?u=", nil
}

// StreamURL returns the address the page plays an audio stream from: the
// local server that fetches it from Go, with bilibili's headers, the app's
// cookies and through the app's proxy.
func (s *System) StreamURL(raw string) (string, error) {
	return s.core.streamURL(raw)
}

// OpenExternal opens a URL in the user's browser.
func (s *System) OpenExternal(url string) {
	if strings.TrimSpace(url) == "" {
		return
	}
	if err := mygo.Shell.OpenExternal(url); err != nil {
		log.Printf("blbl: open %s: %v", url, err)
	}
}

// SetProxy makes the app's requests go through a proxy, as the settings ask:
// an empty rules string goes straight to the network again.
func (s *System) SetProxy(rules, username, password string) ProxyResult {
	s.core.init()
	rules = strings.TrimSpace(rules)
	if err := s.core.client.setProxy(rules, username, password); err != nil {
		return ProxyResult{Success: false, Error: err.Error()}
	}
	s.core.saveSettings(appSettings{ProxyRules: rules, ProxyUser: username, ProxyPass: password})
	return ProxyResult{Success: true}
}

// GetProxy returns the proxy the app uses.
func (s *System) GetProxy() ProxyInfo {
	s.core.init()
	return ProxyInfo{Rules: s.core.client.proxyRules()}
}
