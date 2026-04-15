import React, { ReactNode } from "react";

export function Button(props: {
  text: ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      style={{
        padding: 8,
        margin: 8,
      }}
      onClick={props.onClick}
      disabled={props.disabled}
      type="button"
    >
      {props.text}
    </button>
  );
}
