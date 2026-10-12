import { STATUS_LABELS } from "@/lib/bot-types";
import { cn } from "@/lib/utils";
const STYLES = {
  new: "bg-primary/20 text-primary",
  received: "bg-info/15 text-info",
  preparing: "bg-warning/15 text-warning",
  on_way: "bg-primary/15 text-primary",
  delivered: "bg-success/15 text-success",
  ready_pickup: "bg-warning/15 text-warning",
  picked_up: "bg-success/15 text-success",
  cancelled: "bg-destructive/15 text-destructive"
};
function StatusBadge({ status, className }) {
  return <span
    className={cn(
      "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
      STYLES[status],
      className
    )}
  >
      {STATUS_LABELS[status]}
    </span>;
}
export {
  StatusBadge
};
