import { useEffect, useState } from "react";
import { fetchWordpacks } from "../../network/roomApi";
import { defaultWordpack, WordpackInfo } from "../../state/Wordpack";

const fallbackWordpacks: WordpackInfo[] = [{ id: defaultWordpack, name: defaultWordpack }];

export function useWordpacks(): WordpackInfo[] {
  const [wordpacks, setWordpacks] = useState<WordpackInfo[]>(fallbackWordpacks);

  useEffect(() => {
    let isDisposed = false;

    void fetchWordpacks()
      .then((loadedWordpacks) => {
        if (!isDisposed && loadedWordpacks.length > 0) {
          setWordpacks(loadedWordpacks);
        }
      })
      .catch((error) => {
        console.error("Failed to load wordpacks", error);
        if (!isDisposed) {
          setWordpacks(fallbackWordpacks);
        }
      });

    return () => {
      isDisposed = true;
    };
  }, []);

  return wordpacks;
}
