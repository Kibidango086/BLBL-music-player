package main

import (
	"context"
	"os"
	"testing"
)

func TestSearchQuery(t *testing.T) {
	cases := map[string]string{
		"[Hi-Res 48kHz/24bit][中字]YOASOBI - 夜に駆ける":  "YOASOBI - 夜に駆ける",
		"【附谱】綾地寧々角色曲「sweet treasure」Quiet Version": "sweet treasure",
		"【ASOUL】向晚：向爹奔去（夜に駆ける）":                    "向晚：向爹奔去",
		"《群青》YOASOBI 完整版":                          "群青",
	}
	for title, want := range cases {
		if got := searchQuery(title); got != want {
			t.Fatalf("searchQuery(%q) = %q, want %q", title, got, want)
		}
	}
}

// TestLookupCover asks the music databases, which needs the network:
//
//	BLBL_LIVE=1 go test -run TestLookupCover -v .
func TestLookupCover(t *testing.T) {
	if os.Getenv("BLBL_LIVE") == "" {
		t.Skip("set BLBL_LIVE=1 to call the music databases")
	}
	core := testCore(t)
	music := &Music{core: core}

	meta := music.Lookup(context.Background(), "[Hi-Res 48kHz/24bit][中字]YOASOBI - 夜に駆ける", "", "")
	if meta.Cover == "" || meta.Source == "" {
		t.Fatalf("no cover for a well-known song: %+v", meta)
	}
	if meta.Title != "夜に駆ける" || meta.Artist != "YOASOBI" {
		t.Fatalf("matched %q by %q", meta.Title, meta.Artist)
	}
	t.Logf("%s — %s (%s) %s", meta.Title, meta.Artist, meta.Source, meta.Cover)

	// A search result's title carries its highlighting markup.
	tagged := music.Lookup(context.Background(), `YOASOBI <em class="keyword">夜に駆ける</em> (Yoru ni Kakeru) Official Music Video`, "", "")
	if tagged.Title != "夜に駆ける" || tagged.Artist != "YOASOBI" {
		t.Fatalf("a title with markup matched %q by %q", tagged.Title, tagged.Artist)
	}

	// A search engine always answers; a hit that shares nothing is no hit.
	if junk := music.Lookup(context.Background(), "zzzz qqqq xxxx", "", ""); junk.Source != "" {
		t.Fatalf("a meaningless title matched %q by %q (%s)", junk.Title, junk.Artist, junk.Source)
	}

	// A name the user typed beats the video's title.
	manual := music.Lookup(context.Background(), "完全无关的标题", "群青 YOASOBI", "")
	if manual.Title == "" {
		t.Fatalf("no match for a name typed in: %+v", manual)
	}
	t.Logf("%s — %s (%s)", manual.Title, manual.Artist, manual.Source)
}
