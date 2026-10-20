package main

import (
	"context"
	"net/http/httptest"
	"net/url"
	"os"
	"testing"
)

// TestStreamCORS checks the headers of an audio stream, which Web Audio needs
// to read the samples of the cross-origin audio (the surround effect):
//
//	BLBL_LIVE=1 go test -run TestStreamCORS -v .
func TestStreamCORS(t *testing.T) {
	if os.Getenv("BLBL_LIVE") == "" {
		t.Skip("set BLBL_LIVE=1 to call bilibili")
	}
	core := testCore(t)
	bili := &Bilibili{core: core}
	videos, err := bili.Search("夜に駆ける", 1, 2)
	if err != nil || len(videos) == 0 {
		t.Fatalf("Search: %v", err)
	}
	info, err := bili.VideoInfo(videos[0].Bvid)
	if err != nil {
		t.Fatalf("VideoInfo: %v", err)
	}
	streams, err := bili.PlayURL(videos[0].Bvid, info.Cid)
	if err != nil || len(streams) == 0 {
		t.Fatalf("PlayURL: %v", err)
	}

	base, err := core.baseURL()
	if err != nil {
		t.Fatalf("baseURL: %v", err)
	}
	playURL := base + "/stream?u=" + url.QueryEscape(streams[0].URL)

	req := httptest.NewRequestWithContext(context.Background(), "GET", playURL, nil)
	req.Header.Set("Range", "bytes=0-2047")
	req.Header.Set("Origin", "mygo://localhost")
	rec := httptest.NewRecorder()
	core.serveStream(rec, req)

	res := rec.Result()
	t.Logf("status=%d headers=%v", res.StatusCode, res.Header)
	if res.StatusCode != 206 && res.StatusCode != 200 {
		t.Fatalf("status %d", res.StatusCode)
	}
	if got := res.Header.Get("Access-Control-Allow-Origin"); got != "*" {
		t.Fatalf("Access-Control-Allow-Origin = %q, want *", got)
	}
	if got := res.Header.Get("Content-Range"); got == "" {
		t.Fatalf("no Content-Range on a ranged request")
	}
}
