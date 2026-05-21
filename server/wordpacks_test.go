package server

import (
	"os"
	"path/filepath"
	"testing"
)

func TestWordpackCatalogParsesJSONLWithOptionalColors(t *testing.T) {
	t.Parallel()

	dir := t.TempDir()
	path := filepath.Join(dir, "Custom.jsonl")
	contents := `{"left":{"text":"cold","color":"#00f"},"right":{"text":"hot"}}` + "\n"
	if err := os.WriteFile(path, []byte(contents), 0o644); err != nil {
		t.Fatalf("write wordpack: %v", err)
	}

	cards, err := NewWordpackCatalog(dir).Load("Custom")
	if err != nil {
		t.Fatalf("load wordpack: %v", err)
	}
	if len(cards) != 1 || cards[0].Left.Text != "cold" || cards[0].Left.Color != "#00f" || cards[0].Right.Text != "hot" {
		t.Fatalf("unexpected parsed cards: %#v", cards)
	}
}

func TestWordpackCatalogListsEnglishFirstAndPersian(t *testing.T) {
	t.Parallel()

	wordpacks, err := NewWordpackCatalog(defaultWordpackDir).List()
	if err != nil {
		t.Fatalf("list wordpacks: %v", err)
	}
	if len(wordpacks) == 0 || wordpacks[0].ID != defaultWordpack {
		t.Fatalf("expected English to be listed first, got %#v", wordpacks)
	}
	foundPersian := false
	for _, wordpack := range wordpacks {
		if wordpack.ID == "Persian" {
			foundPersian = true
		}
	}
	if !foundPersian {
		t.Fatalf("expected Persian in built-in wordpacks, got %#v", wordpacks)
	}
}

func TestInitialRoomStateNormalizesLegacyDeckLanguageToWordpack(t *testing.T) {
	t.Parallel()

	room := InitialRoomState("de")
	if room.Wordpack != "German" {
		t.Fatalf("expected German wordpack for legacy de deck language, got %q", room.Wordpack)
	}
}

func TestNormalizeRoomStatePreservesExplicitEnglishWordpack(t *testing.T) {
	t.Parallel()

	room := InitialRoomState("de")
	room.Wordpack = "English"
	room.Wordpacks = nil
	normalizeRoomStateShape(&room)
	if room.Wordpack != "English" {
		t.Fatalf("expected explicit English wordpack to be preserved, got %q", room.Wordpack)
	}
}
