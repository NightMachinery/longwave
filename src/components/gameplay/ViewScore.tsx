import React, { useContext, useEffect, useRef } from "react";
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
      gameState.spectrumTarget > gameState.guess) ||
    (gameState.counterGuess === "exact" &&
      gameState.spectrumTarget === gameState.guess);

  const isGameOver =
    (gameState.gameType === GameType.Teams &&
      ((gameState.leftScore >= 10 && gameState.leftScore > gameState.rightScore) ||
        (gameState.rightScore >= 10 && gameState.rightScore > gameState.leftScore))) ||
    (gameState.gameType === GameType.Cooperative &&
      gameState.turnsTaken >= 7 + gameState.coopBonusTurns);

  useEndGameFanfare(isGameOver);

  return (
    <div className={isGameOver ? "end-game-reveal" : undefined}>
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
    return (
      <>
        <EndGameResult winner={Team.Left} loser={Team.Right} />
        <PlayAgainButton />
      </>
    );
  }

  if (gameState.rightScore >= 10 && gameState.rightScore > gameState.leftScore) {
    return (
      <>
        <EndGameResult winner={Team.Right} loser={Team.Left} />
        <PlayAgainButton />
      </>
    );
  }

  if (
    gameState.gameType === GameType.Cooperative &&
    gameState.turnsTaken >= 7 + gameState.coopBonusTurns
  ) {
    return (
      <>
        <EndGameResult />
        <PlayAgainButton />
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

function EndGameResult(props: { winner?: Team; loser?: Team }) {
  const { t } = useTranslation();
  const { gameState } = useContext(GameModelContext);

  if (gameState.gameType === GameType.Cooperative) {
    return (
      <div className="end-game-result" role="status">
        <div className="end-game-title">{t("viewscore.game_finished")}</div>
        <div className="end-game-score">
          {t("viewscore.final_score_team")}: <strong>{gameState.coopScore}</strong>
        </div>
      </div>
    );
  }

  return (
    <div className="end-game-result" role="status">
      <div className="end-game-title">
        {t("viewscore.winning_team", {
          winnerteam: TeamName(props.winner ?? Team.Unset, t),
        })}
      </div>
      <div className="end-game-grid">
        <div>
          <span>{t("viewscore.winner", "Winner")}</span>
          <strong>{TeamName(props.winner ?? Team.Unset, t)}</strong>
        </div>
        <div>
          <span>{t("viewscore.loser", "Loser")}</span>
          <strong>{TeamName(props.loser ?? Team.Unset, t)}</strong>
        </div>
        <div>
          <span>{t("viewscore.final_score", "Final score")}</span>
          <strong>
            {gameState.leftScore}-{gameState.rightScore}
          </strong>
        </div>
      </div>
    </div>
  );
}

function useEndGameFanfare(isGameOver: boolean) {
  const playedRef = useRef(false);

  useEffect(() => {
    if (!isGameOver || playedRef.current) {
      return;
    }
    playedRef.current = true;
    const AudioContextConstructor =
      window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextConstructor) {
      return;
    }
    try {
      const context = new AudioContextConstructor();
      const now = context.currentTime;
      [523.25, 659.25, 783.99].forEach((frequency, index) => {
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        oscillator.frequency.value = frequency;
        oscillator.type = "triangle";
        gain.gain.setValueAtTime(0.0001, now + index * 0.12);
        gain.gain.exponentialRampToValueAtTime(0.08, now + index * 0.12 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + index * 0.12 + 0.22);
        oscillator.connect(gain);
        gain.connect(context.destination);
        oscillator.start(now + index * 0.12);
        oscillator.stop(now + index * 0.12 + 0.24);
      });
      window.setTimeout(() => {
        void context.close();
      }, 700);
    } catch (error) {
      // Browsers may block audio playback unless the score reveal follows a user gesture.
    }
  }, [isGameOver]);
}

function PlayAgainButton() {
  const { t } = useTranslation();
  const { gameState, submitAction } = useContext(GameModelContext);

  if (!gameState.viewer.canManageRoom) {
    return null;
  }

  return (
    <Button
      text={t("viewscore.play_again", "Play again")}
      onClick={() => submitAction({ type: "play_again" })}
    />
  );
}
