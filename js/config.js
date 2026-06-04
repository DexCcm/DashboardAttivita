/* ============================================================
   STATE
   ============================================================ */
let rawData = [];
let currentView = "project";
let chartUnit = "hours";
let chartMode = "total";
let selProjects = [], selTasks = [], selUsers = [];
let chartProjects = null, chartDonut = null;

let sortTotali = { key: "ore", dir: "desc" };
let sortPivot  = { key: "__tot__", dir: "desc" };
let sortDetail = { key: "data", dir: "asc" };

let totaliData = null;
let pivotCache = null;
let detailRows = [];
let detailTitle = "";

/* Plafond state — usato da plafond.js e firebase.js */
let pfTotali    = [];
let pfDettaglio = [];
let pfPending   = [];

const TEAM_ROLES = {
  "Simone Viscomi": "PM / Lead",
  "Damiano Angioletti": "Developer",
  "Leonardo Fantozzi": "Developer",
  "Samuela Carnelli": "Developer"
};
function roleOf(n) { return TEAM_ROLES[n] || "Developer"; }

const HOLIDAYS = new Set([
  "2024-01-01","2024-01-06","2024-04-01","2024-04-25","2024-05-01","2024-06-02","2024-08-15","2024-11-01","2024-12-08","2024-12-25","2024-12-26",
  "2025-01-01","2025-01-06","2025-04-21","2025-04-25","2025-05-01","2025-06-02","2025-08-15","2025-11-01","2025-12-08","2025-12-25","2025-12-26",
  "2026-01-01","2026-01-06","2026-04-06","2026-04-25","2026-05-01","2026-06-02","2026-08-15","2026-11-01","2026-12-08","2026-12-25","2026-12-26",
  "2027-01-01","2027-01-06","2027-03-29","2027-04-25","2027-05-01","2027-06-02","2027-08-15","2027-11-01","2027-12-08","2027-12-25","2027-12-26"
]);

const CAT_COLORS = {
  "EVAL Credem":   "var(--accent-1)",
  "SAL":           "var(--accent-2)",
  "Analisi":       "var(--accent-3)",
  "Call":          "var(--accent-5)",
  "Formazione":    "var(--accent-4)",
  "Credem - Altro":"var(--muted-2)"
};

/* Palette dinamica per client non-Credem */
const CAT_DYN_PALETTE = ["--good","--accent-3","--accent-4","--accent-5","--warn","--accent-2","--muted","--border-strong"];
const _catDynCache = {};
let _catDynIdx = 0;
function catColor(cat) {
  if(CAT_COLORS[cat]) return CAT_COLORS[cat];
  if(!_catDynCache[cat]) { _catDynCache[cat] = `var(${CAT_DYN_PALETTE[_catDynIdx++ % CAT_DYN_PALETTE.length]})`; }
  return _catDynCache[cat];
}

const CAT_ORDER = ["EVAL Credem","SAL","Analisi","Call","Formazione","Credem - Altro"];

const USER_PALETTE = [
  "--accent-1","--accent-2","--accent-3","--accent-4","--accent-5",
  "--good","--warn","--muted-2"
];
