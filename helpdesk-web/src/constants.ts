import type { Category, Priority, Status } from "./types";

export const STATUSES: Status[] = ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"];
export const PRIORITIES: Priority[] = ["LOW", "MEDIUM", "HIGH", "URGENT"];
export const CATEGORIES: Category[] = ["GENERAL", "BILLING", "TECHNICAL", "ACCOUNT", "OTHER"];

export const STATUS_STYLE: Record<Status, string> = {
  OPEN: "bg-blue-100 text-blue-800",
  IN_PROGRESS: "bg-amber-100 text-amber-800",
  RESOLVED: "bg-green-100 text-green-800",
  CLOSED: "bg-gray-200 text-gray-700",
};

export const PRIORITY_STYLE: Record<Priority, string> = {
  LOW: "bg-gray-100 text-gray-700",
  MEDIUM: "bg-sky-100 text-sky-800",
  HIGH: "bg-orange-100 text-orange-800",
  URGENT: "bg-red-100 text-red-800",
};

export const EVENT_LABEL: Record<string, string> = {
  "ticket.created": "Ticket created",
  "ticket.updated": "Ticket updated",
  "ticket.status_changed": "Status changed",
  "comment.added": "Comment added",
  "ticket.resolved": "Ticket resolved",
};