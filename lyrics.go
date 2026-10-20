package main

import (
	"context"
	"encoding/json"
	"fmt"
	"net/url"
	"regexp"
	"sort"
	"strconv"
	"strings"
)

// The lyrics of a song come from, in order: AMLL's database (word-timed),
// LRCLIB, NetEase Cloud Music, and last of all the video's own subtitles,
// which are a video's captions rather than its lyrics.

var (
	// lrcStamp matches the "[mm:ss.xx]" of an LRC line.
	lrcStamp  = regexp.MustCompile(`\[(\d{1,3}):(\d{1,2})(?:[.:](\d{1,3}))?\]`)
	htmlTagsL = regexp.MustCompile(`<[^>]*>`)
)

// parseLRC turns an LRC file into lyric lines, one word each, the line ending
// where the next begins.
func parseLRC(text string) []LyricLine {
	text = htmlTagsL.ReplaceAllString(text, "")
	type stamp struct {
		at   int64
		text string
	}
	items := []stamp{}
	for _, raw := range strings.Split(text, "\n") {
		raw = strings.TrimSpace(raw)
		if raw == "" {
			continue
		}
		stamps := lrcStamp.FindAllStringSubmatchIndex(raw, -1)
		if len(stamps) == 0 {
			continue
		}
		body := strings.TrimSpace(raw[stamps[len(stamps)-1][1]:])
		if body == "" {
			continue
		}
		for _, m := range stamps {
			minutes, _ := strconv.Atoi(raw[m[2]:m[3]])
			seconds, _ := strconv.Atoi(raw[m[4]:m[5]])
			millis := 0
			if m[6] >= 0 {
				frac := raw[m[6]:m[7]]
				for len(frac) < 3 {
					frac += "0"
				}
				millis, _ = strconv.Atoi(frac[:3])
			}
			items = append(items, stamp{int64(minutes*60000 + seconds*1000 + millis), body})
		}
	}
	sort.SliceStable(items, func(a, b int) bool { return items[a].at < items[b].at })

	lines := make([]LyricLine, 0, len(items))
	for i, item := range items {
		end := item.at + 4000
		if i+1 < len(items) {
			end = items[i+1].at
		}
		if end <= item.at {
			end = item.at + 1000
		}
		lines = append(lines, LyricLine{
			Words:     []LyricWord{{Word: item.text, StartTime: item.at, EndTime: end}},
			StartTime: item.at,
			EndTime:   end,
		})
	}
	return lines
}

// attachTranslations puts each translated line on the line of its timestamp.
func attachTranslations(lines []LyricLine, translation string) {
	if translation == "" || len(lines) == 0 {
		return
	}
	byTime := map[int64]string{}
	for _, line := range parseLRC(translation) {
		text := ""
		if len(line.Words) > 0 {
			text = line.Words[0].Word
		}
		if text != "" {
			byTime[line.StartTime] = text
		}
	}
	for i := range lines {
		if text, ok := byTime[lines[i].StartTime]; ok {
			lines[i].TranslatedLyric = text
		}
	}
}

// creditLine matches the credits some lyric files open with, which are not
// lyrics: "作词 : Ayase", "Composed by …".
var creditLine = regexp.MustCompile(`(?i)^\s*(作词|作詞|作曲|编曲|編曲|制作人|製作人|混音|母带|录音|錄音|吉他|贝斯|鼓|和声|監製|监制|出品|词|曲|lyrics?|composed|composer|arranged|arranger|producer|mixed|mastered|written|music|guitar|bass|drums)\s*[:：]`)

// dropCredits removes the credits a lyric file may open with.
func dropCredits(lines []LyricLine) []LyricLine {
	kept := lines[:0]
	for i, line := range lines {
		text := ""
		if len(line.Words) > 0 {
			text = line.Words[0].Word
		}
		if i < 12 && creditLine.MatchString(text) {
			continue
		}
		kept = append(kept, line)
	}
	return kept
}

// lrclib reads synced lyrics from lrclib.net, a public database of them.
func (c *Core) lrclib(ctx context.Context, title string, artist string) []LyricLine {
	values := url.Values{}
	values.Set("track_name", title)
	if artist != "" {
		values.Set("artist_name", artist)
	}
	u := "https://lrclib.net/api/search?" + values.Encode()
	body, status, err := c.client.request(ctx, "GET", u, map[string]string{"User-Agent": appUserAgent}, "")
	if err != nil || status != 200 {
		return []LyricLine{}
	}
	var hits []struct {
		TrackName    string `json:"trackName"`
		ArtistName   string `json:"artistName"`
		SyncedLyrics string `json:"syncedLyrics"`
	}
	if err := json.Unmarshal(body, &hits); err != nil {
		return []LyricLine{}
	}
	query := strings.TrimSpace(title + " " + artist)
	best, bestScore := -1, 0
	metas := []TrackMeta{}
	for _, hit := range hits {
		metas = append(metas, TrackMeta{Title: hit.TrackName, Artist: hit.ArtistName})
		score := scoreHit(query, TrackMeta{Title: hit.TrackName, Artist: hit.ArtistName}, 0)
		if hit.SyncedLyrics == "" {
			score = 0
		}
		if score > bestScore {
			best, bestScore = len(metas)-1, score
		}
	}
	if best < 0 {
		return []LyricLine{}
	}
	return dropCredits(parseLRC(hits[best].SyncedLyrics))
}

// netease reads lyrics from NetEase Cloud Music, which has the best coverage
// of Chinese and Japanese songs, with translations.
func (c *Core) netease(ctx context.Context, title string, artist string) []LyricLine {
	headers := map[string]string{
		"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
		"Referer":    "https://music.163.com/",
		"Origin":     "https://music.163.com",
	}
	query := strings.TrimSpace(title + " " + artist)
	searchURL := "https://music.163.com/api/search/get/web?s=" + url.QueryEscape(query) + "&type=1&limit=10"
	body, status, err := c.client.request(ctx, "GET", searchURL, headers, "")
	if err != nil || status != 200 {
		return []LyricLine{}
	}
	var found struct {
		Result struct {
			Songs []struct {
				ID   int64  `json:"id"`
				Name string `json:"name"`
				Ar   []struct {
					Name string `json:"name"`
				} `json:"artists"`
				Al struct {
					Name string `json:"name"`
				} `json:"album"`
			} `json:"songs"`
		} `json:"result"`
	}
	if err := json.Unmarshal(body, &found); err != nil || len(found.Result.Songs) == 0 {
		return []LyricLine{}
	}

	best, bestScore := int64(0), 0
	for i, song := range found.Result.Songs {
		artistName := ""
		if len(song.Ar) > 0 {
			artistName = song.Ar[0].Name
		}
		score := scoreHit(query, TrackMeta{Title: song.Name, Artist: artistName, Album: song.Al.Name}, i)
		if score > bestScore {
			best, bestScore = song.ID, score
		}
	}
	if best == 0 {
		return []LyricLine{}
	}

	lyricURL := fmt.Sprintf("https://music.163.com/api/song/lyric?id=%d&lv=1&kv=1&tv=-1", best)
	body, status, err = c.client.request(ctx, "GET", lyricURL, headers, "")
	if err != nil || status != 200 {
		return []LyricLine{}
	}
	var doc struct {
		LRC struct {
			Lyric string `json:"lyric"`
		} `json:"lrc"`
		Translated struct {
			Lyric string `json:"lyric"`
		} `json:"tlyric"`
	}
	if err := json.Unmarshal(body, &doc); err != nil {
		return []LyricLine{}
	}
	lines := dropCredits(parseLRC(doc.LRC.Lyric))
	attachTranslations(lines, doc.Translated.Lyric)
	return lines
}
