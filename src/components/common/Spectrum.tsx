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
  const filterId = `liquid-glass-target-${props.label.replace(/[^a-z0-9]+/gi, "-")}-${props.value}`;
  const bodyGradientId = `${filterId}-body`;
  const glintGradientId = `${filterId}-glint`;

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
      <svg
        aria-hidden="true"
        viewBox="0 0 26 26"
        style={{
          position: "absolute",
          left: `${(props.value / 20) * 100}%`,
          top: -9,
          width: 26,
          height: 26,
          transform: "translateX(-13px)",
          zIndex: 1,
          pointerEvents: "none",
          overflow: "visible",
        }}
      >
        <defs>
          <radialGradient id={bodyGradientId} cx="34%" cy="24%" r="72%">
            <stop offset="0%" stopColor="rgba(255,255,255,0.94)" />
            <stop offset="34%" stopColor="rgba(255,255,255,0.48)" />
            <stop offset="68%" stopColor="rgba(255,255,255,0.18)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0.06)" />
          </radialGradient>
          <linearGradient id={glintGradientId} x1="5" y1="3" x2="20" y2="24">
            <stop offset="0%" stopColor="rgba(255,255,255,0.92)" />
            <stop offset="45%" stopColor="rgba(255,255,255,0.16)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0.34)" />
          </linearGradient>
          <filter id={filterId} x="-35%" y="-35%" width="170%" height="170%">
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.055 0.11"
              numOctaves="2"
              seed={props.value + 7}
              result="texture"
            />
            <feDisplacementMap in="SourceGraphic" in2="texture" scale="1.15" xChannelSelector="R" yChannelSelector="G" result="liquid" />
            <feGaussianBlur in="liquid" stdDeviation="0.16" result="softLiquid" />
            <feDropShadow dx="0" dy="4" stdDeviation="3" floodColor="rgba(17,24,39,0.18)" />
            <feComposite in="softLiquid" in2="SourceGraphic" operator="over" />
          </filter>
        </defs>
        <circle cx="13" cy="13" r="12" fill={`url(#${bodyGradientId})`} filter={`url(#${filterId})`} />
        <circle cx="13" cy="13" r="11.5" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="0.9" />
        <path
          d="M7.1 7.2C9.1 4.9 12.5 4.1 15.4 5.3"
          fill="none"
          stroke={`url(#${glintGradientId})`}
          strokeWidth="2.1"
          strokeLinecap="round"
          opacity="0.9"
        />
        <path
          d="M6.1 17.3C8.6 20.4 14.6 22.1 19.8 17.9"
          fill="none"
          stroke="rgba(255,255,255,0.22)"
          strokeWidth="3.2"
          strokeLinecap="round"
        />
      </svg>
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
