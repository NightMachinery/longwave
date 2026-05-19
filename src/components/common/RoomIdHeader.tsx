import { CenteredColumn, CenteredRow } from "./LayoutElements";
import {
  faArrowsRotate,
  faCogs,
  faLink,
  faRotateLeft,
  faShuffle,
  faUserEdit,
  faUserPlus,
  faUserCheck,
  faWandMagicSparkles,
  faSliders,
} from "@fortawesome/free-solid-svg-icons";
import Tippy from "@tippyjs/react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useCallback, useContext, useEffect, useMemo, useState } from "react";
import { GameModelContext } from "../../state/GameModelContext";
import { copyTextToClipboard } from "../../utils/copyTextToClipboard";
import { buildCanonicalRoomUrl, buildMigratedRoomUrl } from "../../utils/roomIdentity";
import { requestMigrationLink } from "../../network/roomApi";
import { RoundPhase } from "../../state/GameState";
import { useTranslation } from "react-i18next";
import { useWordpacks } from "../hooks/useWordpacks";

type Notice = {
  kind: "success" | "error";
  message: string;
} | null;

function useTransientNotice() {
  const [notice, setNotice] = useState<Notice>(null);

  useEffect(() => {
    if (notice === null) {
      return;
    }
    const timeoutId = window.setTimeout(() => setNotice(null), 2600);
    return () => window.clearTimeout(timeoutId);
  }, [notice]);

  return [notice, setNotice] as const;
}

function HeaderNotice(props: { notice: Notice }) {
  if (props.notice === null) {
    return null;
  }

  return (
    <div
      role="status"
      style={{
        alignSelf: "flex-end",
        marginTop: 8,
        padding: "8px 12px",
        borderRadius: 12,
        backgroundColor: props.notice.kind === "success" ? "#ecfdf5" : "#fef2f2",
        color: props.notice.kind === "success" ? "#065f46" : "#991b1b",
        border: `1px solid ${props.notice.kind === "success" ? "#a7f3d0" : "#fecaca"}`,
        boxShadow: "0 8px 20px rgba(15, 23, 42, 0.08)",
        fontSize: 14,
        fontWeight: 600,
      }}
    >
      {props.notice.message}
    </div>
  );
}

export function RoomIdHeader() {
  const { t } = useTranslation();
  const { gameState } = useContext(GameModelContext);
  const [notice, setNotice] = useTransientNotice();

  const canonicalRoomUrl = useMemo(
    () => buildCanonicalRoomUrl(window.location.origin, gameState.roomId),
    [gameState.roomId]
  );

  const showCopyNotice = useCallback(
    async (text: string, successMessage: string) => {
      const copied = await copyTextToClipboard(text);
      setNotice({
        kind: copied ? "success" : "error",
        message: copied ? successMessage : t("roomidheader.copy_link_failed"),
      });
    },
    [setNotice, t]
  );

  return (
    <CenteredColumn style={{ alignItems: "stretch" }}>
      <CenteredRow
        style={{
          justifyContent: "flex-end",
          alignItems: "center",
          color: "gray",
        }}
      >
        <button
          type="button"
          onClick={() => {
            void showCopyNotice(canonicalRoomUrl, t("roomidheader.copy_room_link_success"));
          }}
          style={{
            margin: 4,
            padding: 4,
            background: "transparent",
            border: "none",
            color: "inherit",
            cursor: "pointer",
            borderRadius: 8,
            fontWeight: 600,
          }}
        >
          {t("roomidheader.roomid")} {gameState.roomId}
        </button>
        <Tippy
          content={
            <RoomMenu
              roomId={gameState.roomId}
              canonicalRoomUrl={canonicalRoomUrl}
              showCopyNotice={showCopyNotice}
              showNotice={setNotice}
            />
          }
          interactive
          placement="bottom-end"
        >
          <div tabIndex={0} style={{ padding: 8 }}>
            <FontAwesomeIcon icon={faCogs} />
          </div>
        </Tippy>
      </CenteredRow>
      <HeaderNotice notice={notice} />
    </CenteredColumn>
  );
}

export function RoomMenu(props: {
  roomId: string;
  canonicalRoomUrl: string;
  showCopyNotice: (text: string, successMessage: string) => Promise<void>;
  showNotice: (notice: Notice) => void;
}) {
  const { t } = useTranslation();
  const { gameState, localPlayer, openNameEditor, submitAction } = useContext(GameModelContext);
  const [isEditingGameSettings, setIsEditingGameSettings] = useState(false);

  const menuItemProps = {
    style: { margin: 8, cursor: "pointer" },
    tabIndex: 0,
  };


  const canRerollPrompt =
    gameState.viewer.canRerollRound &&
    gameState.roundPhase === RoundPhase.GiveClue &&
    gameState.clues.length === 0;

  if (isEditingGameSettings) {
    return <GameSettingsPanel onBack={() => setIsEditingGameSettings(false)} />;
  }

  return (
    <div>
      <div
        {...menuItemProps}
        onClick={() => {
          void props.showCopyNotice(
            props.canonicalRoomUrl,
            t("roomidheader.copy_room_link_success")
          );
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
              return props.showCopyNotice(url, t("roomidheader.migrate_device_success"));
            })
            .catch(() =>
              props.showNotice({
                kind: "error",
                message: t("roomidheader.copy_link_failed"),
              })
            );
        }}
      >
        <FontAwesomeIcon icon={faUserPlus} /> {t("roomidheader.migrate_device")}
      </div>
      {gameState.viewer.canManageRoom && (
        <>
          <div {...menuItemProps} onClick={() => setIsEditingGameSettings(true)}>
            <FontAwesomeIcon icon={faSliders} /> {t("roomidheader.game_settings", "Game settings")}
          </div>
          <div {...menuItemProps} onClick={() => submitAction({ type: "play_again" })}>
            <FontAwesomeIcon icon={faArrowsRotate} /> {t("roomidheader.play_again")}
          </div>
        </>
      )}
      {canRerollPrompt && (
        <div {...menuItemProps} onClick={() => submitAction({ type: "reroll_round" })}>
          <FontAwesomeIcon icon={faShuffle} /> {t("roomidheader.reroll_prompt")}
        </div>
      )}
      {localPlayer.isObserver && (
        <div
          {...menuItemProps}
          onClick={() => submitAction({ type: "set_observer", playerId: localPlayer.id, value: false })}
        >
          <FontAwesomeIcon icon={faUserCheck} /> {t("playercard.rejoin", "Rejoin")}
        </div>
      )}
      {gameState.viewer.canManageRoom && (
        <>
          <div {...menuItemProps} onClick={() => submitAction({ type: "reset_room" })}>
            <FontAwesomeIcon icon={faRotateLeft} /> {t("roomidheader.reset_room")}
          </div>
          <div {...menuItemProps} onClick={() => submitAction({ type: "reset_room_id" })}>
            <FontAwesomeIcon icon={faLink} /> {t("roomidheader.reset_room_id")}
          </div>
        </>
      )}
      <div {...menuItemProps} onClick={openNameEditor}>
        <FontAwesomeIcon icon={faUserEdit} /> {t("roomidheader.change_name")}
      </div>
    </div>
  );
}

function GameSettingsPanel(props: { onBack: () => void }) {
  const { t } = useTranslation();
  const { gameState, submitAction } = useContext(GameModelContext);
  const wordpacks = useWordpacks();

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
    <div style={{ minWidth: 240 }}>
      <div style={{ margin: 8, fontWeight: 700 }}>
        <FontAwesomeIcon icon={faSliders} /> {t("roomidheader.game_settings", "Game settings")}
      </div>
      <label style={{ display: "block", margin: 8 }} htmlFor="header-wordpack-select">
        {t("roomidheader.wordpack", "Wordpack")}
      </label>
      <select
        id="header-wordpack-select"
        value={gameState.wordpack}
        onChange={(event) => submitAction({ type: "set_wordpack", wordpack: event.target.value })}
        style={{ margin: 8, padding: 6, borderRadius: 8, width: "calc(100% - 16px)" }}
      >
        {wordpacks.map((wordpack) => (
          <option key={wordpack.id} value={wordpack.id}>
            {wordpack.name}
          </option>
        ))}
      </select>
      <div style={{ margin: 8 }}>
        <FontAwesomeIcon icon={faWandMagicSparkles} /> {t("roomidheader.psychics")}: {gameState.psychicCount}
        <button type="button" onClick={() => updateIntegerSetting("psychicCount", -1)}>
          -
        </button>
        <button type="button" onClick={() => updateIntegerSetting("psychicCount", 1)}>
          +
        </button>
      </div>
      <div style={{ margin: 8 }}>
        {t("roomidheader.clue_quota", "Clue quota")}: {gameState.clueQuota}
        <button type="button" onClick={() => updateIntegerSetting("clueQuota", -1)}>
          -
        </button>
        <button type="button" onClick={() => updateIntegerSetting("clueQuota", 1)}>
          +
        </button>
      </div>
      <div style={{ margin: 8, cursor: "pointer" }} tabIndex={0} onClick={props.onBack}>
        {t("roomidheader.back", "Back")}
      </div>
    </div>
  );
}
