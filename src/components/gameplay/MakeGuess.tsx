import React, { useContext } from "react";
import { GameType, TeamName } from "../../state/GameState";
import { Spectrum } from "../common/Spectrum";
import { CenteredColumn } from "../common/LayoutElements";
import { Button } from "../common/Button";
import { GameModelContext } from "../../state/GameModelContext";
import { RecordEvent } from "../../TrackEvent";
import { useTranslation } from "react-i18next";

export function MakeGuess() {
  const { t } = useTranslation();
  const { gameState, localPlayer, spectrumCard, submitAction } =
    useContext(GameModelContext);

  const waitingText =
    gameState.gameType === GameType.Teams
      ? t("makeguess.waiting_guessing_team", {
          guessingteam: TeamName(gameState.actingTeam, t),
        })
      : t("makeguess.waiting_guessing_team", { guessingteam: t("gamestate.the_player") });

  return (
    <div>
      <Spectrum
        spectrumCard={spectrumCard}
        handleValue={gameState.guess}
        psychicTargetValue={
          gameState.viewer.isCurrentPsychic ? gameState.spectrumTarget : undefined
        }
        guessingValue={!gameState.viewer.canSetGuess ? gameState.guess : undefined}
        onChange={(guess: number) => {
          if (gameState.viewer.canSetGuess) {
            submitAction({ type: "set_guess", guess });
          }
        }}
      />
      <CenteredColumn>
        <ClueList />
        {!gameState.viewer.canSubmitGuess && <div>{waitingText}</div>}
        <div>
          <Button
            text={t("makeguess.guess_for_team", {
              teamname: TeamName(localPlayer.team, t),
            })}
            onClick={() => {
              RecordEvent("guess_submitted", {
                clue_count: gameState.clues.length.toString(),
                target: gameState.spectrumTarget.toString(),
                guess: gameState.guess.toString(),
              });
              submitAction({ type: "submit_guess" });
            }}
            disabled={!gameState.viewer.canSubmitGuess}
          />
        </div>
      </CenteredColumn>
    </div>
  );
}

function ClueList() {
  const { t } = useTranslation();
  const { gameState } = useContext(GameModelContext);

  return (
    <div>
      <div>{t("makeguess.clues", "Clues")}</div>
      {gameState.clues.map((clue) => (
        <div key={`${clue.authorId}-${clue.order}`}>
          <strong>{clue.authorName}</strong>: {clue.text}
        </div>
      ))}
    </div>
  );
}
