package main

import (
	"context"
	"encoding/json"
	"math"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"sync"
	"time"
)

// ---------------------------------------------------------------------------
// AMLL's lyrics database, which the app reads before bilibili's subtitles.
// ---------------------------------------------------------------------------

const (
	amllIndexURL = "https://raw.githubusercontent.com/amll-dev/amll-ttml-db/refs/heads/main/metadata/raw-lyrics-index.jsonl"
	amllRawBase  = "https://raw.githubusercontent.com/amll-dev/amll-ttml-db/refs/heads/main/raw-lyrics"
)

type amllEntry struct {
	MusicName    string   `json:"musicName"`
	Artists      []string `json:"artists"`
	Album        string   `json:"album"`
	RawLyricFile string   `json:"rawLyricFile"`
}

var (
	amllMu    sync.Mutex
	amllIndex []amllEntry
	amllAt    time.Time
)

func (c *Core) loadAMLLIndex(ctx context.Context) []amllEntry {
	amllMu.Lock()
	if amllIndex != nil && time.Since(amllAt) < 24*time.Hour {
		index := amllIndex
		amllMu.Unlock()
		return index
	}
	amllMu.Unlock()

	dir := filepath.Join(c.cacheDir(), "amll-cache")
	cacheFile := filepath.Join(dir, "amll-index.json")

	// The cache holds the parsed index for a day.
	if stat, err := os.Stat(cacheFile); err == nil && time.Since(stat.ModTime()) < 24*time.Hour {
		if data, err := os.ReadFile(cacheFile); err == nil {
			var cached []amllEntry
			if json.Unmarshal(data, &cached) == nil && len(cached) > 0 {
				amllMu.Lock()
				amllIndex, amllAt = cached, time.Now()
				amllMu.Unlock()
				return cached
			}
		}
	}

	raw, status, err := c.amllGet(ctx, amllIndexURL)
	if err != nil || status != 200 {
		amllMu.Lock()
		old := amllIndex
		amllMu.Unlock()
		return old
	}

	entries := make([]amllEntry, 0, 65536)
	for _, line := range strings.Split(string(raw), "\n") {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}
		var obj struct {
			Metadata     [][]any `json:"metadata"`
			RawLyricFile string  `json:"rawLyricFile"`
		}
		if err := json.Unmarshal([]byte(line), &obj); err != nil {
			continue
		}
		var entry amllEntry
		for _, field := range obj.Metadata {
			if len(field) < 2 {
				continue
			}
			key, _ := field[0].(string)
			switch key {
			case "musicName":
				if values, ok := field[1].([]any); ok && len(values) > 0 {
					entry.MusicName, _ = values[0].(string)
				}
			case "artists":
				if values, ok := field[1].([]any); ok {
					for _, v := range values {
						if s, ok := v.(string); ok {
							entry.Artists = append(entry.Artists, s)
						}
					}
				}
			case "album":
				if values, ok := field[1].([]any); ok && len(values) > 0 {
					entry.Album, _ = values[0].(string)
				}
			}
		}
		if entry.MusicName == "" || obj.RawLyricFile == "" {
			continue
		}
		entry.RawLyricFile = obj.RawLyricFile
		entries = append(entries, entry)
	}

	if len(entries) > 0 {
		if err := os.MkdirAll(dir, 0o755); err == nil {
			if data, err := json.Marshal(entries); err == nil {
				_ = os.WriteFile(cacheFile, data, 0o644)
			}
		}
	}

	amllMu.Lock()
	amllIndex, amllAt = entries, time.Now()
	amllMu.Unlock()
	return entries
}

var (
	bracketPatterns = []*regexp.Regexp{
		regexp.MustCompile(`「([^」]+)」`),
		regexp.MustCompile(`『([^』]+)』`),
		regexp.MustCompile(`《([^》]+)》`),
		regexp.MustCompile(`"([^"]+)"`),
		regexp.MustCompile(`'([^']+)'`),
	}
	cleanPatterns = []struct{ re *regexp.Regexp }{
		{regexp.MustCompile(`【[^】]*】`)},
		{regexp.MustCompile(`「[^」]*」`)},
		{regexp.MustCompile(`『[^』]*』`)},
		{regexp.MustCompile(`《[^》]*》`)},
		{regexp.MustCompile(`"[^"]*"`)},
		{regexp.MustCompile(`[|｜]`)},
		{regexp.MustCompile(`[-～~—]`)},
		{regexp.MustCompile(`[/\\]`)},
	}
	wordSplitter = regexp.MustCompile(`[\s,，、]+`)
)

// tokenizeTitle extracts the possible song names from a bilibili video title,
// as the app did: "【附谱】綾地寧々角色曲「sweet treasure」Quiet Version" gives
// "sweet treasure" first.
func tokenizeTitle(title string) []string {
	tokens := []string{}
	seen := map[string]bool{}
	add := func(s string) {
		s = strings.TrimSpace(s)
		if s == "" || seen[s] {
			return
		}
		seen[s] = true
		tokens = append(tokens, s)
	}
	for _, re := range bracketPatterns {
		for _, m := range re.FindAllStringSubmatch(title, -1) {
			if len(m) > 1 {
				add(m[1])
			}
		}
	}
	cleaned := title
	for _, p := range cleanPatterns {
		cleaned = p.re.ReplaceAllString(cleaned, " ")
	}
	for _, w := range wordSplitter.Split(cleaned, -1) {
		add(w)
	}
	return tokens
}

func levenshtein(a, b string) int {
	ra, rb := []rune(strings.ToLower(a)), []rune(strings.ToLower(b))
	m, n := len(ra), len(rb)
	prev := make([]int, n+1)
	cur := make([]int, n+1)
	for j := 0; j <= n; j++ {
		prev[j] = j
	}
	for i := 1; i <= m; i++ {
		cur[0] = i
		for j := 1; j <= n; j++ {
			cost := 1
			if ra[i-1] == rb[j-1] {
				cost = 0
			}
			best := prev[j-1] + cost
			if v := prev[j] + 1; v < best {
				best = v
			}
			if v := cur[j-1] + 1; v < best {
				best = v
			}
			cur[j] = best
		}
		prev, cur = cur, prev
	}
	return prev[n]
}

type amllMatch struct {
	entry amllEntry
	score float64
}

// searchLyrics finds the database entry closest to a video title.
func searchLyrics(index []amllEntry, title string) *amllMatch {
	tokens := tokenizeTitle(title)
	var best *amllMatch

	for i := range index {
		entry := index[i]
		name := strings.ToLower(entry.MusicName)
		for _, token := range tokens {
			lower := strings.ToLower(token)
			if lower == name {
				return &amllMatch{entry: entry, score: 100}
			}
		}
		for _, token := range tokens {
			if len([]rune(token)) < 2 {
				continue
			}
			lower := strings.ToLower(token)
			if strings.Contains(name, lower) && name != "" {
				score := float64(len([]rune(token))) / float64(len([]rune(entry.MusicName))) * 90
				if best == nil || score > best.score {
					best = &amllMatch{entry: entry, score: score}
				}
			}
			nameRunes, tokenRunes := len([]rune(entry.MusicName)), len([]rune(token))
			if nameRunes >= 2 && strings.Contains(lower, name) {
				score := float64(nameRunes) / float64(tokenRunes) * 85
				if best == nil || score > best.score {
					best = &amllMatch{entry: entry, score: score}
				}
			}
		}
		for _, artist := range entry.Artists {
			artist = strings.ToLower(artist)
			for _, token := range tokens {
				if len([]rune(token)) < 2 {
					continue
				}
				if strings.Contains(artist, strings.ToLower(token)) && best != nil && best.score < 70 {
					best.score = math.Min(95, best.score+10)
				}
			}
		}
	}

	if best == nil || best.score < 50 {
		for i := range index {
			entry := index[i]
			nameRunes := len([]rune(entry.MusicName))
			for _, token := range tokens {
				tokenRunes := len([]rune(token))
				if tokenRunes < 3 {
					continue
				}
				maxLen := tokenRunes
				if nameRunes > maxLen {
					maxLen = nameRunes
				}
				diff := tokenRunes - nameRunes
				if diff < 0 {
					diff = -diff
				}
				// A similarity above 0.7 needs the lengths to be close.
				if float64(diff) >= 0.3*float64(maxLen) {
					continue
				}
				dist := levenshtein(token, entry.MusicName)
				similarity := 0.0
				if maxLen > 0 {
					similarity = 1 - float64(dist)/float64(maxLen)
				}
				if similarity > 0.7 {
					score := similarity * 80
					if best == nil || score > best.score {
						best = &amllMatch{entry: entry, score: score}
					}
				}
			}
		}
	}
	return best
}

// parseTime reads the time of a TTML attribute, in seconds.
func parseTime(value string) float64 {
	value = strings.TrimSpace(value)
	if value == "" {
		return 0
	}
	if strings.HasSuffix(value, "ms") {
		f, _ := strconv.ParseFloat(strings.TrimSuffix(value, "ms"), 64)
		return f / 1000
	}
	if strings.HasSuffix(value, "s") {
		f, _ := strconv.ParseFloat(strings.TrimSuffix(value, "s"), 64)
		return f
	}
	parts := strings.Split(value, ":")
	switch len(parts) {
	case 3:
		h, _ := strconv.ParseFloat(parts[0], 64)
		m, _ := strconv.ParseFloat(parts[1], 64)
		s, _ := strconv.ParseFloat(parts[2], 64)
		return h*3600 + m*60 + s
	case 2:
		m, _ := strconv.ParseFloat(parts[0], 64)
		s, _ := strconv.ParseFloat(parts[1], 64)
		return m*60 + s
	}
	f, _ := strconv.ParseFloat(value, 64)
	return f
}

var (
	pTagRE       = regexp.MustCompile(`(?is)<p\s([^>]*?)>(.*?)</p>`)
	beginRE      = regexp.MustCompile(`(?i)begin="([^"]*)"`)
	endRE        = regexp.MustCompile(`(?i)end="([^"]*)"`)
	transRE      = regexp.MustCompile(`(?is)<span[^>]*ttm:role="x-translation"[^>]*>(.*?)</span>`)
	romanRE      = regexp.MustCompile(`(?is)<span[^>]*ttm:role="x-roman"[^>]*>(.*?)</span>`)
	spanRE       = regexp.MustCompile(`(?is)<span\s([^>]*?)>(.*?)</span>`)
	spanOpenRE   = regexp.MustCompile(`(?is)<span[^>]*>`)
	spanCloseRE  = regexp.MustCompile(`(?i)</span>`)
	anyTagRE     = regexp.MustCompile(`(?is)<[^>]*>`)
	transSpanRE  = regexp.MustCompile(`(?is)<span[^>]*ttm:role="x-translation"[^>]*>.*?</span>`)
	romanSpanRE  = regexp.MustCompile(`(?is)<span[^>]*ttm:role="x-roman"[^>]*>.*?</span>`)
	whitespaceRE = regexp.MustCompile(`\s+`)
)

// parseTTML reads AMLL's TTML into lyric lines, with word-level timing.
func parseTTML(ttml string) []LyricLine {
	lines := []LyricLine{}
	for _, p := range pTagRE.FindAllStringSubmatch(ttml, -1) {
		attrs, inner := p[1], p[2]
		begin := beginRE.FindStringSubmatch(attrs)
		end := endRE.FindStringSubmatch(attrs)
		if begin == nil || end == nil {
			continue
		}
		lineFrom := int64(parseTime(begin[1]) * 1000)
		lineTo := int64(parseTime(end[1]) * 1000)

		translated, roman := "", ""
		if m := transRE.FindStringSubmatch(inner); m != nil {
			translated = strings.TrimSpace(stripTags(m[1]))
		}
		if m := romanRE.FindStringSubmatch(inner); m != nil {
			roman = strings.TrimSpace(stripTags(m[1]))
		}

		words := []LyricWord{}
		for _, span := range spanRE.FindAllStringSubmatch(inner, -1) {
			spanAttrs, text := span[1], span[2]
			if strings.Contains(spanAttrs, "x-translation") || strings.Contains(spanAttrs, "x-roman") {
				continue
			}
			text = strings.TrimSpace(stripTags(text))
			if text == "" {
				continue
			}
			wb := beginRE.FindStringSubmatch(spanAttrs)
			we := endRE.FindStringSubmatch(spanAttrs)
			if wb != nil && we != nil {
				words = append(words, LyricWord{
					Word:      text,
					StartTime: int64(parseTime(wb[1]) * 1000),
					EndTime:   int64(parseTime(we[1]) * 1000),
				})
			} else if len(words) > 0 {
				words[len(words)-1].Word += text
			}
		}

		if len(words) == 0 {
			text := inner
			text = transSpanRE.ReplaceAllString(text, "")
			text = romanSpanRE.ReplaceAllString(text, "")
			text = spanOpenRE.ReplaceAllString(text, "")
			text = spanCloseRE.ReplaceAllString(text, "")
			text = strings.TrimSpace(text)
			if text != "" {
				words = append(words, LyricWord{Word: text, StartTime: lineFrom, EndTime: lineTo})
			}
		}

		if len(words) > 0 || translated != "" {
			line := LyricLine{
				Words:           words,
				StartTime:       lineFrom,
				EndTime:         lineTo,
				TranslatedLyric: translated,
				RomanLyric:      roman,
			}
			if len(words) > 0 {
				line.StartTime = words[0].StartTime
				line.EndTime = words[len(words)-1].EndTime
			}
			lines = append(lines, line)
		}
	}
	return lines
}

func stripTags(s string) string {
	return anyTagRE.ReplaceAllString(s, "")
}

// amllUserAgent names the app to AMLL's database, as the app did.
const amllUserAgent = "BLBL-Music-Player/3.0"

func (c *Core) amllGet(ctx context.Context, rawurl string) ([]byte, int, error) {
	return c.client.request(ctx, http.MethodGet, rawurl, map[string]string{"User-Agent": amllUserAgent}, "")
}

// searchAMLLDB finds the title in AMLL's database and returns its lyrics.
func (c *Core) searchAMLLDB(ctx context.Context, title string) []LyricLine {
	index := c.loadAMLLIndex(ctx)
	if len(index) == 0 {
		return []LyricLine{}
	}
	match := searchLyrics(index, title)
	if match == nil {
		return []LyricLine{}
	}
	u := amllRawBase + "/" + match.entry.RawLyricFile
	body, status, err := c.amllGet(ctx, u)
	if err != nil || status != 200 {
		return []LyricLine{}
	}
	return parseTTML(string(body))
}
