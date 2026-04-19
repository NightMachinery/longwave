import { useHistory, useLocation, useParams } from "react-router-dom";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  RoomConnectionError,
  useNetworkBackedGameState,
} from "../hooks/useNetworkBackedGameState";
import { InputName } from "./InputName";
import { GameModelContext } from "../../state/GameModelContext";
import { ActiveGame } from "./ActiveGame";
import { BuildGameModel } from "../../state/BuildGameModel";
import { RoomIdHeader } from "../common/RoomIdHeader";
import { FakeRooms } from "./FakeRooms";
import { useTranslation } from "react-i18next";
import { Button } from "../common/Button";
import { CenteredColumn } from "../common/LayoutElements";
import {
  getMigrationKey,
  readStoredPlayerName,
  writeStoredPlayerName,
} from "../../utils/roomIdentity";

export function GameRoom() {
  const { roomId } = useParams<{ roomId: string }>();
  const location = useLocation();
  const history = useHistory();
  if (roomId === undefined) {
    throw new Error("RoomId missing");
  }

  const migrationKey = useMemo(() => getMigrationKey(location.search), [location.search]);
  const [playerName, setPlayerNameState] = useState(() =>
    readStoredPlayerName(localStorage, roomId)
  );
  const [isEditingName, setIsEditingName] = useState(false);

  useEffect(() => {
    setPlayerNameState(readStoredPlayerName(localStorage, roomId));
  }, [roomId]);

  const persistPlayerName = useCallback((nextPlayerName: string) => {
    writeStoredPlayerName(localStorage, nextPlayerName);
    setPlayerNameState(nextPlayerName);
  }, []);

  const [gameState, submitAction, connectionError] = useNetworkBackedGameState({
    roomId,
    playerName,
    migrationKey,
  });
  const cardsTranslation = useTranslation("spectrum-cards");
  const { t } = useTranslation();

  useEffect(() => {
    const syncedPlayerName = gameState?.players?.[gameState.viewer.playerId]?.name ?? "";

    if (syncedPlayerName.length > 0 && syncedPlayerName !== playerName) {
      persistPlayerName(syncedPlayerName);
    }
  }, [gameState, persistPlayerName, playerName]);

  useEffect(() => {
    if (!gameState) {
      return;
    }
    if (gameState.roomId.length === 0) {
      return;
    }
    const canCanonicalizeRoute = playerName.trim().length > 0 || migrationKey === null;
    if (!canCanonicalizeRoute) {
      return;
    }
    const nextPath = `/${encodeURIComponent(gameState.roomId)}`;
    if (location.pathname !== nextPath || location.search !== "") {
      history.replace(nextPath);
    }
  }, [gameState, history, location.pathname, location.search, migrationKey, playerName]);

  if (roomId === "MULTIPLAYER_TEST") {
    return <FakeRooms />;
  }

  if (isEditingName && gameState) {
    const currentPlayerName = gameState.players[gameState.viewer.playerId]?.name ?? playerName;
    return (
      <InputName
        title={String(t("roomidheader.change_name"))}
        initialName={currentPlayerName}
        submitText={String(t("roomidheader.save_name", "Save name"))}
        cancelText={String(t("inputname.cancel", "Cancel"))}
        setName={(nextName) => {
          const trimmedName = nextName.trim();
          if (trimmedName.length === 0) {
            return;
          }
          persistPlayerName(trimmedName);
          submitAction({ type: "set_name", name: trimmedName });
          setIsEditingName(false);
        }}
        onCancel={() => setIsEditingName(false)}
      />
    );
  }

  if (playerName.length === 0 && migrationKey === null) {
    return <InputName setName={persistPlayerName} initialName={playerName} />;
  }

  if (connectionError && !gameState) {
    return <RoomJoinError error={connectionError} onReturnHome={() => history.push("/")} />;
  }

  if (!gameState) {
    return null;
  }

  const gameModel = BuildGameModel(gameState, submitAction, cardsTranslation.t, () => {
    setIsEditingName(true);
  });

  return (
    <GameModelContext.Provider value={gameModel}>
      <RoomIdHeader />
      <ActiveGame />
    </GameModelContext.Provider>
  );
}

function RoomJoinError(props: {
  error: RoomConnectionError;
  onReturnHome: () => void;
}) {
  const { t } = useTranslation();

  const message =
    props.error.type === "stale_link"
      ? String(
          t(
            "roomerror.stale_link",
            "This room link has expired. Ask a moderator for the latest link."
          )
        )
      : String(t("roomerror.join_failed", "Could not connect to this room right now."));

  return (
    <CenteredColumn>
      <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 8 }}>{message}</div>
      <div style={{ color: "#6b7280", textAlign: "center", marginBottom: 16 }}>
        {props.error.message}
      </div>
      <Button text={String(t("roomerror.return_home", "Return home"))} onClick={props.onReturnHome} />
    </CenteredColumn>
  );
}
