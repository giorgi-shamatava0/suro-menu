---
name: Suro
description: Botanical café identity with a landscape loyalty card.
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
    fontFamily: "Noto Serif Georgian, Spectral, Georgia, serif"
    fontSize: "36px"
    fontWeight: 700
    lineHeight: 1.3
  card-count:
    fontFamily: "Spectral, Georgia, serif"
    fontSize: "37px"
    fontWeight: 400
    lineHeight: 1
    letterSpacing: "-0.02em"
  card-reward:
    fontFamily: "Noto Serif Georgian, Spectral, Georgia, serif"
    fontSize: "25px"
    fontWeight: 400
    lineHeight: 1.45
  card-expiry:
    fontFamily: "Spectral, Georgia, serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.6
  card-terms-button:
    fontFamily: "Noto Serif Georgian, Spectral, Georgia, serif"
    fontSize: "20px"
    fontWeight: 400
    lineHeight: 1.4
  card-terms-body:
    fontFamily: "Noto Serif Georgian, Spectral, Georgia, serif"
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

## Website identity

The café website uses its actual Suro mark, atmospheric botanical cutouts, dark stone, cream lettering, Spectral and Noto Serif Georgian. Menu, staff and admin retain their existing designs and controls.

## Customer card — 2026-11-24

The user rejected the previous generated card designs and explicitly requested removal of the old references. Earlier Garden Club, cursive, ceramic and ivory-inlay directions are retired and are not design authority.

The current implementation is a new landscape card in RewardCard.tsx and RewardCard.module.css. It has independent scoped styles rather than inherited legacy live-card CSS. A larger warm cream face meets a deep-green reward band, with subtle existing stone texture, directional light and a fine inset edge. The title uses the heavy website serif; the reward uses a distinct upright sans; the action label is smaller. Actual Suro impressions carry progress. No decorative image, generated relief, character illustration or stock icon is added. The front identifies the loyalty card, shows the actual stamp positions and names the real reward. The reverse preserves the reward photo, description, and QR. A reward preview never redeems it.

Thresholds 4, 6, 8 and 10 remain live data. Collected positions carry the actual Suro mark, the next ring is dashed, and the last slot identifies the gift. Labels support Georgian, English and Russian. Reduced motion switches faces immediately. Numeric expiry and recovery controls remain outside the card. /loyalty/design is a sample-only local review surface; it does not create memberships.

## Constraints

Preserve actual brand assets and all original font licenses. Never invent rewards, program terms or membership progress. Keep the QR quiet zone white and unobstructed. Scope this work to the card and its sample preview; existing menu, staff and admin workflows are preserved.

Latest correction: the user asked to remove the visible numerical counter. Stamp progress alone remains on the front, with the accessible button label retaining the count. The larger two-color card has a cream face and green reward band.

Completion correction: preserve the existing cream/green palette. Do not recolor completed cards gold. Center the handwritten heading. Completion is communicated through the final stamp, one-shot light/seal animation, and localized “მიიღე საჩუქარი” heading; tapping reveals the existing café QR.

Prize name correction: regular 400 weight, preserving its existing size and upright sans font. Do not increase its weight with heading or completion changes.

Title size follow-up: centered handwritten heading enlarged to 31–48px, 28px on the narrowest screens; other text sizes and prize weight are unchanged.

Reverse layout update: larger 16:9 actual menu image; compact name/description group; centered QR at 176–216px with original white quiet zone and caption underneath. Reverse height follows content. Missing photos use a shorter branded fallback; descriptions are only shown when saved on the real menu item. Sample preview now reads the public menu photo and translations rather than supplying an empty photo/description.

Reverse correction: the user rejected the tall reverse. Both faces must have identical dimensions. Reverse is a single 40/60 horizontal split: full-height real image left, centered QR and café caption right. No product-description block or enlarged portrait layout. Keep the original front unchanged.

Reverse spacing correction: equal 50/50 columns with equal padding. Image and QR have matching square bounds up to216px and share the same vertical center; café caption sits below.

Final reverse correction: keep equal halves; image fills the entire left half edge to edge (cover, centered), without padding or inset square. QR remains centered with white quiet zone in the right half.
