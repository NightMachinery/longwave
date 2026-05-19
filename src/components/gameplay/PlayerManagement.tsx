import React, { ReactNode, useContext } from "react";
import { useTranslation } from "react-i18next";
import { RoomAction } from "../../network/roomApi";
import { GameModelContext } from "../../state/GameModelContext";
import { GameType, Team, TeamName } from "../../state/GameState";
import { Button } from "../common/Button";

const cardStyle: React.CSSProperties = {
  width: "100%",
  border: "1px solid #d1d5db",
  borderRadius: 16,
  padding: 12,
  backgroundColor: "#ffffff",
  boxSizing: "border-box",
};

const chipStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  padding: "4px 8px",
  borderRadius: 999,
  backgroundColor: "#f3f4f6",
  color: "#374151",
  fontSize: 12,
  fontWeight: 700,
};

export function PlayerManagementCard(props: {
  playerId: string;
  showTeamSelector?: boolean;
  submitAction: (action: RoomAction) => void;
}) {
  const { t } = useTranslation();
  const { gameState, localPlayer } = useContext(GameModelContext);
  const player = gameState.players[props.playerId];
  const isLocalPlayer = props.playerId === localPlayer.id;
  const isCreator = props.playerId === gameState.creatorId;
  const canManageRoom = gameState.viewer.canManageRoom;
  const canSelfRejoin = isLocalPlayer && player?.isObserver;
  const isCurrentPsychic = gameState.psychicIds.includes(props.playerId);

  if (!player) {
    return null;
  }

  const badges = [
    isCreator ? t("playercard.creator", "Creator") : null,
    isLocalPlayer ? t("playercard.you", "You") : null,
    player.isModerator ? t("playercard.moderator", "Moderator") : null,
    player.isRepresentative ? t("playercard.representative", "Representative") : null,
    player.isObserver ? t("playercard.observer", "Observer") : null,
    gameState.psychicIds.includes(props.playerId) ? t("playercard.psychic", "Psychic") : null,
    gameState.viewer.playerId === props.playerId && gameState.viewer.isTemporaryRep
      ? t("playercard.temporary_rep", "Temporary rep")
      : null,
  ].filter((value): value is string => Boolean(value));

  const showTeamSelector =
    (props.showTeamSelector || canManageRoom) &&
    gameState.gameType === GameType.Teams &&
    !isCurrentPsychic &&
    (!player.isObserver || canManageRoom);

  return (
    <div
      data-testid={`player-card-${props.playerId}`}
      style={{
        ...cardStyle,
        backgroundColor: player.isObserver ? "#f9fafb" : "#ffffff",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 8,
          flexWrap: "wrap",
        }}
      >
        <div>
          <div style={{ fontWeight: 700, color: "#111827" }}>{player.name}</div>
          <div style={{ color: "#6b7280", fontSize: 14 }}>
            {player.isObserver
              ? t("playercard.observing", "Watching this room")
              : gameState.gameType === GameType.Teams
                ? TeamName(player.team, t)
                : t("playercard.active_player", "Active player")}
          </div>
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
          {badges.map((badge) => (
            <span key={badge} style={chipStyle}>
              {badge}
            </span>
          ))}
        </div>
      </div>

      {showTeamSelector && (
        <div style={{ marginTop: 12 }}>
          <div style={{ marginBottom: 6, fontSize: 13, color: "#4b5563", fontWeight: 600 }}>
            {t("playercard.team_assignment", "Team")}
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <Button
              text={TeamName(Team.Left, t)}
              compact
              variant={player.team === Team.Left ? "selected" : "secondary"}
              onClick={() =>
                props.submitAction({
                  type: "set_team",
                  playerId: props.playerId,
                  team: Team.Left,
                })
              }
              disabled={player.team === Team.Left}
            />
            <Button
              text={TeamName(Team.Right, t)}
              compact
              variant={player.team === Team.Right ? "selected" : "secondary"}
              onClick={() =>
                props.submitAction({
                  type: "set_team",
                  playerId: props.playerId,
                  team: Team.Right,
                })
              }
              disabled={player.team === Team.Right}
            />
          </div>
        </div>
      )}

      {(canManageRoom || canSelfRejoin) && (
        <div style={{ marginTop: 12, display: "flex", gap: 6, flexWrap: "wrap" }}>
          {canManageRoom && (
            <Button
              text={
                player.isRepresentative
                  ? t("playercard.remove_rep", "Remove rep")
                  : t("playercard.make_rep", "Make rep")
              }
              compact
              variant={player.isRepresentative ? "selected" : "secondary"}
              onClick={() =>
                props.submitAction({
                  type: "set_representative",
                  playerId: props.playerId,
                  value: !player.isRepresentative,
                })
              }
            />
          )}
          <Button
            text={
              player.isObserver
                ? t("playercard.rejoin", "Rejoin")
                : t("playercard.observe", "Observe")
            }
            compact
            variant="ghost"
            onClick={() =>
              props.submitAction({
                type: "set_observer",
                playerId: props.playerId,
                value: !player.isObserver,
              })
            }
            disabled={!canManageRoom && !canSelfRejoin}
          />
          {!isLocalPlayer && (
            <Button
              text={
                player.isModerator
                  ? t("playercard.demote_mod", "Demote mod")
                  : t("playercard.promote_mod", "Promote mod")
              }
              compact
              variant="ghost"
              onClick={() =>
                props.submitAction({
                  type: "set_moderator",
                  playerId: props.playerId,
                  value: !player.isModerator,
                })
              }
              disabled={isCreator}
            />
          )}
        </div>
      )}
    </div>
  );
}

export function SectionTitle(props: { children: ReactNode }) {
  return (
    <div style={{ fontWeight: 700, color: "#111827", marginBottom: 8, width: "100%" }}>
      {props.children}
    </div>
  );
}
