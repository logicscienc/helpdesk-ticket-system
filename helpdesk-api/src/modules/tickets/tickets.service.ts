import { pool } from "../../config";
import { AppError } from "../../errors";
import { publish } from "../../events";
import type { AuthUser } from "../../middleware";

export const STATUSES = ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"] as const;
export const PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;
export const CATEGORIES = ["GENERAL", "BILLING", "TECHNICAL", "ACCOUNT", "OTHER"] as const;
export type Status = (typeof STATUSES)[number];
export type Priority = (typeof PRIORITIES)[number];
export type Category = (typeof CATEGORIES)[number];

export interface Ticket {
  id: string; user_id: string; title: string; description: string;
  category: Category; priority: Priority; status: Status;
  created_at: Date; updated_at: Date; resolved_at: Date | null; author?: string;
}

export interface ListFilters {
  status?: Status; priority?: Priority; q?: string;
  sort: "created_at" | "updated_at"; order: "asc" | "desc";
  page: number; limit: number;
}

/** Central access rule: admins see everything, users only their own (404 hides existence). */
export async function getAccessible(id: string, user: AuthUser): Promise<Ticket> {
  const { rows } = await pool.query<Ticket>(
    `SELECT t.*, u.name AS author FROM tickets t JOIN users u ON u.id = t.user_id WHERE t.id = $1`,
    [id]
  );
  const ticket = rows[0];
  if (!ticket || (user.role !== "ADMIN" && ticket.user_id !== user.id)) {
    throw new AppError(404, "Ticket not found");
  }
  return ticket;
}

export async function create(
  user: AuthUser,
  input: { title: string; description: string; category: Category; priority: Priority }
) {
  const { rows } = await pool.query<Ticket>(
    `INSERT INTO tickets (user_id, title, description, category, priority)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [user.id, input.title, input.description, input.category, input.priority]
  );
  publish("ticket.created", { ticketId: rows[0].id, actorId: user.id, data: { title: input.title } });
  return rows[0];
}

export async function list(user: AuthUser, f: ListFilters) {
  const where: string[] = [];
  const params: unknown[] = [];
  const add = (sql: string, value: unknown) => {
    params.push(value);
    where.push(sql.replaceAll("?", `$${params.length}`));
  };

  if (user.role !== "ADMIN") add("t.user_id = ?", user.id);
  if (f.status) add("t.status = ?", f.status);
  if (f.priority) add("t.priority = ?", f.priority);
  if (f.q) add("(t.title ILIKE ? OR t.description ILIKE ?)", `%${f.q}%`);

  const clause = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const offset = (f.page - 1) * f.limit;

  // f.sort / f.order are whitelisted by zod, so interpolating them is safe
  const [rows, count] = await Promise.all([
    pool.query<Ticket>(
      `SELECT t.*, u.name AS author FROM tickets t JOIN users u ON u.id = t.user_id
       ${clause} ORDER BY t.${f.sort} ${f.order}
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, f.limit, offset]
    ),
    pool.query<{ total: number }>(`SELECT count(*)::int AS total FROM tickets t ${clause}`, params),
  ]);

  const total = count.rows[0].total;
  return {
    data: rows.rows,
    meta: { page: f.page, limit: f.limit, total, totalPages: Math.ceil(total / f.limit) },
  };
}

/** Owner edits content; only while the ticket is still OPEN. */
export async function update(
  id: string,
  user: AuthUser,
  input: Partial<{ title: string; description: string; category: Category; priority: Priority }>
) {
  const ticket = await getAccessible(id, user);
  if (ticket.user_id !== user.id) throw new AppError(403, "Only the ticket owner can edit it");
  if (ticket.status !== "OPEN") throw new AppError(409, "Only OPEN tickets can be edited");

  const keys = Object.keys(input) as (keyof typeof input)[]; // keys come from the zod schema
  const sets = keys.map((k, i) => `${k} = $${i + 2}`).join(", ");
  const { rows } = await pool.query<Ticket>(
    `UPDATE tickets SET ${sets}, updated_at = now() WHERE id = $1 RETURNING *`,
    [id, ...keys.map((k) => input[k])]
  );
  publish("ticket.updated", { ticketId: id, actorId: user.id, data: { fields: keys } });
  return rows[0];
}

/** Admin changes status and/or priority. */
export async function adminUpdate(
  id: string,
  admin: AuthUser,
  input: { status?: Status; priority?: Priority }
) {
  const current = await getAccessible(id, admin);
  const status = input.status ?? current.status;
  const priority = input.priority ?? current.priority;
  const resolvedAt = status === "RESOLVED" ? current.resolved_at ?? new Date() : null;

  const { rows } = await pool.query<Ticket>(
    `UPDATE tickets SET status = $2, priority = $3, resolved_at = $4, updated_at = now()
     WHERE id = $1 RETURNING *`,
    [id, status, priority, resolvedAt]
  );

  if (priority !== current.priority) {
    publish("ticket.updated", {
      ticketId: id, actorId: admin.id,
      data: { priority: { from: current.priority, to: priority } },
    });
  }
  if (status !== current.status) {
    publish("ticket.status_changed", {
      ticketId: id, actorId: admin.id, data: { from: current.status, to: status },
    });
    if (status === "RESOLVED") publish("ticket.resolved", { ticketId: id, actorId: admin.id });
  }
  return rows[0];
}

export async function remove(id: string, user: AuthUser) {
  const ticket = await getAccessible(id, user);
  const isOwner = ticket.user_id === user.id;
  if (user.role !== "ADMIN" && (!isOwner || ticket.status !== "OPEN")) {
    throw new AppError(409, "Only OPEN tickets can be deleted by their owner");
  }
  await pool.query(`DELETE FROM tickets WHERE id = $1`, [id]);
}

export async function activity(id: string, user: AuthUser) {
  await getAccessible(id, user);
  const { rows } = await pool.query(
    `SELECT a.id, a.event_type, a.metadata, a.created_at, u.name AS actor
     FROM activity_logs a LEFT JOIN users u ON u.id = a.actor_id
     WHERE a.ticket_id = $1 ORDER BY a.created_at DESC`,
    [id]
  );
  return rows;
}


/** Admins get stats for all tickets, users for their own. */
export async function stats(user: AuthUser) {
  const isAdmin = user.role === "ADMIN";
  const scope = isAdmin ? "" : "WHERE user_id = $1";
  const params = isAdmin ? [] : [user.id];

  const [byStatus, byPriority, avg] = await Promise.all([
    pool.query<{ status: Status; count: number }>(
      `SELECT status, count(*)::int AS count FROM tickets ${scope} GROUP BY status`, params),
    pool.query<{ priority: Priority; count: number }>(
      `SELECT priority, count(*)::int AS count FROM tickets ${scope} GROUP BY priority`, params),
    pool.query<{ hours: number | null }>(
      `SELECT round((avg(extract(epoch FROM (resolved_at - created_at)) / 3600))::numeric, 1)::float AS hours
       FROM tickets ${scope ? scope + " AND" : "WHERE"} resolved_at IS NOT NULL`, params),
  ]);

  const status = Object.fromEntries(STATUSES.map((s) => [s, 0])) as Record<Status, number>;
  const priority = Object.fromEntries(PRIORITIES.map((p) => [p, 0])) as Record<Priority, number>;
  byStatus.rows.forEach((r) => (status[r.status] = r.count));
  byPriority.rows.forEach((r) => (priority[r.priority] = r.count));

  return {
    total: Object.values(status).reduce((a, b) => a + b, 0),
    byStatus: status,
    byPriority: priority,
    avgResolutionHours: avg.rows[0].hours,
  };
}