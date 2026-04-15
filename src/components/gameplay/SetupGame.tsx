import React, { useContext } from "react";
import { GameType } from "../../state/GameState";
import { CenteredRow, CenteredColumn } from "../common/LayoutElements";
import { Button } from "../common/Button";
import { LongwaveAppTitle } from "../common/Title";
import { GameModelContext } from "../../state/GameModelContext";
import { useTranslation } from "react-i18next";

export function SetupGame() {
  const { t } = useTranslation();
  const { gameState, submitAction, localPlayer } = useContext(GameModelContext);
  const canManageRoom = gameState.viewer.canManageRoom || localPlayer.isModerator;

  const startGame = (gameType: GameType) => {
    submitAction({ type: "set_game_type", gameType });
  };

  return (
    <CenteredColumn>
      <LongwaveAppTitle />
      {!canManageRoom && <p>{t("setupgame.waiting_for_mod", "Waiting for a moderator to choose a mode.")}</p>}
      <CenteredRow style={{ flexWrap: "wrap" }}>
        <Button
          text={t("setupgame.standard_game")}
          onClick={() => startGame(GameType.Teams)}
          disabled={!canManageRoom}
        />
        <Button
          text={t("setupgame.coop_game")}
          onClick={() => startGame(GameType.Cooperative)}
          disabled={!canManageRoom}
        />
        <Button
          text={t("setupgame.free_game")}
          onClick={() => startGame(GameType.Freeplay)}
          disabled={!canManageRoom}
        />
      </CenteredRow>
    </CenteredColumn>
  );
}
