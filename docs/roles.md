# Roles, clue quota, and secure room sessions

Longwave now supports server-enforced room roles and filtered hidden information.

## Room roles

- **Moderator**
  - The first player to join a room becomes the creator and a moderator.
  - Creator status is permanent for that room.
  - Moderators can change mode, start team games, reset the room, change psychic/clue/team-randomization settings, promote or demote moderators, mark representatives, move players into or out of observer mode, and force-assign non-psychic players to either team.
  - Moderators can also manage their own representative, observer, and team state from the player-management UI.
- **Representative**
  - Representatives are optional.
  - If a relevant acting pool has no representatives, everyone in that pool can submit the guess.
  - If representatives exist, only they can submit the guess for that pool.
  - If an assigned representative is unavailable because they are currently a psychic or observer, Longwave derives a temporary replacement for that phase. Only the representative or derived temporary replacement may move and submit the guess while representative restrictions are active.
- **Observer**
  - Observers stay in the room but are removed from active play.
  - They keep their stored team, moderator, and representative flags while observing.
  - Observers can rejoin active play by themselves.
  - Moderators retain moderator powers even while observing.
- **Psychic / clue-giver**
  - Psychics are chosen from the eligible active player pool, preferring players who have been psychic the fewest times in the current game and randomizing only within ties.
  - Team mode picks psychics from the acting team; Cooperative and Free Play pick from the whole active room.
  - Individual mode always picks one clue-giver from active non-observers, preferring players who have been clue-giver the fewest times.

## Psychic count and clue quota

Moderators can change two room-wide settings from the room menu:

- **Psychic count**: how many psychics are chosen for each round.
- **Clue quota (`k`)**: how many total clues the room waits for before guessing starts.
- **Rounds as clue giver**: Individual-mode target for how many times every active player must become clue-giver before the game ends.
- **Clue givers see players guessing in real-time**: Individual-mode visibility setting for live colored guess markers during the guessing phase.

Rules:

- Each psychic may submit at most one clue.
- The effective clue quota is `min(k, eligible psychics this round)`.
- Non-psychics do not see clues until the clue quota has been satisfied.
- Once the quota is reached, clue submission is closed for the round.
- Individual mode ignores psychic count and clue quota and always uses one clue-giver and one clue.

## Hidden information

The backend now filters room views per player session:

- Current psychics can see the round target during clueing and continue to see the true target during guessing and counter-guessing, with a distinct private marker.
- Non-psychics cannot see the true target before reveal.
- Once the score/reveal phase is reached, everyone can see the target.

## Session and migration model

Room access now uses a room-scoped server session cookie instead of the older `roomAuth` URL-sharing model. The client joins the room before it opens authenticated event streams.

- **Copy room link** shares the clean room URL.
- **Migrate device** asks the server for a one-time migration link.
- Opening that migration link on another device transfers the same in-room identity there.
- **Reroll prompt** is available to moderators and current psychics during clueing before any clue is submitted; it draws new spectrum labels while keeping the current psychics and true target.
- **Reroll Target** is available only to moderators during clueing before any clue is submitted; it draws a new true target while keeping the current prompt labels.
- **Play Again** resets the current game while preserving the room, creator, player list, room settings, and a summary of the previous winner/score.
- **Reset Room ID** rotates the join code so the old public link stops accepting new joins.
