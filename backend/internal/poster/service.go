package poster

import (
	"context"
	"fmt"
	"io"
	"log"
	"net"
	"net/http"
	"net/url"
	"regexp"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

type Result struct {
	Stream      io.ReadCloser
	ContentType string
}

type Service interface {
	GetPosterStream(ctx context.Context, title string, year int, tmdbPath string, directURL string, dbID int) (*Result, error)
}

type service struct {
	pool   *pgxpool.Pool
	client *http.Client
}

func NewService(pool *pgxpool.Pool) Service {
	dialer := &net.Dialer{
		Timeout:   3 * time.Second,
		KeepAlive: 30 * time.Second,
	}

	transport := &http.Transport{
		DialContext: func(ctx context.Context, network, addr string) (net.Conn, error) {
			host, _, err := net.SplitHostPort(addr)
			if err != nil {
				return nil, err
			}
			ips, err := net.LookupIP(host)
			if err != nil {
				return nil, err
			}
			for _, ip := range ips {
				if ip.IsLoopback() || ip.IsPrivate() || ip.IsLinkLocalUnicast() || ip.IsLinkLocalMulticast() || ip.IsInterfaceLocalMulticast() || ip.IsUnspecified() {
					return nil, fmt.Errorf("SSRF blocked: illegal IP %s", ip.String())
				}
			}
			return dialer.DialContext(ctx, network, addr)
		},
	}

	return &service{
		pool: pool,
		client: &http.Client{
			Timeout:   8 * time.Second,
			Transport: transport,
		},
	}
}

func (s *service) getVQDToken(ctx context.Context, query string) (string, error) {
	escapedQuery := url.QueryEscape(query)
	req, err := http.NewRequestWithContext(ctx, "GET", "https://duckduckgo.com/?q="+escapedQuery, nil)
	if err != nil {
		return "", err
	}
	req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")

	client := &http.Client{Timeout: 5 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	bodyBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", err
	}
	body := string(bodyBytes)

	re1 := regexp.MustCompile(`vqd=([^&'"]+)`)
	re2 := regexp.MustCompile(`vqd\s*:\s*['"]([^'"]+)['"]`)
	re3 := regexp.MustCompile(`vqd\s*=\s*['"]([^'"]+)['"]`)

	if m := re1.FindStringSubmatch(body); len(m) > 1 {
		return m[1], nil
	}
	if m := re2.FindStringSubmatch(body); len(m) > 1 {
		return m[1], nil
	}
	if m := re3.FindStringSubmatch(body); len(m) > 1 {
		return m[1], nil
	}

	return "", fmt.Errorf("VQD token not found in response")
}

func (s *service) searchDDGPosters(ctx context.Context, title string, year int) ([]string, error) {
	query := fmt.Sprintf("%s %d movie poster", title, year)
	if year == 0 {
		query = fmt.Sprintf("%s movie poster", title)
	}

	vqd, err := s.getVQDToken(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("getting vqd token: %w", err)
	}

	escapedQuery := url.QueryEscape(query)
	imgURL := fmt.Sprintf("https://duckduckgo.com/i.js?q=%s&vqd=%s&o=json&s=0", escapedQuery, vqd)
	reqImg, err := http.NewRequestWithContext(ctx, "GET", imgURL, nil)
	if err != nil {
		return nil, err
	}
	reqImg.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
	reqImg.Header.Set("Referer", "https://duckduckgo.com/")

	client := &http.Client{Timeout: 5 * time.Second}
	respImg, err := client.Do(reqImg)
	if err != nil {
		return nil, err
	}
	defer respImg.Body.Close()

	imgBodyBytes, err := io.ReadAll(respImg.Body)
	if err != nil {
		return nil, err
	}
	imgBody := string(imgBodyBytes)

	reImage := regexp.MustCompile(`"image"\s*:\s*"([^"]+)"`)
	matches := reImage.FindAllStringSubmatch(imgBody, -1)
	if len(matches) == 0 {
		return nil, fmt.Errorf("no images found in results")
	}

	var urls []string
	for i, match := range matches {
		if i >= 3 {
			break
		}
		urls = append(urls, match[1])
	}
	return urls, nil
}

func (s *service) streamImage(ctx context.Context, targetURL string) (*Result, error) {
	u, err := url.Parse(targetURL)
	if err != nil {
		return nil, fmt.Errorf("invalid URL: %w", err)
	}
	if u.Scheme != "https" {
		return nil, fmt.Errorf("invalid scheme: only https is allowed")
	}

	req, err := http.NewRequestWithContext(ctx, "GET", targetURL, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")

	resp, err := s.client.Do(req)
	if err != nil {
		return nil, err
	}

	if resp.StatusCode != http.StatusOK {
		resp.Body.Close()
		return nil, fmt.Errorf("status code %d", resp.StatusCode)
	}

	return &Result{
		Stream:      resp.Body,
		ContentType: resp.Header.Get("Content-Type"),
	}, nil
}

func (s *service) GetPosterStream(ctx context.Context, title string, year int, tmdbPath string, directURL string, dbID int) (*Result, error) {
	// 1. Try directURL
	if directURL != "" {
		res, err := s.streamImage(ctx, directURL)
		if err == nil {
			return res, nil
		}
	}

	// 2. Try TMDB path
	if tmdbPath != "" {
		if strings.HasPrefix(tmdbPath, "/") && !strings.Contains(tmdbPath, "..") {
			tmdbURL := "https://image.tmdb.org/t/p/w500" + tmdbPath
			res, err := s.streamImage(ctx, tmdbURL)
			if err == nil {
				return res, nil
			}
		}
	}

	// 3. Fallback to DDG search
	if title != "" {
		log.Printf("🔍 TMDB poster failed or missing for %q. Falling back to DuckDuckGo search...", title)
		imgURLs, err := s.searchDDGPosters(ctx, title, year)
		if err == nil {
			for _, imgURL := range imgURLs {
				log.Printf("   -> Trying poster candidate: %s", imgURL)
				res, err := s.streamImage(ctx, imgURL)
				if err == nil {
					// Cache asynchronously
					if dbID > 0 && s.pool != nil {
						go s.updateCachedPosterURL(dbID, imgURL)
					}
					return res, nil
				}
			}
		} else {
			log.Printf("⚠️ DuckDuckGo image search failed for %q: %v", title, err)
		}
	}

	return nil, fmt.Errorf("movie poster not found")
}

func (s *service) updateCachedPosterURL(id int, newURL string) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	_, dbErr := s.pool.Exec(ctx, "UPDATE movies SET poster_url = $1 WHERE id = $2", newURL, id)
	if dbErr != nil {
		log.Printf("⚠️ Failed to update cached poster_url in database: %v", dbErr)
	} else {
		log.Printf("💾 Successfully updated cached poster_url in DB for movie ID %d", id)
	}
}
