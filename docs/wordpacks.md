# Wordpacks

Built-in wordpacks live in `wordpacks/*.jsonl`. Each non-empty line is a JSON object with `left.text` and `right.text` fields, and room moderators can choose any discovered wordpack during setup or from room settings.

The frontend should render labels from the currently selected wordpack response; fallback cards are only a temporary loading/error state and must not be cached across wordpack changes.

## Built-in decks

- `English`: default general-purpose prompt deck.
- `Adult_1`: adult party-game prompt deck with 252 manually authored pairs. It is suggestive and R-rated in tone, but avoids graphic sexual wording, slurs, non-consensual framing, minors, and protected-class stereotypes.
- Localized decks: `French`, `German`, `Italian`, `Persian`, `Portuguese`, and `Spanish` mirror the default deck length for non-English play.

## Validation checklist

When adding or editing a wordpack:

1. Keep the file in JSON Lines format under `wordpacks/`.
2. Ensure every non-empty line has non-empty `left.text` and `right.text` values.
3. Run the server and frontend test suites plus the production build before committing.
