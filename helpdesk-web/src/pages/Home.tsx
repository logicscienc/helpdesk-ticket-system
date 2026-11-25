import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { FiPlusCircle, FiList } from "react-icons/fi";
import { api } from "../api/client";
import { useAuth } from "../context/useAuth";
import { PRIORITIES, PRIORITY_STYLE } from "../constants";
import type { Stats } from "../types";

const hide = (e: React.SyntheticEvent<HTMLImageElement>) => (e.currentTarget.style.display = "none");

function StatCard({ label, value, tone }: { label: string; value: number | string; tone: string }) {
  return (
    <div className="card p-5">
      <p className="text-sm font-medium">{label}</p>
      <p className={`mt-1 inline-block rounded px-2 text-3xl font-bold ${tone}`}>{value}</p>
    </div>
  );
}

export default function Home() {
  const { user } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    api.get<Stats>("/tickets/stats").then((r) => setStats(r.data)).catch(() => {});
  }, []);

  return (
    <>
      <section className="relative overflow-hidden bg-linear-to-br from-hero-from to-hero-to">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-16">
          <div>
            <h1 className="text-5xl font-bold">Support Help</h1>
            <p className="mt-3 text-lg">Hi {user?.name}, how can we help?</p>
          </div>
          <div className="hidden items-end gap-4 md:flex">
            <img src="/images/hero-1.png" alt="" className="h-56" onError={hide} />
            <img src="/images/hero-2.png" alt="" className="h-40" onError={hide} />
          </div>
        </div>
      </section>

      {stats && (
        <section className="mx-auto max-w-4xl px-4 pt-10">
          <h2 className="mb-4 text-xl font-bold">
            {user?.role === "ADMIN" ? "Ticket overview" : "Your tickets at a glance"}
          </h2>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <StatCard label="Total" value={stats.total} tone="bg-chip" />
            <StatCard label="Open" value={stats.byStatus.OPEN} tone="bg-blue-100 text-blue-800" />
            <StatCard label="In progress" value={stats.byStatus.IN_PROGRESS} tone="bg-amber-100 text-amber-800" />
            <StatCard label="Resolved" value={stats.byStatus.RESOLVED} tone="bg-green-100 text-green-800" />
          </div>
          <div className="card mt-4 flex flex-wrap items-center gap-3 p-4 text-sm">
            <span className="font-semibold">By priority:</span>
            {PRIORITIES.map((p) => (
              <span key={p} className={`rounded-full px-3 py-1 font-semibold ${PRIORITY_STYLE[p]}`}>
                {p}: {stats.byPriority[p]}
              </span>
            ))}
            {stats.avgResolutionHours !== null && (
              <span className="ml-auto">Avg. resolution: <b>{stats.avgResolutionHours} h</b></span>
            )}
          </div>
        </section>
      )}

      <section className="mx-auto grid max-w-4xl gap-6 px-4 py-10 sm:grid-cols-2">
        <Link to="/tickets/new" className="card flex items-center gap-4 p-6 transition hover:-translate-y-0.5">
          <FiPlusCircle className="text-3xl" />
          <span className="text-lg font-semibold">Raise a new ticket</span>
        </Link>
        <Link to="/tickets" className="card flex items-center gap-4 p-6 transition hover:-translate-y-0.5">
          <FiList className="text-3xl" />
          <span className="text-lg font-semibold">{user?.role === "ADMIN" ? "Manage all tickets" : "View my tickets"}</span>
        </Link>
      </section>
    </>
  );
}