# Longwave game modes

This folder documents the gameplay modes available from the room setup screen.

## Available modes

- [Standard (Teams)](./standard-teams.md)
- [Cooperative](./cooperative.md)
- [Free Play](./free-play.md)

## Quick summary

| Mode | Recommended players | Teams? | Hidden target? | Guessing flow | Scoring |
| --- | --- | --- | --- | --- | --- |
| Standard (Teams) | 4+ | Yes | Yes | One team gives a clue, that team guesses, then the other team counter-guesses left, right, or exact | Race to 10 points |
| Cooperative | 2+ | No formal teams | Yes | One player clues, everyone else discusses and submits one shared guess | Shared score over a fixed number of rounds |
| Free Play | 2+ | No | Yes | One player clues, everyone else discusses and submits one shared guess | No running score |

## Notes for future feature work

The current codebase has mode-specific behavior mainly around:

- whether teams exist (`GameType.Teams`)
- whether counter-guessing exists
- whether the room shows team scores or a shared/free-play scoreboard
- who is allowed to act during clue and guess phases

That means new role features such as multiple psychics, representatives, observers, and moderators should be designed explicitly per mode rather than assumed to work everywhere.
