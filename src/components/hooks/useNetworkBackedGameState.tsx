import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  joinRoom,
  normalizeGameStatePayload,
  postRoomAction,
  RoomApiError,
  RoomAction,
  subscribeToRoom,
} from "../../network/roomApi";
import { GameState } from "../../state/GameState";

export type RoomConnectionError = {
  type: "stale_link" | "join_failed";
  message: string;
  status: number;
};

export function useNetworkBackedGameState(args: {
  roomId: string;
  playerName: string;
  migrationKey?: string | null;
}): [GameState | null, (action: RoomAction) => void, RoomConnectionError | null] {
  const { i18n } = useTranslation("spectrum-cards");
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [connectionError, setConnectionError] = useState<RoomConnectionError | null>(null);

  useEffect(() => {
    let isDisposed = false;

    const shouldJoin =
      args.playerName.trim().length > 0 ||
      (args.migrationKey !== null && args.migrationKey !== undefined);

    if (!shouldJoin) {
      setGameState(null);
      setConnectionError(null);
      return;
    }

    let unsubscribe = () => {};
    setConnectionError(null);

    void joinRoom({
      roomId: args.roomId,
      playerName: args.playerName,
      migrationKey: args.migrationKey,
      deckLanguage: i18n.language,
    })
      .then((joinedState) => {
        if (isDisposed) {
          return;
        }

        setGameState(normalizeGameStatePayload(joinedState));
        setConnectionError(null);

        unsubscribe = subscribeToRoom(
          args.roomId,
          (nextGameState) => {
            if (!isDisposed) {
              setGameState(normalizeGameStatePayload(nextGameState));
              setConnectionError(null);
            }
          },
          (error) => {
            console.error("Room event stream failed", error);
          }
        );
      })
      .catch((error) => {
        console.error("Failed to join room", error);
        if (isDisposed) {
          return;
        }
        setGameState(null);
        if (error instanceof RoomApiError) {
          setConnectionError({
            type: error.code === "stale_room_link" ? "stale_link" : "join_failed",
            message: error.message,
            status: error.status,
          });
          return;
        }
        setConnectionError({
          type: "join_failed",
          message: "Failed to join room",
          status: 0,
        });
      });

    return () => {
      isDisposed = true;
      unsubscribe();
    };
  }, [args.migrationKey, args.playerName, args.roomId, i18n.language]);

  return [
    gameState,
    (action: RoomAction) => {
      void postRoomAction(args.roomId, action)
        .then((savedGameState) => {
          setGameState(normalizeGameStatePayload(savedGameState));
          setConnectionError(null);
        })
        .catch((error) => {
          console.error("Failed to update room state", error);
        });
    },
    connectionError,
  ];
}
