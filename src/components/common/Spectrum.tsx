import React from "react";
import Slider from "rc-slider";
import { CenteredColumn, CenteredRow } from "./LayoutElements";
import { GetContrastingColors } from "./GetContrastingColors";
import { GetContrastingText } from "./GetContrastingText";

import { useTranslation } from "react-i18next";
import { WordpackCard } from "../../state/Wordpack";

export type SpectrumDotMarker = {
  playerId: string;
  name: string;
  value: number;
  color: string;
};

export function Spectrum(props: {
  spectrumCard: WordpackCard;
  handleValue?: number;
  targetValue?: number;
  psychicTargetValue?: number;
  guessingValue?: number;
  dotMarkers?: SpectrumDotMarker[];
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
            <PlayerDotMarkers markers={props.dotMarkers ?? []} />
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

function PlayerDotMarkers(props: { markers: SpectrumDotMarker[] }) {
  const grouped = props.markers.reduce<Record<number, SpectrumDotMarker[]>>((acc, marker) => {
    if (!acc[marker.value]) {
      acc[marker.value] = [];
    }
    acc[marker.value].push(marker);
    return acc;
  }, {});

  return (
    <>
      {Object.entries(grouped).flatMap(([rawValue, markers]) =>
        markers
          .slice()
          .sort((left, right) => left.name.localeCompare(right.name))
          .map((marker, index) => {
            const offset = spiralOffset(index);
            return (
              <span
                key={marker.playerId}
                title={marker.name}
                aria-hidden="true"
                style={{
                  position: "absolute",
                  left: `${(Number(rawValue) / 20) * 100}%`,
                  top: 5.5 + offset.y,
                  width: 7,
                  height: 7,
                  borderRadius: "50%",
                  transform: `translateX(${offset.x - 3.5}px)`,
                  backgroundColor: marker.color,
                  border: "1px solid rgba(255,255,255,0.88)",
                  zIndex: 2,
                  pointerEvents: "none",
                }}
              />
            );
          })
      )}
    </>
  );
}

function spiralOffset(index: number) {
  if (index === 0) {
    return { x: 0, y: 0 };
  }

  const goldenAngle = Math.PI * (3 - Math.sqrt(5));
  const radius = Math.sqrt(index) * 7;
  const angle = index * goldenAngle;

  return {
    x: Math.cos(angle) * radius,
    y: Math.sin(angle) * radius,
  };
}

function TrueTargetMarker(props: { value: number; label: string }) {
  const filterId = `liquid-glass-target-${props.label.replace(/[^a-z0-9]+/gi, "-")}-${props.value}`;
  const bodyGradientId = `${filterId}-body`;

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
        viewBox="0 0 22 22"
        style={{
          position: "absolute",
          left: `${(props.value / 20) * 100}%`,
          top: 0,
          width: 22,
          height: 22,
          transform: "translate(-11px, -2px)",
          zIndex: 1,
          pointerEvents: "none",
          overflow: "visible",
        }}
      >
        <defs>
          <radialGradient id={bodyGradientId} cx="50%" cy="50%" r="64%">
            <stop offset="0%" stopColor="rgba(255,255,255,0.94)" />
            <stop offset="38%" stopColor="rgba(255,255,255,0.46)" />
            <stop offset="72%" stopColor="rgba(255,255,255,0.16)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0.06)" />
          </radialGradient>
          <filter id={filterId} x="-35%" y="-35%" width="170%" height="170%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="0.12" result="softLiquid" />
            <feDropShadow dx="0" dy="2.5" stdDeviation="2.1" floodColor="rgba(17,24,39,0.2)" />
            <feComposite in="softLiquid" in2="SourceGraphic" operator="over" />
          </filter>
        </defs>
        <circle
          cx="11"
          cy="11"
          r="10.2"
          fill="rgba(100,116,139,0.14)"
          stroke="rgba(17,24,39,0.26)"
          strokeWidth="0.8"
        />
        <circle cx="11" cy="11" r="9.8" fill={`url(#${bodyGradientId})`} filter={`url(#${filterId})`} />
        <circle cx="11" cy="11" r="9.1" fill="none" stroke="rgba(255,255,255,0.72)" strokeWidth="0.95" />
        <circle cx="11" cy="11" r="6.2" fill="none" stroke="rgba(255,255,255,0.22)" strokeWidth="2.3" />
        <circle cx="11" cy="11" r="3.1" fill="rgba(255,255,255,0.26)" />
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
