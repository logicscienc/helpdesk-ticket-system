export type Role = "USER" | "ADMIN";
export type Status = "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED";
export type Priority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";
export type Category = "GENERAL" | "BILLING" | "TECHNICAL" | "ACCOUNT" | "OTHER";

export interface User { id: string; name: string; email: string; role: Role }

export interface Ticket {
  id: string; user_id: string; title: string; description: string;
  category: Category; priority: Priority; status: Status;
  created_at: string; updated_at: string; resolved_at: string | null; author?: string;
}

export interface TicketComment {
  id: string; body: string; created_at: string;
  user_id: string; author: string; author_role: Role;
}

export interface Stats {
  total: number;
  byStatus: Record<Status, number>;
  byPriority: Record<Priority, number>;
  avgResolutionHours: number | null;
}