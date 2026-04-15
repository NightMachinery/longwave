import { useLocation, useParams } from "react-router-dom";
import React, { useEffect, useMemo, useState } from "react";
import { useNetworkBackedGameState } from "../hooks/useNetworkBackedGameState";
import { InputName } from "./InputName";
import { GameModelContext } from "../../state/GameModelContext";
import { ActiveGame } from "./ActiveGame";
import { BuildGameModel } from "../../state/BuildGameModel";
import { RoomIdHeader } from "../common/RoomIdHeader";
import { FakeRooms } from "./FakeRooms";
import { useTranslation } from "react-i18next";
import { Team } from "../../state/GameState";
import {
  getPlayerNameStorageKey,
  readStoredPlayerName,
  resolveRoomIdentity,
  writeStoredPlayerName,
} from "../../utils/roomIdentity";

export function GameRoom() {
  const { roomId } = useParams<{ roomId: string }>();
  const location = useLocation();
  if (roomId === undefined) {
    throw new Error("RoomId missing");
  }

  const roomIdentity = useMemo(
    () => resolveRoomIdentity(localStorage, roomId, location.search),
    [location.search, roomId]
  );
  const playerNameStorageKey = useMemo(
    () => getPlayerNameStorageKey(roomIdentity),
    [roomIdentity]
  );
  const [playerName, setPlayerNameState] = useState(() =>
    readStoredPlayerName(localStorage, playerNameStorageKey)
  );

  useEffect(() => {
    setPlayerNameState(readStoredPlayerName(localStorage, playerNameStorageKey));
  }, [playerNameStorageKey]);

  const setPlayerName = (nextPlayerName: string) => {
    writeStoredPlayerName(localStorage, playerNameStorageKey, nextPlayerName);
    setPlayerNameState(nextPlayerName);
  };

  const [gameState, setGameState] = useNetworkBackedGameState(
    roomId,
    roomIdentity.effectiveRoomAuthId,
    playerName
  );

  const cardsTranslation = useTranslation("spectrum-cards");

  if (
    gameState.deckLanguage !== null &&
    cardsTranslation.i18n.language !== gameState.deckLanguage
  ) {
    cardsTranslation.i18n.changeLanguage(gameState.deckLanguage);
    return null;
  }

  useEffect(() => {
    const syncedPlayerName =
      gameState.players[roomIdentity.effectiveRoomAuthId]?.name ?? "";

    if (syncedPlayerName.length > 0 && syncedPlayerName !== playerName) {
      setPlayerName(syncedPlayerName);
    }
  }, [gameState.players, playerName, roomIdentity.effectiveRoomAuthId]);

  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    if (!searchParams.get("rocketcrab")) {
      return;
    }

    const rocketcrabPlayerName = searchParams.get("name");
    if (rocketcrabPlayerName !== null && rocketcrabPlayerName !== playerName) {
      setPlayerName(rocketcrabPlayerName);
    }
  }, [location.search, playerName]);

  if (roomId === "MULTIPLAYER_TEST") {
    return <FakeRooms />;
  }

  const gameModel = BuildGameModel(
    gameState,
    setGameState,
    roomIdentity.effectiveRoomAuthId,
    cardsTranslation.t,
    setPlayerName
  );

  if (playerName.length === 0) {
    return (
      <InputName
        setName={(name) => {
          setPlayerName(name);
          setGameState({
            players: {
              ...gameState.players,
              [roomIdentity.effectiveRoomAuthId]: {
                name,
                team:
                  gameState.players[roomIdentity.effectiveRoomAuthId]?.team ??
                  Team.Unset,
              },
            },
          });
        }}
      />
    );
  }

  if (!gameState?.players?.[roomIdentity.effectiveRoomAuthId]) {
    return null;
  }

  return (
    <GameModelContext.Provider value={gameModel}>
      <RoomIdHeader />
      <ActiveGame />
    </GameModelContext.Provider>
  );
}
