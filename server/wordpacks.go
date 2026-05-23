package server

import (
	"bufio"
	"encoding/json"
	"fmt"
	"hash/fnv"
	"math/rand"
	"os"
	"path/filepath"
	"sort"
	"strings"
)

const defaultWordpack = "English"

type WordpackSide struct {
	Text  string `json:"text"`
	Color string `json:"color,omitempty"`
}

type WordpackCard struct {
	Left  WordpackSide `json:"left"`
	Right WordpackSide `json:"right"`
}

type WordpackInfo struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}

type WordpackCatalog struct {
	dir string
}

func NewWordpackCatalog(dir string) *WordpackCatalog {
	if strings.TrimSpace(dir) == "" {
		dir = "wordpacks"
	}
	if _, err := os.Stat(dir); err != nil && dir == "wordpacks" {
		if _, parentErr := os.Stat(filepath.Join("..", dir)); parentErr == nil {
			dir = filepath.Join("..", dir)
		}
	}
	return &WordpackCatalog{dir: dir}
}

func (catalog *WordpackCatalog) List() ([]WordpackInfo, error) {
	entries, err := os.ReadDir(catalog.dir)
	if err != nil {
		return nil, fmt.Errorf("read wordpacks: %w", err)
	}
	wordpacks := []WordpackInfo{}
	for _, entry := range entries {
		if entry.IsDir() || filepath.Ext(entry.Name()) != ".jsonl" {
			continue
		}
		id := strings.TrimSuffix(entry.Name(), filepath.Ext(entry.Name()))
		if id == "" {
			continue
		}
		wordpacks = append(wordpacks, WordpackInfo{ID: id, Name: id})
	}
	sort.Slice(wordpacks, func(i, j int) bool {
		if wordpacks[i].ID == defaultWordpack {
			return true
		}
		if wordpacks[j].ID == defaultWordpack {
			return false
		}
		return wordpacks[i].Name < wordpacks[j].Name
	})
	return wordpacks, nil
}

func (catalog *WordpackCatalog) Exists(id string) bool {
	_, err := os.Stat(catalog.wordpackPath(id))
	return err == nil
}

func (catalog *WordpackCatalog) Load(id string) ([]WordpackCard, error) {
	id = normalizeWordpack(id)
	file, err := os.Open(catalog.wordpackPath(id))
	if err != nil {
		return nil, fmt.Errorf("open wordpack %q: %w", id, err)
	}
	defer file.Close()

	cards := []WordpackCard{}
	scanner := bufio.NewScanner(file)
	lineNumber := 0
	for scanner.Scan() {
		lineNumber++
		line := strings.TrimSpace(scanner.Text())
		if line == "" {
			continue
		}
		var card WordpackCard
		if err := json.Unmarshal([]byte(line), &card); err != nil {
			return nil, fmt.Errorf("parse %s line %d: %w", id, lineNumber, err)
		}
		card.Left.Text = strings.TrimSpace(card.Left.Text)
		card.Right.Text = strings.TrimSpace(card.Right.Text)
		card.Left.Color = strings.TrimSpace(card.Left.Color)
		card.Right.Color = strings.TrimSpace(card.Right.Color)
		if card.Left.Text == "" || card.Right.Text == "" {
			return nil, fmt.Errorf("parse %s line %d: left and right text are required", id, lineNumber)
		}
		cards = append(cards, card)
	}
	if err := scanner.Err(); err != nil {
		return nil, fmt.Errorf("read wordpack %q: %w", id, err)
	}
	if len(cards) == 0 {
		return nil, fmt.Errorf("wordpack %q has no cards", id)
	}
	return cards, nil
}

func (catalog *WordpackCatalog) wordpackPath(id string) string {
	return filepath.Join(catalog.dir, filepath.Base(normalizeWordpack(id))+".jsonl")
}

func normalizeWordpack(id string) string {
	id = strings.TrimSpace(id)
	if id == "" {
		return defaultWordpack
	}
	legacy := map[string]string{
		"en":    "English",
		"de":    "German",
		"fr":    "French",
		"pt":    "Portuguese",
		"pt-BR": "Portuguese",
		"it":    "Italian",
		"es":    "Spanish",
	}
	if mapped, ok := legacy[id]; ok {
		return mapped
	}
	return id
}

func normalizeWordpackList(ids []string, fallback string) []string {
	normalized := []string{}
	seen := map[string]struct{}{}
	for _, id := range ids {
		wordpack := normalizeWordpack(id)
		if wordpack == "" {
			continue
		}
		if _, ok := seen[wordpack]; ok {
			continue
		}
		seen[wordpack] = struct{}{}
		normalized = append(normalized, wordpack)
	}
	if len(normalized) == 0 {
		normalized = append(normalized, normalizeWordpack(fallback))
	}
	return normalized
}

func (catalog *WordpackCatalog) DrawCard(seed string, deckIndex int, wordpacks []string, fallback string) (*WordpackCard, error) {
	selectedWordpacks := normalizeWordpackList(wordpacks, fallback)
	cards := []WordpackCard{}
	seen := map[string]struct{}{}
	for _, wordpack := range selectedWordpacks {
		loadedCards, err := catalog.Load(wordpack)
		if err != nil {
			return nil, err
		}
		for _, card := range loadedCards {
			keyBytes, _ := json.Marshal(card)
			key := string(keyBytes)
			if _, ok := seen[key]; ok {
				continue
			}
			seen[key] = struct{}{}
			cards = append(cards, card)
		}
	}
	if len(cards) == 0 {
		return nil, fmt.Errorf("no prompt cards available")
	}
	shuffled := append([]WordpackCard(nil), cards...)
	rng := rand.New(rand.NewSource(promptSeed(seed)))
	rng.Shuffle(len(shuffled), func(i, j int) {
		shuffled[i], shuffled[j] = shuffled[j], shuffled[i]
	})
	if deckIndex < 0 {
		deckIndex = 0
	}
	card := shuffled[deckIndex%len(shuffled)]
	return &card, nil
}

func promptSeed(seed string) int64 {
	hasher := fnv.New64a()
	_, _ = hasher.Write([]byte(seed))
	return int64(hasher.Sum64())
}
