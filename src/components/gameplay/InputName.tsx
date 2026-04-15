import React from "react";
import { useRef } from "react";
import { CenteredColumn } from "../common/LayoutElements";
import { LongwaveAppTitle } from "../common/Title";
import { useTranslation } from "react-i18next";
import { Button } from "../common/Button";

export function InputName(props: { setName: (name: string) => void }) {
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
      <div>{t("inputname.your_name")}:</div>
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
            onKeyDown={(event) => {
              if (event.key !== "Enter") {
                return;
              }

              event.preventDefault();
              submitName();
            }}
          />
          <Button text={t("inputname.submit_name")} onClick={submitName} />
        </CenteredColumn>
      </form>
    </CenteredColumn>
  );
}
