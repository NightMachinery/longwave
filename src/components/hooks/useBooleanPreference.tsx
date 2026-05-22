import { useState } from "react";
import { readBooleanPreference, writeBooleanPreference } from "../../utils/localPreferences";

export function useBooleanPreference(
  key: string,
  defaultValue: boolean
): [boolean, (value: boolean) => void] {
  const [value, setValue] = useState(() => readBooleanPreference(localStorage, key, defaultValue));

  return [
    value,
    (nextValue: boolean) => {
      writeBooleanPreference(localStorage, key, nextValue);
      setValue(nextValue);
    },
  ];
}
