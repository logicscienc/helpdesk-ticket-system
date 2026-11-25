import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { FiPlus, FiSearch } from "react-icons/fi";
import toast from "react-hot-toast";
import { api, errMsg } from "../api/client";
import { useAuth } from "../context/useAuth";
import StatusBadge, { PriorityBadge } from "../components/StatusBadge";
import { PRIORITIES, STATUSES } from "../constants";
import type { Ticket } from "../types";

interface Meta { page: number; limit: number; total: number; totalPages: number }
interface Result { key: string; data: Ticket[]; meta: Meta }

export default function Tickets() {
  const { user } = useAuth();
  const isAdmin = user?.role === "ADMIN";
  const [params, setParams] = useState({ status: "", priority: "", q: "", page: 1 });
  const [search, setSearch] = useState("");
  const [result, setResult] = useState<Result | null>(null);

  const key = JSON.stringify(params);
  const loading = result?.key !== key;

  useEffect(() => {
    let cancelled = false;
    api
      .get<{ data: Ticket[]; meta: Meta }>("/tickets", {
        params: {
          status: params.status || undefined,
          priority: params.priority || undefined,
          q: params.q || undefined,
          page: params.page,
          limit: 8,
        },
      })
      .then((r) => !cancelled && setResult({ key, ...r.data }))
      .catch((e) => toast.error(errMsg(e)));
    return () => { cancelled = true; };
  }, [key, params]);

  const onSearch = (e: FormEvent) => {
    e.preventDefault();
    setParams({ ...params, q: search.trim(), page: 1 });
  };

  const tickets = result?.data ?? [];
  const meta = result?.meta;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">{isAdmin ? "All tickets" : "My tickets"}</h1>
        <Link to="/tickets/new" className="btn-primary"><FiPlus /> New ticket</Link>
      </div>

      <div className="card mb-4 flex flex-wrap gap-3 p-4">
        <form onSubmit={onSearch} className="flex min-w-60 flex-1 gap-2">
          <input className="input" placeholder="Search title or description..." value={search}
            onChange={(e) => setSearch(e.target.value)} />
          <button className="btn-primary"><FiSearch /></button>
        </form>
        <select className="input w-auto" value={params.status}
          onChange={(e) => setParams({ ...params, status: e.target.value, page: 1 })}>
          <option value="">All statuses</option>
          {STATUSES.map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
        </select>
        <select className="input w-auto" value={params.priority}
          onChange={(e) => setParams({ ...params, priority: e.target.value, page: 1 })}>
          <option value="">All priorities</option>
          {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-line bg-chip text-xs uppercase">
            <tr>
              <th className="p-3">Title</th>
              {isAdmin && <th className="p-3">Author</th>}
              <th className="p-3">Category</th>
              <th className="p-3">Priority</th>
              <th className="p-3">Status</th>
              <th className="p-3">Created</th>
            </tr>
          </thead>
          <tbody>
            {tickets.map((t) => (
              <tr key={t.id} className="border-b border-line last:border-0 hover:bg-surface">
                <td className="p-3 font-medium">
                  <Link to={`/tickets/${t.id}`} className="underline-offset-2 hover:underline">{t.title}</Link>
                </td>
                {isAdmin && <td className="p-3">{t.author}</td>}
                <td className="p-3">{t.category}</td>
                <td className="p-3"><PriorityBadge priority={t.priority} /></td>
                <td className="p-3"><StatusBadge status={t.status} /></td>
                <td className="p-3">{new Date(t.created_at).toLocaleDateString()}</td>
              </tr>
            ))}
            {!loading && tickets.length === 0 && (
              <tr><td colSpan={6} className="p-8 text-center">No tickets found.</td></tr>
            )}
            {loading && (
              <tr><td colSpan={6} className="p-8 text-center">Loading...</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {meta && meta.totalPages > 1 && (
        <div className="mt-4 flex items-center justify-center gap-3 text-sm">
          <button className="btn-ghost" disabled={meta.page <= 1}
            onClick={() => setParams({ ...params, page: params.page - 1 })}>Previous</button>
          <span>Page {meta.page} of {meta.totalPages} ({meta.total} tickets)</span>
          <button className="btn-ghost" disabled={meta.page >= meta.totalPages}
            onClick={() => setParams({ ...params, page: params.page + 1 })}>Next</button>
        </div>
      )}
    </div>
  );
}