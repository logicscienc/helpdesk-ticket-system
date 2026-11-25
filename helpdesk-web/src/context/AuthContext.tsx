import { useEffect, useState, type ReactNode } from "react";
import { api } from "../api/client";
import type { User } from "../types";
import { Ctx } from "./authStore";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(() => !!localStorage.getItem("token"));

  useEffect(() => {
    if (!localStorage.getItem("token")) return;
    api.get<User>("/auth/me")
      .then((r) => setUser(r.data))
      .catch(() => localStorage.removeItem("token"))
      .finally(() => setLoading(false));
  }, []);

  const save = (data: { token: string; user: User }) => {
    localStorage.setItem("token", data.token);
    setUser(data.user);
  };

  const login = async (email: string, password: string) =>
    save((await api.post("/auth/login", { email, password })).data);

  const register = async (name: string, email: string, password: string) =>
    save((await api.post("/auth/register", { name, email, password })).data);

  const logout = () => {
    localStorage.removeItem("token");
    setUser(null);
  };

  return <Ctx.Provider value={{ user, loading, login, register, logout }}>{children}</Ctx.Provider>;
}