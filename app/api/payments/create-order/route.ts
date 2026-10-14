import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prepareCheckout } from "@/lib/services/orders";
import { ServiceError } from "@/lib/services/errors";

export const runtime = "nodejs";

/** Manual checkout page → the same prepareCheckout the agent uses. Never charges. */
export async function POST() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  try {
    return NextResponse.json(await prepareCheckout(user.userId, user.email));
  } catch (e) {
    if (e instanceof ServiceError) return NextResponse.json({ error: e.message, code: e.code, data: e.data }, { status: 400 });
    console.error(e);
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}
