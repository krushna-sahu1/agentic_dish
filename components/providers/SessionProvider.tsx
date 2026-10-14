"use client";

import { createContext, useContext } from "react";
import type { Role } from "@/lib/types";

export interface ClientSession {
  userId: string;
  email: string | null;
  name: string | null;
  role: Role;
  allergies: string[];
  dietaryPrefs: string[];
  spiceTolerance: number;
}

const Ctx = createContext<ClientSession | null>(null);

export function SessionProvider({ session, children }: { session: ClientSession | null; children: React.ReactNode }) {
  return <Ctx.Provider value={session}>{children}</Ctx.Provider>;
}

export const useSession = () => useContext(Ctx);
