import React, { ReactNode } from "react";

export function Button(props: {
  text: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  variant?: "primary" | "secondary" | "ghost" | "selected";
  compact?: boolean;
  style?: React.CSSProperties;
}) {
  const variant = props.variant ?? "primary";
  const palette =
    variant === "secondary"
      ? {
          backgroundColor: "#eef2ff",
          border: "1px solid #c7d2fe",
          color: "#312e81",
        }
      : variant === "ghost"
        ? {
            backgroundColor: "transparent",
            border: "1px solid #d1d5db",
            color: "#1f2937",
          }
        : variant === "selected"
          ? {
              backgroundColor: "#1d4ed8",
              border: "1px solid #1d4ed8",
              color: "#ffffff",
            }
          : {
              backgroundColor: "#111827",
              border: "1px solid #111827",
              color: "#ffffff",
            };

  return (
    <button
      style={{
        padding: props.compact ? "6px 10px" : "10px 14px",
        margin: props.compact ? 4 : 8,
        borderRadius: 999,
        fontWeight: 600,
        cursor: props.disabled ? "not-allowed" : "pointer",
        opacity: props.disabled ? 0.55 : 1,
        transition: "all 0.15s ease",
        ...palette,
        ...props.style,
      }}
      onClick={props.onClick}
      disabled={props.disabled}
      type="button"
    >
      {props.text}
    </button>
  );
}
