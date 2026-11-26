// Shared by server and client components (no "use client").

/** Category illustrations (public/dishes) used when a dish has no photo. */
const CATEGORY_ART: [RegExp, string][] = [
  [/dosa/i, "/dishes/dosa.svg"],
  [/vada/i, "/dishes/vada.svg"],
  [/idli/i, "/dishes/idli.svg"],
  [/uttapam/i, "/dishes/uttapam.svg"],
  [/biryani/i, "/dishes/biryani.svg"],
  [/rice/i, "/dishes/rice.svg"],
  [/machha|fish|chingudi|prawn/i, "/dishes/fish.svg"],
  [/odia|curry|kasa|dalma|santula|potala/i, "/dishes/curry.svg"],
  [/snack/i, "/dishes/snack.svg"],
  [/lassi|soda|coconut|neer mor/i, "/dishes/drink.svg"],
  [/beverage|drink|coffee|chai/i, "/dishes/coffee.svg"],
  [/dessert|sweet/i, "/dishes/dessert.svg"],
];

export function dishArt(hint?: string | null): string {
  if (!hint) return "/dishes/placeholder.svg";
  return CATEGORY_ART.find(([re]) => re.test(hint))?.[1] ?? "/dishes/placeholder.svg";
}
