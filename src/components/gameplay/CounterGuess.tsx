import React, { useContext } from "react";
import { TeamReverse, TeamName } from "../../state/GameState";
import { Spectrum } from "../common/Spectrum";
import { CenteredColumn, CenteredRow } from "../common/LayoutElements";
import { Button } from "../common/Button";
import { GameModelContext } from "../../state/GameModelContext";
import { useTranslation } from "react-i18next";

export function CounterGuess() {
  const { t } = useTranslation();
  const { gameState, spectrumCard, submitAction } = useContext(GameModelContext);

  const counterGuessTeamString = TeamName(TeamReverse(gameState.actingTeam), t);

  return (
    <div>
      <Spectrum
        spectrumCard={spectrumCard}
        psychicTargetValue={
          gameState.viewer.isCurrentPsychic ? gameState.spectrumTarget : undefined
        }
        guessingValue={gameState.guess}
      />
      <CenteredColumn>
        {gameState.clues.map((clue) => (
          <div key={`${clue.authorId}-${clue.order}`}>
            <strong>{clue.authorName}</strong>: {clue.text}
          </div>
        ))}
        {!gameState.viewer.canSubmitCounterGuess && (
          <div>
            {t("counterguess.waiting_guess_team", {
              guessteam: counterGuessTeamString,
            })}
          </div>
        )}
      </CenteredColumn>
      <CenteredRow>
        <Button
          text={t("counterguess.more_left")}
          onClick={() =>
            submitAction({ type: "submit_counterguess", counterGuess: "left" })
          }
          disabled={!gameState.viewer.canSubmitCounterGuess}
        />
        <Button
          text={t("counterguess.exact", "Target is exactly here")}
          onClick={() =>
            submitAction({ type: "submit_counterguess", counterGuess: "exact" })
          }
          disabled={!gameState.viewer.canSubmitCounterGuess}
        />
        <Button
          text={t("counterguess.more_right")}
          onClick={() =>
            submitAction({ type: "submit_counterguess", counterGuess: "right" })
          }
          disabled={!gameState.viewer.canSubmitCounterGuess}
        />
      </CenteredRow>
    </div>
  );
}
