/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Agentic Eats — landing page configuration.
 *
 * THIS IS THE ONLY FILE YOU NEED TO EDIT to re-brand the /landing page.
 * Every name, tagline, contact detail, link, price number, section label and
 * legal placeholder on the page is read from here.
 *
 * Anything marked `PLACEHOLDER` below is not a real, verified fact — replace
 * it before you publish. Everything else maps to behaviour that exists in this
 * repository (see components/marketing/* for where each fact is used).
 * ─────────────────────────────────────────────────────────────────────────────
 */

export type Audience = "diners" | "owners";

/** Brand identity + SEO strings. */
export const SITE = {
  name: "Agentic Eats",
  /** Short form used in tight spaces (nav, footer, OG alt text). */
  shortName: "Agentic Eats",
  tagline: "Your restaurant's own AI ordering channel — for diners and for you.",
  description:
    "Agentic Eats gives your restaurant a direct ordering channel powered by AI: diners order by chat or voice, and you run the business by asking questions and confirming changes.",
  /** Used in the footer + legal line. */
  legalName: "Agentic Eats",
  /** Absolute URL of the site — used for canonical + Open Graph. PLACEHOLDER. */
  url: "https://agenticeats.com",
  /** Social preview image, 1200×630. PLACEHOLDER — add the file to /public. */
  ogImage: "/og/agentic-eats.png",
  /** Square logo for structured data. PLACEHOLDER — add the file to /public. */
  logo: "/og/agentic-eats-logo.png",
  locale: "en_IN",
} as const;

/** How to reach a human. PLACEHOLDER values. */
export const CONTACT = {
  email: "hello@agenticeats.com", // PLACEHOLDER
  whatsappDisplay: "+91 98765 43210", // PLACEHOLDER
  /** Digits only, with country code. PLACEHOLDER. */
  whatsappNumber: "919876543210", // PLACEHOLDER
  /** Where "Book a demo" goes. PLACEHOLDER — point at your calendar. */
  demoUrl: "https://wa.me/919876543210?text=Hi%20Agentic%20Eats%20%E2%80%94%20I%27d%20like%20to%20book%20a%20demo.",
  /** "Try the live demo" — the real, running restaurant product in this repo. */
  liveDemoUrl: "/",
  /** Prefix used to build the WhatsApp deep link from a message. */
  whatsappMessage: "Hi Agentic Eats — I'd like to book a demo.",
} as const;

/** Primary navigation. `href` values are in-page anchors on this route. */
export const NAV_LINKS = [
  { label: "Product", href: "#demo" },
  { label: "Features", href: "#features" },
  { label: "How it works", href: "#how" },
  { label: "Trust", href: "#trust" },
  { label: "Pricing", href: "#pricing" },
] as const;

/** Logo strip under the hero. These are the services actually wired into this repo. */
export const INTEGRATIONS = [
  "Razorpay",
  "Supabase",
  "Resend",
  "Deepgram",
  "Google sign-in",
] as const;

/** Hero copy, per audience. The nav toggle swaps between these. */
export const HERO = {
  headline: "Stop renting your customers.",
  /** The emphasised second line of the headline. */
  headlineAccent: "Run your restaurant by talking to it.",
  subhead: {
    diners:
      "An AI host that knows your menu, respects every allergy and takes the order — by chat or by voice.",
    owners:
      "Your own AI ordering channel, plus an assistant that answers your questions and asks before it changes anything.",
  },
  primaryCta: "Book a demo",
  secondaryCta: "Try the live demo",
  /** Rotating micro-labels under the orb. */
  orbLabels: {
    diners: ["Menu-aware", "Allergy-aware", "Speech input", "Razorpay checkout"],
    owners: ["Ask your business", "Realtime orders", "Voice operations", "Confirm-first changes"],
  },
} as const;

/** Section 003 — the editorial "shift" paragraph. */
export const SHIFT = {
  kicker: "The shift",
  title: "Every restaurant is stuck in the middle.",
  body: [
    "Phone calls that interrupt the rush. Aggregator commissions on every order. A dashboard that shows you numbers you already know, but never the answer to the question you actually asked.",
    "Agentic Eats gives you a channel you own: your menu, your branding, your customers, your data — with an AI running it end to end. Your diners talk to it. Your team asks it. It proposes, you approve.",
  ],
} as const;

/** Section 004 — Figure 1 caption. */
export const ARCHITECTURE = {
  kicker: "How it fits together",
  title: "One AI layer, two doors in.",
  caption:
    "Figure 1 — Diners and owners talk to the same agent layer; the agent reads and proposes. Only a verified Razorpay webhook can mark an order paid.",
  lockedNote:
    "The AI never touches payments. Only verified Razorpay webhooks can mark an order paid.",
  layers: {
    input: ["Diner chat", "Diner voice", "Owner chat", "Owner voice"],
    agent: ["AI agent", "Tool layer", "Confirm gate"],
    tools: [
      "Menu",
      "Cart",
      "Orders",
      "Reservations",
      "Inventory",
      "Analytics",
      "Email campaigns",
    ],
  },
} as const;

/** Section 005 — diner-facing features. */
export const DINER_FEATURES = {
  kicker: "For diners",
  title: "An AI host that actually knows the kitchen.",
  items: [
    {
      title: "A host that knows every dish",
      body: "Ask what's good, what's spicy, what's under ₹300. The host answers from your real menu — ingredients, portions, prep time.",
    },
    {
      title: "Allergy and diet aware",
      body: "Tell it once. It checks your allergen list and your dietary preferences against the menu before it suggests anything, and it stops you adding a conflicting dish until you confirm.",
    },
    {
      title: "Pairings, reorders and your usual",
      body: "Curated “goes well with” pairings, one-tap reorders from your order history, a favourites list, and “add my usual” in a single line.",
    },
    {
      title: "Table, order and pay in one flow",
      body: "Book a table, track a live order, apply a coupon and pay by Razorpay — without juggling separate pages.",
    },
  ],
} as const;

/** Section 006 — owner-facing features (the main section). */
export const OWNER_FEATURES = {
  kicker: "For owners",
  title: "Ask your business anything. Change it by talking.",
  items: [
    {
      title: "Ask your business anything",
      body: "Revenue, orders, average order value, peak hours, top and slowest dishes, repeat customers, coupons, ratings, cancellations. Ask in plain language, get a chart or a table.",
    },
    {
      title: "Change things by chatting",
      body: "Prices, availability, stock, menu items, coupons, refunds, reservations, settings, review replies. Every change shows a before and after, and nothing happens until you confirm.",
    },
    {
      title: "A live orders board",
      body: "New, Accepted, Preparing, Ready, Out for delivery — updating in real time, with ETA, one-tap status moves and a full order timeline.",
    },
    {
      title: "Hands-free voice operations",
      body: "A voice assistant for the floor: ask for the day's numbers, check what is running low, move an order along — and still confirm before anything changes.",
    },
    {
      title: "Email campaigns on autopilot",
      body: "Describe a campaign, pick an audience, and get a ready-to-send email with an auto-generated coupon that only activates when you send.",
    },
    {
      title: "A daily summary and smart alerts",
      body: "Yesterday's numbers in your inbox every morning. Hourly alerts for low stock, stuck orders, cancellation spikes, bad reviews and sudden sales dips.",
    },
    {
      title: "Reports, staff and a full audit trail",
      body: "Download CSV or PDF reports. Give staff logins with limited permissions. Every confirmed change is recorded with who did it and what changed.",
    },
  ],
} as const;

/** Section 007 — the scripted product demo. */
export const DEMO = {
  kicker: "Product",
  title: "Two assistants. One conversation each.",
  caption:
    "Figure 2 — A scripted preview of the diner and owner chat. Real conversations run on your own data.",
  tabs: [
    { id: "diner", label: "Diner" },
    { id: "owner", label: "Owner" },
  ],
} as const;

/** Section 008 — trust & safety. */
export const TRUST = {
  kicker: "Trust & safety",
  title: "The AI proposes. You approve.",
  items: [
    {
      title: "Nothing changes without your tap",
      body: "Every write — price, stock, coupon, refund, settings, a reply to a review — shows a before and after and waits for your confirmation.",
    },
    {
      title: "The AI cannot mark an order paid",
      body: "There is no tool that charges or settles an order. Only a verified Razorpay webhook can do that.",
    },
    {
      title: "Role-based access",
      body: "Owners and staff get different permissions. Staff can move orders and manage stock; revenue, pricing, refunds, campaigns and settings stay with the owner.",
    },
    {
      title: "Everything is logged",
      body: "Confirmed changes, blocked attempts and rejected actions are written to an audit trail you can read from the assistant.",
    },
    {
      title: "Allergy warnings are not optional",
      body: "The diner assistant checks your allergen list and your menu's allergen data before it suggests anything.",
    },
  ],
} as const;

/** Section 009 — how it works. Timelines are editable placeholders. */
export const HOW_IT_WORKS = {
  kicker: "How it works",
  title: "Three steps to your own channel.",
  steps: [
    {
      step: "Step 1",
      timeline: "Day 1", // PLACEHOLDER — edit to match your real onboarding time
      title: "Share your menu",
      body: "Send us your current menu, prices and photos. If you already have a menu link or a POS export, that works too.",
    },
    {
      step: "Step 2",
      timeline: "Within a week", // PLACEHOLDER
      title: "We set it up and brand it",
      body: "We build your ordering page in your name and colours, connect payments and email, and train the assistant on your dishes.",
    },
    {
      step: "Step 3",
      timeline: "Go live", // PLACEHOLDER
      title: "Go live and start taking direct orders",
      body: "Share your link on Google, Instagram, WhatsApp and your own packaging. Orders come straight to your board.",
    },
  ],
} as const;

/** Section 010 — aggregator comparison. Qualitative only, no invented numbers. */
export const COMPARISON = {
  kicker: "Own your channel",
  title: "Your restaurant, or a marketplace?",
  caption: "Qualitative comparison — what changes when the ordering channel is yours.",
  rows: [
    {
      topic: "Your customers",
      aggregator: "Owned by the marketplace. You see an order, not a relationship.",
      direct: "Yours. Emails, phone numbers, favourites and order history stay with you.",
    },
    {
      topic: "Your data",
      aggregator: "Limited reporting, usually summarised and delayed.",
      direct: "Your own data, queryable in plain language the moment you need it.",
    },
    {
      topic: "Campaigns",
      aggregator: "Platform-run promotions you do not design or keep.",
      direct: "Your own email campaigns, your own coupon codes, your own audience segments.",
    },
    {
      topic: "Your branding",
      aggregator: "The marketplace's checkout and app, with your logo on top.",
      direct: "Your menu, your colours, your voice — on a page that is yours.",
    },
    {
      topic: "Control",
      aggregator: "Rules, fees and visibility set elsewhere.",
      direct: "You decide what is on the menu, what is sold out, what is charged and when.",
    },
    {
      topic: "The daily work",
      aggregator: "Phones, tablets and dashboards alongside the aggregator's app.",
      direct: "One assistant for the front of house and the back office.",
    },
  ],
} as const;

/**
 * Section 011 — proof band.
 * `facts` are true product facts. `quotes` are PLACEHOLDERS — replace before launch.
 */
export const PROOF = {
  kicker: "What it is",
  title: "Built for restaurants, not for tech teams.",
  facts: [
    { label: "AI agents for diners and owners", detail: "Two conversations, one platform." },
    { label: "Voice for the floor", detail: "Speech-to-speech assistant for the owner." },
    { label: "Speech input for diners", detail: "Talk instead of typing when you order." },
    { label: "Real-time order board", detail: "Live status across the whole kitchen." },
    { label: "Razorpay checkout", detail: "Signed webhooks decide what is paid." },
    { label: "No app to install", detail: "Diners order from a link." },
    { label: "Confirm before every change", detail: "A human taps before anything moves." },
    { label: "Allergy-aware ordering", detail: "Your allergen list is checked before a dish is suggested." },
  ],
  quotesTitle: "What restaurants say",
  quotesNote: "Placeholder — replace with real quotes and results before publishing.",
  quotes: [
    {
      quote: "We stopped paying commission on every direct order we could have won ourselves.",
      name: "Restaurant owner",
      role: "PLACEHOLDER — pilot customer",
    },
    {
      quote: "The morning summary tells me what happened yesterday without me opening a single screen.",
      name: "Restaurant owner",
      role: "PLACEHOLDER — pilot customer",
    },
    {
      quote: "My manager asks the assistant about stock during service and just gets the answer.",
      name: "Restaurant manager",
      role: "PLACEHOLDER — pilot customer",
    },
  ],
} as const;

/** Section 012 — FAQ for owners. */
export const FAQ = {
  kicker: "FAQ",
  title: "Questions owners ask us first.",
  items: [
    {
      q: "Do I need to be technical to run this?",
      a: "No. If you can use WhatsApp, you can use this. You send us your menu, we set up the ordering page and the assistant on your menu, and from then on you talk to it in plain language — ask a question, approve a change.",
    },
    {
      q: "Are my payments safe?",
      a: "Payments are handled by Razorpay, not by the AI. The assistant has no tool that can charge or settle an order. An order only becomes paid when Razorpay sends a verified webhook.",
    },
    {
      q: "Can I stay in control?",
      a: "Yes. Every change — prices, stock, menu, coupons, refunds, settings, replies to reviews — is proposed by the assistant with a before and after, and only happens when you confirm it.",
    },
    {
      q: "Can my staff use it?",
      a: "Yes, with limited permissions. Staff accounts can move orders along, update availability, manage stock and reservations. Revenue and customer analytics, pricing, coupons, refunds, campaigns, settings and the voice assistant stay with the owner. Tell us how many staff logins you need and we set them up with you.",
    },
    {
      q: "Who owns the customer data?",
      a: "You do. Orders, contact details, favourites and order history live in your account, and your campaigns go to your own customers. You can download your reports as CSV or PDF.",
    },
    {
      q: "How long does setup take?",
      a: "We aim to have you ordering within about a week of receiving your menu. Timelines vary with how much detail your menu has and how fast you can approve the final look.",
    },
    {
      q: "What if the AI gets something wrong?",
      a: "It proposes, you approve — nothing changes without your confirmation. Writes are recorded in an audit trail, and blocked or rejected actions are logged too, so you can always see what happened.",
    },
    {
      q: "Do I need to change my website or install an app?",
      a: "No. Diners order from a link you can put anywhere — Google, Instagram, WhatsApp, your packaging or a QR code. Staff use the dashboard on any browser.",
    },
  ],
} as const;

/** Section 013 — pricing. ALL NUMBERS ARE PLACEHOLDERS. */
export const PRICING = {
  kicker: "Pricing",
  title: "Simple plans. No per-order fee.",
  note: "Pricing shown is indicative — we confirm your plan and any one-time setup fee before you commit.",
  cta: "Talk to us",
  tiers: [
    {
      name: "Starter",
      price: "₹2,499",
      period: "per month",
      summary: "One outlet, getting its first direct orders.",
      features: [
        "AI ordering page, branded to your restaurant",
        "Diner chat and voice ordering",
        "Razorpay checkout and coupons",
        "AI host that knows your menu",
        "Order board and daily summary email",
      ],
      cta: "Talk to us",
      featured: false,
    },
    {
      name: "Growth",
      price: "₹5,999",
      period: "per month",
      summary: "For restaurants that want the assistant running the back office too.",
      features: [
        "Everything in Starter",
        "Ask-your-business analytics with charts and tables",
        "Change-by-chatting with confirm-first approvals",
        "Voice assistant for operations",
        "Email campaigns with auto-generated coupons",
        "CSV and PDF reports, audit log, staff accounts",
      ],
      cta: "Talk to us",
      featured: true,
    },
    {
      name: "Custom",
      price: "Let's talk",
      period: "",
      summary: "Multiple outlets, custom branding, dedicated setup.",
      features: [
        "Everything in Growth",
        "Multiple outlets and menus",
        "Custom branding and integrations",
        "Guided onboarding and migration",
        "Priority support",
      ],
      cta: "Talk to us",
      featured: false,
    },
  ],
} as const;

/** Section 014 — closing CTA + footer. */
export const CLOSING = {
  kicker: "Get started",
  title: "Your next order shouldn't cost you a commission.",
  body: "Tell us about your restaurant. We will set up your ordering page, train the assistant on your menu and walk you through the dashboard.",
  primaryCta: "Book a demo",
  secondaryCta: "Try the live demo",
} as const;

export const FOOTER = {
  blurb:
    "Agentic Eats gives restaurants their own AI ordering channel — an AI host for diners and an assistant for the business, on your menu, your brand, your data.",
  columns: [
    {
      title: "Product",
      links: [
        { label: "Product demo", href: "#demo" },
        { label: "Features", href: "#features" },
        { label: "How it works", href: "#how" },
        { label: "Pricing", href: "#pricing" },
      ],
    },
    {
      title: "Trust",
      links: [
        { label: "Trust & safety", href: "#trust" },
        { label: "Own your channel", href: "#compare" },
        { label: "FAQ", href: "#faq" },
      ],
    },
    {
      title: "Get in touch",
      links: [
        { label: "Book a demo", href: CONTACT.demoUrl },
        { label: "Live demo", href: CONTACT.liveDemoUrl },
      ],
    },
  ],
  legal: [
    { label: "Privacy", href: "/privacy" }, // PLACEHOLDER — create the page
    { label: "Terms", href: "/terms" }, // PLACEHOLDER — create the page
  ],
  /** Shown next to the copyright line. */
  paymentNote: "Payments are processed by Razorpay. The AI never handles payments.",
} as const;

/** Small helper so components never hand-build a WhatsApp URL. */
export function whatsappLink(message: string = CONTACT.whatsappMessage) {
  return `https://wa.me/${CONTACT.whatsappNumber}?text=${encodeURIComponent(message)}`;
}
