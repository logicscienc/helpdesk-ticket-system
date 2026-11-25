import { createContext } from "react";
import type { User } from "../types";

export interface AuthCtx {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
}

export const Ctx = createContext<AuthCtx | null>(null);