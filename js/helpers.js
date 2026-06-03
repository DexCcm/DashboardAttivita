/* ============================================================
   HELPERS
   ============================================================ */
const $ = id => document.getElementById(id);
const css = v => getComputedStyle(document.body).getPropertyValue(v.replace(/^var\(\s*|\s*\)$/g,"")).trim() || v;
const esc = s => String(s ?? "").replace(/[&<>"']/g, m => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;" }[m]));

function toUnit(v) { return chartUnit === "days" ? v/8 : v; }
function formatUnit(v) { return toUnit(v).toFixed(2); }
function unitLabel() { return chartUnit === "days" ? "gg" : "h"; }

function parseDateValue(v) {
  if(v == null || v === "") return null;
  if(typeof v === "number") { const ms = (v - 25569) * 86400000; return new Date(ms); }
  const s = String(v).trim();
  let m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if(m) return new Date(+m[3], +m[2]-1, +m[1]);
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if(m) return new Date(+m[1], +m[2]-1, +m[3]);
  const d = new Date(s);
  return isNaN(d) ? null : d;
}
function isoDate(d) { return d.getFullYear() + "-" + String(d.getMonth()+1).padStart(2,"0") + "-" + String(d.getDate()).padStart(2,"0"); }
function workingDaysBetween(from, to) {
  const out = [];
  const cur = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const end = new Date(to.getFullYear(), to.getMonth(), to.getDate());
  while(cur <= end) {
    const wd = cur.getDay();
    if(wd !== 0 && wd !== 6 && !HOLIDAYS.has(isoDate(cur))) out.push(new Date(cur));
    cur.setDate(cur.getDate()+1);
  }
  return out;
}

const EVA_RE = /EVA[L]?\s*\d+/i;
function catFromName(n) {
  if(!n) return null;
  const t = String(n);
  if(EVA_RE.test(t)) return "EVAL";
  const tl = t.toLowerCase();
  if(/\bs\.?a\.?l\.?\b/.test(tl)) return "SAL";
  if(/\banalisi\b/.test(tl)) return "Analisi";
  if(/\bcall\b/.test(tl)) return "Call";
  if(/\bformazione\b/.test(tl)) return "Formazione";
  return null;
}
function categoryOf(task, parent, root) {
  const c = catFromName(task);
  if(c) return c;
  if(catFromName(parent) === "EVAL") return "EVAL";
  if(catFromName(root) === "EVAL")   return "EVAL";
  return "Altro";
}
function findHeaderIndex(h, names) { return h.findIndex(c => names.includes(String(c ?? "").trim())); }

