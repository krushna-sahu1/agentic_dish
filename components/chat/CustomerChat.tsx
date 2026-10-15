"use client";

import "@copilotkit/react-core/v2/styles.css";
import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { ArrowRight, RotateCcw, ShoppingBag, X } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import {
  CopilotChat,
  CopilotKitProvider,
  useAgent,
  useAgentContext,
  useConfigureSuggestions,
  type ReactHumanInTheLoop,
  type ReactToolCallRenderer,
} from "@copilotkit/react-core/v2";
import { Button } from "@/components/ui/button";
import { useCart } from "@/components/providers/CartProvider";
import { useSession } from "@/components/providers/SessionProvider";
import { CUSTOMER_CONFIRM_SCHEMAS, type CustomerConfirmSchemaName } from "@/lib/agents/customer/confirm-schemas";
import { executeCustomerConfirmAction, previewCustomerConfirmAction, rejectCustomerConfirmAction } from "@/app/actions/customer";
import { newConversationAction } from "@/app/actions/chat";
import { formatINR } from "@/lib/format";
import { cn } from "@/lib/utils";
import { LogoMark } from "@/components/site/Logo";
import { ChatActionsProvider, useChatActions } from "./chat-actions";
import { ChatLauncher } from "./ChatLauncher";
import { ConfirmCard } from "./ConfirmCard";
import { ErrorNote, LoginPromptCard, parseResult, ToolProgress } from "./shared";
import {
  AllergenWarningCard,
  CartSummaryCard,
  CheckoutCard,
  ComboSuggestionCard,
  CouponsCard,
  DishCarousel,
  ItemOptionsCard,
  OrdersListCard,
  OrderStatusCard,
  ReservationsCard,
  type CheckoutData,
  type Combo,
  type CompactCart,
  type OrderStatusData,
} from "./CustomerCards";
import { useChatPersistence } from "./useChatPersistence";

const anyArgs = z.any();
type RenderProps = { name: string; toolCallId: string; args: Record<string, unknown>; status: string; result?: string };

/** Generic wrapper: progress chip while running, error/login cards, else `body`. */
function backend(name: string, body: (data: any, args: Record<string, unknown>) => React.ReactNode): ReactToolCallRenderer<any> { // eslint-disable-line @typescript-eslint/no-explicit-any
  function Render(props: RenderProps) {
    if (props.status !== "complete") return <ToolProgress name={name} />;
    const r = parseResult(props.result);
    if (!r) return <ToolProgress name={name} done />;
    if (!r.ok) {
      if (r.code === "login_required") return <LoginPromptCard message={r.error} />;
      if (r.code === "ambiguous" && Array.isArray(r.data?.options))
        return <ItemOptionsCard message={r.error} options={r.data.options as never} qty={Number(props.args?.qty ?? 1)} />;
      return <ErrorNote message={r.error} />;
    }
    return <>{body(r.data, props.args)}</>;
  }
  Render.displayName = `Render_${name}`;
  return { name, args: anyArgs, render: Render as never };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function cartCard(headline?: (d: any) => string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any, react/display-name
  return (d: any) => <CartSummaryCard cart={(d.cart ?? d) as CompactCart} headline={headline?.(d)} />;
}

function buildRenderers(restaurantName: string): ReactToolCallRenderer<any>[] { // eslint-disable-line @typescript-eslint/no-explicit-any
  return [
    backend("search_menu", (d) => <DishCarousel items={d.items} />),
    backend("get_item_details", (d) => <DishCarousel items={[{ ...d, reason: d.pairings?.length ? `Goes well with ${d.pairings.map((p: { name: string }) => p.name).join(", ")}` : d.description }]} />),
    backend("get_pairings", (d) => <DishCarousel title={`Goes well with ${d.item}`} items={d.pairings} />),
    backend("get_recommendations", (d) => (d.kind === "combo" ? <ComboSuggestionCard combo={d as Combo} /> : <DishCarousel title={d.title} items={d.items} notes={d.notes} />)),
    backend("add_to_cart", (d) =>
      d.status === "needs_confirmation" ? <AllergenWarningCard message={d.message} pending={d.pending} /> : cartCard(() => `Added ${d.qty_in_line > 1 ? "" : "1 × "}${d.item}`)(d),
    ),
    backend("update_cart_item", cartCard(() => "Cart updated")),
    backend("remove_from_cart", cartCard(() => "Removed")),
    backend("view_cart", cartCard()),
    backend("set_order_options", cartCard(() => "Order options updated")),
    backend("apply_coupon", cartCard((d) => `Coupon applied${d.cart?.coupon_code ? `: ${d.cart.coupon_code}` : ""}`)),
    backend("remove_coupon", cartCard(() => "Coupon removed")),
    backend("reorder", (d) => (
      <>
        <CartSummaryCard cart={d.cart} headline={`Added from ${d.from_order}${d.times_ordered ? ` (your usual, ordered ${d.times_ordered}×)` : ""}`} />
        {d.skipped?.length ? <ErrorNote message={`Couldn't add: ${d.skipped.map((s: { name: string; reason: string }) => `${s.name} (${s.reason})`).join(", ")}`} /> : null}
      </>
    )),
    backend("prepare_checkout", (d) => <CheckoutCard data={d as CheckoutData} restaurantName={restaurantName} />),
    backend("get_order_status", (d) => <OrderStatusCard data={d as OrderStatusData} />),
    backend("list_my_orders", (d) => <OrdersListCard orders={d.orders} />),
    backend("list_available_coupons", (d) => <CouponsCard coupons={d.coupons} />),
    backend("list_my_reservations", (d) => <ReservationsCard reservations={d.reservations} />),
    backend("list_favorites", (d) => <DishCarousel title="Your favourites" items={d.items} />),
    backend("toggle_favorite", (d) => <ToolProgress name="toggle_favorite" done error={null} key={String(d.favorite)} />),
    backend("check_reservation_availability", (d) =>
      d.available ? <p className="text-sm text-success">✓ Table {d.table_number} is free.</p> : <ErrorNote message={`${d.reason}${d.alternatives?.length ? " Alternatives are available." : ""}`} />,
    ),
  ];
}

/** Confirm-gated customer actions (clear cart, cancel order, book/cancel table). */
function buildHitl(): ReactHumanInTheLoop[] {
  return (Object.keys(CUSTOMER_CONFIRM_SCHEMAS) as CustomerConfirmSchemaName[]).map((name) => {
    const def = CUSTOMER_CONFIRM_SCHEMAS[name];
    function Render(props: { args: Record<string, unknown>; status: string; result?: string; respond?: (r: unknown) => Promise<void> }) {
      const session = useSession();
      const { refresh } = useCart();
      if (!session) {
        if (props.status === "executing") void props.respond?.({ status: "login_required", error: "User must log in first." });
        return <LoginPromptCard />;
      }
      return (
        <ConfirmCard
          args={props.args ?? {}}
          status={props.status as "inProgress" | "executing" | "complete"}
          result={props.result}
          respond={props.respond}
          preview={(a) => previewCustomerConfirmAction(name, a)}
          execute={(a) => executeCustomerConfirmAction(name, a)}
          reject={(a) => rejectCustomerConfirmAction(name, a)}
          onDone={() => void refresh()}
          confirmLabel={name === "create_reservation" ? "Book table" : "Confirm"}
        />
      );
    }
    Render.displayName = `Confirm_${name}`;
    return { name, description: def.description, parameters: def.schema as never, render: Render as never } as ReactHumanInTheLoop;
  });
}

const SUGGESTIONS = [
  { title: "What's spicy?", message: "Which dishes are spicy?" },
  { title: "Veg meal under ₹300", message: "Suggest a veg meal under ₹300" },
  { title: "Add my usual", message: "Add my usual to the cart" },
  { title: "Track my order", message: "Where's my food?" },
];

function CustomerBindings({ isOpen, statusLabel }: { isOpen: boolean; statusLabel: string }) {
  const pathname = usePathname();
  const session = useSession();
  const { cart } = useCart();
  const viewing = pathname.startsWith("/menu/") ? pathname.split("/")[2] : null;

  useAgentContext({ description: "Page the customer is currently on", value: pathname });
  useAgentContext({ description: "Dish the customer is viewing (slug), if any", value: viewing });
  useAgentContext({
    description: "Customer's current cart (server-computed totals in paise)",
    value: cart
      ? { items: cart.lines.map((l) => ({ cart_item_id: l.id, name: l.name, qty: l.qty })), total: formatINR(cart.totals.totalPaise), order_type: cart.order_type }
      : null,
  });
  useAgentContext({
    description: "Customer profile preferences",
    value: session ? { name: session.name, allergies: session.allergies, dietary_prefs: session.dietaryPrefs, spice_tolerance: session.spiceTolerance } : "not logged in",
  });
  useAgentContext({ description: "Restaurant open status right now", value: { open: isOpen, label: statusLabel } });
  useConfigureSuggestions({ suggestions: SUGGESTIONS, available: "before-first-message" });
  useChatPersistence("customer", !!session);
  return null;
}

function PendingPrompt({ prompt, onSent }: { prompt: string | null; onSent: () => void }) {
  const { submitUserMessage } = useChatActions();
  const { isReady } = useAgent();
  useEffect(() => {
    if (!prompt || !isReady) return;
    onSent();
    void submitUserMessage(prompt);
  }, [prompt, isReady, onSent, submitUserMessage]);
  return null;
}

export function CustomerChat({
  restaurantName,
  isOpen,
  statusLabel,
  initialOpen = false,
  initialPrompt,
}: {
  restaurantName: string;
  isOpen: boolean;
  statusLabel: string;
  initialOpen?: boolean;
  initialPrompt?: string;
}) {
  const [open, setOpen] = useState(initialOpen);
  const [pending, setPending] = useState<string | null>(initialPrompt ?? null);
  const [resetKey, setResetKey] = useState(0);
  const session = useSession();
  const panelRef = useRef<HTMLDivElement>(null);
  const renderers = useMemo(() => buildRenderers(restaurantName), [restaurantName]);
  const hitl = useMemo(() => buildHitl(), []);

  useEffect(() => {
    const onOpen = (e: Event) => {
      setOpen(true);
      const p = (e as CustomEvent<{ prompt?: string }>).detail?.prompt;
      if (p) setPending(p);
    };
    window.addEventListener("agentic:open-chat", onOpen);
    return () => window.removeEventListener("agentic:open-chat", onOpen);
  }, []);

  useEffect(() => {
    if (!open) return;
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", esc);
    panelRef.current?.querySelector("textarea")?.focus();
    return () => window.removeEventListener("keydown", esc);
  }, [open]);

  return (
    <CopilotKitProvider
      key={resetKey}
      runtimeUrl="/api/copilot/customer"
      renderToolCalls={renderers}
      humanInTheLoop={hitl}
      enableInspector={false}
      showIntelligenceIndicator={false}
      onError={({ error }) => {
        console.error("[assistant]", error);
        toast.error("Our assistant is having a moment. You can keep using the menu and cart normally.", { id: "assistant-error" });
      }}
    >
      <ChatActionsProvider>
        <CustomerBindings isOpen={isOpen} statusLabel={statusLabel} />
        <PendingPrompt prompt={pending} onSent={() => setPending(null)} />

        {!open && <ChatLauncher onClick={() => setOpen(true)} />}

        <div
          ref={panelRef}
          role="dialog"
          aria-modal="false"
          aria-label={`${restaurantName} AI assistant`}
          hidden={!open}
          data-testid="chat-panel"
          className={cn(
            "fixed z-50 flex flex-col overflow-hidden bg-card shadow-[0_30px_80px_-20px_rgb(0_0_0/0.35)]",
            "inset-0 pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)] sm:inset-auto sm:bottom-5 sm:right-5 sm:h-[min(740px,calc(100dvh-2.5rem))] sm:w-[420px] sm:rounded-3xl sm:border sm:p-0",
            open && "animate-rise",
          )}
        >
          <div className="flex items-center gap-3 border-b px-4 py-3">
            <span className="relative">
              <LogoMark className="size-9" />
              <span className={cn("absolute -bottom-0.5 -right-0.5 size-3 rounded-full border-2 border-card", isOpen ? "bg-success" : "bg-muted-foreground")} aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-display text-xl leading-tight">{restaurantName} host</p>
              <p className="truncate text-xs text-muted-foreground">{session ? "Orders, tracking and tables — just ask" : "Ask about the menu · log in to order"}</p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Start a new conversation"
              title="New conversation"
              onClick={async () => {
                await newConversationAction("customer");
                setResetKey((k) => k + 1);
              }}
            >
              <RotateCcw />
            </Button>
            <Button variant="ghost" size="icon" aria-label="Close assistant" onClick={() => setOpen(false)}>
              <X />
            </Button>
          </div>
          <CartStrip onNavigate={() => setOpen(false)} />
          <div className="relative min-h-0 flex-1 [&_.copilotKitChat]:h-full">
            <CopilotChat
              className="h-full"
              labels={{
                chatInputPlaceholder: "e.g. add one paneer masala dosa to my cart",
                welcomeMessageText: `Hi! I'm the ${restaurantName} host. Ask me about dishes, or tell me what to add to your cart.`,
                chatDisclaimerText: "AI can make mistakes. Prices are always calculated by our server. Only you can pay.",
              }}
            />
            {/* Voice seam (§14): a mic button will mount here and call submitUserMessage(text). */}
            <div data-slot="mic" className="hidden" aria-hidden />
          </div>
        </div>
      </ChatActionsProvider>
    </CopilotKitProvider>
  );
}

/** Live cart summary under the chat header: one tap to review the cart while chatting. */
function CartStrip({ onNavigate }: { onNavigate: () => void }) {
  const { cart, count } = useCart();
  if (!cart || count === 0) return null;
  return (
    <Link
      href="/cart"
      onClick={onNavigate}
      className="flex items-center gap-2 border-b bg-muted/60 px-4 py-2 text-sm transition-colors hover:bg-muted"
    >
      <ShoppingBag className="size-4 text-primary" aria-hidden />
      <span className="flex-1">
        {count} item{count === 1 ? "" : "s"} · <span className="font-medium tabular-nums">{formatINR(cart.totals.totalPaise)}</span>
      </span>
      <span className="flex items-center gap-1 text-xs font-medium">
        View cart <ArrowRight className="size-3.5" aria-hidden />
      </span>
    </Link>
  );
}
