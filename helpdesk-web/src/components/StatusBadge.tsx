import { PRIORITY_STYLE, STATUS_STYLE } from "../constants";
import type { Priority, Status } from "../types";

const base = "rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap";

export default function StatusBadge({ status }: { status: Status }) {
  return <span className={`${base} ${STATUS_STYLE[status]}`}>{status.replace("_", " ")}</span>;
}

export function PriorityBadge({ priority }: { priority: Priority }) {
  return <span className={`${base} ${PRIORITY_STYLE[priority]}`}>{priority}</span>;
}