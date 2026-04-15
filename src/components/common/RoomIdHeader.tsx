import { useParams } from "react-router-dom";
import { CenteredRow } from "./LayoutElements";
import {
  faCogs,
  faLink,
  faRightLeft,
  faUserEdit,
} from "@fortawesome/free-solid-svg-icons";
import { faUndo } from "@fortawesome/free-solid-svg-icons";
import Tippy from "@tippyjs/react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useContext, useMemo, useState } from "react";
import { GameModelContext } from "../../state/GameModelContext";
import { InitialGameState } from "../../state/GameState";
import { copyTextToClipboard } from "../../utils/copyTextToClipboard";
import {
  buildCanonicalRoomUrl,
  buildMigratedRoomUrl,
  resolveRoomIdentity,
} from "../../utils/roomIdentity";

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
  const { t, i18n } = useTranslation();
  const { setGameState, setPlayerName } = useContext(GameModelContext);
  const [copyStatus, setCopyStatus] = useState<"idle" | "room" | "migrate" | "error">(
    "idle"
  );
  const roomIdentity = useMemo(
    () => resolveRoomIdentity(localStorage, props.roomId, window.location.search),
    [props.roomId]
  );
  const canonicalRoomUrl = buildCanonicalRoomUrl(
    window.location.origin,
    props.roomId
  );
  const migratedRoomUrl = buildMigratedRoomUrl(
    window.location.origin,
    props.roomId,
    roomIdentity.effectiveRoomAuthId
  );

  const menuItemProps = {
    style: { margin: 8, cursor: "pointer" },
    tabIndex: 0,
  };

  const copyLink = async (text: string, successStatus: "room" | "migrate") => {
    const copied = await copyTextToClipboard(text);
    setCopyStatus(copied ? successStatus : "error");
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
          void copyLink(migratedRoomUrl, "migrate");
        }}
      >
        <FontAwesomeIcon icon={faRightLeft} /> {t("roomidheader.migrate_device")}
      </div>
      <div
        {...menuItemProps}
        onClick={() => setGameState(InitialGameState(i18n.language))}
      >
        <FontAwesomeIcon icon={faUndo} /> {t("roomidheader.reset_room")}
      </div>
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
