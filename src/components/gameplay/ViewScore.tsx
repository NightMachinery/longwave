import React, { useContext, useEffect, useRef } from "react";
import { GetScore } from "../../state/GetScore";
import { CenteredColumn, CenteredRow } from "../common/LayoutElements";
import { Spectrum } from "../common/Spectrum";
import { Button } from "../common/Button";
import { GameType, PlayersTeams, Team, TeamName, TeamReverse } from "../../state/GameState";
import { GameModelContext } from "../../state/GameModelContext";
import { Info } from "../common/Info";
import { Trans, useTranslation } from "react-i18next";
import { buildIndividualGuessMarkers } from "./IndividualGuessMarkers";

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
      gameState.turnsTaken >= 7 + gameState.coopBonusTurns) ||
    (gameState.gameType === GameType.Individual && isIndividualGameOver(gameState));

  useEndGameFanfare(isGameOver);

  if (gameState.gameType === GameType.Individual) {
    return <IndividualScoreReveal isGameOver={isGameOver} />;
  }

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

function IndividualScoreReveal(props: { isGameOver: boolean }) {
  const { t } = useTranslation();
  const { gameState, spectrumCard, submitAction } = useContext(GameModelContext);
  const clueGiverId = gameState.psychicIds[0];
  const clueGiverName =
    clueGiverId && gameState.players[clueGiverId]
      ? gameState.players[clueGiverId].name
      : t("gamestate.the_player");
  const guesserIds = Object.keys(gameState.individualGuesses)
    .filter((playerId) => gameState.individualGuesses[playerId] >= 0)
    .sort((left, right) =>
      (gameState.players[left]?.name ?? left).localeCompare(gameState.players[right]?.name ?? right)
    );
  const roundScores = guesserIds.map((playerId) =>
    GetScore(gameState.spectrumTarget, gameState.individualGuesses[playerId])
  );
  const average =
    roundScores.length === 0
      ? 0
      : roundScores.reduce((total, score) => total + score, 0) / roundScores.length;
  const winnerIds = individualWinnerIds(gameState);
  const dotMarkers = buildIndividualGuessMarkers(
    Object.keys(gameState.individualDraftGuesses).length > 0
      ? gameState.individualDraftGuesses
      : gameState.individualGuesses,
    gameState.players
  );

  return (
    <div className={props.isGameOver ? "end-game-reveal" : undefined}>
      <Spectrum
        spectrumCard={spectrumCard}
        targetValue={gameState.spectrumTarget}
        dotMarkers={dotMarkers}
      />
      <CenteredColumn>
        {gameState.clues.map((clue) => (
          <div key={`${clue.authorId}-${clue.order}`}>
            <strong>{clue.authorName}</strong>: {clue.text}
          </div>
        ))}
        <div>
          {t("viewscore.individual_round_score", {
            defaultValue: "{{name}} scores {{score}} points.",
            name: clueGiverName,
            score: average.toFixed(1),
          })}
        </div>
        <div>
          {guesserIds.map((playerId) => (
            <div key={playerId}>
              <strong>{gameState.players[playerId]?.name ?? playerId}</strong>:{" "}
              {gameState.individualGuesses[playerId]} (
              {GetScore(gameState.spectrumTarget, gameState.individualGuesses[playerId])}{" "}
              {t("viewscore.points")})
            </div>
          ))}
        </div>
        {props.isGameOver ? (
          <>
            <div className="end-game-result" role="status">
              <div className="end-game-title">{t("viewscore.game_finished")}</div>
              <div className="end-game-score">
                {t("viewscore.individual_winners", {
                  defaultValue: "Winner: {{winners}}",
                  winners: winnerIds
                    .map((playerId) => gameState.players[playerId]?.name ?? playerId)
                    .join(", "),
                })}
              </div>
            </div>
            <IndividualStandings />
            <PlayAgainButton />
          </>
        ) : (
          <>
            <IndividualStandings />
            <Button
              text={t("viewscore.draw_next_card")}
              onClick={() => submitAction({ type: "start_round" })}
              disabled={!gameState.viewer.canStartRound}
            />
          </>
        )}
      </CenteredColumn>
    </div>
  );
}

function IndividualStandings() {
  const { t } = useTranslation();
  const { gameState } = useContext(GameModelContext);
  const playerIds = Object.keys(gameState.players)
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
    <div>
      <div style={{ fontWeight: 700 }}>{t("viewscore.standings", "Standings")}</div>
      {playerIds.map((playerId) => (
        <div key={playerId}>
          {gameState.players[playerId].name}: {(gameState.individualScores[playerId] ?? 0).toFixed(1)}
        </div>
      ))}
    </div>
  );
}

function isIndividualGameOver(gameState: { players: Record<string, { isObserver: boolean }>; clueGiverCounts: Record<string, number>; individualClueGiverTarget: number }) {
  const activePlayerIds = Object.keys(gameState.players).filter(
    (playerId) => !gameState.players[playerId].isObserver
  );
  if (activePlayerIds.length < 2) {
    return false;
  }
  return activePlayerIds.every(
    (playerId) => (gameState.clueGiverCounts[playerId] ?? 0) >= gameState.individualClueGiverTarget
  );
}

function individualWinnerIds(gameState: { players: Record<string, { isObserver: boolean }>; individualScores: Record<string, number> }) {
  const activePlayerIds = Object.keys(gameState.players).filter(
    (playerId) => !gameState.players[playerId].isObserver
  );
  let bestScore = Number.NEGATIVE_INFINITY;
  let winners: string[] = [];
  activePlayerIds.forEach((playerId) => {
    const score = gameState.individualScores[playerId] ?? 0;
    if (score > bestScore) {
      bestScore = score;
      winners = [playerId];
    } else if (score === bestScore) {
      winners.push(playerId);
    }
  });
  return winners;
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

  const winner = props.winner ?? Team.Unset;
  const loser = props.loser ?? Team.Unset;
  const winnerNames = teamMemberNames(gameState.players, winner);
  const loserNames = teamMemberNames(gameState.players, loser);
  const teamScore = (team: Team) =>
    team === Team.Left ? gameState.leftScore : team === Team.Right ? gameState.rightScore : 0;

  return (
    <div className="end-game-result" role="status">
      <div className="end-game-title">
        {t("viewscore.winning_team", {
          winnerteam: TeamName(winner, t),
        })}
      </div>
      <div className="end-game-grid">
        <div>
          <span>{t("viewscore.winner", "Winner")}</span>
          <strong>{TeamName(winner, t)}</strong>
          <strong>
            {t("viewscore.team_score", "Score")}: {teamScore(winner)}
          </strong>
          <div className="end-game-roster">{winnerNames.join(", ")}</div>
        </div>
        <div>
          <span>{t("viewscore.loser", "Loser")}</span>
          <strong>{TeamName(loser, t)}</strong>
          <strong>
            {t("viewscore.team_score", "Score")}: {teamScore(loser)}
          </strong>
          <div className="end-game-roster">{loserNames.join(", ")}</div>
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

function teamMemberNames(players: PlayersTeams, team: Team) {
  return Object.keys(players)
    .filter((playerId) => players[playerId].team === team && !players[playerId].isObserver)
    .map((playerId) => players[playerId].name)
    .sort((left, right) => left.localeCompare(right));
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
