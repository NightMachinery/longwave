# Longwave
Real-time online adaptation of the Wavelength party game

## Purpose

The game is an online adaptation of the social game Wavelength, which can be played via telephone or video conference. In times of remote work, home office work and social distancing in the wake of the Corona pandemic, this adaptation supports virtual teaming and shared enjoyment.

In the game, one player describes the other players with a hint, on a scale between which a mark is placed. The aim is to relate the value system of the tipster to one's own value system. The other players discuss how the tipster might understand the clue and where his clues might lie on this scale.

## How is the game played?

In the game, two teams take turns playing against each other. One team member is shown two opposing terms. A point is marked on a scale between these two terms. This point is now to be described to the other team members as precisely as possible with a word, a term or a short sentence.

Their own team does not know this position and now tries to hit the point as accurately as possible. The closer the team has placed the marker to the point, the more points it wins. Up to four points are possible here.

After the team's guess attempt, the other team also has the opportunity to score a point by guessing whether the marker is to the left or right of the other team's guess. If the team is correct, they receive one point.

The first team to score 10 points wins.

For a mode-by-mode explanation of Standard (Teams), Cooperative, Free Play, and Individual, see `docs/modes/README.md`.

For the new moderator / representative / observer / psychic behavior and the secure migration flow, see `docs/roles.md`.

## Translations and wordpacks

Longwave has two separate language concepts:

- **UI translations** live in `public/locales/<language>/translation.json` and control buttons, labels, and help text.
- **Wordpacks** live in `wordpacks/*.jsonl` and control the spectrum prompts used by a room. The room creator/moderator can choose one or more wordpacks during room setup; prompts are drawn from the selected union and default to `English` regardless of UI language.

To add a new UI translation, follow these steps:

1. Determine the ISO language code for your target language. See https://www.andiamo.co.uk/resources/iso-language-codes/
2. Add the new language code to `src/i18n.tsx` in the "allLanguages" array
3. Copy the contents of `public/locales/en/translation.json` into a new folder `public/locales/XX` for your language code
4. Translate `translation.json` into the target language
5. Test the adapted language by starting the local server, selecting the new language and testing the correct display.

To add a new built-in wordpack, create `wordpacks/Name.jsonl`. Each non-empty line is one prompt pair:

```json
{"left":{"text":"cold"},"right":{"text":"hot"}}
```

Each side may also include an optional `color` field, for example `{"text":"cold","color":"#3b82f6"}`.

See [`docs/wordpacks.md`](docs/wordpacks.md) for the current built-in deck list and validation checklist.

If everything is correct, make the updated files available to the upstream as PR.

### Structure of the translation.json
The file is in JSON format. The entries are stored in two hierarchies.

The first hierarchy indicates the file in which the translation is implemented. This information may not be relevant for the user, but it helps to locate the position of the translation more easily in later developments.

The second hierarchy describes the text to be translated. The keys stored here are to be translated into the respective language. Placeholders are possible here, which can be specified with `{{ ... }}` and can be placed anywhere in the entry to be translated, depending on the language.

Sample:

```json
{
    "commonfooter": {
        "open_source": "Longwave is open source on"
    },
    "landingpage": {
    ...
```

Meaning:

`commonfooter`: filename of affected file

`developedby`: string to be translated

...

#### Notes to adding or replacing language strings

You can easily find the positions where the replacements take place via the first and second hierarchy. To do this, open the respective file (example: `commonfooter`) and search for `commonfooter.developed_by`. You can then easily find the context of the replacement.

## Installation

You can simply run the project on your computer. The following steps are necessary:

1. Clone or fork the repository
2. Install node.js, pnpm, and Go
3. Change to the project directory
4. Run the command `pnpm install` to install dependent and maybe missing packages
5. In one shell, start the local Go room-sync backend via `pnpm start:backend`
6. In another shell, launch the frontend dev server via `pnpm start`
7. Open `http://localhost:3000`

The frontend dev server proxies `/api` and `/healthz` to the local backend on `127.0.0.1:3310`.

## Self-hosting

For the supported intranet/self-host deployment flow, see:

```text
docs/self-hosting.md
```

That flow replaces the old Firebase runtime dependency with a local Go + SQLite backend and is the recommended deployment path for this repo.

## Room identity and sharing

- Each browser stores a local user auth token and saved display name. The server associates that token with the in-room player so refreshes do not create duplicate users when cookies are lost.
- The first player to join a room becomes the creator and an initial moderator.
- **Copy room link** shares the clean room URL only.
- Clicking the visible room ID copies the same clean invite link.
- **Migrate device** copies a durable room-specific `?migrate=...` link so another device can use the same in-room identity without exposing the user auth token.
- **Play Again** restarts the game in the same room while preserving the creator, player list, and room settings.
- In team mode, moderators can use default-on balanced random team assignment, new joiners are placed on the smaller team, and moderators can still adjust non-psychic players manually.
- In individual mode, each active non-clue-giver submits a private guess, guessers score normally, and moderators can configure how many times everyone must be clue-giver before final scoring.
- Current psychics can reroll prompts before clues are submitted up to the moderator-configured per-round limit; moderators can reroll without using that limit. Each round stores the full prompt pair object that was drawn, so later wordpack changes do not rewrite current or previous prompts.
- **Reset Room ID** rotates the room code so the previous join link no longer accepts new joins.
- Hidden round information is filtered by the backend so only current psychics see the target during clueing.
- Player names are remembered locally per browser and **Change Name** updates the live in-room identity.

### Available Scripts

In the project directory, you can run:

#### `pnpm install`

Installs the frontend dependencies from the committed `pnpm-lock.yaml`.

#### `pnpm start`

Runs the Vite frontend dev server in development mode.<br />
Open [http://localhost:3000](http://localhost:3000) to view it in the browser.

The page will reload if you make edits.

This development server expects the local backend from `pnpm start:backend` to be running.

#### `pnpm start:backend`

Runs the local Go + SQLite room-sync backend for development on `127.0.0.1:3310`.

For the supported intranet/deployed multiplayer runtime, use the self-host flow in `docs/self-hosting.md`.

#### `pnpm test`

Runs the frontend unit and component tests once with Vitest.

Use `pnpm test:watch` for the interactive watch mode.

#### `pnpm build`

Builds the app for production to the `build` folder.<br />
It typechecks the frontend with TypeScript and bundles React with Vite.

The build is minified, the filenames include hashes, and production source maps are disabled.<br />
Your app is ready to be deployed!

#### Learn More

You can learn more in the [Vite documentation](https://vite.dev/guide/).

To learn React, check out the [React documentation](https://reactjs.org/).
