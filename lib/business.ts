/**
 * Everything that describes THIS business in words. Point the app at another
 * restaurant by editing this file (and the rows in `restaurant_settings` and the
 * menu tables). Prices, hours and fees stay in the database; nothing here is a
 * number the app computes with. Client-safe: no server imports.
 */
export const BRAND = {
  name: "Agentic Dish",
  tagline: "South Indian and Odia kitchen with an AI host that takes your order.",
  description: "Crisp dosas, Odia comfort food and an AI host that takes your order. Delivery, pickup or dine-in in Bhubaneswar.",
} as const;

export const BUSINESS = {
  /** Used in page titles and the AI host's introduction. */
  cuisine: "South Indian & Odia",
  city: "Bhubaneswar",
  /** UTC offset the AI must use in datetimes, and how it names the zone. */
  utcOffset: "+05:30",
  zoneName: "IST",
  about: [
    "We started as a tiny tiffin counter in Saheed Nagar, grinding our own dosa batter every night. Today our kitchen brings together two food cultures we love: the crisp dosas, idlis and filter coffee of South India, and the comforting Odia home food (dalma, pakhala, chhena poda) that Bhubaneswar grew up on.",
    "Everything is made fresh each day. We mark allergens on every dish, cook with less oil on request, and are happy to make most dishes milder, or spicier.",
    "Our AI host can answer questions about the menu, suggest combos for your group and add dishes to your cart. It never handles your payment: you always pay yourself through Razorpay's secure checkout.",
  ],
  aboutPrompt: { label: "Ask about our Odia specials", message: "Tell me about your Odia specials" },
  menuDescription: "Dosas, idli, uttapam, rice, Odia specials, snacks, drinks and desserts.",
  searchPlaceholder: "Search dosa, biryani, chhena poda…",
  chatPlaceholder: "e.g. add one masala dosa",
  /** Starter prompts in the customer chat. */
  chatSuggestions: [
    { title: "What's spicy?", message: "Which dishes are spicy?" },
    { title: "Veg meal under ₹300", message: "Suggest a veg meal under ₹300" },
    { title: "Add my usual", message: "Add my usual to the cart" },
    { title: "Track my order", message: "Where's my food?" },
  ],
  /** Words customers use → words on this menu. */
  searchSynonyms: {
    coffee: ["filter coffee"],
    tea: ["masala chai", "chai"],
    kheer: ["payasam"],
    prawn: ["chingudi"],
    prawns: ["chingudi"],
    shrimp: ["chingudi"],
    fish: ["machha"],
    pani: ["gupchup"],
    puri: ["gupchup"],
    buttermilk: ["neer mor"],
    chaas: ["neer mor"],
    rasgulla: ["rasagola"],
    dal: ["dalma"],
    sweet: ["desserts"],
    drink: ["beverages"],
    drinks: ["beverages"],
  } as Record<string, string[]>,
  /** Category slugs that play each role when the host builds a combo. */
  comboCategories: {
    mains: ["dosa", "uttapam", "rice", "odia-specials", "idli-vada"],
    breakfast: ["dosa", "idli-vada", "uttapam"],
    sides: ["snacks"],
    drinks: ["beverages"],
    desserts: ["desserts"],
  },
  /** "What goes well with spicy food?", best first, with the reason shown. */
  coolingPicks: {
    "neer-mor": "Spiced buttermilk cools the palate instantly",
    "curd-rice": "Curd rice is the classic South Indian cool-down",
    "sweet-lassi": "Creamy lassi soothes chilli burn",
    "mango-lassi": "Sweet and fruity against the heat",
    "tender-coconut-water": "Refreshing and mild",
    "dahi-vada": "Cool curd calms chilli heat",
  } as Record<string, string>,
} as const;
