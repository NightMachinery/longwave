# Roles, clue quota, and secure room sessions

Longwave now supports server-enforced room roles and filtered hidden information.

## Room roles

- **Moderator**
  - The first player to join a room becomes the creator and a moderator.
  - Creator status is permanent for that room.
  - Moderators can change mode, reset the room, change psychic/clue settings, promote or demote moderators, mark representatives, and move players into or out of observer mode.
- **Representative**
  - Representatives are optional.
  - If a relevant acting pool has no representatives, everyone in that pool can submit the guess.
  - If representatives exist, only they can submit the guess for that pool.
  - If an assigned representative is unavailable because they are currently a psychic or observer, Longwave derives a temporary replacement for that phase.
- **Observer**
  - Observers stay in the room but are removed from active play.
  - They keep their stored team, moderator, and representative flags while observing.
  - Moderators retain moderator powers even while observing.
- **Psychic**
  - Psychics are chosen randomly each round from the eligible active player pool.
  - Team mode picks psychics from the acting team; Cooperative and Free Play pick from the whole active room.

## Psychic count and clue quota

Moderators can change two room-wide settings from the room menu:

- **Psychic count**: how many psychics are chosen for each round.
- **Clue quota (`k`)**: how many total clues the room waits for before guessing starts.

Rules:

- Each psychic may submit at most one clue.
- The effective clue quota is `min(k, eligible psychics this round)`.
- Non-psychics do not see clues until the clue quota has been satisfied.
- Once the quota is reached, clue submission is closed for the round.

## Hidden information

The backend now filters room views per player session:

- Current psychics can see the round target during clueing.
- Non-psychics cannot.
- Once the score/reveal phase is reached, everyone can see the target.

## Session and migration model

Room access now uses a room-scoped server session cookie instead of the older `roomAuth` URL-sharing model.

- **Copy room link** shares the clean room URL.
- **Migrate device** asks the server for a one-time migration link.
- Opening that migration link on another device transfers the same in-room identity there.
