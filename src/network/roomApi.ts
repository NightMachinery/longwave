import { GameState } from "../state/GameState";

const roomApiPath = (roomId: string) =>
  `/api/rooms/${encodeURIComponent(roomId)}`;

async function parseJsonResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    throw new Error(`Unexpected ${response.status} response from ${response.url}`);
  }

  return response.json() as Promise<T>;
}

export async function fetchRoom(roomId: string): Promise<GameState | null> {
  const response = await fetch(roomApiPath(roomId), {
    headers: {
      Accept: "application/json",
    },
  });

  if (response.status === 404) {
    return null;
  }

  return parseJsonResponse<GameState>(response);
}

export async function patchRoom(
  roomId: string,
  roomStatePatch: Partial<GameState>
): Promise<GameState> {
  const response = await fetch(roomApiPath(roomId), {
    method: "PATCH",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(roomStatePatch),
  });

  return parseJsonResponse<GameState>(response);
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
