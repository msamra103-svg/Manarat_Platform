# V21 review build

Existing repository: msamra103-svg/Manarat_Platform. Production output is public/, generated from root sources by scripts/sync-public.js. This branch incorporates main commit 221a7d5 including Champions Race V8 and its build-time asset unpacking.

## Implemented
- Shared Qatar theme contract, light/dark/premium presets, responsive RTL homepage, compact game gallery, cinematic hero, real weekly rankings and aggregate charts.
- Persistent administrator design studio: theme controls, section drag/drop and visibility, safe navigation destinations, game ordering/covers, branding uploads, school photograph focal point, four video layouts, actual-page iframe preview, revision conflict protection and restore history.
- Existing teacher/admin tools and game eligibility remain in place. Puzzle is assignment-only. Public video publication is explicit; empty analytics do not fabricate students or results.
- Branding uses supplied assets only. Upload an authentic ministry logo and verified school photograph in the studio; no invented building or reconstructed official artwork is displayed by default.

## Review deployment isolation
The frontend uses school-api-v21-preview on the EXISTING Supabase project yltlzogrhwvnmxcnaesu. That function uses school_design_studio for design settings; production school_settings and school-api remain separate. Other authenticated administrative and learning operations still use the real existing platform data: this is not a sandbox for deleting users or changing real assignments.

The migration creates the private settings table and the public-read manarat-brand-assets bucket. Upload writes are authenticated administrator-only through the function. PNG/JPEG/WebP, 4 MB maximum; new immutable object paths preserve earlier images. Public settings strip private student mappings and asset inventory. Full-name publication requires explicit approval.

## Verification
Passed npm run build (138 JavaScript/inline checks and 290 asset references), test:unit, test:design, and test:race-v8. Live preview API returned 200 for settings/homeHub and denied anonymous design state/save/upload. SQL verified RLS and denied direct anon/authenticated table writes.

Browser visual inspection and an authenticated administrator upload/save/reload in a real browser remain required. Automated browser access was blocked in this environment; VM tests are not a substitute for visual acceptance. The connected Vercel account did not expose the existing manarat project, so deployment must use the repository's existing Vercel integration, not a newly created project.

## Before production promotion
Review desktop/mobile rendering and an administrator session. Confirm official branding assets. Explicitly decide whether to keep the separate V21 settings store or migrate approved settings to school_settings; do not merely flip DESIGN_PREVIEW or overwrite live settings. Deploy matching frontend and backend together after that decision. Do not replace the existing Supabase project or AI Studio/GitHub integration.

## Production release — 2026-10-24
User authorized publication. Frontend now targets school-api with DESIGN_PREVIEW=false. Existing school_settings is retained as the authoritative configuration; no draft data replaces it. Preview function and private draft table remain available for rollback/review.
