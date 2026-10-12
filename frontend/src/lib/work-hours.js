const DAY_SECONDS = 86400;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

// Match the backend's daily UTC+5 schedule, including overnight hours.
export function workHoursStatus(hours, now = Date.now()) {
  if (!hours || !TIME.test(hours.open) || !TIME.test(hours.close)) return null;
  if (!hours.enabled || hours.open === hours.close) {
    return { open: true, label: "24 soat ochiq", remaining: null };
  }
  const seconds = (value) => Number(value.slice(0, 2)) * 3600 + Number(value.slice(3)) * 60;
  const current = ((Math.floor(now / 1000) + 5 * 3600) % DAY_SECONDS + DAY_SECONDS) % DAY_SECONDS;
  const start = seconds(hours.open), end = seconds(hours.close);
  const open = start < end ? current >= start && current < end : current >= start || current < end;
  const remaining = ((open ? end : start) - current + DAY_SECONDS) % DAY_SECONDS;
  const days = Math.floor(remaining / DAY_SECONDS);
  const hour = Math.floor(remaining % DAY_SECONDS / 3600);
  const minute = Math.floor(remaining % 3600 / 60);
  const second = remaining % 60;
  return {
    open,
    remaining,
    label: `${open ? "Ish tugashiga" : "Ish boshlanishiga"} qoldi: ${days} kun ${String(hour).padStart(2, "0")} soat ${String(minute).padStart(2, "0")} min ${String(second).padStart(2, "0")} sek`,
  };
}