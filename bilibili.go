package main

import (
	"context"
	"crypto/md5"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/url"
	"sort"
	"strconv"
	"strings"
	"time"
)

const apiBase = "https://api.bilibili.com"

const mixinKeyEncTab = "46,47,18,2,53,8,23,32,15,50,10,31,58,3,45,35,27,43,5,49,33,9,42,19,29,28,14,39,12,38,41,13,37,48,7,16,24,55,40,61,26,17,0,1,60,51,30,4,22,25,54,21,56,59,6,63,57,62,11,36,20,52,44,34"

// ---------------------------------------------------------------------------
// Types shared with the frontend
// ---------------------------------------------------------------------------

// Owner is the uploader of a video.
type Owner struct {
	Mid  int64  `json:"mid"`
	Name string `json:"name"`
	Face string `json:"face"`
}

// Stat holds a video's counters.
type Stat struct {
	View     int64 `json:"view"`
	Like     int64 `json:"like"`
	Coin     int64 `json:"coin"`
	Favorite int64 `json:"favorite"`
}

// Video is a bilibili video, as the page shows it.
type Video struct {
	Bvid        string `json:"bvid"`
	Aid         int64  `json:"aid"`
	Title       string `json:"title"`
	Description string `json:"description"`
	Pic         string `json:"pic"`
	Duration    int64  `json:"duration"`
	Owner       Owner  `json:"owner"`
	Stat        Stat   `json:"stat"`
	Pubdate     int64  `json:"pubdate"`
	Cid         int64  `json:"cid,omitempty"`
}

// PlayURL is one audio stream of a video.
type PlayURL struct {
	URL     string `json:"url"`
	Quality int64  `json:"quality"`
	Format  string `json:"format"`
}

// FavFolder is a favorites folder of the signed-in user.
type FavFolder struct {
	ID         int64  `json:"id"`
	Mid        int64  `json:"mid"`
	Title      string `json:"title"`
	MediaCount int64  `json:"media_count"`
	Cover      string `json:"cover"`
}

// FavUpper is the uploader of a video in a favorites folder.
type FavUpper struct {
	Mid  int64  `json:"mid"`
	Name string `json:"name"`
	Face string `json:"face"`
}

// FavCntInfo holds the counters of a video in a favorites folder.
type FavCntInfo struct {
	Play    int64 `json:"play"`
	Like    int64 `json:"like"`
	Coin    int64 `json:"coin"`
	Collect int64 `json:"collect"`
}

// FavMedia is a video of a favorites folder.
type FavMedia struct {
	ID       int64      `json:"id"`
	Bvid     string     `json:"bvid"`
	Title    string     `json:"title"`
	Cover    string     `json:"cover"`
	Intro    string     `json:"intro"`
	Duration int64      `json:"duration"`
	Pubtime  int64      `json:"pubtime"`
	Upper    FavUpper   `json:"upper"`
	CntInfo  FavCntInfo `json:"cnt_info"`
}

// CreatedFav is a favorites folder the app created.
type CreatedFav struct {
	ID    int64  `json:"id"`
	Title string `json:"title"`
}

// AddToFavResult says how many videos a folder took.
type AddToFavResult struct {
	Total  int      `json:"total"`
	Failed int      `json:"failed"`
	Errors []string `json:"errors"`
}

// LoginStatus is who is signed in, if anyone.
type LoginStatus struct {
	IsLogin bool   `json:"isLogin"`
	Mid     int64  `json:"mid,omitempty"`
	Uname   string `json:"uname,omitempty"`
	Face    string `json:"face,omitempty"`
}

// LoginResult is the outcome of the login window.
type LoginResult struct {
	Success bool   `json:"success"`
	Message string `json:"message,omitempty"`
}

// CookieInput is a cookie the user pasted into the settings.
type CookieInput struct {
	Name  string `json:"name"`
	Value string `json:"value"`
}

// SetCookiesResult is the outcome of setting cookies by hand.
type SetCookiesResult struct {
	Success bool         `json:"success"`
	Status  *LoginStatus `json:"status,omitempty"`
	Error   string       `json:"error,omitempty"`
}

// LyricWord is a word of a lyric line, with its timing.
type LyricWord struct {
	Word      string `json:"word"`
	StartTime int64  `json:"startTime"`
	EndTime   int64  `json:"endTime"`
}

// LyricLine is a line of lyrics, as AMLL's LyricPlayer shows it.
type LyricLine struct {
	Words           []LyricWord `json:"words"`
	StartTime       int64       `json:"startTime"`
	EndTime         int64       `json:"endTime"`
	TranslatedLyric string      `json:"translatedLyric"`
	RomanLyric      string      `json:"romanLyric"`
	IsBG            bool        `json:"isBG"`
	IsDuet          bool        `json:"isDuet"`
}

// ---------------------------------------------------------------------------
// Bilibili is the service the page calls: the bilibili API of the app.
// ---------------------------------------------------------------------------

// Bilibili calls the bilibili API from Go, so that the page never meets CORS,
// and with the cookies the app keeps.
type Bilibili struct {
	core *Core
}

// Search returns the videos matching a keyword.
func (b *Bilibili) Search(keyword string, page int, pageSize int) ([]Video, error) {
	if page <= 0 {
		page = 1
	}
	if pageSize <= 0 {
		pageSize = 20
	}
	b.core.ensureSession()
	u := fmt.Sprintf("%s/x/web-interface/search/type?keyword=%s&search_type=video&page=%d&page_size=%d",
		apiBase, url.QueryEscape(keyword), page, pageSize)
	data, err := b.core.client.getJSON(context.Background(), u)
	if err != nil {
		return nil, err
	}
	list, _ := data["result"].([]any)
	out := make([]Video, 0, len(list))
	for _, item := range list {
		if m, ok := item.(map[string]any); ok {
			out = append(out, adaptSearchResult(m))
		}
	}
	return out, nil
}

// VideoInfo returns one video, with the cid of its first page.
func (b *Bilibili) VideoInfo(bvid string) (Video, error) {
	u := fmt.Sprintf("%s/x/web-interface/view?bvid=%s", apiBase, url.QueryEscape(bvid))
	data, err := b.core.client.getJSON(context.Background(), u)
	if err != nil {
		return Video{}, err
	}
	return adaptVideoInfo(data, bvid), nil
}

// PlayURL returns the audio streams of a video, best first.
func (b *Bilibili) PlayURL(bvid string, cid int64) ([]PlayURL, error) {
	u := fmt.Sprintf("%s/x/player/playurl?bvid=%s&cid=%d&fnval=16&platform=web",
		apiBase, url.QueryEscape(bvid), cid)
	data, err := b.core.client.getJSON(context.Background(), u)
	if err != nil {
		return nil, err
	}
	out := []PlayURL{}
	if dash, ok := data["dash"].(map[string]any); ok {
		if audios, ok := dash["audio"].([]any); ok {
			for _, a := range audios {
				audio, ok := a.(map[string]any)
				if !ok {
					continue
				}
				raw := firstString(audio, "baseUrl", "base_url", "url")
				if raw == "" {
					if backup, ok := audio["backupUrl"].([]any); ok && len(backup) > 0 {
						raw, _ = backup[0].(string)
					} else if backup, ok := audio["backup_url"].([]any); ok && len(backup) > 0 {
						raw, _ = backup[0].(string)
					}
				}
				if raw != "" {
					out = append(out, PlayURL{URL: raw, Quality: asInt(audio["id"]), Format: firstString(audio, "codecs")})
				}
			}
		}
	}
	if len(out) == 0 {
		if durl, ok := data["durl"].([]any); ok {
			for _, d := range durl {
				item, ok := d.(map[string]any)
				if !ok {
					continue
				}
				raw := firstString(item, "url")
				if raw == "" {
					if backup, ok := item["backup_url"].([]any); ok && len(backup) > 0 {
						raw, _ = backup[0].(string)
					}
				}
				if raw != "" {
					out = append(out, PlayURL{URL: raw, Quality: asInt(item["size"]), Format: "audio/mp4"})
				}
			}
		}
	}
	for i := range out {
		if out[i].Format == "" {
			out[i].Format = "audio/mp4"
		}
	}
	return out, nil
}

// Popular returns the popular videos: the app has none, as before.
func (b *Bilibili) Popular() []Video {
	return []Video{}
}

// LoginStatus says whether the user is signed in.
func (b *Bilibili) LoginStatus() LoginStatus {
	return b.core.loginStatus(context.Background())
}

// OpenLogin shows bilibili's login page in a window, and returns once the
// user is signed in or closes it.
func (b *Bilibili) OpenLogin(ctx context.Context) LoginResult {
	return b.core.openLogin(ctx)
}

// FavFolders returns the favorites folders of a user.
func (b *Bilibili) FavFolders(mid int64) ([]FavFolder, error) {
	u := fmt.Sprintf("%s/x/v3/fav/folder/created/list-all?up_mid=%d", apiBase, mid)
	data, err := b.core.client.getJSON(context.Background(), u)
	if err != nil {
		return nil, err
	}
	list, _ := data["list"].([]any)
	out := make([]FavFolder, 0, len(list))
	for _, item := range list {
		m, ok := item.(map[string]any)
		if !ok {
			continue
		}
		out = append(out, FavFolder{
			ID:         asInt(m["id"]),
			Mid:        asInt(m["mid"]),
			Title:      asString(m["title"]),
			MediaCount: asInt(m["media_count"]),
			Cover:      asString(m["cover"]),
		})
	}
	return out, nil
}

// FavContent returns a page of a favorites folder.
func (b *Bilibili) FavContent(mediaID int64, page int, pageSize int) ([]FavMedia, error) {
	if page <= 0 {
		page = 1
	}
	if pageSize <= 0 {
		pageSize = 20
	}
	u := fmt.Sprintf("%s/x/v3/fav/resource/list?media_id=%d&pn=%d&ps=%d&platform=web", apiBase, mediaID, page, pageSize)
	data, err := b.core.client.getJSON(context.Background(), u)
	if err != nil {
		return nil, err
	}
	medias, _ := data["medias"].([]any)
	out := make([]FavMedia, 0, len(medias))
	for _, item := range medias {
		m, ok := item.(map[string]any)
		if !ok {
			continue
		}
		upper, _ := m["upper"].(map[string]any)
		cnt, _ := m["cnt_info"].(map[string]any)
		out = append(out, FavMedia{
			ID:       asInt(m["id"]),
			Bvid:     asString(m["bvid"]),
			Title:    asString(m["title"]),
			Cover:    asString(m["cover"]),
			Intro:    asString(m["intro"]),
			Duration: asInt(m["duration"]),
			Pubtime:  asInt(m["pubtime"]),
			Upper: FavUpper{
				Mid:  asInt(upper["mid"]),
				Name: asString(upper["name"]),
				Face: asString(upper["face"]),
			},
			CntInfo: FavCntInfo{
				Play:    asInt(cnt["play"]),
				Like:    asInt(cnt["like"]),
				Coin:    asInt(cnt["coin"]),
				Collect: asInt(cnt["collect"]),
			},
		})
	}
	return out, nil
}

// SetCookies signs the user in with cookies they pasted.
func (b *Bilibili) SetCookies(cookies []CookieInput) SetCookiesResult {
	expires := time.Now().Add(365 * 24 * time.Hour).Unix()
	imported := 0
	for _, c := range cookies {
		if c.Name == "" || c.Value == "" {
			continue
		}
		b.core.jar.set(storedCookie{Name: c.Name, Value: c.Value, Domain: "bilibili.com", Path: "/", Expires: expires})
		imported++
	}
	if imported == 0 {
		return SetCookiesResult{Success: false, Error: "没有可用的 Cookie"}
	}
	status := b.core.loginStatus(context.Background())
	return SetCookiesResult{Success: status.IsLogin, Status: &status}
}

// CreateFav creates a favorites folder and returns it.
func (b *Bilibili) CreateFav(title string, intro string, privacy int) (CreatedFav, error) {
	csrf := b.core.jar.value("bilibili.com", "bili_jct")
	if csrf == "" {
		return CreatedFav{}, fmt.Errorf("csrf 校验失败：请先登录并确保 cookie 中包含 bili_jct")
	}
	form := url.Values{}
	form.Set("title", title)
	form.Set("intro", intro)
	form.Set("privacy", strconv.Itoa(privacy))
	form.Set("csrf", csrf)
	body, _, err := b.core.client.request(context.Background(), "POST", apiBase+"/x/v3/fav/folder/add", map[string]string{
		"Content-Type": "application/x-www-form-urlencoded",
		"Referer":      "https://www.bilibili.com",
		"Origin":       "https://www.bilibili.com",
	}, form.Encode())
	if err != nil {
		return CreatedFav{}, err
	}
	var root map[string]any
	if err := json.Unmarshal(body, &root); err != nil {
		return CreatedFav{}, err
	}
	if code := asInt(root["code"]); code != 0 {
		return CreatedFav{}, fmt.Errorf("%s", asString(root["message"]))
	}
	data, _ := root["data"].(map[string]any)
	return CreatedFav{ID: asInt(data["id"]), Title: asString(data["title"])}, nil
}

// AddToFav adds videos to a favorites folder.
func (b *Bilibili) AddToFav(aidList []int64, mediaID int64) (AddToFavResult, error) {
	csrf := b.core.jar.value("bilibili.com", "bili_jct")
	if csrf == "" {
		return AddToFavResult{}, fmt.Errorf("csrf 校验失败：请先登录并确保 cookie 中包含 bili_jct")
	}
	if len(aidList) == 0 {
		return AddToFavResult{Errors: []string{}}, nil
	}
	failures := []string{}
	for _, aid := range aidList {
		form := url.Values{}
		form.Set("rid", strconv.FormatInt(aid, 10))
		form.Set("type", "2")
		form.Set("add_media_ids", strconv.FormatInt(mediaID, 10))
		form.Set("csrf", csrf)
		body, _, err := b.core.client.request(context.Background(), "POST", apiBase+"/x/v3/fav/resource/deal", map[string]string{
			"Content-Type": "application/x-www-form-urlencoded",
			"Referer":      "https://www.bilibili.com",
			"Origin":       "https://www.bilibili.com",
		}, form.Encode())
		if err != nil {
			failures = append(failures, fmt.Sprintf("%d: %s", aid, err.Error()))
			continue
		}
		var root map[string]any
		if err := json.Unmarshal(body, &root); err != nil {
			failures = append(failures, fmt.Sprintf("%d: %s", aid, err.Error()))
			continue
		}
		if code := asInt(root["code"]); code != 0 {
			failures = append(failures, fmt.Sprintf("%d: %s", aid, asString(root["message"])))
		}
	}
	if len(failures) > 0 && len(failures) == len(aidList) {
		shown := failures
		if len(shown) > 3 {
			shown = shown[:3]
		}
		return AddToFavResult{}, fmt.Errorf("全部添加失败: %s", strings.Join(shown, "; "))
	}
	return AddToFavResult{Total: len(aidList), Failed: len(failures), Errors: failures}, nil
}

// Subtitles returns the lyrics of a video: AMLL's database first, bilibili's
// subtitles next, as the app did.
func (b *Bilibili) Subtitles(ctx context.Context, bvid string, cid int64, title string) []LyricLine {
	if title != "" {
		if lines := b.core.searchAMLLDB(ctx, title); len(lines) > 0 {
			return lines
		}
	}
	return b.core.bilibiliSubtitles(ctx, bvid, cid)
}

// ---------------------------------------------------------------------------
// API responses
// ---------------------------------------------------------------------------

func adaptSearchResult(item map[string]any) Video {
	pic := fixURL(asString(item["pic"]))
	owner, _ := item["owner"].(map[string]any)
	face := fixURL(asString(owner["face"]))
	duration := int64(0)
	switch d := item["duration"].(type) {
	case float64:
		duration = int64(d)
	case string:
		parts := strings.Split(d, ":")
		if len(parts) == 2 {
			m, _ := strconv.Atoi(parts[0])
			s, _ := strconv.Atoi(parts[1])
			duration = int64(m*60 + s)
		}
	}
	mid := asInt(owner["mid"])
	if mid == 0 {
		mid = asInt(item["mid"])
	}
	name := asString(owner["name"])
	if name == "" {
		name = asString(item["author"])
	}
	if name == "" {
		name = "Unknown"
	}
	title := asString(item["title"])
	if title == "" {
		title = "无标题"
	}
	stat, _ := item["stat"].(map[string]any)
	view := asInt(stat["view"])
	if view == 0 {
		view = asInt(item["play"])
	}
	pubdate := asInt(item["pubdate"])
	if pubdate == 0 {
		pubdate = asInt(item["senddate"])
	}
	if pubdate == 0 {
		pubdate = time.Now().Unix()
	}
	return Video{
		Bvid:        asString(item["bvid"]),
		Aid:         asInt(item["aid"]),
		Title:       title,
		Description: asString(item["description"]),
		Pic:         pic,
		Duration:    duration,
		Owner:       Owner{Mid: mid, Name: name, Face: face},
		Stat: Stat{
			View:     view,
			Like:     asInt(stat["like"]),
			Coin:     asInt(stat["coin"]),
			Favorite: asInt(stat["favorite"]),
		},
		Pubdate: pubdate,
	}
}

func adaptVideoInfo(data map[string]any, bvid string) Video {
	pic := fixURL(asString(data["pic"]))
	owner, _ := data["owner"].(map[string]any)
	face := fixURL(asString(owner["face"]))
	title := asString(data["title"])
	if title == "" {
		title = "无标题"
	}
	name := asString(owner["name"])
	if name == "" {
		name = "Unknown"
	}
	stat, _ := data["stat"].(map[string]any)
	pubdate := asInt(data["pubdate"])
	if pubdate == 0 {
		pubdate = time.Now().Unix()
	}
	outBvid := asString(data["bvid"])
	if outBvid == "" {
		outBvid = bvid
	}
	duration := int64(0)
	if d, ok := data["duration"].(float64); ok {
		duration = int64(d)
	}
	return Video{
		Bvid:        outBvid,
		Aid:         asInt(data["aid"]),
		Title:       title,
		Description: asString(data["desc"]),
		Pic:         pic,
		Duration:    duration,
		Owner:       Owner{Mid: asInt(owner["mid"]), Name: name, Face: face},
		Stat: Stat{
			View:     asInt(stat["view"]),
			Like:     asInt(stat["like"]),
			Coin:     asInt(stat["coin"]),
			Favorite: asInt(stat["favorite"]),
		},
		Pubdate: pubdate,
		Cid:     asInt(data["cid"]),
	}
}

// ---------------------------------------------------------------------------
// wbi signing
// ---------------------------------------------------------------------------

var mixinKeyTable = func() []int {
	parts := strings.Split(mixinKeyEncTab, ",")
	out := make([]int, 0, len(parts))
	for _, p := range parts {
		n, _ := strconv.Atoi(p)
		out = append(out, n)
	}
	return out
}()

func (c *Core) wbiKey(ctx context.Context) string {
	c.mu.Lock()
	key, at := c.wbiKeyValue, c.wbiKeyTime
	c.mu.Unlock()
	if key != "" && time.Since(at) < time.Hour {
		return key
	}
	data, err := c.client.getJSON(ctx, apiBase+"/x/web-interface/nav")
	if err != nil {
		return key
	}
	wbi, _ := data["wbi_img"].(map[string]any)
	imgKey := fileStem(asString(wbi["img_url"]))
	subKey := fileStem(asString(wbi["sub_url"]))
	raw := imgKey + subKey
	if raw == "" {
		return key
	}
	var sb strings.Builder
	for _, i := range mixinKeyTable {
		if i < len(raw) {
			sb.WriteByte(raw[i])
		}
	}
	key = sb.String()
	c.mu.Lock()
	c.wbiKeyValue = key
	c.wbiKeyTime = time.Now()
	c.mu.Unlock()
	return key
}

func fileStem(rawurl string) string {
	part := rawurl
	if i := strings.LastIndex(part, "/"); i >= 0 {
		part = part[i+1:]
	}
	if i := strings.Index(part, "."); i >= 0 {
		part = part[:i]
	}
	return part
}

// signWBI returns the w_rid and wts of the parameters.
func signWBI(params map[string]string, mixinKey string) (string, string) {
	wts := strconv.FormatInt(time.Now().Unix(), 10)
	all := map[string]string{"wts": wts}
	for k, v := range params {
		all[k] = v
	}
	keys := make([]string, 0, len(all))
	for k := range all {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	var sb strings.Builder
	for i, k := range keys {
		if i > 0 {
			sb.WriteByte('&')
		}
		sb.WriteString(k)
		sb.WriteByte('=')
		sb.WriteString(url.QueryEscape(all[k]))
	}
	sum := md5.Sum([]byte(sb.String() + mixinKey))
	return hex.EncodeToString(sum[:]), wts
}

// bilibiliSubtitles reads the subtitles of a video, as the app did: the WBI
// endpoint first, which returns the video's own subtitles.
func (c *Core) bilibiliSubtitles(ctx context.Context, bvid string, cid int64) []LyricLine {
	viewData, err := c.client.getJSON(ctx, apiBase+"/x/web-interface/view?bvid="+url.QueryEscape(bvid))
	if err != nil {
		return []LyricLine{}
	}
	aid := asInt(viewData["aid"])
	pages, _ := viewData["pages"].([]any)
	targetCid := cid
	if targetCid == 0 && len(pages) > 0 {
		if p, ok := pages[0].(map[string]any); ok {
			targetCid = asInt(p["cid"])
		}
	}
	found := false
	for _, p := range pages {
		if page, ok := p.(map[string]any); ok && asInt(page["cid"]) == targetCid {
			found = true
			break
		}
	}
	if !found || targetCid == 0 {
		return []LyricLine{}
	}

	mixinKey := c.wbiKey(ctx)
	if mixinKey == "" {
		return []LyricLine{}
	}
	var subs []any
	rid, wts := signWBI(map[string]string{"bvid": bvid, "cid": strconv.FormatInt(targetCid, 10)}, mixinKey)
	u := fmt.Sprintf("%s/x/player/wbi/v2?bvid=%s&cid=%d&w_rid=%s&wts=%s",
		apiBase, url.QueryEscape(bvid), targetCid, rid, wts)
	if data, err := c.client.getJSON(ctx, u); err == nil {
		if subtitle, ok := data["subtitle"].(map[string]any); ok {
			subs, _ = subtitle["subtitles"].([]any)
		}
	}
	if len(subs) == 0 {
		rid, wts = signWBI(map[string]string{"aid": strconv.FormatInt(aid, 10), "cid": strconv.FormatInt(targetCid, 10)}, mixinKey)
		u = fmt.Sprintf("%s/x/player/wbi/v2?aid=%d&cid=%d&w_rid=%s&wts=%s", apiBase, aid, targetCid, rid, wts)
		if data, err := c.client.getJSON(ctx, u); err == nil {
			if subtitle, ok := data["subtitle"].(map[string]any); ok {
				subs, _ = subtitle["subtitles"].([]any)
			}
		}
	}
	if len(subs) == 0 {
		return []LyricLine{}
	}

	// Chinese subtitles first, then the others.
	ordered := make([]map[string]any, 0, len(subs))
	rest := make([]map[string]any, 0, len(subs))
	for _, s := range subs {
		m, ok := s.(map[string]any)
		if !ok {
			continue
		}
		if lan := asString(m["lan"]); lan == "zh-Hans" || lan == "zh-CN" {
			ordered = append(ordered, m)
		} else {
			rest = append(rest, m)
		}
	}
	ordered = append(ordered, rest...)

	for _, sub := range ordered {
		raw := fixURL(asString(sub["subtitle_url"]))
		if raw == "" {
			continue
		}
		body, status, err := c.client.get(ctx, raw)
		if err != nil || status != 200 {
			continue
		}
		var doc map[string]any
		if err := json.Unmarshal(body, &doc); err != nil {
			continue
		}
		items, _ := doc["body"].([]any)
		lines := make([]LyricLine, 0, len(items))
		for _, it := range items {
			m, ok := it.(map[string]any)
			if !ok {
				continue
			}
			content := asString(m["content"])
			if strings.TrimSpace(content) == "" {
				continue
			}
			from := int64(asFloat(m["from"]) * 1000)
			to := int64(asFloat(m["to"]) * 1000)
			lines = append(lines, LyricLine{
				Words:     []LyricWord{{Word: content, StartTime: from, EndTime: to}},
				StartTime: from,
				EndTime:   to,
			})
		}
		if len(lines) > 0 {
			return lines
		}
	}
	return []LyricLine{}
}

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

func fixURL(raw string) string {
	if raw == "" {
		return ""
	}
	if !strings.HasPrefix(raw, "http") {
		if strings.HasPrefix(raw, "//") {
			return "https:" + raw
		}
		return raw
	}
	return raw
}

func asString(v any) string {
	switch x := v.(type) {
	case string:
		return x
	case nil:
		return ""
	case float64:
		return strconv.FormatFloat(x, 'f', -1, 64)
	default:
		return fmt.Sprint(x)
	}
}

func asFloat(v any) float64 {
	switch x := v.(type) {
	case float64:
		return x
	case string:
		f, _ := strconv.ParseFloat(x, 64)
		return f
	case int64:
		return float64(x)
	case int:
		return float64(x)
	default:
		return 0
	}
}

func asInt(v any) int64 {
	switch x := v.(type) {
	case float64:
		return int64(x)
	case string:
		n, _ := strconv.ParseInt(x, 10, 64)
		return n
	case int64:
		return x
	case int:
		return int64(x)
	case json.Number:
		n, _ := x.Int64()
		return n
	default:
		return 0
	}
}

func firstString(m map[string]any, keys ...string) string {
	for _, k := range keys {
		if s := asString(m[k]); s != "" {
			return s
		}
	}
	return ""
}
