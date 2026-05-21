# Standard (Teams)

Standard mode is the classic competitive Longwave flow.

## Who it is for

- Best with 4 or more players
- Two teams: LEFT BRAIN and RIGHT BRAIN

## Round flow

1. Players join one of the two teams.
2. A clue-giver from one team is selected for the round.
3. That clue-giver sees the spectrum card and hidden target.
4. The clue-giver submits one clue.
5. Their own team makes the main guess.
6. The opposing team counter-guesses whether the target is left, right, or exactly on the main guess.
7. Scores are revealed.
8. The next round passes to the other team unless catch-up bonus-turn rules apply.

## Scoring

- Main guessing team earns 0-4 points based on distance from the target.
- Opposing team can earn 1 extra point for a correct counter-guess, including an exact guess when the main guess lands on the target.
- First team to 10 points wins.
- If a team scores a perfect 4-point round while still trailing, they get a bonus turn.

## Current implementation notes

- This is the only mode with explicit team membership.
- This is the only mode with counter-guessing.
- Most of the role ideas you requested naturally fit here first, because "psychic", "representative", and team-only permissions all map cleanly onto this mode.


## Moderator controls

- Only moderators may press **Start Game** during team setup.
- Team setup has a default-enabled random assignment option. It randomizes active players once when entering setup and keeps team counts balanced.
- New active joiners in team mode are automatically assigned to the smaller team, including mid-game joins.
- Moderators may press **Randomize Teams** during team setup, then manually adjust assignments.
- Moderators may force-assign any non-psychic joined player to LEFT BRAIN or RIGHT BRAIN before or during team-mode play.
- Moderators can configure how many shared prompt rerolls current psychics get each round. Moderators can still reroll prompts without using that limit.
