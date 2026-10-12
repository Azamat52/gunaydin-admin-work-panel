import { test } from "node:test";
import assert from "node:assert/strict";
import { workHoursStatus } from "./work-hours.js";

const at = (time) => Date.parse(`2026-10-11T${time}+05:00`);
const daily = { enabled: true, open: "09:00", close: "23:00" };

test("counts down each second until opening and switches at the boundary", () => {
  assert.equal(workHoursStatus(daily, at("08:59:58")).remaining, 2);
  assert.equal(workHoursStatus(daily, at("08:59:59")).label, "Ish boshlanishiga qoldi: 0 kun 00 soat 00 min 01 sek");
  assert.equal(workHoursStatus(daily, at("09:00:00")).open, true);
  assert.equal(workHoursStatus(daily, at("09:00:00")).remaining, 14 * 3600);
});
test("counts down to closing and then the next day's opening", () => {
  assert.equal(workHoursStatus(daily, at("22:59:59")).label, "Ish tugashiga qoldi: 0 kun 00 soat 00 min 01 sek");
  assert.equal(workHoursStatus(daily, at("23:00:00")).open, false);
  assert.equal(workHoursStatus(daily, at("23:00:00")).remaining, 10 * 3600);
});
test("overnight schedule stays open past midnight", () => {
  const overnight = { enabled: true, open: "18:00", close: "03:00" };
  assert.equal(workHoursStatus(overnight, at("23:00:00")).remaining, 4 * 3600);
  assert.equal(workHoursStatus(overnight, at("02:59:59")).open, true);
  assert.equal(workHoursStatus(overnight, at("03:00:00")).remaining, 15 * 3600);
  assert.equal(workHoursStatus(overnight, at("17:59:59")).open, false);
});
test("disabled and equal times mean always open; invalid input is ignored", () => {
  assert.deepEqual(workHoursStatus({ ...daily, enabled: false }), { open: true, label: "24 soat ochiq", remaining: null });
  assert.equal(workHoursStatus({ ...daily, close: "09:00" }).remaining, null);
  assert.equal(workHoursStatus({ ...daily, open: "25:00" }), null);
});