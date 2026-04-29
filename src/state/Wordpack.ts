export type WordpackSide = {
  text: string;
  color?: string;
};

export type WordpackCard = {
  left: WordpackSide;
  right: WordpackSide;
};

export type WordpackInfo = {
  id: string;
  name: string;
};

export const defaultWordpack = "English";

export const fallbackWordpackCards: WordpackCard[] = [
  { left: { text: "Hot" }, right: { text: "Cold" } },
];


export function normalizeWordpack(value?: string | null): string {
  const trimmedValue = (value ?? "").trim();
  if (trimmedValue.length === 0) {
    return defaultWordpack;
  }
  const legacyLanguages: Record<string, string> = {
    en: "English",
    de: "German",
    fr: "French",
    pt: "Portuguese",
    "pt-BR": "Portuguese",
    it: "Italian",
    es: "Spanish",
  };
  return legacyLanguages[trimmedValue] ?? trimmedValue;
}
