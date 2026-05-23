import React, { useContext } from "react";
import { GameType, Team, TeamName, TeamReverse, TurnSummaryModel } from "../../state/GameState";
import { CenteredColumn } from "../common/LayoutElements";
import { Spectrum } from "../common/Spectrum";
import { GameModelContext } from "../../state/GameModelContext";
import { useTranslation } from "react-i18next";
import { TFunction } from "i18next";
import { GetScore } from "../../state/GetScore";
import { buildIndividualGuessMarkers } from "./IndividualGuessMarkers";

export function PreviousTurnResult(props: TurnSummaryModel) {
  const { t } = useTranslation();
  const { gameState, previousSpectrumCard } = useContext(GameModelContext);
  const style: React.CSSProperties = {
    borderTop: "1px solid black",
    margin: 16,
    paddingTop: 16,
  };

  if (!previousSpectrumCard) {
    return null;
  }

  const gameType = props.gameType ?? gameState.gameType;
  const individualGuesses = props.individualGuesses ?? {};
  const dotMarkers =
    gameType === GameType.Individual
      ? buildIndividualGuessMarkers(individualGuesses, gameState.players)
      : [];

  return (
    <div style={style}>
      <CenteredColumn>
        <em>{t("previousturnresult.previous_game", "Previous round")}</em>
      </CenteredColumn>
      <div>
        <Spectrum
          spectrumCard={previousSpectrumCard}
          handleValue={gameType === GameType.Individual ? undefined : props.guess}
          targetValue={props.spectrumTarget}
          dotMarkers={dotMarkers}
        />
        <CenteredColumn>
          {props.clues.map((clue) => (
            <div key={`${clue.authorId}-${clue.order}`}>
              <strong>{clue.authorName}</strong>: {clue.text}
            </div>
          ))}
          <PreviousRoundScoreSummary
            gameType={gameType}
            spectrumTarget={props.spectrumTarget}
            guess={props.guess}
            counterGuess={props.counterGuess}
            actingTeam={props.actingTeam}
            individualGuesses={individualGuesses}
          />
        </CenteredColumn>
      </div>
    </div>
  );
}

function PreviousRoundScoreSummary(props: {
  gameType: GameType;
  spectrumTarget: number;
  guess: number;
  counterGuess?: "left" | "right" | "exact";
  actingTeam?: Team;
  individualGuesses: { [playerId: string]: number };
}) {
  const { t } = useTranslation();
  const { gameState } = useContext(GameModelContext);

  if (props.gameType === GameType.Individual) {
    const guesserIds = Object.keys(props.individualGuesses)
      .filter((playerId) => props.individualGuesses[playerId] >= 0)
      .sort((left, right) =>
        (gameState.players[left]?.displayName ?? gameState.players[left]?.name ?? left).localeCompare(
          gameState.players[right]?.displayName ?? gameState.players[right]?.name ?? right
        )
      );
    return (
      <div>
        {guesserIds.map((playerId) => (
          <div key={playerId}>
            <strong>
              {gameState.players[playerId]?.displayName ??
                gameState.players[playerId]?.name ??
                playerId}
            </strong>:{" "}
            {props.individualGuesses[playerId]} (
            {GetScore(props.spectrumTarget, props.individualGuesses[playerId])}{" "}
            {t("viewscore.points")})
          </div>
        ))}
      </div>
    );
  }

  const score = GetScore(props.spectrumTarget, props.guess);
  const displayScore = props.gameType === GameType.Cooperative && score === 4 ? 3 : score;

  if (props.gameType !== GameType.Teams || props.actingTeam === undefined) {
    return (
      <div>
        {t("viewscore.score")}: {displayScore} {t("viewscore.points")}
      </div>
    );
  }

  const counterGuess = props.counterGuess ?? "left";
  const wasCounterGuessCorrect =
    (counterGuess === "left" && props.spectrumTarget < props.guess) ||
    (counterGuess === "right" && props.spectrumTarget > props.guess) ||
    (counterGuess === "exact" && props.spectrumTarget === props.guess);

  return (
    <div>
      <div>
        {TeamName(props.actingTeam, t)} {t("previousturnresult.scored", "scored")}{" "}
        {displayScore} {t("viewscore.points")}
      </div>
      <div>
        {TeamName(TeamReverse(props.actingTeam), t)} {t("viewscore.got")}{" "}
        {wasCounterGuessCorrect
          ? t("viewscore.1_point_correct_guess", {
              counterguess: counterGuessLabel(counterGuess, t),
            })
          : t("viewscore.0_point_wrong_guess", {
              counterguess: counterGuessLabel(counterGuess, t),
            })}
      </div>
    </div>
  );
}

function counterGuessLabel(counterGuess: "left" | "right" | "exact", t: TFunction) {
  if (counterGuess === "left") {
    return t("counterguess.more_left");
  }
  if (counterGuess === "right") {
    return t("counterguess.more_right");
  }
  return t("counterguess.exact", "Target is exactly here");
}
