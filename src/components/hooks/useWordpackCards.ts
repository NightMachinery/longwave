import { useEffect, useMemo, useState } from "react";
import { fetchWordpackCards } from "../../network/roomApi";
import {
  fallbackWordpackCards,
  WordpackCard,
  defaultWordpack,
  normalizeWordpack,
} from "../../state/Wordpack";

export function useWordpackCards(wordpacks?: string[] | string | null): WordpackCard[] {
  const [cards, setCards] = useState<WordpackCard[]>(fallbackWordpackCards);
  const selectedWordpackKey = Array.isArray(wordpacks)
    ? wordpacks.join("\n")
    : wordpacks ?? "";
  const selectedWordpacks = useMemo(
    () => normalizeSelectedWordpacks(selectedWordpackKey.split("\n")),
    [selectedWordpackKey]
  );

  useEffect(() => {
    let isDisposed = false;

    void Promise.all(selectedWordpacks.map((wordpack) => fetchWordpackCards(wordpack)))
      .then((loadedPacks) => {
        if (!isDisposed) {
          setCards(dedupeCards(loadedPacks.flat()));
        }
      })
      .catch((error) => {
        console.error("Failed to load wordpack", error);
        if (!isDisposed) {
          setCards(fallbackWordpackCards);
        }
      });

    return () => {
      isDisposed = true;
    };
  }, [selectedWordpacks]);

  return cards;
}

function normalizeSelectedWordpacks(wordpacks?: string[] | string | null): string[] {
  const selected = Array.isArray(wordpacks) ? wordpacks : [wordpacks ?? defaultWordpack];
  const normalized = selected
    .map((wordpack) => normalizeWordpack(wordpack))
    .filter((wordpack, index, all) => all.indexOf(wordpack) === index);
  return normalized.length > 0 ? normalized : [defaultWordpack];
}

function dedupeCards(cards: WordpackCard[]): WordpackCard[] {
  const seen = new Set<string>();
  return cards.filter((card) => {
    const key = JSON.stringify({
      left: card.left,
      right: card.right,
    });
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}
