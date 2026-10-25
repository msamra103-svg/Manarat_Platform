# Integration review — 2026-10-25

Integrated from the user-supplied Claude overlay onto current main bc3c636, rather than replacing current platform files with the overlay's older versions.

## Corrections during integration
- The supplied school.js predates the current design studio and homepage polish. Only the football-question class change was merged.
- The replaced football.css was also loaded by basketball, volleyball, fishing and puzzle. Its original contents are retained byte-for-byte as games/sports/legacy-sport.css, and those four entry points use it. Their game engines are unchanged.
- Only the appended football-specific game-session.css rules and test:football package script were adopted.
- Existing README, dependencies, lockfile, backend, authentication and all deployment settings were preserved.
- All public mirrors are regenerated through the existing build.
- CI covers school/race regressions plus the new standalone and embedded football tests. The integration test also explicitly rejects invalid message origin, source and index, in addition to token checks.

The supplied FOOTBALL_* documents record the author's original work and QA, not independent integration verification. Do not use the original guide's bulk overlay copy command against a newer platform: it would overwrite unrelated improvements.

Local verification: build/syntax/reference/mirror check; football physics and 90 randomized outcomes; shared sports; homepage/analytics unit tests; game session and navigation; volleyball/fishing/puzzle/classic and bowling tests passed. Browser verification is run in GitHub Actions. No live student data is used by these tests.

Limitations: the players are rigged stylized human models, not photoreal scans. The original arena is inspired by Gulf venues. No real phone GPU, touch hardware or audio listening test is claimed. No database or environment changes are needed.
