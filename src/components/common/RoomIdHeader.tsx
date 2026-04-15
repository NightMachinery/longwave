import { useParams } from "react-router-dom";
import { CenteredRow } from "./LayoutElements";
import {
  faCogs,
  faLink,
  faUserEdit,
  faUserPlus,
  faWandMagicSparkles,
} from "@fortawesome/free-solid-svg-icons";
import { faUndo } from "@fortawesome/free-solid-svg-icons";
import Tippy from "@tippyjs/react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useContext, useState } from "react";
import { GameModelContext } from "../../state/GameModelContext";
import { copyTextToClipboard } from "../../utils/copyTextToClipboard";
import {
  buildCanonicalRoomUrl,
  buildMigratedRoomUrl,
} from "../../utils/roomIdentity";
import { requestMigrationLink } from "../../network/roomApi";
import { useTranslation } from "react-i18next";

export function RoomIdHeader() {
  const { t } = useTranslation();
  const { roomId }: { [k: string]: any } = useParams();

  return (
    <CenteredRow
      style={{
        justifyContent: "flex-end",
        alignItems: "center",
        color: "gray",
      }}
    >
      <div style={{ margin: 4, padding: 4 }}>
        {t("roomidheader.roomid")} {roomId}
      </div>
      <Tippy content={<RoomMenu roomId={roomId} />} interactive placement="bottom-end">
        <div tabIndex={0} style={{ padding: 8 }}>
          <FontAwesomeIcon icon={faCogs} />
        </div>
      </Tippy>
    </CenteredRow>
  );
}

export function RoomMenu(props: { roomId: string }) {
  const { t } = useTranslation();
  const { gameState, setPlayerName, submitAction } = useContext(GameModelContext);
  const [copyStatus, setCopyStatus] = useState<
    "idle" | "room" | "migrate" | "error"
  >("idle");
  const canonicalRoomUrl = buildCanonicalRoomUrl(
    window.location.origin,
    props.roomId
  );

  const menuItemProps = {
    style: { margin: 8, cursor: "pointer" },
    tabIndex: 0,
  };

  const copyLink = async (text: string, successStatus: "room" | "migrate") => {
    const copied = await copyTextToClipboard(text);
    setCopyStatus(copied ? successStatus : "error");
  };

  const updateIntegerSetting = (field: "psychicCount" | "clueQuota", delta: number) => {
    const currentValue = gameState[field];
    const nextValue = Math.max(1, currentValue + delta);
    if (field === "psychicCount") {
      submitAction({ type: "set_psychic_count", psychicCount: nextValue });
    } else {
      submitAction({ type: "set_clue_quota", clueQuota: nextValue });
    }
  };

  return (
    <div>
      <div
        {...menuItemProps}
        onClick={() => {
          void copyLink(canonicalRoomUrl, "room");
        }}
      >
        <FontAwesomeIcon icon={faLink} /> {t("roomidheader.copy_room_link")}
      </div>
      <div
        {...menuItemProps}
        onClick={() => {
          void requestMigrationLink(props.roomId)
            .then((serverURL) => {
              const url = serverURL.startsWith("http")
                ? serverURL
                : buildMigratedRoomUrl(window.location.origin, props.roomId, serverURL);
              return copyLink(url, "migrate");
            })
            .catch(() => setCopyStatus("error"));
        }}
      >
        <FontAwesomeIcon icon={faUserPlus} /> {t("roomidheader.migrate_device")}
      </div>
      {gameState.viewer.canManageRoom && (
        <>
          <div style={{ margin: 8 }}>
            <FontAwesomeIcon icon={faWandMagicSparkles} /> Psychics: {gameState.psychicCount}
            <button type="button" onClick={() => updateIntegerSetting("psychicCount", -1)}>
              -
            </button>
            <button type="button" onClick={() => updateIntegerSetting("psychicCount", 1)}>
              +
            </button>
          </div>
          <div style={{ margin: 8 }}>
            Clue quota: {gameState.clueQuota}
            <button type="button" onClick={() => updateIntegerSetting("clueQuota", -1)}>
              -
            </button>
            <button type="button" onClick={() => updateIntegerSetting("clueQuota", 1)}>
              +
            </button>
          </div>
          <div {...menuItemProps} onClick={() => submitAction({ type: "reset_room" })}>
            <FontAwesomeIcon icon={faUndo} /> {t("roomidheader.reset_room")}
          </div>
        </>
      )}
      <div {...menuItemProps} onClick={() => setPlayerName("")}>
        <FontAwesomeIcon icon={faUserEdit} /> {t("roomidheader.change_name")}
      </div>
      {copyStatus === "room" && <div style={{ margin: 8 }}>{t("roomidheader.copy_room_link_success")}</div>}
      {copyStatus === "migrate" && (
        <div style={{ margin: 8 }}>{t("roomidheader.migrate_device_success")}</div>
      )}
      {copyStatus === "error" && (
        <div style={{ margin: 8 }}>{t("roomidheader.copy_link_failed")}</div>
      )}
    </div>
  );
}
