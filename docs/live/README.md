# Live classroom competitions

Teacher entry: `live.html?host=1`, also linked from the school workspace and each active assignment. Student entry: `live.html`, six-digit code or locally generated QR URL.

## Delivered scope

- Teacher-owned sessions, lobby, up to 80 participant capabilities, joining lock, countdown, timed MC/true-false questions, pause/resume, reveal, manual/automatic advancement, early finish, ranked podium, saved session list and detailed CSV.
- Existing assignments and question-type restrictions are reused. Unsupported/manual questions are excluded and the count is shown before the teacher starts. The original assignment is never modified.
- Server clock and serialized Postgres transactions decide deadlines, transitions, first answer and scoring. Default points: 1000 per correct answer. Optional speed points: 500–1000 per correct answer, excluding paused time. Educational grade: weighted correct points divided by total selected-question points; unanswered questions are zero. Equal competition points share a rank.
- Student answers and rank changes for the current question stay hidden until reveal. Future questions/answers and participant secrets are not returned.
- Browser polls every 1.5 seconds with bounded retry backoff; a three-second countdown aligns clients. This is synchronized classroom play, not a frame-synchronized sports engine. Reconnection uses a random 256-bit browser-stored capability; only its SHA-256 hash is stored server-side. No student account is required. Shared devices/browsers should use separate profiles if participating as different students.
- Names and rankings are visible only to session participants and the authorized host, not on the public homepage. Teacher session reports are a dedicated record, separate from regular assignment attempts and weekly rankings.
- Session admission expires after six hours; state requests close expired sessions. Historical results remain available. No automatic deletion of student records was introduced.

## Security and deployment

Apply `supabase/migrations/*_live_classroom_sessions.sql` before deploying `supabase/functions/live-api/index.ts`. The function performs its own verified user authentication for host operations and capability validation for guests; deploy with `verify_jwt=false` to permit student code entry. The existing school-api is unchanged.

All three live tables use RLS and have no anon/authenticated grants. The security-invoker RPC is callable only by service_role. Existing platform grants are made explicit without adding public access to student records. SQL queries serialize on a room row; a server timestamp is taken after the lock. No client score, role or timestamp is trusted. New sessions are capped at five active per host, and API calls are rate limited.

The three live tables intentionally have no client RLS policies: clients never access them directly. Supabase's `rls_enabled_no_policy` informational notice is expected, not a reason to add public policies.

Frontend: run `npm run build` to regenerate public assets, including live.html. Do not manually deploy only root files. Keep the latest basketball and football runtimes unchanged.

## Verification

`node tests/live-db.cjs` executes the real migration/RPC under PGlite, including ownership, grants, server deadlines, duplicate/stale calls, pause, automatic transitions, speed points, manual-question exclusion, weighted grade and kick/reconnect.

`node tests/live-api.cjs` checks token authentication and rejects client identity/score injection.

`node tests/live-browser.cjs` exercises the real frontend with a teacher and two independent student contexts, backed by the SQL RPC in PGlite. It uses test API transport; production authentication is not mocked in the deployed code. Screenshots and CSV are produced in CI. Physical phones and a real 80-student classroom load test are not claimed.

Third-party QR renderer: qrcode-generator 1.4.4 by Kazuhiko Arase (MIT), bundled locally in js/vendor. No participant information is sent to a QR image service.

## Automatic question-winner celebrations

When a question ends (timeout or the teacher's close action), its question and choices disappear. An eight-second stage shows the name and selected avatar of the fastest correct respondent, with local fanfare, lights and confetti. The server uses that question's recorded `elapsed_ms`, regardless of the cumulative ranking or whether speed-bonus scoring is enabled. Exact ties share the stage; a round without correct answers shows encouragement and the correct answer without naming a winner. Answer keys and winner data remain hidden until reveal.

New sessions have automatic advancement enabled by default. The teacher can turn it off when creating a session; existing sessions keep their saved setting. In automatic mode the server advances to the next question after the celebration, or to the final podium after the last question. The teacher's “تجاوز الاحتفال” button advances immediately; stale/repeated controls cannot skip an extra question. Students see the same winners and cannot skip. Reconnection does not restart the server deadline or replay the fanfare.

The final 3–2–1 podium still stays open until the teacher closes it. Sound preferences, question countdown cues, scoring, CSV reports and the original game name remain unchanged.

Apply the `live_round_celebration` migration before publishing the frontend. It replaces the existing security-invoker RPC, keeps table access private and includes explicit service-role grants. No Edge Function change is required. `npm run test:live` runs the SQL, API-boundary and browser regressions, including automatic transition, skip, winner correctness, tied/empty rounds, phone/desktop/fullscreen layouts and the persistent final podium.
