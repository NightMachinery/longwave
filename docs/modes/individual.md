# Individual

Individual mode keeps the hidden-target / clue / guess structure, but each non-clue-giver guesses separately.

## Who it is for

- Works with 2 or more active players
- Best when players want individual accountability instead of a shared team discussion
- Observers can watch without affecting scores or the win condition

## Round flow

1. One clue-giver is selected from active non-observer players.
2. The clue-giver sees the spectrum card and hidden target.
3. The clue-giver submits one clue.
4. Every other active non-observer submits a private guess.
5. The answer is revealed with each guesser's score.
6. Each guesser receives their own guess score, and the clue-giver receives the average of all guesser scores for the round.

## Scoring

- Each guess is worth 0-4 points based on distance from the target.
- Guessers receive the points earned by their own guess.
- The clue-giver's round score is the average of all active guessers' scores.
- Zero-point guesses count in the average.
- Observers do not submit guesses and do not count toward the average.
- Scores are displayed with one decimal place.

## Win condition

- Moderators can set **Rounds as clue giver** from the game settings menu.
- New Individual games default this target to 3.
- The game ends when every current active non-observer has been clue-giver at least that many times.
- Late active joiners count toward the condition; observers do not.
- The active player or players with the highest total score win.

## Current implementation notes

- Individual mode always uses one clue-giver and one clue per round.
- The existing psychic count and clue quota settings are ignored for Individual rounds.
- Submitted guesses stay private during the guessing phase; other players only see that a guess was submitted.
- By default, clue-givers see live colored dot markers for each active guesser while guesses move. The same per-player color appears on active player cards. Moderators can disable the live moving dots with **Clue givers see players guessing in real-time**.
- During guessing, active player-card dots get a red outer ring with a white band while that player still needs to submit a guess.
- All guesses are revealed during the score phase.
