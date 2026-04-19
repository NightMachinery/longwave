import React from "react";
import { useRef } from "react";
import { CenteredColumn } from "../common/LayoutElements";
import { LongwaveAppTitle } from "../common/Title";
import { useTranslation } from "react-i18next";
import { Button } from "../common/Button";

export function InputName(props: {
  setName: (name: string) => void;
  initialName?: string;
  title?: string;
  submitText?: string;
  onCancel?: () => void;
  cancelText?: string;
}) {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);

  const submitName = () => {
    if (!inputRef.current) {
      return;
    }

    props.setName(inputRef.current.value);
  };

  return (
    <CenteredColumn>
      <LongwaveAppTitle />
      <div>{props.title ?? t("inputname.your_name")}:</div>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          submitName();
        }}
      >
        <CenteredColumn>
          <input
            type="text"
            style={{ margin: 16 }}
            ref={inputRef}
            defaultValue={props.initialName ?? ""}
            onKeyDown={(event) => {
              if (event.key !== "Enter") {
                return;
              }

              event.preventDefault();
              submitName();
            }}
          />
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
            <Button text={props.submitText ?? t("inputname.submit_name")} onClick={submitName} />
            {props.onCancel && (
              <Button
                text={props.cancelText ?? t("inputname.cancel", "Cancel")}
                onClick={props.onCancel}
                variant="ghost"
              />
            )}
          </div>
        </CenteredColumn>
      </form>
    </CenteredColumn>
  );
}
