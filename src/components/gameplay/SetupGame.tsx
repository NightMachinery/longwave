import React, { useContext } from "react";
import { GameType } from "../../state/GameState";
import { CenteredRow, CenteredColumn } from "../common/LayoutElements";
import { Button } from "../common/Button";
import { LongwaveAppTitle } from "../common/Title";
import { GameModelContext } from "../../state/GameModelContext";
import { useTranslation } from "react-i18next";
import { useWordpacks } from "../hooks/useWordpacks";
import { defaultWordpack } from "../../state/Wordpack";

export function SetupGame() {
  const { t } = useTranslation();
  const { gameState, submitAction, localPlayer } = useContext(GameModelContext);
  const canManageRoom = gameState.viewer.canManageRoom || localPlayer.isModerator;
  const wordpacks = useWordpacks();
  const selectedWordpack = gameState.wordpack || defaultWordpack;

  const startGame = (gameType: GameType) => {
    submitAction({ type: "set_game_type", gameType });
  };

  return (
    <CenteredColumn>
      <LongwaveAppTitle />
      <label style={{ marginTop: 8, fontWeight: 700 }} htmlFor="wordpack-select">
        {t("setupgame.wordpack", "Wordpack")}
      </label>
      {canManageRoom ? (
        <select
          id="wordpack-select"
          value={selectedWordpack}
          onChange={(event) => {
            submitAction({ type: "set_wordpack", wordpack: event.target.value });
          }}
          style={{ margin: 8, padding: 8, borderRadius: 8 }}
        >
          {wordpacks.map((wordpack) => (
            <option key={wordpack.id} value={wordpack.id}>
              {wordpack.name}
            </option>
          ))}
        </select>
      ) : (
        <p style={{ margin: 8 }}>{selectedWordpack}</p>
      )}
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
