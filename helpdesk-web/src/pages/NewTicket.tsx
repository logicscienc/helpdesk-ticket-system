import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { api, errMsg } from "../api/client";
import { CATEGORIES, PRIORITIES } from "../constants";
import type { Ticket } from "../types";

export default function NewTicket() {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", category: "GENERAL", priority: "MEDIUM" });

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { data } = await api.post<Ticket>("/tickets", form);
      toast.success("Ticket created");
      navigate(`/tickets/${data.id}`);
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold">Raise a new ticket</h1>
      <form onSubmit={onSubmit} className="card space-y-4 p-6">
        <input className="input" placeholder="Title" required minLength={3} maxLength={200}
          value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
        <textarea className="input min-h-32" placeholder="Describe your issue (min 10 characters)" required minLength={10}
          value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        <div className="grid gap-4 sm:grid-cols-2">
          <select className="input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
            {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
          </select>
          <select className="input" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
            {PRIORITIES.map((p) => <option key={p}>{p}</option>)}
          </select>
        </div>
        <button className="btn-primary" disabled={busy}>{busy ? "Submitting..." : "Submit ticket"}</button>
      </form>
    </div>
  );
}