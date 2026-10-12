// Yangi buyurtma tovushi (Web Audio — fayl kerak emas)
let ctx = null;
function getCtx() {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  return ctx;
}
// Brauzer tovushni faqat foydalanuvchi bosgandan keyin ruxsat beradi
function unlockSound() {
  const c = getCtx();
  if (c && c.state === "suspended") c.resume();
}
function playOrderSound(volume = 70) {
  if (volume <= 0) return;
  const c = getCtx();
  if (!c) return;
  if (c.state === "suspended") c.resume();
  const notes = [880, 1175, 1568];
  notes.forEach((f, i) => {
    const t = c.currentTime + i * 0.18;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = "sine";
    o.frequency.value = f;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0001, 0.4 * Math.min(100, volume) / 100), t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
    o.connect(g).connect(c.destination);
    o.start(t);
    o.stop(t + 0.4);
  });
}
export { playOrderSound, unlockSound };
