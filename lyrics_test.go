package main

import (
	"context"
	"os"
	"testing"
)

const sampleLRC = `[ti:夜に駆ける]
[00:12.34][01:02.10]沈むように溶けてゆくように
[00:15.000]二人だけの空が広がる夜に
[00:18.5]「さよなら」だけだった
`

func TestParseLRC(t *testing.T) {
	lines := parseLRC(sampleLRC)
	if len(lines) != 4 {
		t.Fatalf("want 4 lines (one timestamped twice), got %d", len(lines))
	}
	if lines[0].StartTime != 12340 {
		t.Fatalf("first line starts at %d", lines[0].StartTime)
	}
	if lines[0].Words[0].Word != "沈むように溶けてゆくように" {
		t.Fatalf("first line is %q", lines[0].Words[0].Word)
	}
	if lines[0].EndTime != 15000 {
		t.Fatalf("first line ends at %d", lines[0].EndTime)
	}
	if lines[2].StartTime != 18500 {
		t.Fatalf("a one-digit fraction read as %d", lines[2].StartTime)
	}
	if lines[3].StartTime != 62100 {
		t.Fatalf("the repeated timestamp came at %d", lines[3].StartTime)
	}
}

func TestAttachTranslations(t *testing.T) {
	lines := parseLRC(sampleLRC)
	attachTranslations(lines, "[00:12.34]奔向你\n[00:15.00]只有两人的天空\n")
	if lines[0].TranslatedLyric != "奔向你" {
		t.Fatalf("first translation is %q", lines[0].TranslatedLyric)
	}
	if lines[1].TranslatedLyric != "只有两人的天空" {
		t.Fatalf("second translation is %q", lines[1].TranslatedLyric)
	}
	if lines[2].TranslatedLyric != "" {
		t.Fatalf("a line without translation got %q", lines[2].TranslatedLyric)
	}
}

// TestLiveLyricProviders asks the new fallbacks, which need the network:
//
//	BLBL_LIVE=1 go test -run TestLiveLyricProviders -v .
func TestLiveLyricProviders(t *testing.T) {
	if os.Getenv("BLBL_LIVE") == "" {
		t.Skip("set BLBL_LIVE=1 to call the lyric databases")
	}
	core := testCore(t)

	lrclib := core.lrclib(context.Background(), "夜に駆ける", "YOASOBI")
	if len(lrclib) == 0 {
		t.Fatal("LRCLIB found no lyrics for a well-known song")
	}
	t.Logf("lrclib: %d lines, first %q at %d", len(lrclib), lrclib[0].Words[0].Word, lrclib[0].StartTime)

	netease := core.netease(context.Background(), "夜に駆ける", "YOASOBI")
	if len(netease) == 0 {
		t.Fatal("NetEase found no lyrics for a well-known song")
	}
	translated := 0
	for _, line := range netease {
		if line.TranslatedLyric != "" {
			translated++
		}
	}
	t.Logf("netease: %d lines, %d translated, first %q", len(netease), translated, netease[0].Words[0].Word)
}
