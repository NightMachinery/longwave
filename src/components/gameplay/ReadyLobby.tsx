import React, { useContext } from "react";
import { GameModelContext } from "../../state/GameModelContext";
import { GameType } from "../../state/GameState";
import { CenteredColumn, CenteredRow } from "../common/LayoutElements";
import { LongwaveAppTitle } from "../common/Title";
import { Button } from "../common/Button";
import { useTranslation } from "react-i18next";
import { PreviousGameResultBanner } from "./PreviousGameResult";

export function ReadyLobby() {
  const { t } = useTranslation();
  const { gameState, submitAction } = useContext(GameModelContext);

  const modeLabel =
    gameState.gameType === GameType.Cooperative
      ? t("setupgame.coop_game")
      : gameState.gameType === GameType.Freeplay
        ? t("setupgame.free_game")
        : t("setupgame.standard_game");

  return (
    <CenteredColumn>
      <LongwaveAppTitle />
      <PreviousGameResultBanner />
      <div style={{ marginBottom: 8 }}>{t("readylobby.mode_ready", "Mode ready")}</div>
      <div style={{ fontWeight: 700, marginBottom: 16 }}>{modeLabel}</div>
      {!gameState.viewer.canManageRoom && (
        <p>{t("readylobby.waiting_for_mod", "Waiting for a moderator to restart the game.")}</p>
      )}
      <CenteredRow>
        <Button
          text={t("readylobby.start_game", "Start game")}
          onClick={() => submitAction({ type: "start_round" })}
          disabled={!gameState.viewer.canStartRound}
        />
      </CenteredRow>
    </CenteredColumn>
  );
}
