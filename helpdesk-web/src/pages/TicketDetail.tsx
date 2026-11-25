import { useEffect, useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { FiEdit2, FiTrash2 } from "react-icons/fi";
import toast from "react-hot-toast";
import { api, errMsg } from "../api/client";
import { useAuth } from "../context/useAuth";
import StatusBadge, { PriorityBadge } from "../components/StatusBadge";
import { EVENT_LABEL, PRIORITIES, STATUSES } from "../constants";
import type { Ticket, TicketComment } from "../types";

interface Activity {
  id: string; event_type: string; actor: string | null; created_at: string;
  metadata: { from?: string; to?: string; fields?: string[]; priority?: { from: string; to: string } };
}
interface Bundle { key: string; ticket: Ticket; comments: TicketComment[]; activity: Activity[] }

function describe(a: Activity) {
  const m = a.metadata;
  if (a.event_type === "ticket.status_changed") return `${m.from} → ${m.to}`;
  if (a.event_type === "ticket.updated" && m.priority) return `Priority ${m.priority.from} → ${m.priority.to}`;
  if (a.event_type === "ticket.updated" && m.fields) return `Edited: ${m.fields.join(", ")}`;
  return "";
}

export default function TicketDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [version, setVersion] = useState(0);
  const [data, setData] = useState<Bundle | null>(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ title: "", description: "" });
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);

  const key = `${id}:${version}`;
  const refresh = () => setVersion((v) => v + 1);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      api.get<Ticket>(`/tickets/${id}`),
      api.get<TicketComment[]>(`/tickets/${id}/comments`),
      api.get<Activity[]>(`/tickets/${id}/activity`),
    ])
      .then(([t, c, a]) => {
        if (!cancelled) setData({ key, ticket: t.data, comments: c.data, activity: a.data });
      })
      .catch((e) => {
        toast.error(errMsg(e));
        navigate("/tickets");
      });
    return () => { cancelled = true; };
  }, [id, key, navigate]);

  if (!data || !user) return <p className="p-8 text-center">Loading...</p>;
  const { ticket: t, comments, activity } = data;

  const isAdmin = user.role === "ADMIN";
  const canEdit = user.id === t.user_id && t.status === "OPEN";
  const canDelete = isAdmin || canEdit;

  const run = async (fn: () => Promise<unknown>, success: string) => {
    setBusy(true);
    try {
      await fn();
      toast.success(success);
      refresh();
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setBusy(false);
    }
  };

  const startEdit = () => {
    setForm({ title: t.title, description: t.description });
    setEditing(true);
  };

  const saveEdit = (e: FormEvent) => {
    e.preventDefault();
    run(async () => {
      await api.patch(`/tickets/${t.id}`, form);
      setEditing(false);
    }, "Ticket updated");
  };

  const remove = async () => {
    if (!confirm("Delete this ticket permanently?")) return;
    try {
      await api.delete(`/tickets/${t.id}`);
      toast.success("Ticket deleted");
      navigate("/tickets");
    } catch (err) {
      toast.error(errMsg(err));
    }
  };

  const manage = (patch: { status?: string; priority?: string }) =>
    run(() => api.patch(`/tickets/${t.id}/manage`, patch), "Ticket updated");

  const addComment = (e: FormEvent) => {
    e.preventDefault();
    run(async () => {
      await api.post(`/tickets/${t.id}/comments`, { body: comment });
      setComment("");
    }, "Comment added");
  };

  return (
    <div className="mx-auto grid max-w-6xl gap-6 px-4 py-8 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        <div className="card p-6">
          {editing ? (
            <form onSubmit={saveEdit} className="space-y-3">
              <input className="input" required minLength={3} value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })} />
              <textarea className="input min-h-32" required minLength={10} value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })} />
              <div className="flex gap-2">
                <button className="btn-primary" disabled={busy}>Save</button>
                <button type="button" className="btn-ghost" onClick={() => setEditing(false)}>Cancel</button>
              </div>
            </form>
          ) : (
            <>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <h1 className="text-2xl font-bold">{t.title}</h1>
                <div className="flex gap-2">
                  {canEdit && <button className="btn-ghost" onClick={startEdit}><FiEdit2 /> Edit</button>}
                  {canDelete && <button className="btn-ghost text-red-700" onClick={remove}><FiTrash2 /> Delete</button>}
                </div>
              </div>
              <div className="my-3 flex flex-wrap items-center gap-2">
                <StatusBadge status={t.status} />
                <PriorityBadge priority={t.priority} />
                <span className="rounded-full bg-chip px-2.5 py-0.5 text-xs font-semibold">{t.category}</span>
              </div>
              <p className="whitespace-pre-wrap">{t.description}</p>
              <p className="mt-4 text-xs text-brand/70">
                By {t.author} · {new Date(t.created_at).toLocaleString()}
              </p>
            </>
          )}
        </div>

        <div className="card p-6">
          <h2 className="mb-4 text-lg font-bold">Comments ({comments.length})</h2>
          <div className="space-y-3">
            {comments.length === 0 && <p className="text-sm">No comments yet.</p>}
            {comments.map((c) => (
              <div key={c.id} className={`rounded-md p-3 text-sm ${c.author_role === "ADMIN" ? "bg-hero-to/40" : "bg-chip"}`}>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="font-semibold">
                    {c.author} {c.author_role === "ADMIN" && <span className="ml-1 rounded bg-brand px-1.5 py-0.5 text-white">Support</span>}
                  </span>
                  <span>{new Date(c.created_at).toLocaleString()}</span>
                </div>
                <p className="whitespace-pre-wrap">{c.body}</p>
              </div>
            ))}
          </div>
          {t.status === "CLOSED" ? (
            <p className="mt-4 text-sm">This ticket is closed, so new comments are disabled.</p>
          ) : (
            <form onSubmit={addComment} className="mt-4 space-y-2">
              <textarea className="input" placeholder="Write a comment..." required maxLength={2000}
                value={comment} onChange={(e) => setComment(e.target.value)} />
              <button className="btn-primary" disabled={busy}>Add comment</button>
            </form>
          )}
        </div>
      </div>

      <div className="space-y-6">
        {isAdmin && (
          <div className="card space-y-3 p-6">
            <h2 className="text-lg font-bold">Admin controls</h2>
            <label className="block text-sm font-medium">Status
              <select className="input mt-1" value={t.status} disabled={busy}
                onChange={(e) => manage({ status: e.target.value })}>
                {STATUSES.map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
              </select>
            </label>
            <label className="block text-sm font-medium">Priority
              <select className="input mt-1" value={t.priority} disabled={busy}
                onChange={(e) => manage({ priority: e.target.value })}>
                {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </label>
          </div>
        )}

        <div className="card p-6">
          <h2 className="mb-4 text-lg font-bold">Activity</h2>
          <ul className="space-y-3 text-sm">
            {activity.map((a) => (
              <li key={a.id} className="border-l-2 border-hero-from pl-3">
                <p className="font-semibold">{EVENT_LABEL[a.event_type] ?? a.event_type}</p>
                {describe(a) && <p>{describe(a)}</p>}
                <p className="text-xs text-brand/70">{a.actor ?? "System"} · {new Date(a.created_at).toLocaleString()}</p>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}