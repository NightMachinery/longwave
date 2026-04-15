import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { fetchRoom, patchRoom, subscribeToRoom } from "../../network/roomApi";
import { GameState, InitialGameState, Team } from "../../state/GameState";

export function useNetworkBackedGameState(
  roomId: string,
  playerId: string,
  playerName: string
): [GameState, (newState: Partial<GameState>) => void] {
  const { i18n } = useTranslation("spectrum-cards");
  const [gameState, setGameState] = useState<GameState>(
    InitialGameState(i18n.language)
  );

  useEffect(() => {
    let isDisposed = false;

    const mergeIntoInitialGameState = (networkGameState: Partial<GameState>) => ({
      ...InitialGameState(i18n.language),
      ...networkGameState,
    });

    const syncLocalPlayer = async (networkGameState: Partial<GameState> | null) => {
      const completeGameState = mergeIntoInitialGameState(networkGameState ?? {});

      if (completeGameState.players[playerId] === undefined) {
        if (playerName.trim().length === 0) {
          if (!isDisposed) {
            setGameState(completeGameState);
          }
          return;
        }

        const shouldWriteFullRoomState =
          networkGameState === null ||
          networkGameState.roundPhase === undefined;

        const nextGameState = {
          ...completeGameState,
          players: {
            ...completeGameState.players,
            [playerId]: {
              name: playerName,
              team: Team.Unset,
            },
          },
        };

        if (!isDisposed) {
          setGameState(nextGameState);
        }

        try {
          const savedGameState = await patchRoom(
            roomId,
            shouldWriteFullRoomState
              ? nextGameState
              : {
                  players: nextGameState.players,
                }
          );

          if (!isDisposed) {
            setGameState(mergeIntoInitialGameState(savedGameState));
          }
        } catch (error) {
          console.error("Failed to persist room state", error);
        }

        return;
      }

      if (!isDisposed) {
        setGameState(completeGameState);
      }
    };

    void fetchRoom(roomId)
      .then((networkGameState) => syncLocalPlayer(networkGameState))
      .catch((error) => {
        console.error("Failed to load room state", error);
      });

    const unsubscribe = subscribeToRoom(
      roomId,
      (nextGameState) => {
        void syncLocalPlayer(nextGameState);
      },
      (error) => {
        console.error("Room event stream failed", error);
      }
    );

    return () => {
      isDisposed = true;
      unsubscribe();
    };
  }, [i18n.language, playerId, playerName, roomId]);

  return [
    gameState,
    (newState: Partial<GameState>) => {
      setGameState((previousGameState) => ({
        ...previousGameState,
        ...newState,
      }));

      void patchRoom(roomId, newState)
        .then((savedGameState) => {
          setGameState({
            ...InitialGameState(i18n.language),
            ...savedGameState,
          });
        })
        .catch((error) => {
          console.error("Failed to update room state", error);
        });
    },
  ];
}
