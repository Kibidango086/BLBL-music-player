package main

import (
	"crypto/sha1"
	"encoding/hex"
	"io"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"time"
)

// Covers, avatars and the other pictures of bilibili come from its CDN, which
// answers 403 to a request whose Referer is not bilibili's: the Electron app
// sent one for every request the app made (onBeforeSendHeaders), and this is
// the port of that, for pictures only. The page loads them from the server
// that serves the audio too, which fetches them from Go with bilibili's
// headers, through the app's proxy, and keeps them in the cache directory.
//
// It is HTTP over the loopback interface rather than a custom scheme because
// WebKitGTK loads pictures of a custom scheme only in CORS mode, which a
// background image cannot ask for (see core.go for the audio's reason).

// imageHosts are the hosts a picture is fetched from.
var imageHosts = []string{"hdslb.com", "biliimg.com", "bilibili.com", "bilivideo.com"}

func allowedImageURL(raw string) bool {
	u, err := url.Parse(raw)
	if err != nil || (u.Scheme != "https" && u.Scheme != "http") {
		return false
	}
	return hostIn(u.Hostname(), imageHosts)
}

func hostIn(host string, suffixes []string) bool {
	host = strings.ToLower(host)
	if host == "" {
		return false
	}
	for _, suffix := range suffixes {
		if host == suffix || strings.HasSuffix(host, "."+suffix) {
			return true
		}
	}
	return false
}

// stripPicParams cuts bilibili's sizing parameters, as the page's
// getHighResPic did: ".../x.jpg@320w_200h" is ".../x.jpg".
func stripPicParams(raw string) string {
	if i := strings.IndexByte(raw, '@'); i >= 0 {
		return raw[:i]
	}
	return raw
}

const imageMaxAge = 14 * 24 * time.Hour

func (c *Core) serveImage(w http.ResponseWriter, r *http.Request) {
	raw := r.URL.Query().Get("u")
	if raw == "" || !allowedImageURL(raw) {
		http.Error(w, "not a bilibili picture", http.StatusForbidden)
		return
	}

	sum := sha1.Sum([]byte(raw))
	dir := filepath.Join(c.cacheDir(), "images")
	file := filepath.Join(dir, hex.EncodeToString(sum[:]))

	w.Header().Set("Cache-Control", "public, max-age=1209600, immutable")
	w.Header().Set("Access-Control-Allow-Origin", "*")

	// A picture of the last two weeks is served from the cache, and its
	// bytes go to the page as the file reads.
	if stat, err := os.Stat(file); err == nil && time.Since(stat.ModTime()) < imageMaxAge {
		f, err := os.Open(file)
		if err == nil {
			defer f.Close()
			w.Header().Set("Content-Type", contentTypeFor(raw))
			http.ServeContent(w, r, "", stat.ModTime(), f)
			return
		}
	}

	// Otherwise it streams from bilibili as it arrives, into the cache and
	// the page at once, so a large cover does not wait for its last byte.
	res, err := c.client.open(r.Context(), raw, nil)
	if err != nil {
		http.Error(w, "the picture could not be fetched", http.StatusBadGateway)
		return
	}
	defer res.Body.Close()
	if res.StatusCode != http.StatusOK {
		http.Error(w, "the picture could not be fetched", http.StatusBadGateway)
		return
	}
	if ct := res.Header.Get("Content-Type"); ct != "" {
		w.Header().Set("Content-Type", ct)
	} else {
		w.Header().Set("Content-Type", contentTypeFor(raw))
	}
	if n := res.Header.Get("Content-Length"); n != "" {
		w.Header().Set("Content-Length", n)
	}
	w.WriteHeader(http.StatusOK)

	if err := os.MkdirAll(dir, 0o755); err != nil {
		_, _ = io.Copy(w, res.Body)
		return
	}
	tmp, err := os.CreateTemp(dir, "img-*")
	if err != nil {
		_, _ = io.Copy(w, res.Body)
		return
	}
	_, _ = io.Copy(io.MultiWriter(w, tmp), res.Body)
	tmp.Close()
	_ = os.Rename(tmp.Name(), file)
}

func contentTypeFor(raw string) string {
	lower := strings.ToLower(stripPicParams(raw))
	switch {
	case strings.HasSuffix(lower, ".png"):
		return "image/png"
	case strings.HasSuffix(lower, ".webp"):
		return "image/webp"
	case strings.HasSuffix(lower, ".gif"):
		return "image/gif"
	case strings.HasSuffix(lower, ".avif"):
		return "image/avif"
	}
	return "image/jpeg"
}
