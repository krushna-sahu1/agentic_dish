/**
 * draft_email tool schema — client-safe so the chat, Jarvis (Deepgram function
 * definitions) and the server all share one source of truth.
 */
import { z } from "zod";

export const EMAIL_GROUPS = ["all", "inactive", "new", "loyal", "big_spenders", "ordered_dish"] as const;
export type EmailGroup = (typeof EMAIL_GROUPS)[number];

export const GROUP_DEFAULTS = { days: 30, min_orders: 3, min_spend_rupees: 2000 } as const;

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const emailToSchema = z
  .object({
    emails: z.array(z.email()).min(1).max(50).optional().describe("Specific addresses the owner said. Use this OR group."),
    group: z
      .enum(EMAIL_GROUPS)
      .optional()
      .describe(
        `all = every customer; inactive = ordered before but not in the last \`days\` days (default ${GROUP_DEFAULTS.days}); new = first order within the last \`days\` days (default ${GROUP_DEFAULTS.days}); loyal = \`min_orders\`+ orders (default ${GROUP_DEFAULTS.min_orders}); big_spenders = spent \`min_spend_rupees\`+ in total (default ₹${GROUP_DEFAULTS.min_spend_rupees}); ordered_dish = ordered \`dish\` before`,
      ),
    days: z.number().int().min(1).max(365).optional(),
    min_orders: z.number().int().min(1).max(200).optional(),
    min_spend_rupees: z.number().int().min(1).max(10_000_000).optional(),
    dish: z.string().min(1).max(120).optional().describe("Dish name, for group ordered_dish"),
  })
  .describe("Who receives it");
export type EmailTo = z.infer<typeof emailToSchema>;

export const emailOfferSchema = z
  .object({
    percent_off: z.number().int().min(1).max(90).optional(),
    flat_off_rupees: z.number().int().min(1).max(5000).optional(),
    starts_on: date.optional().describe("YYYY-MM-DD (IST), first day the code works; default today"),
    ends_on: date.describe("YYYY-MM-DD (IST), last day the code works (inclusive)"),
    min_order_rupees: z.number().int().min(0).max(100_000).optional(),
    max_discount_rupees: z.number().int().min(1).max(100_000).optional().describe("Cap for percent offers"),
  })
  .describe("Discount: the server creates a one-use-per-customer coupon that only activates when the owner taps Send");
export type EmailOffer = z.infer<typeof emailOfferSchema>;

export const draftEmailSchema = z.object({
  draft_id: z.uuid().optional().describe("Revise this existing draft (from the last draft_email result). Omitted fields keep their current values."),
  to: emailToSchema.optional(),
  goal: z.string().max(500).optional().describe("What the owner wants, in their words"),
  subject: z.string().min(3).max(120).optional(),
  message: z
    .string()
    .min(10)
    .max(2000)
    .optional()
    .describe(
      "Plain-text body you write from the goal: 2–4 short, warm paragraphs. No greeting line (the template adds “Hi <first name>,”), no sign-off, and never a coupon code, discount amount or dates — the offer box shows those from the real coupon.",
    ),
  offer: emailOfferSchema.optional(),
  remove_offer: z.boolean().optional().describe("true to drop the offer from an existing draft"),
});
export type DraftEmailInput = z.infer<typeof draftEmailSchema>;

export const DRAFT_EMAIL_DESCRIPTION =
  "Draft a bulk email to customers (or specific addresses). You write the subject and message from the owner's goal; the server finds recipients, creates the coupon for any offer, and shows a preview card. NOTHING is sent — only the owner's tap on Send sends it. Call again with draft_id to change the audience, wording, or offer.";

/** What the preview card and Jarvis panel render (returned by draft_email). */
export interface EmailDraftView {
  draft_id: string;
  version: number;
  status: "draft" | "sending" | "sent" | "cancelled" | "failed";
  audience_label: string;
  recipient_count: number;
  sample: string[];
  subject: string;
  message: string;
  coupon: { code: string; headline: string; detail: string; validity: string } | null;
  warnings: string[];
  next_step: string;
}
