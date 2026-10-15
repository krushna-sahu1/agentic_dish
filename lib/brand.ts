/** Site-wide brand constants (UI chrome, metadata, emails). Restaurant details still come from restaurant_settings. */
export const BRAND = {
  name: "Agentic Dish",
  tagline: "South Indian & Odia kitchen, with an AI host that takes your order.",
  description:
    "Crisp dosas, Odia comfort food and an AI host that takes your order. Order online for delivery, pickup or dine-in in Bhubaneswar.",
} as const;

const unsplash = (id: string, w: number) => `https://images.unsplash.com/${id}?w=${w}&q=75&auto=format&fit=crop`;

/** Editorial photography for the landing page (dish photos come from the menu). */
export const PHOTOS = {
  hero: unsplash("photo-1668236543090-82eba5ee5976", 1400), // masala dosa thali
  idli: unsplash("photo-1589301760014-d929f3979dbc", 800),
  tiffin: unsplash("photo-1630383249896-424e482df921", 800),
  biryani: unsplash("photo-1563379091339-03b21ab4a4f8", 800),
  thali: unsplash("photo-1546833999-b9f581a1996d", 1000),
  dining: unsplash("photo-1517248135467-4c7edcad34c4", 1200),
} as const;
