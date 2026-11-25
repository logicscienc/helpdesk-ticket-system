import { pool } from "../../config";
import { AppError } from "../../errors";
import { publish } from "../../events";
import type { AuthUser } from "../../middleware";
import { getAccessible } from "./tickets.service";

export async function list(ticketId: string, user: AuthUser) {
  await getAccessible(ticketId, user);
  const { rows } = await pool.query(
    `SELECT c.id, c.body, c.created_at, u.id AS user_id, u.name AS author, u.role AS author_role
     FROM comments c JOIN users u ON u.id = c.user_id
     WHERE c.ticket_id = $1 ORDER BY c.created_at ASC`,
    [ticketId]
  );
  return rows;
}

export async function add(ticketId: string, user: AuthUser, body: string) {
  const ticket = await getAccessible(ticketId, user); // owner or admin only
  if (ticket.status === "CLOSED") throw new AppError(409, "Cannot comment on a closed ticket");

  const { rows } = await pool.query(
    `INSERT INTO comments (ticket_id, user_id, body) VALUES ($1, $2, $3) RETURNING *`,
    [ticketId, user.id, body]
  );
  publish("comment.added", { ticketId, actorId: user.id, data: { commentId: rows[0].id } });
  return rows[0];
}