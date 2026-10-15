/**
 * Owner-only bulk email tool, shared by the text chat and Jarvis. It only
 * drafts; sending is a human tap on the preview card (app/actions/email.ts).
 */
import { tool, type ToolDef } from "../tool-def";
import { DRAFT_EMAIL_DESCRIPTION, draftEmailSchema } from "@/lib/bulk-email/schema";
import { draftEmail } from "@/lib/services/bulk-email";

export const ownerEmailTools: ToolDef[] = [
  tool({
    name: "draft_email",
    description: DRAFT_EMAIL_DESCRIPTION,
    schema: draftEmailSchema,
    handler: (ctx, a) => draftEmail(ctx.userId, a),
  }),
];
