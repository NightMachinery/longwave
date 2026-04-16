import { useTranslation } from "react-i18next";
import { CenteredRow } from "./LayoutElements";

export function CommonFooter() {
  const { t } = useTranslation();

  return (
    <CenteredRow
      style={{
        paddingTop: 8,
        borderTop: "1px solid black",
        color: "gray",
        fontSize: "small",
        justifyContent: "center",
      }}
    >
      <p style={{ margin: 8, textAlign: "center" }}>
        {t("commonfooter.open_source")}{" "}
        <a href="https://github.com/cynicaloptimist/longwave" target="_blank" rel="noopener noreferrer">
          GitHub
        </a>
      </p>
    </CenteredRow>
  );
}
