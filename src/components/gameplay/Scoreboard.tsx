import React, { useContext } from "react";
import { GameType, Team, TeamName } from "../../state/GameState";
import { CenteredRow, CenteredColumn } from "../common/LayoutElements";
import { GameModelContext } from "../../state/GameModelContext";
import { useTranslation } from "react-i18next";
import { PlayerManagementCard, SectionTitle } from "./PlayerManagement";
import { RoomAction } from "../../network/roomApi";

export function Scoreboard() {
  const { t } = useTranslation();
  const { gameState, submitAction } = useContext(GameModelContext);

  const style = {
    borderTop: "1px solid black",
    margin: 16,
    paddingTop: 16,
    alignItems: "stretch",
  };

  const observers = Object.keys(gameState.players).filter(
    (playerId) => gameState.players[playerId].isObserver
  );

  return (
    <CenteredColumn style={style}>
      {gameState.gameType === GameType.Freeplay && <em>{t("scoreboard.free_play")}</em>}
      {gameState.gameType === GameType.Individual && (
        <em>{t("scoreboard.individual", "Individual")}</em>
      )}
      {gameState.gameType === GameType.Cooperative && (
        <>
          <em>
            {t("scoreboard.coop_score")}: {gameState.coopScore} {t("scoreboard.points")}
          </em>
          <div>
            {t("scoreboard.card_remaining")}: {7 + gameState.coopBonusTurns - gameState.turnsTaken}
          </div>
        </>
      )}
      {gameState.gameType === GameType.Teams ? (
        <CenteredRow style={{ width: "100%", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
          <TeamColumn team={Team.Left} score={gameState.leftScore} submitAction={submitAction} />
          <TeamColumn team={Team.Right} score={gameState.rightScore} submitAction={submitAction} />
        </CenteredRow>
      ) : gameState.gameType === GameType.Individual ? (
        <IndividualScoreList submitAction={submitAction} />
      ) : (
        <CenteredColumn style={{ alignItems: "stretch", gap: 10 }}>
          {Object.keys(gameState.players)
            .filter((playerId) => !gameState.players[playerId].isObserver)
            .map((playerId) => (
              <PlayerManagementCard
                key={playerId}
                playerId={playerId}
                submitAction={submitAction}
              />
            ))}
        </CenteredColumn>
      )}
      {observers.length > 0 && (
        <CenteredColumn style={{ alignItems: "stretch", marginTop: 12 }}>
          <SectionTitle>{t("scoreboard.observers", "Observers")}</SectionTitle>
          {observers.map((playerId) => (
            <div key={playerId} style={{ marginBottom: 10 }}>
              <PlayerManagementCard playerId={playerId} submitAction={submitAction} />
            </div>
          ))}
        </CenteredColumn>
      )}
    </CenteredColumn>
  );
}

function IndividualScoreList(props: { submitAction: (action: RoomAction) => void }) {
  const { t } = useTranslation();
  const { gameState } = useContext(GameModelContext);
  const activePlayerIds = Object.keys(gameState.players)
    .filter((playerId) => !gameState.players[playerId].isObserver)
    .sort((left, right) => {
      const scoreDelta =
        (gameState.individualScores[right] ?? 0) - (gameState.individualScores[left] ?? 0);
      if (scoreDelta !== 0) {
        return scoreDelta;
      }
      return gameState.players[left].name.localeCompare(gameState.players[right].name);
    });

  return (
    <CenteredColumn style={{ alignItems: "stretch", gap: 10, width: "100%" }}>
      <SectionTitle>{t("scoreboard.standings", "Standings")}</SectionTitle>
      {activePlayerIds.map((playerId) => (
        <div key={playerId} style={{ marginBottom: 10 }}>
          <div style={{ marginBottom: 4, fontWeight: 700 }}>
            {gameState.players[playerId].name}:{" "}
            {(gameState.individualScores[playerId] ?? 0).toFixed(1)}{" "}
            {t("scoreboard.points")}
            {" · "}
            {t("scoreboard.clue_giver_progress", {
              defaultValue: "Clue giver {{count}}/{{target}}",
              count: gameState.clueGiverCounts[playerId] ?? 0,
              target: gameState.individualClueGiverTarget,
            })}
          </div>
          <PlayerManagementCard playerId={playerId} submitAction={props.submitAction} />
        </div>
      ))}
    </CenteredColumn>
  );
}

function TeamColumn(props: { team: Team; score: number; submitAction: (action: RoomAction) => void }) {
  const { t } = useTranslation();
  const { gameState } = useContext(GameModelContext);

  const members = Object.keys(gameState.players).filter(
    (playerId) =>
      gameState.players[playerId].team === props.team &&
      !gameState.players[playerId].isObserver
  );

  return (
    <CenteredColumn
      style={{
        alignItems: "stretch",
        flex: 1,
        minWidth: 220,
        border: "1px solid #d1d5db",
        borderRadius: 16,
        backgroundColor: "#f9fafb",
        padding: 16,
        boxSizing: "border-box",
      }}
    >
      <div style={{ marginBottom: 12, fontWeight: 700 }}>
        {TeamName(props.team, t)}: <strong>{props.score}</strong> {t("scoreboard.points")}
      </div>
      {members.map((playerId) => (
        <div key={playerId} style={{ marginBottom: 10 }}>
          <PlayerManagementCard playerId={playerId} submitAction={props.submitAction} />
        </div>
      ))}
    </CenteredColumn>
  );
}
