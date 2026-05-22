import { GameState, GameType, InitialGameState, Team } from "../state/GameState";
import { normalizeWordpack, WordpackCard, WordpackInfo } from "../state/Wordpack";

export type RoomAction =
  | { type: "set_name"; name: string }
  | { type: "set_game_type"; gameType: GameType }
  | { type: "set_wordpack"; wordpack: string }
  | { type: "set_wordpacks"; wordpacks: string[] }
  | { type: "join_team"; team: Team }
  | { type: "set_team"; playerId: string; team: Team }
  | { type: "start_round" }
  | { type: "set_psychic_count"; psychicCount: number }
  | { type: "set_clue_quota"; clueQuota: number }
  | { type: "set_psychic_reroll_limit"; psychicRerollLimit: number }
  | { type: "set_individual_clue_giver_target"; individualClueGiverTarget: number }
  | { type: "set_individual_live_guesses"; individualClueGiverCanSeeLiveGuesses: boolean }
  | { type: "set_randomize_teams"; value: boolean }
  | { type: "randomize_teams" }
  | { type: "submit_clue"; clue: string }
  | { type: "set_guess"; guess: number }
  | { type: "submit_guess" }
  | { type: "submit_individual_guess"; guess: number }
  | { type: "set_individual_draft_guess"; guess: number }
  | { type: "submit_counterguess"; counterGuess: "left" | "right" | "exact" }
  | { type: "set_moderator"; playerId: string; value: boolean }
  | { type: "set_representative"; playerId: string; value: boolean }
  | { type: "set_observer"; playerId: string; value: boolean }
  | { type: "reset_room" }
  | { type: "play_again" }
  | { type: "reroll_round" }
  | { type: "reroll_target" }
  | { type: "reset_room_id" };

export class RoomApiError extends Error {
  status: number;
  payload: Record<string, unknown> | null;

  constructor(message: string, status: number, payload: Record<string, unknown> | null) {
    super(message);
    this.name = "RoomApiError";
    this.status = status;
    this.payload = payload;
  }

  get code() {
    return typeof this.payload?.code === "string" ? this.payload.code : null;
  }
}

const roomApiPath = (roomId: string) =>
  `/api/rooms/${encodeURIComponent(roomId)}`;

async function parseJsonResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const responseText = await response.text();
    let payload: Record<string, unknown> | null = null;
    try {
      payload = JSON.parse(responseText) as Record<string, unknown>;
    } catch (error) {
      payload = null;
    }
    const message =
      typeof payload?.error === "string"
        ? payload.error
        : `Unexpected ${response.status} response from ${response.url}: ${responseText}`;
    throw new RoomApiError(message, response.status, payload);
  }

  return response.json() as Promise<T>;
}

export async function joinRoom(args: {
  roomId: string;
  playerName: string;
  migrationKey?: string | null;
  deckLanguage?: string;
}): Promise<GameState> {
  const response = await fetch(`${roomApiPath(args.roomId)}/join`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      playerName: args.playerName,
      migrationKey: args.migrationKey,
      deckLanguage: args.deckLanguage,
    }),
  });

  return parseJsonResponse<GameState>(response);
}

export async function fetchRoom(roomId: string): Promise<GameState> {
  const response = await fetch(roomApiPath(roomId), {
    headers: {
      Accept: "application/json",
    },
  });

  return parseJsonResponse<GameState>(response);
}

export async function postRoomAction(
  roomId: string,
  action: RoomAction
): Promise<GameState> {
  const response = await fetch(`${roomApiPath(roomId)}/actions`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(action),
  });

  return parseJsonResponse<GameState>(response);
}

export async function fetchWordpacks(): Promise<WordpackInfo[]> {
  const response = await fetch("/api/wordpacks", {
    headers: { Accept: "application/json" },
  });

  return parseJsonResponse<WordpackInfo[]>(response);
}

export async function fetchWordpackCards(wordpack: string): Promise<WordpackCard[]> {
  const response = await fetch(`/api/wordpacks/${encodeURIComponent(wordpack)}`, {
    headers: { Accept: "application/json" },
  });

  return parseJsonResponse<WordpackCard[]>(response);
}

export async function requestMigrationLink(roomId: string): Promise<string> {
  const response = await fetch(`${roomApiPath(roomId)}/migrate`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({}),
  });

  const payload = await parseJsonResponse<{ url: string }>(response);
  return payload.url;
}

export function subscribeToRoom(
  roomId: string,
  onStateChange: (nextGameState: GameState) => void,
  onError?: (error: Event) => void
) {
  const eventSource = new EventSource(`${roomApiPath(roomId)}/events`);

  eventSource.onmessage = (event) => {
    onStateChange(JSON.parse(event.data) as GameState);
  };

  if (onError) {
    eventSource.onerror = onError;
  }

  return () => {
    eventSource.close();
  };
}


export function normalizeGameStatePayload(gameState: Partial<GameState>): GameState {
  const initialState = InitialGameState(gameState.deckLanguage ?? "en");
  const normalizedWordpacks =
    gameState.wordpacks && gameState.wordpacks.length > 0
      ? gameState.wordpacks.map((wordpack) => normalizeWordpack(wordpack))
      : [
          gameState.wordpack == null
            ? normalizeWordpack(gameState.deckLanguage)
            : normalizeWordpack(gameState.wordpack),
        ];
  return {
    ...initialState,
    ...gameState,
    players: gameState.players ?? initialState.players,
    clues: gameState.clues ?? initialState.clues,
    psychicIds: gameState.psychicIds ?? initialState.psychicIds,
    wordpack: normalizedWordpacks[0],
    wordpacks: normalizedWordpacks,
    previousTurn:
      gameState.previousTurn == null
        ? null
        : {
            ...gameState.previousTurn,
            clues: gameState.previousTurn.clues ?? [],
            individualGuesses: gameState.previousTurn.individualGuesses ?? {},
          },
    previousGameResult: gameState.previousGameResult ?? null,
    individualScores: gameState.individualScores ?? initialState.individualScores,
    individualGuesses: gameState.individualGuesses ?? initialState.individualGuesses,
    individualDraftGuesses:
      gameState.individualDraftGuesses ?? initialState.individualDraftGuesses,
    clueGiverCounts: gameState.clueGiverCounts ?? initialState.clueGiverCounts,
    individualClueGiverTarget:
      gameState.individualClueGiverTarget ?? initialState.individualClueGiverTarget,
    individualClueGiverCanSeeLiveGuesses:
      gameState.individualClueGiverCanSeeLiveGuesses ??
      initialState.individualClueGiverCanSeeLiveGuesses,
    randomizeTeams: gameState.randomizeTeams ?? initialState.randomizeTeams,
    viewer: {
      ...initialState.viewer,
      ...gameState.viewer,
    },
  };
}
