import React, { useContext } from "react";
import { GameType, Team, TeamName } from "../../state/GameState";
import { GameModelContext } from "../../state/GameModelContext";
import { useTranslation } from "react-i18next";

export function PreviousGameResultBanner() {
  const { t } = useTranslation();
  const { gameState } = useContext(GameModelContext);
  const result = gameState.previousGameResult;

  if (!result) {
    return null;
  }

  const message =
    result.gameType === GameType.Teams && result.winnerTeam !== Team.Unset
      ? t("previousgameresult.teams", {
          defaultValue: "{{winner}} beat {{loser}}, {{leftScore}}-{{rightScore}}.",
          winner: TeamName(result.winnerTeam, t),
          loser: TeamName(result.loserTeam, t),
          leftScore: result.leftScore,
          rightScore: result.rightScore,
        })
      : result.gameType === GameType.Individual
        ? t("previousgameresult.individual", {
            defaultValue: "Previous Individual winner: {{winner}}.",
            winner: (result.winnerIds ?? [])
              .map(
                (playerId) =>
                  gameState.players[playerId]?.displayName ??
                  gameState.players[playerId]?.name ??
                  playerId
              )
              .join(", "),
          })
        : t("previousgameresult.coop", {
            defaultValue: "Previous game score: {{score}} points.",
            score: result.coopScore,
          });

  return (
    <div
      role="status"
      style={{
        margin: "8px 0 16px",
        padding: "10px 12px",
        border: "1px solid #d1d5db",
        borderRadius: 8,
        backgroundColor: "#f9fafb",
        color: "#111827",
        fontWeight: 700,
      }}
    >
      {message}
    </div>
  );
}
