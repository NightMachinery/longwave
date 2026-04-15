import { useLocation, useParams } from "react-router-dom";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNetworkBackedGameState } from "../hooks/useNetworkBackedGameState";
import { InputName } from "./InputName";
import { GameModelContext } from "../../state/GameModelContext";
import { ActiveGame } from "./ActiveGame";
import { BuildGameModel } from "../../state/BuildGameModel";
import { RoomIdHeader } from "../common/RoomIdHeader";
import { FakeRooms } from "./FakeRooms";
import { useTranslation } from "react-i18next";
import {
  getMigrationKey,
  getPlayerNameStorageKey,
  readStoredPlayerName,
  writeStoredPlayerName,
} from "../../utils/roomIdentity";

export function GameRoom() {
  const { roomId } = useParams<{ roomId: string }>();
  const location = useLocation();
  if (roomId === undefined) {
    throw new Error("RoomId missing");
  }

  const migrationKey = useMemo(() => getMigrationKey(location.search), [location.search]);
  const playerNameStorageKey = useMemo(() => getPlayerNameStorageKey(roomId), [roomId]);
  const [playerName, setPlayerNameState] = useState(() =>
    readStoredPlayerName(localStorage, playerNameStorageKey)
  );

  useEffect(() => {
    setPlayerNameState(readStoredPlayerName(localStorage, playerNameStorageKey));
  }, [playerNameStorageKey]);

  const setPlayerName = useCallback(
    (nextPlayerName: string) => {
      writeStoredPlayerName(localStorage, playerNameStorageKey, nextPlayerName);
      setPlayerNameState(nextPlayerName);
    },
    [playerNameStorageKey]
  );

  const [gameState, submitAction] = useNetworkBackedGameState({
    roomId,
    playerName,
    migrationKey,
  });
  const cardsTranslation = useTranslation("spectrum-cards");

  useEffect(() => {
    const syncedPlayerName =
      gameState?.players?.[gameState.viewer.playerId]?.name ?? "";

    if (syncedPlayerName.length > 0 && syncedPlayerName !== playerName) {
      setPlayerName(syncedPlayerName);
    }
  }, [gameState, playerName, setPlayerName]);

  if (roomId === "MULTIPLAYER_TEST") {
    return <FakeRooms />;
  }

  if (playerName.length === 0 && migrationKey === null) {
    return <InputName setName={setPlayerName} />;
  }

  if (!gameState) {
    return null;
  }

  const gameModel = BuildGameModel(
    gameState,
    submitAction,
    cardsTranslation.t,
    setPlayerName
  );

  return (
    <GameModelContext.Provider value={gameModel}>
      <RoomIdHeader />
      <ActiveGame />
    </GameModelContext.Provider>
  );
}
