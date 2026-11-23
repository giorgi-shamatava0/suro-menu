# Loyalty preview

Production was rolled back to the pre-loyalty menu in commit `61cc5d8`. Production enrollment is disabled. Preserve existing production records; do not seed, reset, or deploy the preview backend there.

The development frontend is https://suro-loyalty-dev.vercel.app/loyalty. It is a separate Vercel project in the developer's accessible `supervercel1` team, using only Convex development deployment `amicable-grouse-297`. The original production project link and GitHub connection were not changed. Deploying this project's preview URL must never target `suro-menu`.

Activation requires an unchecked terms/privacy checkbox, same-origin POST, and a server admission secret. Successful enrollment is limited to five per hashed network address per hour and 200 globally per hour. The direct anonymous enrollment action was removed. Consent timestamp and notice version are recorded. Card reads use indexed, unguessable random identifiers and expose no member secret, staff, or ledger. The 22-character public alias has 128 bits of randomness. It is read-only but should be kept private because anyone holding it can view that card.

The first active program receives two welcome stamps in the same transaction as membership creation. It must have a threshold of at least three. The first visit and gift have distinct ledger entries. Retrying enrollment with the same member secret returns the existing card without issuing more stamps. The cinematic welcome sequence shows stamp one, waits three seconds, presents a gift and three shuffled cups, then shows stamp two for any selected cup. The animation changes presentation only; it cannot mint stamps. Escape dismisses it and reduced-motion preferences suppress movement.

Enrollment preview uses live program rules, reward translations, stamp grid and the actual card styles. Signup navigates to a unique `/c/[code]` URL. Card QR images encode the entire same-origin recovery URL, never only an identifier. Staff input accepts both full links and legacy identifiers. Saved PNGs capture the rendered card, QR and expiry in the selected Georgian, English or Russian language. Images are snapshots; opening their QR recovers the current card after browser storage is cleared. The warning explains both recovery and read-only link sharing.

The per-card manifest launches the same unique live card from a home-screen shortcut. Compatible browsers offer installation; others show browser-specific instructions. The home-screen icon does not show live stamp totals, and no offline card cache or service worker was introduced. Open online to receive current counts.

There are two authorization levels: existing application admin and staff. Legacy staff records with role `admin` do not grant application administration. Staff can look up and stamp; redemption, correction and card deactivation require the main admin session. Admin has Cards, Staff and Terms sections. Staff controls expose password reset and collapsed staff creation, with no separate role selector. Password resets revoke that person's sessions. Logout asks for confirmation.

Policy links appear at the menu footer and before activation; the card itself has only expiry below it, plus the separately grouped recovery controls. The notice describes existing menu language/session storage as well as activation storage. Admin-authored program terms are available on the public notice page. This implements storage disclosure and consent; it is not a legal compliance certification.

Removed abandoned offer/report UI, loyalty-only administration roles, public enrollment bypass, reward-image management endpoints, large dashboard member/history scans, and unused image lookups in public card reads. Historical tables are retained to avoid destroying records.

## Verification

- `npm test`: password, language isolation, calendar expiry and balance rules.
- `npm run test:loyalty`: authorization, transactional welcome awards, duplicate enrollment, rate limiting, reward lifecycle, revocation, corrections and session resets.
- `npx tsc --noEmit`, `npm run build`, and development Convex deployment typecheck.
- `scripts/check-loyalty-rework.mjs`: opt-in development browser check that creates a test card; consent enforcement, unique route, timed welcome, cup choice, three translated PNGs, storage-cleared recovery, manifest and responsive rendering. Never run on production.
- `scripts/check-loyalty-admin-browser.mjs`: local verification helper requiring the private temporary development session and preceding browser artifacts. Decodes the exported PNG's QR and checks simplified admin, responsive rendering and logout cancellation. It never logs credentials.

Physical iOS/Android installation and camera scanning are still device-specific manual checks. QR recovery was decoded using the same HTML5 QR library used by the staff scanner.
