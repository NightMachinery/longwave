import React, { useRef, useContext, useState } from "react";
import { Spectrum } from "../common/Spectrum";
import { CenteredColumn, CenteredRow } from "../common/LayoutElements";
import { Button } from "../common/Button";
import { GameModelContext } from "../../state/GameModelContext";
import { Info } from "../common/Info";
import { Animate } from "../common/Animate";
import { useTranslation } from "react-i18next";

export function GiveClue() {
  const { t } = useTranslation();
  const { gameState, psychics, spectrumCard, submitAction } =
    useContext(GameModelContext);
  const inputElement = useRef<HTMLInputElement>(null);
  const [disableSubmit, setDisableSubmit] = useState(
    !inputElement.current?.value?.length
  );

  const submit = () => {
    if (!inputElement.current?.value?.length) {
      return false;
    }

    submitAction({
      type: "submit_clue",
      clue: inputElement.current.value,
    });
    if (inputElement.current) {
      inputElement.current.value = "";
    }
  };

  if (!gameState.viewer.isCurrentPsychic) {
    return (
      <div>
        <Animate animation="wipe-reveal-right">
          <Spectrum spectrumCard={spectrumCard} />
        </Animate>
        {gameState.viewer.canManageRoom && gameState.clues.length === 0 && (
          <CenteredColumn>
            <Button
              text={t("roomidheader.reroll_prompt")}
              onClick={() => submitAction({ type: "reroll_round" })}
              variant="secondary"
            />
          </CenteredColumn>
        )}
        <CenteredColumn>
          <div>
            {t(
              "giveclue.waiting_for_clues",
              "Waiting for psychics to submit clues..."
            )}
          </div>
          <div>
            {gameState.viewer.submittedClueCount}/{gameState.viewer.effectiveClueQuota}
          </div>
          {psychics.length > 0 && (
            <div>
              {t("giveclue.current_psychics", "Current psychics")}: {psychics.map((psychic) => psychic.name).join(", ")}
            </div>
          )}
        </CenteredColumn>
      </div>
    );
  }

  return (
    <div>
      <Animate animation="wipe-reveal-right">
        <Spectrum
          psychicTargetValue={gameState.spectrumTarget}
          spectrumCard={spectrumCard}
        />
      </Animate>
      <CenteredColumn>
        <div>
          {t("giveclue.current_progress", "Clues submitted")}: {gameState.viewer.submittedClueCount}/
          {gameState.viewer.effectiveClueQuota}
        </div>
        {gameState.clues.map((clue) => (
          <div key={`${clue.authorId}-${clue.order}`}>
            <strong>{clue.authorName}</strong>: {clue.text}
          </div>
        ))}
        <CenteredRow>
          <input
            type="text"
            placeholder={`${t("giveclue.clue")}`}
            ref={inputElement}
            onKeyDown={(event) => {
              if (event.key !== "Enter") {
                return true;
              }
              submit();
            }}
            onChange={() =>
              setDisableSubmit(!inputElement.current?.value?.length)
            }
          />
          <Info>
            <div>
              {t("giveclue.instructions")}
              <ul>
                <li>{t("giveclue.focus1")}</li>
                <li>{t("giveclue.focus2")}</li>
                <li>{t("giveclue.focus3")}</li>
                <li>{t("giveclue.focus4")}</li>
              </ul>
            </div>
          </Info>
        </CenteredRow>
        {gameState.viewer.canManageRoom && gameState.clues.length === 0 && (
          <Button
            text={t("roomidheader.reroll_prompt")}
            onClick={() => submitAction({ type: "reroll_round" })}
            variant="secondary"
          />
        )}
        <Button
          text={t("giveclue.give_clue")}
          onClick={submit}
          disabled={disableSubmit || !gameState.viewer.canSubmitClue}
        />
      </CenteredColumn>
    </div>
  );
}
