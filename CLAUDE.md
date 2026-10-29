@AGENTS.md

# Suro menu — working notes (read first, update after every decision)

Display-only QR menu for **Suro**, a greenhouse/garden café at 12 Tsotne Dadiani St, Tbilisi. Live target: suro-menu.vercel.app. No ordering, no reservations.

## How we work (the owner's rules)
1. **The owner makes every design decision.** I ask questions first (AskUserQuestion), then build 2–3 versions on localhost, they pick. No restyling on my own initiative.
2. **One step at a time**, in this order: loader + hero → navigation (sticky bar, dock, search/index) → section transitions → item rows + detail sheet → footer → desktop layout → admin → deploy. Finish a step before starting the next.
3. **Test on localhost, never artifacts.** Run the production build so it isn't laggy: `npm run build && node node_modules/next/dist/bin/next start -H 0.0.0.0 -p 3000` (snap's `npx next start` exits silently on this machine). Phone: `http://<laptop IP>:3000` on the same Wi‑Fi. The IP changes when the Wi‑Fi changes: check `hostname -I` before giving a link. Dev server: `npm run dev` (webpack; Turbopack can't download Google Fonts on this machine).
   **Exception: Nini** (the owner's girlfriend, works via Remote Control, can't reach localhost): show her examples as **Artifacts**, or a Vercel preview deploy (ask first). Follow her requests like the owner's.
4. **Use the installed skills every UI step**: `design-taste-frontend` (house rules + `inspect.mjs`), `web-design-guidelines`, `playwright-cli`. Screenshot at 390 / 768 / 1440 in KA + EN + RU before showing anything.
5. **Mobile first and fast**: transform/opacity animation only, no backdrop-filter blur, honour reduced motion. `mask-image` gradients are cheap; live blur is not.
6. Update this file whenever a decision is made or an item is fixed.

## Stack (fixed)
Next.js 16 App Router (`cacheComponents`, menu cached with `cacheTag("menu")`), Convex (dev deployment `ideal-falcon-242`, team `control-admin`, project `suro-menu`). No other services.
- `convex/`: schema, `menu.get` (public), `auth.ts` (one admin password, PBKDF2 hash in Convex env `ADMIN_PASSWORD_HASH`, sessions, global lockout), `admin.ts` (token-checked CRUD, upload URL), `seed.ts`.
- `app/(site)/[lang]/`: public page (`Menu.tsx` client component, `site.css`). `/` always opens Georgian (owner, 2026-10-28), unless the guest picked a language before (cookie); the phone's language is ignored.
- Assets: originals in `reference/generated/*.png` (true transparent PNGs from the owner) → converted to `public/decor/*.webp`. Logo: `reference/logo.png` (dark slate on white, **colour is wrong**: render it as a mask so the colour is set in CSS).

## Decisions made
- Languages KA (default) / EN / RU. Missing translation falls back ka → en → ru.
- Look: night greenhouse. Dark ground, cream ink, teal accent (#5fbcac), real botanical PNGs as scenery, Edison bulbs.
- **No café interior photos** (guests are already inside). Dish photos optional per item; items without a photo must still look designed.
- Mobile hero composition (foliage canopy on top, fern basket, bulbs, monstera, big name at the bottom) is **approved**: "mobile is perfect". Keep it, improve the movement.
- Removed on request: "open now" status dot, the old ivy-ring loading animation, the blur bars, the A/B switch.
- Language switch: **one small button showing the current language**; tap → small popup with the other two. (Built: `LangPicker` in Hero.tsx.)
- Vegan and vegetarian tags must have **different colours**.

## In progress: step 1, loader + hero
The owner can't choose from text: **always show built versions on localhost, never text-only options.**
- **Hero = V2 (chosen 2026-10-27)**: centred "greenhouse window", plants on every edge, logo in the middle, tagline, section names as links. Code: `Hero.tsx` + `hero.css`.
- **Loader = 1 "Part" (chosen 2026-10-27), polishing.** Test at `/ka?lab` (always replays; panel: Replay, logo colour).
  Owner's verdicts: plants must never pop in or appear one by one (chunky); no whole-screen "static zoom"; the სურო logo comes **last**, after the plants; the way the leaves swing out shows character (keep).
  Current build: each plant picture once, each piece lives on a line through its own screen edge: it springs in along it (expo ease-out, overlapping), is pushed back out along it while still settling; near pieces travel further and swell (depth), far ones are slower. The room behind slides the last bit into place per plant (no zoom). Starts only after every image is decoded (`img.decode()`, max 2.5s).
  Rejected: walk-through tunnel (repeating pictures), loader 2 "through" (zoom), loader 3 "overgrow", any logo shown before the plants.
- V1 (leaf curtain) and V3 (bulbs first, tiles) were rejected and deleted.

## Step 2, navigation: decided 2026-10-27
**Nav 2 without the ☰ button**: no bar on the hero; in the menu a fixed top bar (category chips + 🔍) slides away while you scroll down and returns when you scroll up. 🔍 opens the categories/search sheet (it lists every category too, so no separate categories button). Rejected: always-visible bar (nav 1), bottom bar with ‹ › (nav 3), the floating dock.
Also done: sheet no longer scrolls sideways; vegetarian olive (#b4c86e) vs vegan teal; no tiny uppercase labels in the bar.
**Owner decided to keep** the vegan/vegetarian filters and the 01/02/03 section numbering (overrides the taste-skill rule; don't raise it again).

## Step 3, section transitions: decided 2026-10-27
**Soft fade, as is**, "no other animation needed there": plants stay beside each section title; the side holding the stem or cut edge (`lib/decor.ts` `stems`) dissolves over a long gradient mask; titles rise in as they scroll into view (scroll-driven CSS, static fallback). Rejected: ivy garland dividers, plants sliding in from the side. Don't add more motion here.

## Step 4, dish rows + popup: decided 2026-10-27
**List**, with **square (1:1) dish photos** on the right of the row. Popup = bottom sheet (photo 4:3, description, tags, allergens, portion · kcal, price). Sold out: dish keeps its place, "Sold out" label instead of the price, dimmed. Drinks/extras: name …… price. Rejected: photo cards, classic-menu round plates.
Dev data: sample allergens / portions / kcal / sizes (Cappuccino) / sold-out (Pepperoni) were added to ~10 dishes in the dev database to judge density. Not real; the owner fills real data via /admin.

## Step 5, footer: decided 2026-10-27
**Bookend** (`Footer.tsx`): the hero mirrored. A fern and a monstera rise from the bottom corners (stems below the page end), centred logo, "Visit us", address (map link) / hours / phone (tel link) as big lines with icons, allergy note, back-to-top. Rejected: big Directions/Call buttons, lit card. Popup photo stays 4:3 unless the owner asks.

## Step 6, laptop layout of the public menu: skipped by the owner ("never mind laptop layout").

## Step 7, admin (/admin): rebuilt twice on 2026-10-29
v1 (whole menu as one big canvas + hover quick buttons + help text) was rejected: "unpractical, hard to manage, spams unnecessary functions". Owner's rules for the editor: simplest and fastest way to edit; no tutorials; no options the menu never used; ask before choosing design.
v2 (current, `app/(admin)/admin/Admin.tsx` + `admin.css`, dark like the menu):
- Left: sections (drag to reorder, click to open, Edit → 3 name fields + Delete (takes its categories and dishes with it, the dialog says how many; owner 2026-10-29), + Section); the open section lists its categories (drag, click to open, + Category).
- Right: only the open section, drawn with the guest styles (`Row` from `app/(site)/[lang]/Row.tsx`). Click a dish or category title to edit; click empty space or Esc to deselect. + Add a dish / + Add a category slots.
- Dish form: name + description per language (ქა/EN/RU rows), price, Sold out, Hidden from guests, photo (add/replace/remove, size No photo / Small / Big), marks (Vegan, Vegetarian, Signature, Spicy, Gluten-free, New), delete. Short-list dishes: name, price, Sold out, Hidden, delete only.
- Category form: name, Short list, Delete (takes its dishes with it). **Removed on request**: plant picker, section editor, note under title, category hide, section/category pickers, allergens, sizes, portion, kcal (also gone from the guest rows).
- Drag and drop: the row lifts off and follows the cursor, others slide aside (FLIP); mouse drags the whole row, touch uses the ⋮⋮ grip.
- **Draft + Publish (owner's choice)**: edits change the draft tables; guests read `published` (menu.get falls back to the draft until the first publish). Publish saves into the first free of 5 version slots; when all are full, the owner picks which to replace. Versions dialog (owner 2026-10-29): each row = optional name (typed in place, `admin.nameVersion`, cleared when the slot is published over), timestamp · dish count, "On the site", **View** only, and a trash icon (`admin.removeVersion`; not on the live version). Empty slots: "Create menu"; when all 5 are full: "Start a new menu" in the dialog footer. Both ask, then empty the draft (`admin.clearDraft`; café info, versions and the site stay). View = read-only look at that version; its bar has Publish this version (`admin.publishVersion`, draft untouched) / Open in editor (restore, asks if the draft has unpublished changes) / Back to my draft. Publish and Café info are off while viewing.
- Dish/category panel has no Done button (edits save as you type; footer says "Changes save automatically"). The sidebar section rename box keeps Done.
- Photos are no longer deleted from storage (old versions may still show them).
- **Form on the right (owner, 2026-10-29)**: the edit form lives only in a right column (bottom sheet on phones); "Form in the menu" and its switch were deleted. Nothing selected → short "Nothing selected" note in the column.
- Panel redesigned 2026-10-29 (owner: the old one was ugly): header (Dish/Category + name), labelled groups (Name, Description, Price, Photo, Marks), settings-style toggle rows, price with ₾ inside, photo preview cropped to its real frame + size guide (Small = square 1:1, ≥600×600; Big = 4:3, ≥1200×900), footer with Delete/Done stays at the bottom.
- Every delete/remove (dish, category, section, dish photo), log out, and opening an old version over unpublished changes) asks first in the editor's own dialog (`ask()` / `AskHost` in Admin.tsx), never the browser's confirm(). Cancel is focused; Enter, Esc and a click outside all cancel.
- New rows are named with examples, not "New …" (owner 2026-10-29): sections Food → Drinks → Sweets → Breakfast, categories fitting their section, dishes fitting their category, in KA/EN/RU (`EXAMPLES` in Admin.tsx; the first one not used yet, plain "New …" when they run out). Empty menu: "Your menu is empty" + one line on sections/categories/dishes + "+ Add the first section". Empty section: one example line above "+ Add a category".
- Category form: "Photo size for all N dishes" (No photo / Small / Big) sets every dish at once (`admin.setDisplay`, needs `npx convex deploy` before the next prod deploy).
- Choosing: names as all three languages stacked (A, `/admin`) vs language tabs (B, `/admin?form=tabs`). After the pick: delete the other and the `TABS` flag in Admin.tsx.
- Password `ADMIN_PASSWORD_HASH` set to the owner's new one on dev (2026-10-29); prod gets it at the deploy.

## Production (deployed 2026-10-27)
- Site: https://suro-menu.vercel.app (Vercel project `suro-menu`, team supervercel1, linked in `.vercel/`; `vercel.json` sets framework nextjs). No git integration: deploy with `vercel deploy --prod`.
- Convex prod: `aromatic-curlew-123` (`NEXT_PUBLIC_CONVEX_URL` set on Vercel, Production). Convex code changes need `npx convex deploy -y` **before** the Vercel deploy.
- Prod data = the starter menu from `seed:run` (sample prices, no photos, no allergens). The dev database keeps the test edits and the Wikimedia sample photos; they never went to prod.
- `ADMIN_PASSWORD_HASH` on prod = the same hash as dev (copied 2026-10-29), so /admin works on prod with the owner's password.

## Backlog (owner's feedback, 2026-10-27), fix in step order
- [x] **Loader**: loader 1 accepted ("it's okay, move on", 2026-10-27). Logo colour still open (teal for now).
- [x] **Hero**: real logo, no cropping, V2 centred layout chosen. Logo colour still open.
- [x] **Sticky category bar**: Nav 2 chosen and built.
- [x] **Section transitions**: soft fade chosen and built.
- [x] **Search/index sheet**: sideways scroll fixed, opened from 🔍 only, filters kept as they are.
- [x] Desktop layout of the public menu: skipped by the owner.
- [ ] House-rule leftovers (taste skill): hairline rules, tiny uppercase labels in the sheet/dish details. Numbering stays (owner). Dock removed.
- [x] Admin editor built (step 7). Deploy to Vercel only when the owner says go.
- [ ] `reference/generated/fern-basket.png` was not replaced with an original. Ask the owner.

## Finishing pass (2026-10-28)
- Fixed: the language switch made the whole page go dark. A switch mounts a fresh page and React resets `<html>`'s classes, so the loader's curtain came back. Hero now adds `seen` when the loader has already played (`booted` flag in Hero.tsx).
- Fixed: Georgian address spelling ცოტნე (was წოთნე) in `convex/seed.ts` and the dev database (`seed:fixAddress`). Prod fixed too (2026-10-28 deploy); `fixAddress` deleted 2026-10-29.
- Choosing: menu background (the list sat on flat black). Versions on localhost via `?bg=a|b|c` (panel bottom-left, remembered per tab): A lamplight (warm/teal glow gradients), B leaves (`public/decor/bg/shade-strip.webp`, dark plants half off both edges), C stone (`public/decor/bg/stone-night.webp`, the stone wall dimmed). Owner asked to combine B + C → added D (stone as C + leaves as B, on `main::after`) and E (darker stone, stronger leaves). Then F mix (owner's idea): Food = B, Drinks = A, Sweets (ტკბილეული) = D, each section's background fades out/in around its title (`.sec::before/::after`, picked by position). **Keep A–F until the boss decides; don't delete any.** CSS at the end of `site.css` (`main[data-bg]`). After the boss picks: make it the default, then remove the others and the panel.

- Favicon = the real logo in teal on #0f1311 (`public/favicon.ico`, `icon.png`, `apple-icon.png`, made from `reference/logo.png`).
- Fixed: repeat visits (loader skipped) showed text first and plants popping in one by one. Now `html.wait` hides the hero until its plants, logo mask and fonts are decoded (max 2.5s), then it fades in whole (START in Hero.tsx).
- **Background D chosen (2026-10-28)** and live on prod for everyone (`<main data-bg="d">`). A–F and the `?bg` panel stay in the code but only work off the production deploy (`BG_LAB` in `next.config.ts`, empty when `VERCEL_ENV=production`).
- Choosing: bigger dish photos. Versions on localhost via `?ph=now|a|b|c` (panel top-left, off on prod): A big square beside the text, B full-width 4:3 card, C two-across grid (photo 4:5). CSS at the end of `site.css` (`main[data-ph]`). 15 sample photos (Wikimedia Commons, CC0/CC BY/BY-SA, dev only) were added to Food/Sweets dishes in the dev database to judge them; replace before launch.
- **Photo test on prod (2026-10-28)**: the boss tests A and B at `suro-menu.vercel.app/ka?ph=a` / `?ph=b` (prod panel offers only A/B; C and Now are localhost only; no `?ph` = the old small photos). The 15 sample photos were copied over every non-compact dish (36) in **both prod and dev** databases (old Wikimedia photos removed); each dish has its own file. Not accurate per dish, samples only: replace with real photos via /admin before launch.
- Deployed 2026-10-28 (language-switch fix, address, background options A–F behind `?bg=`; guests without `?bg` see the plain background as before).

## Hardening pass (2026-10-29), deployed to prod 2026-10-29
- Login: each attempt is counted (`auth.attempt` mutation) *before* the slow hash check, so parallel guesses can't slip past the global lock; passwords over 200 chars are refused; expired sessions are cleaned up on login (`sessions.by_expiry`).
- "Unpublished changes" comes from a one-row `draftState` table (`edited()` in admin.ts writes only when the flag flips) instead of re-reading the whole draft and all 5 versions after every keystroke. publish → off, publishVersion/restore → exact.
- Editor: add/publish/version buttons ignore a second click while the first call runs (`useLock`); toggles/marks save 200ms after the last click (a burst = one save); closing the tab with an unsaved edit warns and saves; `remove` is a no-op on an already-deleted row; map link must be https.
- Headers on every page: no framing (X-Frame-Options DENY + frame-ancestors), nosniff, referrer policy, no X-Powered-By.
- Removed dead code: unused UI strings (open/closed status, allergens, kcal, address/hours/phone labels), `TAGS`/`ALLERGENS` in schema, `hero.ring` import.

## Facts
Address KA: ცოტნე დადიანის 12 (not წოთნე). Phone +995 598 33 70 20 · every day 11:00–23:00 · maps https://maps.app.goo.gl/Du3qVm6CtgMEgWHe9. Seed prices are samples. The 4 dish photos (khachapuri ×2, lobiani, margherita) are Wikimedia samples for dev only and must be replaced before launch.
