package main

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"time"
)

// ---------------------------------------------------------------------------
// Cookie jar
//
// Electron kept the cookies in the session's cookie store, shared by the page
// and by the requests of the main process. MyGo's pages have their own store
// (mygo.Cookies), so the Go side keeps its own jar here: every request the Go
// side makes sends it, and the login window's cookies are imported into it.
// It is written to cookies.json in the app's user data directory, so a login
// survives a restart.
// ---------------------------------------------------------------------------

type storedCookie struct {
	Name     string `json:"name"`
	Value    string `json:"value"`
	Domain   string `json:"domain"` // without a leading dot
	Path     string `json:"path"`
	Expires  int64  `json:"expires,omitempty"` // unix seconds, 0 for a session cookie
	Secure   bool   `json:"secure,omitempty"`
	HTTPOnly bool   `json:"httpOnly,omitempty"`
	HostOnly bool   `json:"hostOnly,omitempty"`
}

type cookieJar struct {
	mu      sync.Mutex
	file    string
	cookies map[string]*storedCookie
}

func newCookieJar(file string) *cookieJar {
	j := &cookieJar{file: file, cookies: map[string]*storedCookie{}}
	j.load()
	return j
}

func cookieKey(domain, path, name string) string {
	return domain + "\t" + path + "\t" + name
}

func (j *cookieJar) load() {
	data, err := os.ReadFile(j.file)
	if err != nil {
		return
	}
	var list []*storedCookie
	if err := json.Unmarshal(data, &list); err != nil {
		return
	}
	now := time.Now().Unix()
	for _, c := range list {
		if c == nil || c.Name == "" {
			continue
		}
		if c.Expires != 0 && c.Expires < now {
			continue
		}
		if c.Path == "" {
			c.Path = "/"
		}
		j.cookies[cookieKey(c.Domain, c.Path, c.Name)] = c
	}
}

func (j *cookieJar) saveLocked() {
	if j.file == "" {
		return
	}
	list := make([]*storedCookie, 0, len(j.cookies))
	for _, c := range j.cookies {
		list = append(list, c)
	}
	sort.Slice(list, func(a, b int) bool {
		if list[a].Domain != list[b].Domain {
			return list[a].Domain < list[b].Domain
		}
		if list[a].Path != list[b].Path {
			return list[a].Path < list[b].Path
		}
		return list[a].Name < list[b].Name
	})
	data, err := json.Marshal(list)
	if err != nil {
		return
	}
	_ = os.MkdirAll(filepath.Dir(j.file), 0o755)
	_ = os.WriteFile(j.file, data, 0o600)
}

func (j *cookieJar) SetCookies(u *url.URL, cookies []*http.Cookie) {
	host := strings.ToLower(u.Hostname())
	j.mu.Lock()
	defer j.mu.Unlock()
	changed := false
	for _, c := range cookies {
		if c == nil || c.Name == "" {
			continue
		}
		domain := strings.ToLower(strings.TrimPrefix(c.Domain, "."))
		hostOnly := domain == ""
		if hostOnly {
			domain = host
		}
		if !hostOnly && !domainMatch(host, domain) {
			continue
		}
		path := c.Path
		if path == "" {
			path = "/"
		}
		key := cookieKey(domain, path, c.Name)
		expired := c.MaxAge < 0 || (!c.Expires.IsZero() && c.Expires.Before(time.Now()))
		if expired {
			if _, ok := j.cookies[key]; ok {
				delete(j.cookies, key)
				changed = true
			}
			continue
		}
		exp := int64(0)
		switch {
		case !c.Expires.IsZero():
			exp = c.Expires.Unix()
		case c.MaxAge > 0:
			exp = time.Now().Add(time.Duration(c.MaxAge) * time.Second).Unix()
		}
		j.cookies[key] = &storedCookie{
			Name: c.Name, Value: c.Value, Domain: domain, Path: path,
			Expires: exp, Secure: c.Secure, HTTPOnly: c.HttpOnly, HostOnly: hostOnly,
		}
		changed = true
	}
	if changed {
		j.saveLocked()
	}
}

func (j *cookieJar) Cookies(u *url.URL) []*http.Cookie {
	host := strings.ToLower(u.Hostname())
	path := u.EscapedPath()
	if path == "" {
		path = "/"
	}
	now := time.Now().Unix()
	j.mu.Lock()
	defer j.mu.Unlock()
	out := make([]*http.Cookie, 0, len(j.cookies))
	for _, c := range j.cookies {
		if c.Expires != 0 && c.Expires < now {
			continue
		}
		if c.HostOnly {
			if host != c.Domain {
				continue
			}
		} else if !domainMatch(host, c.Domain) {
			continue
		}
		if c.Secure && u.Scheme != "https" {
			continue
		}
		if !pathMatch(path, c.Path) {
			continue
		}
		out = append(out, &http.Cookie{Name: c.Name, Value: c.Value, Path: c.Path, Domain: c.Domain, Secure: c.Secure})
	}
	// RFC 6265: longer paths first.
	sort.SliceStable(out, func(a, b int) bool { return len(out[a].Path) > len(out[b].Path) })
	return out
}

// set stores one cookie, as the login window's cookies are imported.
func (j *cookieJar) set(c storedCookie) {
	if c.Domain == "" || c.Name == "" {
		return
	}
	c.Domain = strings.ToLower(strings.TrimPrefix(c.Domain, "."))
	if c.Path == "" {
		c.Path = "/"
	}
	j.mu.Lock()
	defer j.mu.Unlock()
	j.cookies[cookieKey(c.Domain, c.Path, c.Name)] = &c
	j.saveLocked()
}

// value returns the value of a cookie of the domain, bili_jct for example.
func (j *cookieJar) value(domain, name string) string {
	j.mu.Lock()
	defer j.mu.Unlock()
	for _, c := range j.cookies {
		if c.Name == name && domainMatch(domain, c.Domain) {
			return c.Value
		}
	}
	return ""
}

// clear drops the cookies of bilibili, as signing out does.
func (j *cookieJar) clear() {
	j.mu.Lock()
	defer j.mu.Unlock()
	j.cookies = map[string]*storedCookie{}
	j.saveLocked()
}

func domainMatch(host, domain string) bool {
	domain = strings.ToLower(strings.TrimPrefix(domain, "."))
	host = strings.ToLower(host)
	if domain == "" || host == "" {
		return false
	}
	return host == domain || strings.HasSuffix(host, "."+domain)
}

func pathMatch(reqPath, cookiePath string) bool {
	if cookiePath == "" || cookiePath == "/" {
		return true
	}
	if reqPath == cookiePath {
		return true
	}
	if !strings.HasPrefix(reqPath, cookiePath) {
		return false
	}
	return strings.HasSuffix(cookiePath, "/") || reqPath[len(cookiePath)] == '/'
}

// ---------------------------------------------------------------------------
// HTTP client: proxy, headers, cookies
// ---------------------------------------------------------------------------

const (
	userAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
	referer   = "https://www.bilibili.com/"
)

type biliClient struct {
	mu    sync.Mutex
	jar   *cookieJar
	rules string
	user  string
	pass  string
	hc    *http.Client
}

func newBiliClient(jar *cookieJar) *biliClient {
	return &biliClient{jar: jar}
}

func (c *biliClient) setProxy(rules, user, pass string) error {
	if rules != "" {
		if _, err := proxyURL(rules, user, pass); err != nil {
			return err
		}
	}
	c.mu.Lock()
	c.rules, c.user, c.pass = rules, user, pass
	c.hc = nil // rebuilt with the new proxy
	c.mu.Unlock()
	return nil
}

func (c *biliClient) proxyRules() string {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.rules
}

func (c *biliClient) client() *http.Client {
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.hc != nil {
		return c.hc
	}
	tr := http.DefaultTransport.(*http.Transport).Clone()
	// A list shows twenty covers at once, and they come from a handful of
	// hosts: keep enough connections to fetch them side by side.
	tr.MaxIdleConns = 64
	tr.MaxIdleConnsPerHost = 16
	tr.IdleConnTimeout = 90 * time.Second
	if c.rules != "" {
		if u, err := proxyURL(c.rules, c.user, c.pass); err == nil {
			tr.Proxy = http.ProxyURL(u)
		}
	}
	c.hc = &http.Client{Jar: c.jar, Transport: tr, Timeout: 20 * time.Second}
	return c.hc
}

// proxyURL reads the proxy rules the app's settings hold: a URL such as
// socks5://127.0.0.1:1080, host:port, or the http=/https= form of Electron's
// proxy rules.
func proxyURL(rules, user, pass string) (*url.URL, error) {
	rules = strings.TrimSpace(rules)
	if rules == "" {
		return nil, nil
	}
	if strings.Contains(rules, "=") {
		chosen := ""
		for _, part := range strings.Split(rules, ";") {
			kv := strings.SplitN(strings.TrimSpace(part), "=", 2)
			if len(kv) != 2 {
				continue
			}
			switch kv[0] {
			case "https":
				chosen = kv[1]
			case "http", "socks", "socks5":
				if chosen == "" {
					chosen = kv[1]
				}
			}
		}
		rules = chosen
	}
	if rules == "" {
		return nil, fmt.Errorf("代理规则为空")
	}
	raw := rules
	if !strings.Contains(raw, "://") {
		raw = "http://" + raw
	}
	u, err := url.Parse(raw)
	if err != nil || u.Host == "" {
		return nil, fmt.Errorf("无效的代理地址: %s", rules)
	}
	if user != "" {
		u.User = url.UserPassword(user, pass)
	}
	return u, nil
}

// request makes a request with the headers bilibili expects and returns the
// body and status.
func (c *biliClient) request(ctx context.Context, method, rawurl string, headers map[string]string, body string) ([]byte, int, error) {
	var reader io.Reader
	if body != "" {
		reader = strings.NewReader(body)
	}
	req, err := http.NewRequestWithContext(ctx, method, rawurl, reader)
	if err != nil {
		return nil, 0, err
	}
	req.Header.Set("User-Agent", userAgent)
	req.Header.Set("Referer", referer)
	for k, v := range headers {
		req.Header.Set(k, v)
	}
	res, err := c.client().Do(req)
	if err != nil {
		return nil, 0, err
	}
	defer res.Body.Close()
	data, err := io.ReadAll(res.Body)
	if err != nil {
		return nil, res.StatusCode, err
	}
	return data, res.StatusCode, nil
}

func (c *biliClient) get(ctx context.Context, rawurl string) ([]byte, int, error) {
	return c.request(ctx, http.MethodGet, rawurl, nil, "")
}

// open starts a GET and hands the response back unread, for a body that
// streams to the page as it arrives, a picture or an audio stream.
func (c *biliClient) open(ctx context.Context, rawurl string, headers map[string]string) (*http.Response, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, rawurl, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("User-Agent", userAgent)
	req.Header.Set("Referer", referer)
	for k, v := range headers {
		req.Header.Set(k, v)
	}
	return c.client().Do(req)
}

// getJSON calls the API and returns its data, as fetchBiliAPI did.
func (c *biliClient) getJSON(ctx context.Context, rawurl string) (map[string]any, error) {
	data, status, err := c.get(ctx, rawurl)
	if err != nil {
		return nil, err
	}
	if status != http.StatusOK {
		return nil, fmt.Errorf("HTTP %d", status)
	}
	var root map[string]any
	if err := json.Unmarshal(data, &root); err != nil {
		return nil, err
	}
	if code, _ := root["code"].(float64); code != 0 {
		msg, _ := root["message"].(string)
		if msg == "" {
			msg = fmt.Sprintf("API Error: %v", root["code"])
		}
		return nil, fmt.Errorf("%s", msg)
	}
	d, _ := root["data"].(map[string]any)
	return d, nil
}
