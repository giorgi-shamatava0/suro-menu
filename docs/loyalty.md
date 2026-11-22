# Loyalty implementation and operations

Suro uses Convex for membership, stamp balances, immutable program rules, rewards and transaction history. `/loyalty` creates or reopens a card; `/staff` scans it; `/admin/loyalty` manages programs, staff, offers, corrections and reports.

## Customer cards

No Apple or Google Wallet integration, issuer credentials, signing libraries, workers or paid pass service is required. Cards display a QR link to `/loyalty/card/<random-code>`. Its QR opens a read-only page with reactive Convex subscriptions showing current progress, rewards and offers. Staff scanning accepts the URL or original raw identifier. Only authenticated staff can add stamps or redeem rewards.

Enrollment reuses an HttpOnly cookie. Visiting a valid card stores its public identifier locally so `/loyalty` can reopen it on the same browser. The card page only displays the branded card, progress and scan code, with no action buttons or visible URL. Guests can use their browser to bookmark it or add it to their home screen. Clearing browser data removes remembered access; retain a screenshot or bookmark. Anyone possessing the link can view that card’s progress, but cannot change it. Public responses omit customer secrets, receipts, staff and ledger details. Public pages are excluded from search indexing.

## Rules and security

Default stamp expiration is six calendar months in Asia/Tbilisi, clamped at month end. Earned rewards have a separate lifecycle. Rule changes preserve existing balance versions. Stamp issuance and redemption are atomic and idempotent; receipt replay is blocked. Enrollment requires a shared server admission secret and uses IP/global limits. Configure `LOYALTY_ADMISSION_SECRET` on Next.js and Convex. `NEXT_PUBLIC_CONVEX_URL` selects the backend. `LOYALTY_APP_URL` configures the printable signup QR’s canonical public origin. Preserve the deployment targets in HANDOFF.md.

## Reports

Reports show twelve months of activations, gross stamps issued, rewards earned and rewards redeemed for a selected year, all programs, one program, and/or one customer identifier. Time boundaries use Tbilisi. Membership activation means enrollment; program activation means first participation (balance creation). Stamp issuance includes later reversals. Reward earnings and redemptions use their own event dates. Charts use smooth curves and dots, with exact values and a table. Reports read complete indexed historical ranges rather than the dashboard’s limited recent-activity list. Very large annual datasets may need persistent monthly aggregates before reaching Convex query limits.

## Verification and release

Run `npm test`, `npm run test:loyalty`, `npm run build` and Convex type checking. Exercise the browser flow, language switching and phone camera access over HTTPS. Develop on the existing development backend first. Production deployment is separate; local builds and mocked tests do not prove phone camera behavior. Hosting and database plan limits still apply; removing pass services does not guarantee zero total hosting cost.
