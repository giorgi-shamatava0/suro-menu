---
name: Suro
description: Botanical café identity with a calligraphic live stamp card.
colors:
  night: "#0f1311"
  raised: "#171c19"
  chip: "#212823"
  ink: "#efe8db"
  soft: "#a7a194"
  teal: "#5fbcac"
  customer-logo-blue: "#78c8df"
  language-icon: "#a5d5dc"
  teal-ink: "#0b1513"
  loyalty-surface: "#19211d"
  loyalty-muted: "#b2b6aa"
  loyalty-line: "#36453d"
  loyalty-control: "#64786b"
  card-light: "#305842"
  card-mid: "#244c3b"
  card-deep: "#1a3d30"
  card-ink: "#f2eedf"
  seal-ink: "#f1e8cb"
  seal-ink-alternate: "#e3dcbc"
  seal-ring: "#e2ddbd"
  current-stamp: "#c5dbbc"
  gift-stamp: "#f1dcad"
  gift-ring: "#d2b77c"
  gift-number-ink: "#e5d4a5"
  card-scenery: "#111b15"
  expiry: "rgb(242 238 223 / 58%)"
typography:
  menu-body:
    fontFamily: "Spectral, Noto Serif Georgian, Georgia, serif"
    fontSize: "17px"
    fontWeight: 400
    lineHeight: 1.5
  loyalty-body:
    fontFamily: "system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.55
  card-title:
    fontFamily: "Suro Georgian Script, Suro Script, cursive"
    fontSize: "36px"
    fontWeight: 700
    lineHeight: 1.3
  card-count:
    fontFamily: "Suro Script, cursive"
    fontSize: "37px"
    fontWeight: 400
    lineHeight: 1
    letterSpacing: "-0.02em"
  card-reward:
    fontFamily: "Suro Georgian Script, Suro Script, cursive"
    fontSize: "25px"
    fontWeight: 400
    lineHeight: 1.45
  card-expiry:
    fontFamily: "Suro Script, cursive"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.6
  card-terms-button:
    fontFamily: "Suro Georgian Script, Suro Script, cursive"
    fontSize: "20px"
    fontWeight: 400
    lineHeight: 1.4
  card-terms-body:
    fontFamily: "Suro Georgian Script, Suro Script, cursive"
    fontSize: "22px"
    fontWeight: 400
    lineHeight: 1.7
rounded:
  control: "6px"
  button: "8px"
  card: "14px"
  container: "16px"
  pill: "99px"
spacing:
  tight: "10px"
  stamp-gap: "14px"
  control-gap: "18px"
  compact: "20px"
  card-inset: "28px"
  section: "32px"
components:
  button-primary:
    backgroundColor: "{colors.teal}"
    textColor: "{colors.teal-ink}"
    rounded: "{rounded.button}"
    padding: "10px 20px"
  button-secondary:
    backgroundColor: "{colors.loyalty-surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.button}"
    padding: "10px 20px"
  input:
    backgroundColor: "{colors.night}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "10px 12px"
  live-stamp-card:
    textColor: "{colors.card-ink}"
    rounded: "{rounded.card}"
  card-title:
    textColor: "{colors.card-ink}"
    typography: "{typography.card-title}"
  card-count:
    textColor: "{colors.card-ink}"
    typography: "{typography.card-count}"
  card-reward:
    textColor: "{colors.card-ink}"
    typography: "{typography.card-reward}"
---

# Design System: Suro

## Overview

**Creative North Star: "The Night Greenhouse; Garden Club for the live card"**

The established website is a dark botanical café menu: the Suro logo, cut-out plants, warm cream type, and teal controls form its identity. Menu, enrollment, staff, and admin retain their existing visual systems. The Garden Club direction applies only to the live customer card, not to the whole website.

The customer card is restrained and tactile. Its surface has directional light, collected stamps read as cream Suro ink seals, and empty slots remain clean, transparent rings. The page is framed by the actual menu hero assets—canopy, basket, bulbs, fern, and monstera—over native-scale stone. It does not stretch the café photograph across a phone screen. The card communicates real progress with very little text. Program content can describe any eligible item; the stamp symbols do not assume coffee.

**Key Characteristics:**

- Established Suro logo and green, cream, and teal identity.
- Botanical imagery on existing website surfaces; no plants over the live card.
- One compact calligraphic live card with branded stamp states and an unobstructed scan code.
- Physical depth on the card surface, with transparent future slots and branded ink seals.
- Quiet numeric expiry and a Terms disclosure outside the live card.

## Colors

The palette moves from near-black green grounds to warm cream reading surfaces and marks, with teal reserved for controls and active interface details.

### Primary

- **Teal:** existing links, primary controls, focus treatments, and selected interface details.
- **Customer-logo blue:** the restored Suro mark at the live-card page's top left; it does not replace the site's teal controls.
- **Language-icon blue:** the globe and chevron in the full-language pill.
- **Card forest greens:** the live card's directional surface light; these are a local extension of the established green identity.

### Neutral

- **Warm cream ink:** body copy and important labels on dark surfaces.
- **Card cream:** the calligraphic card title, progress, and reward text.
- **Collected-stamp cream:** the actual Suro mark and ring read as ink impressions, not filled cream coins.
- **Muted loyalty green:** supporting copy and operational boundaries.
- **Expiry cream:** a semi-transparent numeric date below the live card, not inside its footer.

**The Scope Rule.** Garden Club card colors do not replace menu, enrollment, staff, or admin tokens.

## Typography

The menu uses Spectral for Latin/Cyrillic and Noto Serif Georgian for Georgian, with language-specific ordering. Its body is serif-led. Loyalty operations use a system sans for compact, familiar controls and data. All live-card lettering is cursive, including the title, progress, gift label, numeric date, Terms control, terms text, and nearby language picker. Georgian uses the self-hosted BPG Mikhail Stephan face; Latin, Cyrillic, and numerals use self-hosted Marck Script. These card fonts do not replace menu or staff/admin typography.

### Hierarchy

- **Menu body:** the existing menu's reading voice; Georgian uses its established smaller body size.
- **Loyalty body:** the operational and customer utility voice.
- **Card title:** the larger, heavier localized loyalty-card title, `ლოიალურობის ბარათი` in Georgian. Georgian uses the title token; English/Russian use 36px. Narrow-phone sizes are 28px Georgian and 31px English/Russian. The single-weight handwritten face uses explicit weight synthesis for this title only. The Suro wordmark is not used as the card heading.
- **Card count:** calligraphic numerical progress, with a smaller muted slash.
- **Card reward:** the configured item expressed as a gift beside the QR, reduced at narrow phone widths.
- **Card expiry:** subdued numeric metadata below the card, centered beside Terms and allowed to wrap.
- **Terms:** a quiet calligraphic text control with a circled information icon; its inline expanded panel uses the same lettering at a readable body size.

**The Quiet Card Rule.** A single-program card shows the localized loyalty-card title and short numerical count at the top. Within the card, Suro appears only in collected stamp impressions; a separate blue Suro logo is restored in the page header. It has no marketing headline, ritual tagline, or descriptive progress sentence. Multiple programs may carry concise names and their own counts to preserve clarity.

## Layout

The menu keeps its established centered reading column and responsive category navigation. Operational loyalty screens keep their existing wider shell, forms, rows, and tables.

The live card is one centered object, capped at 390px. The surrounding page uses the existing canopy, basket, bulbs, fern, and monstera assets over native-scale stone. Their desktop positions and mobile crops frame the card without printing scenery onto its face. Do not replace this layered scene with a stretched `/og.jpg` photograph. A blue Suro logo sits at the top left of the page header, opposite a globe/full-language-name/chevron pill.

The header contains the localized loyalty-card title at left and cursive progress at right. Eight stamp slots occupy two rows of four, with a consistent gap. The bottom compartment places the configured item with a gift suffix at left and QR at right. Expiry sits outside and below the card as `dd/mm/yy`, without an expiry label. A quiet Terms text button and circled information icon sit beside it; opening Terms reveals plain admin-authored multilingual text inline rather than in a modal.

The card uses a 28px main inset and a 14px stamp gap. At widths below 360px, insets reduce to 22px and the stamp gap to 10px. The QR stays 88px with pixelated rendering and a white quiet zone; its encoding uses error-correction level L and a three-module margin. Long reward names wrap rather than collide with the code. Additional programs remain in sequence instead of stretching one row across the viewport.

## Elevation & Depth

Existing website surfaces combine dark tonal layering and soft offset shadows. Garden Club adds a local material treatment: light crosses the card diagonally; the lower reward compartment sits in a slightly deeper tone; uncollected stamps remain transparent outlined positions; collected marks carry the real Suro logo as cream ink inside a restrained seal ring. The card surface uses soft, offset and inset shadows, not a colored halo. Uncollected and current positions have no fill or inset shadow. The exact shadow expressions and surface gradients are stored in the sidecar.

**The Ink-Seal Rule.** Collected positions carry the actual Suro mark as ink impressions. Do not replace them with raised cream coins, checks, or product-specific illustrations.

## Shapes

The live card has gently rounded corners and clips its material treatment. Stamp positions are circular. A brighter full ring marks the next stamp. The final slot is the actual configured reward photograph cropped inside a gold-edged circle, or a quiet gold-outlined slot showing the threshold number. It has no drawn gift illustration. Standard controls retain the existing smaller corner radii, while language and menu chips remain pill-shaped. These local choices do not change existing menu photography or container shapes.

## Components

### Live stamped card

One calligraphic object with a title/count header, stamp field, and reward/QR footer. Its visible content comes from the live membership and program data. The card face has no action buttons or visible URL. The sole customer control is the quiet Terms disclosure beside the outside date. Keep background scenery and promotional copy off the card face.

### Stamp grid

Collected: actual Suro mask in cream ink, a seal ring, and slight alternating rotation. Current: a transparent slot with a brighter full ring. Future: a transparent outlined circle. Final: the actual reward photo if configured, otherwise the threshold number in a quiet gold-outlined slot. Collected stamp symbols must work for any product. Only the final gift position may show the configured actual reward photo; do not introduce product-specific illustrations into every collected stamp. The eight-slot arrangement is four columns; other thresholds retain the component's bounded responsive grid.

### QR and reward footer

The QR is plain, high-contrast, and unobstructed, with a white quiet zone. The adjacent text is the configured item expressed as a gift: for example, Georgian `ყავა საჩუქრად`. Its lettering is calligraphic like the rest of the card. The code shares the membership's live public-card link and remains separate from stamp decoration.

### Terms disclosure

The outside date and Terms text share muted, semi-transparent cream. Terms has a circled information icon, a clear keyboard focus treatment, and a minimum 44px target without a filled button surface. Its plain-text content is independently authored for Georgian, English, and Russian, with the component's existing locale fallback. The expanded dark panel remains inline; preserve line breaks and wrap long words. Do not invent legal or program terms when content is empty.

### Language picker

The native details/summary control opens a compact, dark, elevated language list. In the customer header it is a full-language pill with an outlined globe, the language name, and a chevron, using 20px calligraphic text and a 44px target. It sits opposite the blue Suro logo, with visible focus, hover, open, and selected states. Maintain Escape/outside-click behavior. The menu's compact language abbreviations remain a separate mode.

### Buttons and fields

Existing operation and enrollment screens retain teal filled primary buttons, dark outlined secondary buttons, and dark fields with clear boundaries. Focus uses a teal outline; disabled buttons dim. These primitives are not added to the live card.

### Menu chips

Existing menu category navigation remains a horizontally scrollable set of quiet pills. Selection uses a raised green ground and brighter cream text. It is not a model for card stamp slots.

## Do's and Don'ts

### Do:

- **Do** preserve the actual Suro logo, including the blue page-header mark, and the established botanical identity.
- **Do** keep collected Suro stamp marks neutral enough for any eligible item; reserve an actual reward photo for the final gift slot.
- **Do** use branded filled seals, transparent next/future rings, and an actual reward photo or numbered final slot consistently.
- **Do** keep the QR's quiet zone clear and the real reward readable beside it.
- **Do** place the numeric `dd/mm/yy` expiry and quiet Terms disclosure below the card in the same muted, semi-transparent cream.
- **Do** use the bundled Georgian calligraphic and Marck Script fonts throughout the live card, and allow translated text to wrap.

### Don't:

- **Don't** treat the card redesign as permission to restyle the menu, enrollment, staff, or admin.
- **Don't** use a Suro wordmark as the card heading, a marketing headline, ritual tagline, product-specific collected-stamp icons, or a drawn gift illustration.
- **Don't** add buttons to the card face, explanatory paragraphs, or a visible raw link; Terms beside the outside date is the explicit exception.
- **Don't** place leaves over card content or stretch `/og.jpg` as its page background; use the existing separate hero assets and stone.
- **Don't** fill or inset-shadow future/current slots, replace Suro seals with raised coin/check marks, or use depth without state meaning.

Font assets are served locally from `public/fonts`; `README.md` records their sources and the bundled GPL-with-font-exception and OFL licenses. Preserve those license files when distributing the fonts.

## Current correction — 2026-11-23

This supersedes earlier card-only control and homepage-logo rules: preserve the original menu homepage without the added corner logo or My card action. Enrollment must preview the same Garden Club card and real program rules. Use a simple vector gift icon, never a reward photograph. Remove the card Terms control; show numeric expiry outside it. Put consent and the policy link before activation and policy links at the menu footer. Keep image download and home-screen recovery controls outside the card face. Recovery warnings use readable system text rather than calligraphy. Welcome motion uses a dark cinematic overlay and large gold lettering, a first ink seal, three-second pause, gift and shuffled cups, then the second ink seal. Operational admin has Cards, Staff and Terms only; secondary corrections live in disclosures.
