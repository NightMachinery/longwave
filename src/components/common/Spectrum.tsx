import React from "react";
import Slider from "rc-slider";
import { CenteredColumn, CenteredRow } from "./LayoutElements";
import { GetContrastingColors } from "./GetContrastingColors";
import { GetContrastingText } from "./GetContrastingText";

import { useTranslation } from "react-i18next";
import { WordpackCard } from "../../state/Wordpack";

export function Spectrum(props: {
  spectrumCard: WordpackCard;
  handleValue?: number;
  targetValue?: number;
  psychicTargetValue?: number;
  guessingValue?: number;
  onChange?: (newValue: number) => void;
}) {
  const { t } = useTranslation();

  const [primary, secondary] = GetContrastingColors(
    getStringHash(props.spectrumCard.left.text)
  );
  const primaryColor = props.spectrumCard.left.color ?? primary;
  const secondaryColor = props.spectrumCard.right.color ?? secondary;
  const cardBackStyle: React.CSSProperties = {
    padding: 8,
    fontWeight: "bold",
  };
  const primaryText = GetContrastingText(primaryColor);
  const secondaryText = GetContrastingText(secondaryColor);

  let handleStyle: React.CSSProperties = {
    height: 18,
    width: 18,
    backgroundColor: "rgba(255,255,255,0.8)",
    borderColor: "black",
    zIndex: 3,
  };

  const dotStyle = {
    ...handleStyle,
    cursor: "auto",
    bottom: -9,
    borderWidth: 4,
    transform: "translateX(-5px)",
  };

  if (!props.onChange) {
    handleStyle.cursor = "auto";
    handleStyle.boxShadow = "none";
  }

  if (props.handleValue === undefined) {
    handleStyle.display = "none";
  }

  let marks: {
    [n: number]: { style: React.CSSProperties; label: string };
  } = {};

  if (props.guessingValue !== undefined) {
    const existing = marks[props.guessingValue];
    marks[props.guessingValue] = {
      style: existing
        ? { ...existing.style, cursor: "auto" }
        : { fontWeight: "bold", color: "black", cursor: "auto" },
      label: existing
        ? `${existing.label} / ${t("spectrum.guessing")}`
        : t("spectrum.guessing"),
    };
  }

  return (
    <div style={{ padding: 8 }}>
      <CenteredColumn style={{ alignItems: "stretch" }}>
        <CenteredRow style={{ justifyContent: "space-between" }}>
          <div style={{ ...cardBackStyle, backgroundColor: primaryColor, color: primaryText }}>
            {props.spectrumCard.left.text}
          </div>
          <div style={{ ...cardBackStyle, backgroundColor: secondaryColor, color: secondaryText }}>
            {props.spectrumCard.right.text}
          </div>
        </CenteredRow>
        <div style={{ padding: "16px 32px" }}>
          <div style={{ position: "relative" }}>
            {props.targetValue !== undefined && (
              <TrueTargetMarker value={props.targetValue} label={t("spectrum.target")} />
            )}
            {props.psychicTargetValue !== undefined && (
              <TrueTargetMarker
                value={props.psychicTargetValue}
                label={t("spectrum.psychic_target")}
              />
            )}
            <Slider
              min={0}
              max={20}
              value={props.handleValue}
              trackStyle={{
                backgroundColor: "transparent",
              }}
              railStyle={{
                background: `linear-gradient(90deg, ${primaryColor} 0%, ${secondaryColor} 100%)`,
                height: 8,
              }}
              handleStyle={handleStyle}
              onChange={props.onChange}
              marks={marks}
              dotStyle={dotStyle}
            />
          </div>
        </div>
      </CenteredColumn>
    </div>
  );
}

function TrueTargetMarker(props: { value: number; label: string }) {
  return (
    <>
      <span
        style={{
          position: "absolute",
          width: 1,
          height: 1,
          padding: 0,
          margin: -1,
          overflow: "hidden",
          clip: "rect(0, 0, 0, 0)",
          whiteSpace: "nowrap",
          border: 0,
        }}
      >
        {props.label}
      </span>
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          left: `${(props.value / 20) * 100}%`,
          top: -13,
          width: 34,
          height: 34,
          borderRadius: "50%",
          transform: "translateX(-17px)",
          background:
            "radial-gradient(circle at 32% 24%, rgba(255,255,255,0.85), rgba(255,255,255,0.28) 34%, rgba(255,255,255,0.1) 72%)",
          border: "1px solid rgba(255,255,255,0.78)",
          boxShadow:
            "inset 0 1px 3px rgba(255,255,255,0.95), inset 0 -8px 16px rgba(255,255,255,0.16), 0 8px 18px rgba(17,24,39,0.18), 0 0 0 1px rgba(17,24,39,0.14)",
          backdropFilter: "blur(8px) saturate(1.35)",
          WebkitBackdropFilter: "blur(8px) saturate(1.35)",
          zIndex: 1,
          pointerEvents: "none",
        }}
      />
    </>
  );
}

function getStringHash(value: string) {
  let acc = 0;
  for (let i = 0; i < value.length; i++) {
    acc += value.charCodeAt(i);
  }
  return acc;
}
