import { Inbox } from "lucide-react";
function EmptyState({
  icon: Icon = Inbox,
  title = "Hali ma'lumotlar yo'q",
  hint,
  className = ""
}) {
  return <div
    className={`flex flex-col items-center justify-center gap-1 px-4 py-10 text-center ${className}`}
  >
      <span className="flex size-12 items-center justify-center rounded-full bg-muted">
        <Icon className="size-6 text-muted-foreground" />
      </span>
      <p className="mt-1 text-sm font-medium">{title}</p>
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>;
}
export {
  EmptyState
};
