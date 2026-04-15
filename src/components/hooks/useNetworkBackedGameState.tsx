import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  joinRoom,
  normalizeGameStatePayload,
  postRoomAction,
  RoomAction,
  subscribeToRoom,
} from "../../network/roomApi";
import { GameState } from "../../state/GameState";

export function useNetworkBackedGameState(args: {
  roomId: string;
  playerName: string;
  migrationKey?: string | null;
}): [GameState | null, (action: RoomAction) => void] {
  const { i18n } = useTranslation("spectrum-cards");
  const [gameState, setGameState] = useState<GameState | null>(null);

  useEffect(() => {
    let isDisposed = false;

    const shouldJoin =
      args.playerName.trim().length > 0 ||
      (args.migrationKey !== null && args.migrationKey !== undefined);

    if (!shouldJoin) {
      setGameState(null);
      return;
    }

    let unsubscribe = () => {};

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

        unsubscribe = subscribeToRoom(
          args.roomId,
          (nextGameState) => {
            if (!isDisposed) {
              setGameState(normalizeGameStatePayload(nextGameState));
            }
          },
          (error) => {
            console.error("Room event stream failed", error);
          }
        );
      })
      .catch((error) => {
        console.error("Failed to join room", error);
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
        })
        .catch((error) => {
          console.error("Failed to update room state", error);
        });
    },
  ];
}
