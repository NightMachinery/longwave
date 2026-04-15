import React, { useContext } from "react";
import { TurnSummaryModel } from "../../state/GameState";
import { CenteredColumn } from "../common/LayoutElements";
import { Spectrum } from "../common/Spectrum";
import { GameModelContext } from "../../state/GameModelContext";
import { useTranslation } from "react-i18next";

export function PreviousTurnResult(props: TurnSummaryModel) {
  const { t } = useTranslation();
  const { previousSpectrumCard } = useContext(GameModelContext);
  const style: React.CSSProperties = {
    borderTop: "1px solid black",
    margin: 16,
    paddingTop: 16,
  };

  const glassStyle: React.CSSProperties = {
    position: "absolute",
    zIndex: 10,
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: "rgba(255,255,255,0.5)",
  };

  if (!previousSpectrumCard) {
    return null;
  }

  return (
    <div style={style}>
      <CenteredColumn>
        <em>{t("previousturnresult.previous_game")}</em>
      </CenteredColumn>
      <div style={{ position: "relative" }}>
        <div style={glassStyle} />
        <Spectrum
          spectrumCard={previousSpectrumCard}
          handleValue={props.guess}
          targetValue={props.spectrumTarget}
        />
        <CenteredColumn>
          {props.clues.map((clue) => (
            <div key={`${clue.authorId}-${clue.order}`}>
              <strong>{clue.authorName}</strong>: {clue.text}
            </div>
          ))}
        </CenteredColumn>
      </div>
    </div>
  );
}
