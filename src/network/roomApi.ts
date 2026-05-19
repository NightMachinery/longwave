import { GameState, GameType, InitialGameState, Team } from "../state/GameState";
import { normalizeWordpack, WordpackCard, WordpackInfo } from "../state/Wordpack";

export type RoomAction =
  | { type: "set_name"; name: string }
  | { type: "set_game_type"; gameType: GameType }
  | { type: "set_wordpack"; wordpack: string }
  | { type: "join_team"; team: Team }
  | { type: "set_team"; playerId: string; team: Team }
  | { type: "start_round" }
  | { type: "set_psychic_count"; psychicCount: number }
  | { type: "set_clue_quota"; clueQuota: number }
  | { type: "submit_clue"; clue: string }
  | { type: "set_guess"; guess: number }
  | { type: "submit_guess" }
  | { type: "submit_counterguess"; counterGuess: "left" | "right" }
  | { type: "set_moderator"; playerId: string; value: boolean }
  | { type: "set_representative"; playerId: string; value: boolean }
  | { type: "set_observer"; playerId: string; value: boolean }
  | { type: "reset_room" }
  | { type: "play_again" }
  | { type: "reroll_round" }
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
  return {
    ...initialState,
    ...gameState,
    players: gameState.players ?? initialState.players,
    clues: gameState.clues ?? initialState.clues,
    psychicIds: gameState.psychicIds ?? initialState.psychicIds,
    wordpack: gameState.wordpack == null ? normalizeWordpack(gameState.deckLanguage) : normalizeWordpack(gameState.wordpack),
    previousTurn:
      gameState.previousTurn == null
        ? null
        : {
            ...gameState.previousTurn,
            clues: gameState.previousTurn.clues ?? [],
          },
    previousGameResult: gameState.previousGameResult ?? null,
    randomizeTeams: gameState.randomizeTeams ?? initialState.randomizeTeams,
    viewer: {
      ...initialState.viewer,
      ...gameState.viewer,
    },
  };
}
