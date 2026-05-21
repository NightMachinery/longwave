import React from "react";
import { useTranslation } from "react-i18next";
import { RoomAction } from "../../network/roomApi";
import { defaultWordpack } from "../../state/Wordpack";
import { useWordpacks } from "../hooks/useWordpacks";

export function WordpackSelector(props: {
  selectedWordpacks?: string[];
  canManageRoom: boolean;
  submitAction: (action: RoomAction) => void;
  compact?: boolean;
}) {
  const { t } = useTranslation();
  const wordpacks = useWordpacks();
  const selected =
    props.selectedWordpacks && props.selectedWordpacks.length > 0
      ? props.selectedWordpacks
      : [defaultWordpack];

  const toggleWordpack = (wordpackId: string) => {
    if (!props.canManageRoom) {
      return;
    }
    const next = selected.includes(wordpackId)
      ? selected.filter((id) => id !== wordpackId)
      : [...selected, wordpackId];
    if (next.length === 0) {
      return;
    }
    props.submitAction({ type: "set_wordpacks", wordpacks: next });
  };

  const selectOnlyWordpack = (wordpackId: string) => {
    if (!props.canManageRoom) {
      return;
    }
    props.submitAction({ type: "set_wordpacks", wordpacks: [wordpackId] });
  };

  if (!props.canManageRoom) {
    return (
      <p style={{ margin: 8 }}>
        {selected.join(", ")}
      </p>
    );
  }

  return (
    <fieldset
      style={{
        margin: 8,
        padding: props.compact ? 8 : 12,
        border: "1px solid #d1d5db",
        borderRadius: 8,
        textAlign: "left",
      }}
    >
      <legend style={{ fontWeight: 700 }}>
        {t("setupgame.wordpacks", "Wordpacks")}
      </legend>
      <div
        style={{
          display: "grid",
          gap: 8,
          gridTemplateColumns: props.compact
            ? "1fr"
            : "repeat(auto-fit, minmax(150px, 1fr))",
        }}
      >
        {wordpacks.map((wordpack) => {
          const checked = selected.includes(wordpack.id);
          return (
            <label
              key={wordpack.id}
              style={{ display: "flex", alignItems: "center", gap: 8 }}
              onDoubleClick={(event) => {
                event.preventDefault();
                selectOnlyWordpack(wordpack.id);
              }}
            >
              <input
                type="checkbox"
                checked={checked}
                disabled={checked && selected.length === 1}
                onChange={() => toggleWordpack(wordpack.id)}
              />
              {wordpack.name}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
