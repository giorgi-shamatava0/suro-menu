import canopy from "@/public/decor/canopy-top.webp";
import basket from "@/public/decor/fern-basket.webp";
import bulbs from "@/public/decor/edison-bulbs.webp";
import monsteraA from "@/public/decor/monstera-a.webp";
import monsteraB from "@/public/decor/monstera-b.webp";
import frond from "@/public/decor/fern-frond.webp";
import pothos from "@/public/decor/pothos-cascade.webp";
import vine from "@/public/decor/ivy-vine.webp";
import leaves from "@/public/decor/leaves-scatter.webp";

export const hero = { canopy, basket, bulbs, monstera: monsteraB, vine, leaves };

// Botanical plates a menu section can wear; keys are stored on sections.decor.
export const plates = {
  "fern-frond": frond,
  "pothos-cascade": pothos,
  "monstera-a": monsteraA,
  "monstera-b": monsteraB,
  "fern-basket": basket,
  "leaves-scatter": leaves,
} as const;

// Which side of each plate the stem or cut edge is on (t = top, b = bottom, bl = bottom-left),
// so a section can fade or turn that side away and nothing ever looks cropped.
export const stems: Record<keyof typeof plates, "t" | "b" | "bl"> = {
  "fern-frond": "bl",
  "pothos-cascade": "t",
  "monstera-a": "b",
  "monstera-b": "bl",
  "fern-basket": "t",
  "leaves-scatter": "b",
};
