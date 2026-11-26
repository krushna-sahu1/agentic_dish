/**
 * Copy for /landing, the page that sells the product to restaurant owners.
 * Every claim maps to behaviour in this repository; there are no invented
 * customers, prices or results here. Keep it that way.
 */
import { BRAND } from "@/lib/business";

export const LANDING = {
  title: `${BRAND.name}: run your restaurant by talking to it`,
  description:
    "An AI host that takes orders from your own menu, and an assistant that answers questions about your business and asks before it changes anything.",
  /** Where "Book a demo" goes (a WhatsApp, calendar or mailto link). Empty hides the button. */
  demoUrl: "",
  hero: {
    title: "Run your restaurant by talking to it.",
    body: "Customers order by chat or voice from your own menu. You ask how the day is going and get an answer, then approve changes with one tap.",
  },
  day: {
    title: "A day with it",
    moments: [
      { time: "08:00", title: "Yesterday, in six lines", body: "Revenue, best and slowest dishes, ratings and what is running low. It's in your inbox before you open." },
      { time: "13:10", title: "The lunch rush", body: "Chat and voice orders land on one live board with a chime. Accept, set the time, move each ticket along." },
      { time: "16:30", title: "Idli is finished", body: "Say “mark idli sold out”. You see the change, tap Confirm, and the menu and the AI host stop offering it at once." },
      { time: "21:45", title: "How did we do?", body: "Ask in plain words: best dish, busiest hour, this week against last. You get a chart and one suggestion." },
    ],
  },
  confirm: {
    title: "It proposes. You approve.",
    body: "Prices, stock, coupons, refunds, hours, review replies, customer emails. Each one shows what it was and what it will be, and waits for you.",
    example: {
      ask: "Raise masala, ghee roast and paneer dosa by 10%",
      heading: "Update prices for 3 dishes",
      rows: [
        ["Masala Dosa", "₹120", "₹130"],
        ["Ghee Roast Dosa", "₹150", "₹165"],
        ["Paneer Masala Dosa", "₹170", "₹185"],
      ],
    },
  },
  limits: {
    title: "What the AI can't do",
    body: "These are limits in the code and the database. They are not instructions the AI could talk itself out of.",
    items: [
      { title: "Take or confirm a payment", body: "There is no payment tool. Only a verified Razorpay webhook can mark an order paid, and only for the exact amount." },
      { title: "Change anything on its own", body: "Writes run from your Confirm tap. The model can only propose them." },
      { title: "Invent a price or a number", body: "Totals, taxes and discounts are calculated by your server. Reports come from your own orders." },
      { title: "Skip an allergy", body: "A dish that clashes with a customer's profile needs their explicit “Add anyway”." },
      { title: "Give staff owner powers", body: "Staff run orders, stock and bookings. Revenue, pricing, refunds and campaigns stay with you." },
      { title: "Act without a trace", body: "Confirmed, rejected and blocked actions are all in the audit log, with who and when." },
    ],
  },
  own: {
    title: "Your channel, not a marketplace's",
    rows: [
      ["Customers", "You see an order", "You keep the relationship, history and favourites"],
      ["Reporting", "Their summary, on their schedule", "Your own data, answered when you ask"],
      ["Offers", "Their promotions", "Your emails, your coupons, your audience"],
      ["Branding", "Their app, your logo", "Your menu, name and link"],
    ],
  },
  faq: {
    title: "Questions owners ask",
    items: [
      { q: "Do I need to be technical?", a: "No. If you can send a message, you can use it. Everything the assistant does can also be done from ordinary screens." },
      { q: "What if the AI gets something wrong?", a: "It can only propose. You see the before and after, and nothing happens until you confirm. Anything you reject is logged too." },
      { q: "Does it work without the AI?", a: "Yes. The menu, cart, checkout, orders board and menu editor are normal pages that share the same data." },
      { q: "Can my staff use it?", a: "Yes, with their own login and limited permissions." },
      { q: "Do customers need an app?", a: "No. They order from a link you can put on Google, Instagram, WhatsApp or a QR code." },
    ],
  },
  closing: { title: "Order something. Then see it from the kitchen.", body: "The demo is a working restaurant with sample data. Nothing is charged." },
} as const;

/** Sample orders for the hero: what is said, what the kitchen gets. Prices match the demo menu. */
export const SAMPLE_ORDERS = [
  {
    said: "Two masala dosas, less spicy, and a filter coffee",
    type: "Table 4",
    lines: [
      { qty: 2, name: "Masala Dosa", note: "less spicy", price: 120 },
      { qty: 1, name: "Filter Coffee", note: null, price: 50 },
    ],
    reply: "Added 2 masala dosas, less spicy, and a filter coffee.",
  },
  {
    said: "Something light, no onion, under ₹250",
    type: "Pickup",
    lines: [
      { qty: 1, name: "Curd Rice", note: "Jain-friendly", price: 110 },
      { qty: 1, name: "Tender Coconut Water", note: null, price: 70 },
    ],
    reply: "Curd rice and tender coconut water are both onion-free and come to ₹180 before GST.",
  },
  {
    said: "My usual, delivered home",
    type: "Delivery",
    lines: [
      { qty: 2, name: "Masala Dosa", note: null, price: 120 },
      { qty: 2, name: "Filter Coffee", note: null, price: 50 },
      { qty: 1, name: "Medu Vada", note: null, price: 70 },
    ],
    reply: "Your usual is in the cart: two dosas, two coffees and a vada.",
  },
] as const;
