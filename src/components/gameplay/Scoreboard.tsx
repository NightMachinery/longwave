import React, { useState, useContext } from "react";
import { GameType, Team, TeamName } from "../../state/GameState";
import { CenteredRow, CenteredColumn } from "../common/LayoutElements";
import { GameModelContext } from "../../state/GameModelContext";
import { Button } from "../common/Button";
import { useTranslation } from "react-i18next";

export function Scoreboard() {
  const { t } = useTranslation();
  const { gameState } = useContext(GameModelContext);

  const style = {
    borderTop: "1px solid black",
    margin: 16,
    paddingTop: 16,
    alignItems: "center",
  };

  const observers = Object.keys(gameState.players).filter(
    (playerId) => gameState.players[playerId].isObserver
  );

  return (
    <CenteredColumn style={style}>
      {gameState.gameType === GameType.Freeplay && <em>{t("scoreboard.free_play")}</em>}
      {gameState.gameType === GameType.Cooperative && (
        <>
          <em>
            {t("scoreboard.coop_score")}: {gameState.coopScore} {t("scoreboard.points")}
          </em>
          <div>
            {t("scoreboard.card_remaining")}: {7 + gameState.coopBonusTurns - gameState.turnsTaken}
          </div>
        </>
      )}
      {gameState.gameType === GameType.Teams ? (
        <CenteredRow style={{ width: "100%", alignItems: "flex-start" }}>
          <TeamColumn team={Team.Left} score={gameState.leftScore} />
          <TeamColumn team={Team.Right} score={gameState.rightScore} />
        </CenteredRow>
      ) : (
        <CenteredRow style={{ flexWrap: "wrap" }}>
          {Object.keys(gameState.players)
            .filter((playerId) => !gameState.players[playerId].isObserver)
            .map((playerId) => (
              <PlayerRow key={playerId} playerId={playerId} />
            ))}
        </CenteredRow>
      )}
      {observers.length > 0 && (
        <CenteredColumn style={{ alignItems: "flex-start", marginTop: 12 }}>
          <div>{t("scoreboard.observers", "Observers")}</div>
          {observers.map((playerId) => (
            <PlayerRow key={playerId} playerId={playerId} />
          ))}
        </CenteredColumn>
      )}
    </CenteredColumn>
  );
}

function TeamColumn(props: { team: Team; score: number }) {
  const { t } = useTranslation();
  const { gameState } = useContext(GameModelContext);

  const members = Object.keys(gameState.players).filter(
    (playerId) =>
      gameState.players[playerId].team === props.team &&
      !gameState.players[playerId].isObserver
  );

  return (
    <CenteredColumn style={{ alignItems: "flex-start" }}>
      <div>
        {TeamName(props.team, t)}: <strong>{props.score}</strong> {t("scoreboard.points")}
      </div>
      {members.map((playerId) => (
        <PlayerRow key={playerId} playerId={playerId} />
      ))}
    </CenteredColumn>
  );
}

function PlayerRow(props: { playerId: string }) {
  const { gameState, localPlayer, submitAction } = useContext(GameModelContext);
  const player = gameState.players[props.playerId];
  const [expanded, setExpanded] = useState(false);
  const isCreator = props.playerId === gameState.creatorId;
  const badges = [
    player.isModerator ? "M" : null,
    player.isRepresentative ? "R" : null,
    player.isObserver ? "O" : null,
    gameState.psychicIds.includes(props.playerId) ? "P" : null,
    gameState.viewer.playerId === props.playerId && gameState.viewer.isTemporaryRep ? "T" : null,
  ].filter(Boolean);

  return (
    <div style={{ marginLeft: 16, display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
      <div
        style={{ cursor: gameState.viewer.canManageRoom ? "pointer" : "default" }}
        onClick={() => gameState.viewer.canManageRoom && setExpanded(!expanded)}
      >
        {player.name} {badges.length > 0 ? `[${badges.join(",")}]` : ""}
        {isCreator ? " ★" : ""}
        {localPlayer.id === props.playerId ? " (you)" : ""}
      </div>
      {expanded && gameState.viewer.canManageRoom && props.playerId !== localPlayer.id && (
        <div style={{ display: "flex", flexWrap: "wrap" }}>
          <Button
            text={player.isRepresentative ? "Unset rep" : "Make rep"}
            onClick={() =>
              submitAction({
                type: "set_representative",
                playerId: props.playerId,
                value: !player.isRepresentative,
              })
            }
          />
          <Button
            text={player.isObserver ? "Rejoin" : "Observe"}
            onClick={() =>
              submitAction({
                type: "set_observer",
                playerId: props.playerId,
                value: !player.isObserver,
              })
            }
          />
          {gameState.gameType === GameType.Teams && !player.isObserver && (
            <>
              <Button
                text="Left team"
                onClick={() =>
                  submitAction({
                    type: "set_team",
                    playerId: props.playerId,
                    team: Team.Left,
                  })
                }
                disabled={player.team === Team.Left}
              />
              <Button
                text="Right team"
                onClick={() =>
                  submitAction({
                    type: "set_team",
                    playerId: props.playerId,
                    team: Team.Right,
                  })
                }
                disabled={player.team === Team.Right}
              />
            </>
          )}
          <Button
            text={player.isModerator ? "Demote mod" : "Promote mod"}
            onClick={() =>
              submitAction({
                type: "set_moderator",
                playerId: props.playerId,
                value: !player.isModerator,
              })
            }
            disabled={isCreator}
          />
        </div>
      )}
    </div>
  );
}
