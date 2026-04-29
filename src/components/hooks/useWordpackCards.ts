import { useEffect, useState } from "react";
import { fetchWordpackCards } from "../../network/roomApi";
import { fallbackWordpackCards, WordpackCard, defaultWordpack } from "../../state/Wordpack";

export function useWordpackCards(wordpack?: string | null): WordpackCard[] {
  const [cards, setCards] = useState<WordpackCard[]>(fallbackWordpackCards);

  useEffect(() => {
    let isDisposed = false;
    const selectedWordpack = wordpack || defaultWordpack;

    void fetchWordpackCards(selectedWordpack)
      .then((loadedCards) => {
        if (!isDisposed) {
          setCards(loadedCards);
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
  }, [wordpack]);

  return cards;
}
