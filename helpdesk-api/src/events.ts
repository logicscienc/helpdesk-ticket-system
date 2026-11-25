import { EventEmitter } from "node:events";
import { pool } from "./config";

export type EventName =
  | "ticket.created"
  | "ticket.updated"
  | "ticket.status_changed"
  | "comment.added"
  | "ticket.resolved";

export interface AppEvent {
  ticketId: string;
  actorId: string;
  data?: Record<string, unknown>;
}

const bus = new EventEmitter();

export const publish = (event: EventName, payload: AppEvent) => bus.emit(event, payload);

const EVENTS: EventName[] = [
  "ticket.created",
  "ticket.updated",
  "ticket.status_changed",
  "comment.added",
  "ticket.resolved",
];

export function registerListeners() {
  for (const name of EVENTS) {
    // Action: persist every event to the activity log.
    bus.on(name, async ({ ticketId, actorId, data }: AppEvent) => {
      try {
        await pool.query(
          `INSERT INTO activity_logs (ticket_id, actor_id, event_type, metadata)
           VALUES ($1, $2, $3, $4)`,
          [ticketId, actorId, name, JSON.stringify(data ?? {})]
        );
      } catch (e) {
        console.error(`[${name}] activity log failed`, e); // never break the request
      }
    });
  }
  // More actions can subscribe here later (email, notifications, webhooks).
}