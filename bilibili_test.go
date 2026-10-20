package main

import (
	"context"
	"encoding/json"
	"net/url"
	"os"
	"strings"
	"testing"
	"time"
)

// testCore is a Core with its own directories, without a running app.
func testCore(t *testing.T) *Core {
	t.Helper()
	c := &Core{}
	c.initOnce.Do(func() {}) // init would read the app's directories
	dir := t.TempDir()
	c.configure(dir, dir)
	return c
}

func TestTokenizeTitle(t *testing.T) {
	tokens := tokenizeTitle("【附谱】綾地寧々角色曲「sweet treasure」Quiet Version")
	want := map[string]bool{"sweet treasure": true, "Quiet": true, "Version": true}
	for _, token := range tokens {
		delete(want, token)
	}
	if len(want) != 0 {
		t.Fatalf("tokenizeTitle missed %v, got %v", want, tokens)
	}
	if tokens[0] != "sweet treasure" {
		t.Fatalf("the bracketed song name should come first, got %v", tokens)
	}
}

func TestLevenshtein(t *testing.T) {
	if got := levenshtein("kitten", "sitting"); got != 3 {
		t.Fatalf("levenshtein(kitten, sitting) = %d, want 3", got)
	}
	if got := levenshtein("夜に駆ける", "夜に駆ける"); got != 0 {
		t.Fatalf("levenshtein of equal strings = %d, want 0", got)
	}
}

const sampleTTML = `<?xml version="1.0" encoding="utf-8"?>
<tt xmlns="http://www.w3.org/ns/ttml" xmlns:ttm="http://www.w3.org/ns/ttml#metadata">
  <body><div>
    <p begin="00:00:12.34" end="00:00:15.00"><span begin="00:00:12.34" end="00:00:13.10">夜</span><span begin="00:00:13.10" end="00:00:15.00">に駆ける</span><span ttm:role="x-translation">奔向你</span></p>
    <p begin="00:00:15.00" end="00:00:18.00">夢の中で</p>
  </div></body>
</tt>`

func TestParseTTML(t *testing.T) {
	lines := parseTTML(sampleTTML)
	if len(lines) != 2 {
		t.Fatalf("want 2 lines, got %d", len(lines))
	}
	first := lines[0]
	if len(first.Words) != 2 {
		t.Fatalf("want 2 words, got %v", first.Words)
	}
	if first.Words[0].Word != "夜" || first.Words[0].StartTime != 12340 {
		t.Fatalf("first word is %+v", first.Words[0])
	}
	if first.TranslatedLyric != "奔向你" {
		t.Fatalf("translation is %q", first.TranslatedLyric)
	}
	if first.StartTime != 12340 || first.EndTime != 15000 {
		t.Fatalf("line timing is %d..%d", first.StartTime, first.EndTime)
	}
	if lines[1].Words[0].Word != "夢の中で" {
		t.Fatalf("second line is %+v", lines[1])
	}
}

func TestSignWBI(t *testing.T) {
	rid, wts := signWBI(map[string]string{"bvid": "BV1xx411c7mD", "cid": "12345"}, "mixin")
	if len(rid) != 32 || wts == "" {
		t.Fatalf("signWBI returned %q %q", rid, wts)
	}
	// The same parameters and the same second give the same signature.
	rid2, wts2 := signWBI(map[string]string{"cid": "12345", "bvid": "BV1xx411c7mD"}, "mixin")
	if wts == wts2 && rid != rid2 {
		t.Fatalf("signWBI is not deterministic: %q vs %q", rid, rid2)
	}
}

func TestProxyURL(t *testing.T) {
	cases := map[string]string{
		"127.0.0.1:7890":                           "http://127.0.0.1:7890",
		"socks5://127.0.0.1:1080":                  "socks5://127.0.0.1:1080",
		"http=127.0.0.1:8080;https=127.0.0.1:8443": "http://127.0.0.1:8443",
		"https=127.0.0.1:8443;http=127.0.0.1:8080": "http://127.0.0.1:8443",
		"http=10.0.0.1:3128;socks5=10.0.0.2:1080":  "http://10.0.0.1:3128",
	}
	for rules, want := range cases {
		u, err := proxyURL(rules, "", "")
		if err != nil {
			t.Fatalf("proxyURL(%q): %v", rules, err)
		}
		if u.String() != want {
			t.Fatalf("proxyURL(%q) = %q, want %q", rules, u.String(), want)
		}
	}
	if u, _ := proxyURL("127.0.0.1:7890", "ada", "secret"); u.User == nil || u.User.String() != "ada:secret" {
		t.Fatalf("proxy credentials are %v", u.User)
	}
	if _, err := proxyURL("http://", "", ""); err == nil {
		t.Fatal("proxyURL accepted an address without a host")
	}
}

func TestCookieJarDomainAndPath(t *testing.T) {
	dir := t.TempDir()
	jar := newCookieJar(dir + "/cookies.json")
	jar.set(storedCookie{Name: "SESSDATA", Value: "abc", Domain: "bilibili.com", Path: "/"})
	jar.set(storedCookie{Name: "buvid3", Value: "xyz", Domain: ".bilibili.com", Path: "/"})

	u := mustURL(t, "https://api.bilibili.com/x/web-interface/nav")
	names := map[string]string{}
	for _, c := range jar.Cookies(u) {
		names[c.Name] = c.Value
	}
	if names["SESSDATA"] != "abc" || names["buvid3"] != "xyz" {
		t.Fatalf("cookies for the API are %v", names)
	}
	if jar.value("www.bilibili.com", "SESSDATA") != "abc" {
		t.Fatal("value() did not find the cookie of a subdomain")
	}
	if got := jar.Cookies(mustURL(t, "https://example.com/")); len(got) != 0 {
		t.Fatalf("cookies leaked to another site: %v", got)
	}
	// The jar survives a restart.
	reloaded := newCookieJar(dir + "/cookies.json")
	if reloaded.value("bilibili.com", "SESSDATA") != "abc" {
		t.Fatal("the jar did not keep its cookies on disk")
	}
}

// The tests below call bilibili, so they run only when asked:
//
//	BLBL_LIVE=1 go test -run 'TestLive' -v ./...
func liveOnly(t *testing.T) *Core {
	t.Helper()
	if os.Getenv("BLBL_LIVE") == "" {
		t.Skip("set BLBL_LIVE=1 to call bilibili")
	}
	return testCore(t)
}

func TestLiveSearchAndPlay(t *testing.T) {
	core := liveOnly(t)
	bili := &Bilibili{core: core}

	videos, err := bili.Search("夜に駆ける", 1, 5)
	if err != nil {
		t.Fatalf("Search: %v", err)
	}
	if len(videos) == 0 {
		t.Fatal("Search returned nothing")
	}
	first := videos[0]
	if !strings.HasPrefix(first.Bvid, "BV") || first.Title == "" || first.Owner.Name == "" {
		t.Fatalf("Search returned %+v", first)
	}
	if !strings.HasPrefix(first.Pic, "https://") {
		t.Fatalf("the cover is not an https URL: %q", first.Pic)
	}

	info, err := bili.VideoInfo(first.Bvid)
	if err != nil {
		t.Fatalf("VideoInfo: %v", err)
	}
	if info.Cid == 0 {
		t.Fatalf("VideoInfo has no cid: %+v", info)
	}

	streams, err := bili.PlayURL(first.Bvid, info.Cid)
	if err != nil {
		t.Fatalf("PlayURL: %v", err)
	}
	if len(streams) == 0 || !strings.HasPrefix(streams[0].URL, "http") {
		t.Fatalf("PlayURL returned %+v", streams)
	}
	if !allowedMediaURL(streams[0].URL) {
		t.Fatalf("the stream protocol would refuse %q", streams[0].URL)
	}

	// The stream itself, as the page fetches it.
	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	defer cancel()
	body, status, err := core.client.get(ctx, streams[0].URL)
	if err != nil {
		t.Fatalf("the audio stream: %v", err)
	}
	if status != 200 || len(body) < 10000 {
		t.Fatalf("the audio stream returned %d, %d bytes", status, len(body))
	}
}

func TestLiveLyrics(t *testing.T) {
	core := liveOnly(t)
	bili := &Bilibili{core: core}

	// AMLL's database, which the app reads first.
	lines := bili.Subtitles(context.Background(), "BV1xx411c7mD", 0, "夜に駆ける", "YOASOBI")
	if len(lines) == 0 {
		t.Fatal("Subtitles found no lyrics for a well-known song")
	}
	if lines[0].StartTime < 0 || len(lines[0].Words) == 0 && lines[0].TranslatedLyric == "" {
		t.Fatalf("the first lyric line is %+v", lines[0])
	}
	t.Logf("%d lines, first: %q", len(lines), lines[0].Words[0].Word)
}

func mustURL(t *testing.T, raw string) *url.URL {
	t.Helper()
	u, err := url.Parse(raw)
	if err != nil {
		t.Fatalf("url.Parse(%q): %v", raw, err)
	}
	return u
}

// TestFixture writes the answers of the API to a file, for the visual
// comparison of the page in Chromium, which cannot call Go:
//
//	BLBL_LIVE=1 go test -run TestFixture -v .
func TestFixture(t *testing.T) {
	core := liveOnly(t)
	bili := &Bilibili{core: core}

	videos, err := bili.Search("夜に駆ける", 1, 10)
	if err != nil || len(videos) == 0 {
		t.Fatalf("Search: %v (%d videos)", err, len(videos))
	}
	info, err := bili.VideoInfo(videos[0].Bvid)
	if err != nil {
		t.Fatalf("VideoInfo: %v", err)
	}
	streams, err := bili.PlayURL(videos[0].Bvid, info.Cid)
	if err != nil {
		t.Fatalf("PlayURL: %v", err)
	}
	lyrics := bili.Subtitles(context.Background(), videos[0].Bvid, info.Cid, videos[0].Title, "")
	if len(lyrics) == 0 {
		t.Fatal("Subtitles returned nothing")
	}
	fixture := map[string]any{
		"videos":  videos,
		"info":    info,
		"playurl": []PlayURL{}, // the page's audio needs the app's server
		"lyrics":  lyrics,
		"streams": len(streams),
	}
	data, err := json.Marshal(fixture)
	if err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile("/tmp/blbl-fixture.json", data, 0o644); err != nil {
		t.Fatal(err)
	}
	t.Logf("wrote %d videos, %d lyric lines, %d streams", len(videos), len(lyrics), len(streams))
}

// TestLiveAudioQuality checks that the best audio stream is offered first: the
// API lists the AAC tiers in no order, and 64 kbps often comes first.
func TestLiveAudioQuality(t *testing.T) {
	core := liveOnly(t)
	bili := &Bilibili{core: core}

	videos, err := bili.Search("夜に駆ける", 1, 1)
	if err != nil || len(videos) == 0 {
		t.Fatalf("Search: %v", err)
	}
	info, err := bili.VideoInfo(videos[0].Bvid)
	if err != nil {
		t.Fatalf("VideoInfo: %v", err)
	}
	streams, err := bili.PlayURL(videos[0].Bvid, info.Cid)
	if err != nil || len(streams) == 0 {
		t.Fatalf("PlayURL: %v (%d streams)", err, len(streams))
	}
	for _, s := range streams {
		t.Logf("quality=%d bitrate=%d label=%q format=%q", s.Quality, s.Bitrate, s.Label, s.Format)
	}
	best := streams[0]
	for _, s := range streams[1:] {
		if s.Quality > best.Quality || (s.Quality == best.Quality && s.Bitrate > best.Bitrate) {
			t.Fatalf("the best stream is not first: %+v before %+v", best, s)
		}
	}
	if best.Quality == 1 && best.Bitrate < 190000 {
		t.Fatalf("a low bitrate AAC was offered first: %+v", best)
	}
	if best.Format != "" && !strings.HasPrefix(best.Format, "audio/") {
		t.Fatalf("the format is not a MIME type: %q", best.Format)
	}
}
