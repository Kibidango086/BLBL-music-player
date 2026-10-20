package main

import (
	"context"
	"encoding/json"
	"net/url"
	"regexp"
	"strings"
	"unicode"
)

// TrackMeta is what a music database says about a song: its name, its artist,
// its album and its cover. Source names the database it came from, and is
// empty when none matched.
type TrackMeta struct {
	Title  string `json:"title"`
	Artist string `json:"artist"`
	Album  string `json:"album"`
	Cover  string `json:"cover"`
	Source string `json:"source"`
}

// Music looks a song up in music databases, for the cover of the player and
// for a song name better than a video's title.
type Music struct {
	core *Core
}

// Lookup asks Deezer, then iTunes, for the song of a video. The name the user
// gave wins; without one it searches what the title seems to name. A hit only
// counts when it shares a word with what was searched for: a search engine
// always returns something, and a wrong cover is worse than the video's own.
func (m *Music) Lookup(ctx context.Context, title string, song string, artist string) TrackMeta {
	m.core.init()
	query := strings.TrimSpace(song + " " + artist)
	if strings.TrimSpace(song) == "" {
		query = searchQuery(title)
	}
	if query == "" {
		return TrackMeta{}
	}
	if meta, ok := m.deezer(ctx, query); ok {
		return meta
	}
	return m.itunes(ctx, query)
}

// appUserAgent names the app to the databases' operators.
const appUserAgent = "BLBL-Music-Player/3.1 (+https://github.com/Kibidango086/BLBL-music-player)"

func (m *Music) deezer(ctx context.Context, query string) (TrackMeta, bool) {
	u := "https://api.deezer.com/search?q=" + url.QueryEscape(query) + "&limit=5"
	body, status, err := m.core.client.request(ctx, "GET", u, map[string]string{"User-Agent": appUserAgent}, "")
	if err != nil || status != 200 {
		return TrackMeta{}, false
	}
	var root struct {
		Data []struct {
			Title  string `json:"title"`
			Artist struct {
				Name string `json:"name"`
			} `json:"artist"`
			Album struct {
				Title    string `json:"title"`
				CoverXL  string `json:"cover_xl"`
				CoverBig string `json:"cover_big"`
			} `json:"album"`
		} `json:"data"`
	}
	if err := json.Unmarshal(body, &root); err != nil || len(root.Data) == 0 {
		return TrackMeta{}, false
	}
	hits := make([]TrackMeta, 0, len(root.Data))
	for _, hit := range root.Data {
		cover := hit.Album.CoverXL
		if cover == "" {
			cover = hit.Album.CoverBig
		}
		if cover == "" {
			continue
		}
		hits = append(hits, TrackMeta{
			Title:  hit.Title,
			Artist: hit.Artist.Name,
			Album:  hit.Album.Title,
			Cover:  cover,
			Source: "deezer",
		})
	}
	return bestHit(query, hits)
}

func (m *Music) itunes(ctx context.Context, query string) TrackMeta {
	u := "https://itunes.apple.com/search?term=" + url.QueryEscape(query) + "&entity=song&limit=5&country=JP"
	body, status, err := m.core.client.request(ctx, "GET", u, map[string]string{"User-Agent": appUserAgent}, "")
	if err != nil || status != 200 {
		return TrackMeta{}
	}
	var root struct {
		Results []struct {
			TrackName      string `json:"trackName"`
			ArtistName     string `json:"artistName"`
			CollectionName string `json:"collectionName"`
			Artwork        string `json:"artworkUrl100"`
		} `json:"results"`
	}
	if err := json.Unmarshal(body, &root); err != nil || len(root.Results) == 0 {
		return TrackMeta{}
	}
	hits := make([]TrackMeta, 0, len(root.Results))
	for _, hit := range root.Results {
		if hit.Artwork == "" {
			continue
		}
		// The URL names its size: "…/100x100bb.jpg" is the 100px thumbnail,
		// "…/600x600bb.jpg" the cover worth showing.
		hits = append(hits, TrackMeta{
			Title:  hit.TrackName,
			Artist: hit.ArtistName,
			Album:  hit.CollectionName,
			Cover:  strings.ReplaceAll(hit.Artwork, "100x100bb", "600x600bb"),
			Source: "itunes",
		})
	}
	if meta, ok := bestHit(query, hits); ok {
		return meta
	}
	return TrackMeta{}
}

var (
	// A song name quoted in the title: 「夜に駆ける」, 『…』, 《…》, "…".
	quotedName = regexp.MustCompile(`[「『《"]([^」』》"]{1,80})[」』》"]`)
	// The noise of a bilibili title: 【附谱】, [Hi-Res 48kHz/24bit], （完整版）.
	titleNoise = regexp.MustCompile(`(?i)【[^】]*】|\[[^\]]*\]|（[^）]*）|\([^)]*\)`)
	// Search results highlight their words with markup: <em class="keyword">.
	htmlTag    = regexp.MustCompile(`<[^>]*>`)
	titleParts = strings.NewReplacer("|", " ", "｜", " ", "/", " ", "\\", " ", "—", " ", "~", " ")
)

// scoreHit ranks a database hit against the query. A hit that shares no word
// with it scores 0 and is no hit at all, since a search engine always answers;
// a title that is exactly one of the query's words beats a title with that
// word buried in it ("夜に駆ける" over "夜に駆ける … [ガイド無しカラオケ]"), and a
// version the query did not ask for — a live take, a karaoke — loses.
func scoreHit(query string, meta TrackMeta, order int) int {
	title := strings.ToLower(strings.TrimSpace(meta.Title))
	artist := strings.ToLower(meta.Artist)
	album := strings.ToLower(meta.Album)
	asked := strings.ToLower(strings.TrimSpace(query))

	// The database's own order breaks ties.
	score := 20 - order
	if title == asked {
		score += 200
	}
	for _, word := range queryWords(asked) {
		switch {
		case title == word:
			score += 80
		case strings.Contains(title, word):
			score += 20
		}
		if strings.Contains(artist, word) {
			score += 8
		}
		if strings.Contains(album, word) {
			score += 4
		}
	}
	for _, version := range []string{
		"first take", "live", "remix", "cover", "instrumental", "acoustic", "karaoke", "off vocal", "inst.",
		"カラオケ", "ガイド", "原曲", "歌ってみた", "弾いてみた", "インスト", "カバー", "ライブ",
	} {
		if strings.Contains(title, version) && !strings.Contains(asked, version) {
			score -= 40
		}
	}
	return score
}

func queryWords(query string) []string {
	words := []string{}
	for _, word := range strings.FieldsFunc(query, func(r rune) bool {
		return !unicode.IsLetter(r) && !unicode.IsDigit(r)
	}) {
		if len([]rune(word)) >= 2 {
			words = append(words, word)
		}
	}
	return words
}

// bestHit is the highest scoring hit of a search, or none when nothing shares
// a word with the query.
func bestHit(query string, hits []TrackMeta) (TrackMeta, bool) {
	best := TrackMeta{}
	bestScore := 0
	for i, hit := range hits {
		if score := scoreHit(query, hit, i); score > bestScore {
			best, bestScore = hit, score
		}
	}
	return best, bestScore > 0
}

// searchQuery guesses the song a video title names: the longest quoted name,
// or the title without its brackets, which are usually quality and format.
func searchQuery(title string) string {
	title = htmlTag.ReplaceAllString(title, "")
	if matches := quotedName.FindAllStringSubmatch(title, -1); len(matches) > 0 {
		best := ""
		for _, m := range matches {
			if len([]rune(m[1])) > len([]rune(best)) {
				best = strings.TrimSpace(m[1])
			}
		}
		if best != "" {
			return best
		}
	}
	cleaned := titleNoise.ReplaceAllString(title, " ")
	cleaned = titleParts.Replace(cleaned)
	cleaned = strings.Join(strings.Fields(cleaned), " ")
	if cleaned == "" {
		return strings.TrimSpace(title)
	}
	return cleaned
}
