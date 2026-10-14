"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { getCartAction } from "@/app/actions/customer";
import type { CartView } from "@/lib/services/cart";
import { createClient } from "@/lib/supabase/client";
import { useSession } from "./SessionProvider";

interface CartCtx {
  cart: CartView | null;
  count: number;
  loading: boolean;
  refresh: () => Promise<void>;
  setCart: (c: CartView) => void;
}

const Ctx = createContext<CartCtx>({ cart: null, count: 0, loading: false, refresh: async () => {}, setCart: () => {} });

/**
 * Shared cart state for the header badge, cart page and chat. Refreshes on
 * Supabase Realtime changes to cart_items, so agent-made changes show instantly.
 */
export function CartProvider({ children }: { children: React.ReactNode }) {
  const session = useSession();
  const [cart, setCartState] = useState<CartView | null>(null);
  const [loading, setLoading] = useState(false);
  const inflight = useRef<Promise<void> | null>(null);

  const refresh = useCallback(async () => {
    if (!session) {
      setCartState(null);
      return;
    }
    if (inflight.current) return inflight.current;
    setLoading(true);
    inflight.current = getCartAction()
      .then((r) => {
        if (r.ok) setCartState(r.data);
      })
      .finally(() => {
        setLoading(false);
        inflight.current = null;
      });
    return inflight.current;
  }, [session]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const cartId = cart?.cart_id;
  useEffect(() => {
    if (!cartId || !process.env.NEXT_PUBLIC_SUPABASE_URL) return;
    const supabase = createClient();
    let t: ReturnType<typeof setTimeout> | undefined;
    const debounced = () => {
      clearTimeout(t);
      t = setTimeout(() => void refresh(), 150);
    };
    const channel = supabase
      .channel(`cart-${cartId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "cart_items", filter: `cart_id=eq.${cartId}` }, debounced)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "carts", filter: `id=eq.${cartId}` }, debounced)
      .subscribe();
    const onFocus = () => void refresh();
    window.addEventListener("focus", onFocus);
    return () => {
      clearTimeout(t);
      window.removeEventListener("focus", onFocus);
      void supabase.removeChannel(channel);
    };
  }, [cartId, refresh]);

  const value = useMemo(
    () => ({ cart, count: cart?.item_count ?? 0, loading, refresh, setCart: setCartState }),
    [cart, loading, refresh],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useCart = () => useContext(Ctx);
