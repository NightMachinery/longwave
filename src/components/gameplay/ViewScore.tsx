import React, { useContext } from "react";
import { GetScore } from "../../state/GetScore";
import { CenteredColumn, CenteredRow } from "../common/LayoutElements";
import { Spectrum } from "../common/Spectrum";
import { Button } from "../common/Button";
import { GameType, Team, TeamName, TeamReverse } from "../../state/GameState";
import { GameModelContext } from "../../state/GameModelContext";
import { Info } from "../common/Info";
import { Trans, useTranslation } from "react-i18next";

export function ViewScore() {
  const { t } = useTranslation();
  const { gameState, spectrumCard } = useContext(GameModelContext);

  let score = GetScore(gameState.spectrumTarget, gameState.guess);
  let bonusCoopTurn = false;
  if (gameState.gameType === GameType.Cooperative && score === 4) {
    score = 3;
    bonusCoopTurn = true;
  }

  const wasCounterGuessCorrect =
    (gameState.counterGuess === "left" &&
      gameState.spectrumTarget < gameState.guess) ||
    (gameState.counterGuess === "right" &&
      gameState.spectrumTarget > gameState.guess);

  return (
    <div>
      <Spectrum
        spectrumCard={spectrumCard}
        handleValue={gameState.guess}
        targetValue={gameState.spectrumTarget}
      />
      <CenteredColumn>
        {gameState.clues.map((clue) => (
          <div key={`${clue.authorId}-${clue.order}`}>
            <strong>{clue.authorName}</strong>: {clue.text}
          </div>
        ))}
        <div>
          {t("viewscore.score")}: {score} {t("viewscore.points")}!
        </div>
        {gameState.gameType === GameType.Teams && (
          <div>
            {TeamName(TeamReverse(gameState.actingTeam), t)} {t("viewscore.got")} {wasCounterGuessCorrect
              ? t("viewscore.1_point_correct_guess")
              : t("viewscore.0_point_wrong_guess")}
          </div>
        )}
        {bonusCoopTurn && (
          <Trans
            i18nKey={t("viewscore.bonus_turn") as string}
            components={{
              strong: <strong />,
            }}
          />
        )}
        <NextTurnOrEndGame />
      </CenteredColumn>
    </div>
  );
}

function NextTurnOrEndGame() {
  const { t } = useTranslation();
  const { gameState, submitAction } = useContext(GameModelContext);

  if (gameState.leftScore >= 10 && gameState.leftScore > gameState.rightScore) {
    return <div>{t("viewscore.winning_team", { winnerteam: TeamName(Team.Left, t) })}</div>;
  }

  if (gameState.rightScore >= 10 && gameState.rightScore > gameState.leftScore) {
    return <div>{t("viewscore.winning_team", { winnerteam: TeamName(Team.Right, t) })}</div>;
  }

  if (
    gameState.gameType === GameType.Cooperative &&
    gameState.turnsTaken >= 7 + gameState.coopBonusTurns
  ) {
    return (
      <>
        <div>{t("viewscore.game_finished")}</div>
        <div>
          {t("viewscore.final_score_team")}: <strong>{gameState.coopScore} {t("viewscore.points")}</strong>
        </div>
      </>
    );
  }

  const score = GetScore(gameState.spectrumTarget, gameState.guess);
  const scoringTeamString = TeamName(gameState.actingTeam, t);
  let bonusTurn = false;

  const nextTeam = (() => {
    if (gameState.gameType !== GameType.Teams) {
      return Team.Unset;
    }

    if (score === 4) {
      if (gameState.leftScore < gameState.rightScore && gameState.actingTeam === Team.Left) {
        bonusTurn = true;
        return Team.Left;
      }
      if (gameState.rightScore < gameState.leftScore && gameState.actingTeam === Team.Right) {
        bonusTurn = true;
        return Team.Right;
      }
    }

    return TeamReverse(gameState.actingTeam);
  })();

  return (
    <>
      {bonusTurn && (
        <CenteredRow>
          <div>{t("viewscore.catching_up", { scoringteam: scoringTeamString })}</div>
          <Info>{t("viewscore.catching_up_info") as string}</Info>
        </CenteredRow>
      )}
      <Button
        text={t("viewscore.draw_next_card")}
        onClick={() => submitAction({ type: "start_round" })}
        disabled={!gameState.viewer.canStartRound}
      />
      {gameState.gameType === GameType.Teams && nextTeam !== Team.Unset && (
        <div>{t("viewscore.next_team", "Next team")}: {TeamName(nextTeam, t)}</div>
      )}
    </>
  );
}
