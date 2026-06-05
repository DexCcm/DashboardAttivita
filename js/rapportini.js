/* ============================================================
   NAV
   ============================================================ */
document.querySelectorAll(".nav-btn").forEach(btn => {
  btn.onclick = () => {
    const p = btn.dataset.page;
    document.querySelectorAll(".nav-btn").forEach(b => b.classList.toggle("active", b === btn));
    document.querySelectorAll(".page").forEach(pg => pg.classList.toggle("active", pg.id === "page-" + p));
    window.scrollTo({ top: 0, behavior: "smooth" });
    if(chartProjects) chartProjects.resize();
    if(chartDonut) chartDonut.resize();
  };
});

/* ============================================================
   IMPORT (Rapportini)
   ============================================================ */
$("btnImport").onclick = () => $("fileInput").click();
$("btnReset").onclick = () => location.reload();

$("fileInput").onchange = e => {
  rawData = [];
  selProjects = []; selTasks = []; selUsers = [];
  let pending = e.target.files.length;
  [...e.target.files].forEach(f => {
    const r = new FileReader();
    const xml = f.name.toLowerCase().endsWith(".xml");
    r.onload = ev => {
      try {
        const wb = XLSX.read(ev.target.result, { type: xml ? "string" : "array" });
        const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1 });
        const h = rows[0] || [];
        const idx = {
          u: findHeaderIndex(h, ["Utente","User"]),
          p: h.indexOf("Project Name"),
          t: findHeaderIndex(h, ["Compito/Generale/Issue","Compito/Generale/Problema","Task/General/Issue"]),
          o: h.indexOf("Hours(For Calculation)"),
          d: findHeaderIndex(h, ["Data","Date"]),
          pa: findHeaderIndex(h, ["Parent task","Parent Task","Compito padre"]),
          ro: findHeaderIndex(h, ["Root Task","Root task","Compito radice"])
        };
        rows.slice(1).forEach(r => {
          if(r.some(c => {
            const s = String(c || "");
            return s.includes("Totale ore di log") || s.includes("Total Log Hours") || s.includes("Total Hours(For");
          })) return;
          const utente = r[idx.u];
          if(!utente || String(utente).trim() === "") return;
          const ore = parseFloat(r[idx.o]);
          if(isNaN(ore)) return;
          const data = idx.d >= 0 ? parseDateValue(r[idx.d]) : null;
          const compito = r[idx.t];
          const parent = idx.pa >= 0 ? r[idx.pa] : null;
          const root = idx.ro >= 0 ? r[idx.ro] : null;
          rawData.push({
            utente,
            progetto: r[idx.p],
            compito,
            parent, root,
            ore,
            data,
            categoria: categoryOf(compito, parent, root, r[idx.p])
          });
        });
      } catch(err) { console.error("Errore parsing", f.name, err); }
      pending--;
      if(pending === 0) { initUI(); renderAll(); }
    };
    xml ? r.readAsText(f) : r.readAsArrayBuffer(f);
  });
};

/* ============================================================
   DROPDOWN MULTI-SELECT
   ============================================================ */
document.addEventListener("click", e => {
  document.querySelectorAll(".dropdownMenu").forEach(m => {
    if(!m.parentElement.contains(e.target)) m.classList.remove("open");
  });
});
document.querySelectorAll(".dropdownBtn").forEach(b => {
  b.onclick = e => {
    const menu = b.nextElementSibling;
    const wasOpen = menu.classList.contains("open");
    document.querySelectorAll(".dropdownMenu").forEach(m => m.classList.remove("open"));
    if(!wasOpen) menu.classList.add("open");
    e.stopPropagation();
  };
});

function initUI() {
  buildMenu("projectMenu", [...new Set(rawData.map(r => r.progetto).filter(Boolean))].sort(), selProjects, "cntProjects");
  buildMenu("taskMenu",    [...new Set(rawData.map(r => r.compito).filter(Boolean))].sort(),  selTasks,    "cntTasks");
  buildMenu("userMenu",    [...new Set(rawData.map(r => r.utente).filter(Boolean))].sort(),   selUsers,    "cntUsers");
  const dates = rawData.map(r => r.data).filter(Boolean);
  if(dates.length) {
    const minD = new Date(Math.min(...dates)), maxD = new Date(Math.max(...dates));
    const fmtD = d => d.toLocaleDateString("it-IT",{day:"2-digit",month:"short",year:"numeric"});
    $("metaPeriodo").textContent = fmtD(minD) + " · " + fmtD(maxD);
  }
  $("navMetaR").innerHTML = formatUnit(rawData.reduce((s,r)=>s+r.ore,0)) + " " + unitLabel() + "<br/>" + new Set(rawData.map(r=>r.utente)).size + " utenti";
}
window.initUI = initUI;
function buildMenu(id, values, store, countId) {
  const menu = $(id);
  menu.innerHTML = "";
  values.forEach(v => {
    const l = document.createElement("label");
    l.innerHTML = `<input type="checkbox"> ${esc(v)}`;
    l.querySelector("input").onchange = e => {
      if(e.target.checked) store.push(v); else store.splice(store.indexOf(v), 1);
      updateCountBadge(countId, store.length);
      renderAll();
    };
    menu.appendChild(l);
  });
  updateCountBadge(countId, store.length);
}
function updateCountBadge(id, n) {
  const b = $(id);
  if(!b) return;
  b.style.display = n > 0 ? "inline-flex" : "none";
  b.textContent = n;
}

/* ============================================================
   FILTERS / VIEW SEG
   ============================================================ */
document.querySelectorAll("#segView button").forEach(b => {
  b.onclick = () => {
    document.querySelectorAll("#segView button").forEach(x => x.classList.toggle("active", x === b));
    currentView = b.dataset.view;
    $("ddProjects").style.display = currentView === "project" ? "" : "none";
    $("ddTasks").style.display    = currentView === "task" ? "" : "none";
    $("chartSub").textContent = "Riepilogo per " + (currentView === "task" ? "task" : "progetto");
    $("pivotTitleKey").textContent = "Utente × " + (currentView === "task" ? "Task" : "Progetto");
    renderAll();
  };
});
document.querySelectorAll("#segUnit button").forEach(b => {
  b.onclick = () => {
    document.querySelectorAll("#segUnit button").forEach(x => x.classList.toggle("active", x === b));
    chartUnit = b.dataset.unit;
    renderAll();
  };
});
document.querySelectorAll("#segChartMode button").forEach(b => {
  b.onclick = () => {
    document.querySelectorAll("#segChartMode button").forEach(x => x.classList.toggle("active", x === b));
    chartMode = b.dataset.cm;
    renderProjectsChart(filtered());
  };
});
document.querySelectorAll("#segUserView button").forEach(b => {
  b.onclick = () => {
    document.querySelectorAll("#segUserView button").forEach(x => x.classList.toggle("active", x === b));
    const target = b.dataset.uv;
    $("userCardsWrap").style.display  = target === "cards"  ? "" : "none";
    $("userTotaliWrap").style.display = target === "totali" ? "" : "none";
  };
});

$("searchTxt").addEventListener("input", () => renderAll());

function filtered() {
  const q = $("searchTxt").value.trim().toLowerCase();
  return rawData.filter(r => {
    if(selUsers.length && !selUsers.includes(r.utente)) return false;
    if(currentView === "project" && selProjects.length && !selProjects.includes(r.progetto)) return false;
    if(currentView === "task"    && selTasks.length    && !selTasks.includes(r.compito)) return false;
    if(q) {
      const hay = `${r.utente||""} ${r.progetto||""} ${r.compito||""}`.toLowerCase();
      if(!hay.includes(q)) return false;
    }
    return true;
  });
}

/* ============================================================
   RENDER
   ============================================================ */
function renderAll() {
  const d = filtered();

  // KPI
  const tot = d.reduce((s,r)=>s+r.ore, 0);
  $("kpiHours").textContent = formatUnit(tot);
  $("kpiHoursUnit").textContent = unitLabel();
  $("kpiUsers").textContent = new Set(d.map(r=>r.utente)).size;
  $("kpiProjects").textContent = new Set(d.map(r=>r.progetto)).size;
  $("kpiTasksR").textContent = new Set(d.map(r=>r.compito)).size;
  $("kpiHoursSub").textContent = d.length ? `${d.length} record` : "Importa i rapportini";

  // Periodo (masthead)
  const dates = d.map(r => r.data).filter(Boolean);
  if(dates.length) {
    const min = new Date(Math.min(...dates));
    const max = new Date(Math.max(...dates));
    const fmt = dt => dt.toLocaleDateString("it-IT", { day:"2-digit", month:"short" });
    $("metaPeriodo").textContent = `${fmt(min)} — ${fmt(max)} ${max.getFullYear()}`;
  } else {
    $("metaPeriodo").textContent = "— · —";
  }
  // Nav meta
  $("navMetaR").innerHTML = `${formatUnit(tot)} ${unitLabel()}<br/>${new Set(d.map(r=>r.utente)).size} utenti`;

  renderUserCards(d);
  buildTotaliData(d);
  drawTotali();
  renderProjectsChart(d);
  renderCategoriesDonut(d);
  buildPivot(d);
  drawPivot();
}

function renderUserCards(d) {
  const periodoEl = $("utentiPeriodo");
  const listEl = $("userList");
  if(!d.length) {
    periodoEl.textContent = "Importa i rapportini per vedere la panoramica per utente";
    listEl.innerHTML = `<div style="padding:60px 24px;text-align:center;color:var(--muted);font-size:13px">Nessun dato</div>`;
    return;
  }

  const dates = d.map(r => r.data).filter(Boolean);
  let teoriche = 0, workingDays = [];
  if(dates.length) {
    const minD = new Date(Math.min(...dates));
    const maxD = new Date(Math.max(...dates));
    workingDays = workingDaysBetween(minD, maxD);
    teoriche = workingDays.length * 8;
    periodoEl.innerHTML = `<b>${workingDays.length}</b> giorni lavorativi · <b>${teoriche}h</b> teoriche per persona · festività italiane escluse`;
  } else {
    periodoEl.textContent = "Date non presenti — impossibile calcolare ferie/assenze";
  }

  const users = [...new Set(d.map(r => r.utente))].sort();
  let html = "";
  users.forEach(u => {
    const sub = d.filter(r => r.utente === u);
    const ore = sub.reduce((s,r)=>s+r.ore, 0);
    const role = roleOf(u);
    let pieni=0, parz=0, ass=0, ferie=0;
    if(workingDays.length) {
      const byDay = {};
      sub.forEach(r => { if(r.data) { const k = isoDate(r.data); byDay[k] = (byDay[k]||0) + r.ore; } });
      workingDays.forEach(wd => {
        const h = byDay[isoDate(wd)] || 0;
        if(h >= 8) pieni++; else if(h > 0) parz++; else ass++;
      });
      ferie = Math.max(0, teoriche - ore);
    }
    const byCat = {};
    sub.forEach(r => { byCat[r.categoria] = (byCat[r.categoria]||0) + r.ore; });
    const coord = (byCat.SAL||0) + (byCat.Call||0) + (byCat.Analisi||0);
    const coordPct = ore ? coord/ore : 0;
    const flag = role === "Developer" && coordPct > 0.20;
    const tag = flag
      ? `<span class="tag bad">Coord ${(coordPct*100).toFixed(0)}%</span>`
      : role === "PM / Lead"
        ? `<span class="tag info">PM · ${(coordPct*100).toFixed(0)}%</span>`
        : `<span class="tag ok">Coord ${(coordPct*100).toFixed(0)}%</span>`;

    const refStr = teoriche
      ? `${unitLabel()} / ${chartUnit==='days'? (teoriche/8).toFixed(0) : teoriche}${unitLabel()} · ${Math.round(ore/teoriche*100)}%`
      : `${unitLabel()} totali`;

    // Stack bar by category
    const totCat = Object.values(byCat).reduce((a,b)=>a+b, 0);
    const bars = Object.entries(byCat).map(([k,v]) => {
      if(!v) return "";
      const w = totCat ? (v/totCat*100) : 0;
      return `<div class="seg-bar" style="width:${w}%;background:${css(catColor(k))}" title="${k}: ${formatUnit(v)} ${unitLabel()}"></div>`;
    }).join("");

    const catRows = Object.entries(byCat)
      .filter(([,v]) => v > 0)
      .sort(([,a],[,b]) => b - a)
      .map(([k,v]) => {
        const p = ore ? Math.round(v/ore*100) : 0;
        const safeU = u.replace(/'/g,"\\'");
        return `<div class="cat-row" onclick="openCategoryDetails('${safeU}','${k}')">
          <span class="cat-sw" style="background:${css(catColor(k))}"></span>
          <span class="cat-lbl">${k}</span>
          <span class="cat-val">${toUnit(v).toFixed(1)} ${unitLabel()}</span>
          <span class="cat-pct">${p}%</span>
        </div>`;
      }).join("");

    const oreSub  = chartUnit === "days" ? `${ore.toFixed(1)} h` : `${(ore/8).toFixed(1)} gg`;
    const ferieSub = chartUnit === "days" ? `${ferie.toFixed(1)} h` : `${(ferie/8).toFixed(1)} gg`;
    const statsHtml = workingDays.length ? `
      <div class="uc-stats">
        <div><span class="l">Ore Lav.</span><span class="v">${toUnit(ore).toFixed(1)}</span><span class="uc-stat-sub">${oreSub}</span></div>
        <div><span class="l">Ferie</span><span class="v">${toUnit(ferie).toFixed(1)}</span><span class="uc-stat-sub">${ferieSub}</span></div>
        <div><span class="l">Pieni</span><span class="v">${pieni}</span><span class="uc-stat-sub">gg interi</span></div>
        <div><span class="l">Parz.</span><span class="v">${parz}</span><span class="uc-stat-sub">gg parziali</span></div>
        <div><span class="l">Assenti</span><span class="v">${ass}</span><span class="uc-stat-sub">gg assenza</span></div>
      </div>` : "";

    html += `<div class="user-card">
      <div class="uc-head">
        <div>
          <div class="uc-name" onclick="openUserDetails('${u.replace(/'/g,"\\'")}')">${esc(u)}</div>
          <div class="uc-role">${esc(role)}</div>
        </div>
        ${tag}
      </div>
      <div class="uc-hours">
        <span class="big">${formatUnit(ore)}</span>
        <span class="ref">${refStr}</span>
      </div>
      <div class="uc-bar">${bars}</div>
      ${statsHtml}
      <div class="uc-cats">${catRows}</div>
    </div>`;
  });
  listEl.innerHTML = html;
}

/* ---- Tabella Totali (sortable) ---- */
function buildTotaliData(d) {
  if(!d.length) { totaliData = null; return; }
  const dates = d.map(r => r.data).filter(Boolean);
  let teoriche = 0, workingDays = [];
  if(dates.length) {
    const minD = new Date(Math.min(...dates));
    const maxD = new Date(Math.max(...dates));
    workingDays = workingDaysBetween(minD, maxD);
    teoriche = workingDays.length * 8;
  }
  // Categorie dinamiche: ordine fisso prima, poi client alphabeticamente
  const dynCats = [...new Set(d.map(r => r.categoria))]
    .sort((a,b) => {
      const ai = CAT_ORDER.indexOf(a), bi = CAT_ORDER.indexOf(b);
      if(ai>=0 && bi>=0) return ai-bi;
      if(ai>=0) return -1; if(bi>=0) return 1;
      return a.localeCompare(b);
    });

  const users = [...new Set(d.map(r => r.utente))];
  const rows = users.map(u => {
    const sub = d.filter(r => r.utente === u);
    const ore = sub.reduce((s,r)=>s+r.ore, 0);
    const ferie = teoriche ? Math.max(0, teoriche - ore) : 0;
    const byCat = {};
    dynCats.forEach(c => byCat[c] = 0);
    sub.forEach(r => { byCat[r.categoria] = (byCat[r.categoria]||0) + r.ore; });
    const coord = (byCat.SAL||0) + (byCat.Call||0) + (byCat.Analisi||0);
    const coordPct = ore ? coord/ore : 0;
    const role = roleOf(u);
    return {
      utente: u, role, ore, gg: ore/8, ferieH: ferie, ferieGg: ferie/8,
      ...byCat, coordPct,
      flag: role === "Developer" && coordPct > 0.20
    };
  });
  totaliData = { rows, dynCats, hasDates: workingDays.length > 0 };
}

function drawTotali() {
  const tbl = $("totaliTable");
  if(!totaliData) {
    tbl.innerHTML = '<thead><tr><th>—</th></tr></thead><tbody><tr><td style="text-align:center;color:var(--muted);padding:40px">Importa i rapportini</td></tr></tbody>';
    return;
  }
  const { rows, dynCats, hasDates } = totaliData;
  const dir = sortTotali.dir === "asc" ? 1 : -1;
  const k = sortTotali.key;
  const sorted = [...rows].sort((a,b) => {
    const va = a[k], vb = b[k];
    if(typeof va === "number" && typeof vb === "number") return (va - vb) * dir;
    return String(va ?? "").localeCompare(String(vb ?? "")) * dir;
  });
  const arr = key => sortTotali.key === key ? (sortTotali.dir === "asc" ? "▲" : "▼") : "▲▼";
  const cls = key => "sortable" + (sortTotali.key === key ? " active" : "");
  const ck = c => c.replace(/[^a-zA-Z0-9]/g, "_"); // safe key for data-k

  let html = "<thead><tr>"
    + `<th class="${cls('utente')}" data-k="utente">Utente <span class="arr">${arr('utente')}</span></th>`
    + `<th class="${cls('role')}" data-k="role">Ruolo <span class="arr">${arr('role')}</span></th>`
    + `<th class="${cls('ore')} num" data-k="ore">Ore lavorate <span class="arr">${arr('ore')}</span></th>`
    + `<th class="${cls('gg')} num" data-k="gg">Giornate <span class="arr">${arr('gg')}</span></th>`
    + (hasDates ? `<th class="${cls('ferieH')} num" data-k="ferieH">Ferie (h) <span class="arr">${arr('ferieH')}</span></th><th class="${cls('ferieGg')} num" data-k="ferieGg">Ferie (gg) <span class="arr">${arr('ferieGg')}</span></th>` : "")
    + dynCats.map(c => `<th class="${cls(c)} num" data-k="${ck(c)}">${esc(c)} <span class="arr">${arr(c)}</span></th>`).join("")
    + (hasDates ? `<th class="${cls('coordPct')} num" data-k="coordPct">Coord % <span class="arr">${arr('coordPct')}</span></th>` : "")
    + "</tr></thead><tbody>";

  let totOre=0, totFerie=0;
  const totCat = {};
  dynCats.forEach(c => totCat[c] = 0);
  sorted.forEach(r => {
    totOre += r.ore; totFerie += r.ferieH;
    dynCats.forEach(c => totCat[c] += r[c]||0);
    const safeU = r.utente.replace(/'/g,"\\'");
    html += `<tr class="clickable" onclick="openUserDetails('${safeU}')">`
      + `<td><b style="font-weight:600">${esc(r.utente)}</b></td>`
      + `<td class="muted">${esc(r.role)}</td>`
      + `<td class="num mono">${formatUnit(r.ore)} ${unitLabel()}</td>`
      + `<td class="num mono">${r.gg.toFixed(2)}</td>`
      + (hasDates ? `<td class="num mono">${formatUnit(r.ferieH)}</td><td class="num mono">${r.ferieGg.toFixed(2)}</td>` : "")
      + dynCats.map(c => `<td class="num mono">${formatUnit(r[c]||0)}</td>`).join("")
      + (hasDates ? `<td class="num mono ${r.flag?'flag-bad':''}">${(r.coordPct*100).toFixed(1)}%</td>` : "")
      + "</tr>";
  });
  html += "</tbody>";

  const totGg = totOre/8;
  const totCoord = (totCat.SAL||0) + (totCat.Call||0) + (totCat.Analisi||0);
  const totCoordPct = totOre ? totCoord/totOre : 0;
  html += `<tfoot><tr>`
    + `<td><b>Totale</b></td><td class="muted">${sorted.length} utenti</td>`
    + `<td class="num mono">${formatUnit(totOre)} ${unitLabel()}</td>`
    + `<td class="num mono">${totGg.toFixed(2)}</td>`
    + (hasDates ? `<td class="num mono">${formatUnit(totFerie)}</td><td class="num mono">${(totFerie/8).toFixed(2)}</td>` : "")
    + dynCats.map(c => `<td class="num mono">${formatUnit(totCat[c]||0)}</td>`).join("")
    + (hasDates ? `<td class="num mono">${(totCoordPct*100).toFixed(1)}%</td>` : "")
    + `</tr></tfoot>`;

  tbl.innerHTML = html;
  tbl.querySelectorAll("th.sortable").forEach(th => {
    th.onclick = (e) => {
      e.stopPropagation();
      const key = th.getAttribute("data-k");
      if(sortTotali.key === key) sortTotali.dir = sortTotali.dir === "asc" ? "desc" : "asc";
      else { sortTotali.key = key; sortTotali.dir = (key === "utente" || key === "role") ? "asc" : "desc"; }
      drawTotali();
    };
  });
}

/* ---- Pivot ---- */
function buildPivot(d) {
  const agg = {};
  d.forEach(r => {
    agg[r.utente] ??= {};
    const k = currentView === "task" ? r.compito : r.progetto;
    if(k === undefined || k === null) return;
    agg[r.utente][k] = (agg[r.utente][k] || 0) + r.ore;
  });
  const users = Object.keys(agg);
  const cols = [...new Set(users.flatMap(u => Object.keys(agg[u])))];
  const rows = users.map(u => {
    let tot = 0;
    cols.forEach(c => { tot += agg[u][c] || 0; });
    return { utente: u, values: agg[u], tot };
  });
  pivotCache = { rows, cols };
}
function drawPivot() {
  const tbl = $("pivotTbl");
  if(!pivotCache || !pivotCache.rows.length) {
    tbl.innerHTML = '<thead><tr><th>—</th></tr></thead><tbody><tr><td style="text-align:center;color:var(--muted);padding:40px">Nessun dato</td></tr></tbody>';
    return;
  }
  const { rows, cols } = pivotCache;
  const dir = sortPivot.dir === "asc" ? 1 : -1;
  const k = sortPivot.key;
  const sorted = [...rows].sort((a,b) => {
    let va, vb;
    if(k === "utente") { va = a.utente; vb = b.utente; }
    else if(k === "__tot__") { va = a.tot; vb = b.tot; }
    else { va = a.values[k] || 0; vb = b.values[k] || 0; }
    if(typeof va === "number" && typeof vb === "number") return (va - vb) * dir;
    return String(va ?? "").localeCompare(String(vb ?? "")) * dir;
  });
  const arr = key => sortPivot.key === key ? (sortPivot.dir === "asc" ? "▲" : "▼") : "▲▼";
  const cls = key => "sortable" + (sortPivot.key === key ? " active" : "");

  let html = `<thead><tr><th class="${cls('utente')}" data-k="utente">Utente <span class="arr">${arr('utente')}</span></th>`;
  cols.forEach(c => {
    const safe = c.replace(/"/g, "&quot;");
    html += `<th class="${cls(c)} num" data-k="${safe}" title="${safe}">${esc(c)} <span class="arr">${arr(c)}</span></th>`;
  });
  html += `<th class="${cls('__tot__')} num" data-k="__tot__">Totale <span class="arr">${arr('__tot__')}</span></th></tr></thead><tbody>`;

  const colTot = {};
  cols.forEach(c => colTot[c] = 0);
  let grand = 0;
  sorted.forEach(r => {
    html += `<tr><td><b style="font-weight:600">${esc(r.utente)}</b></td>`;
    cols.forEach(c => {
      const v = r.values[c] || 0;
      colTot[c] += v;
      grand += v;
      const onClick = `openDetails('${r.utente.replace(/'/g,"\\'")}','${c.replace(/'/g,"\\'")}')`;
      html += `<td class="num mono" style="${v?'cursor:pointer':''}" onclick="${v?onClick:''}">${v ? formatUnit(v) : ""}</td>`;
    });
    html += `<td class="num mono"><b style="font-weight:600">${formatUnit(r.tot)}</b></td></tr>`;
  });
  html += "</tbody>";
  html += `<tfoot><tr><td><b>Totale</b></td>`;
  cols.forEach(c => { html += `<td class="num mono">${formatUnit(colTot[c])}</td>`; });
  html += `<td class="num mono">${formatUnit(grand)}</td></tr></tfoot>`;
  tbl.innerHTML = html;
  tbl.querySelectorAll("th.sortable").forEach(th => {
    th.onclick = (e) => {
      e.stopPropagation();
      const key = th.getAttribute("data-k");
      if(sortPivot.key === key) sortPivot.dir = sortPivot.dir === "asc" ? "desc" : "asc";
      else { sortPivot.key = key; sortPivot.dir = (key === "utente") ? "asc" : "desc"; }
      drawPivot();
    };
  });
}

/* ---- Charts ---- */
function chartOpts() {
  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 350 },
    plugins: {
      legend: { labels: { color: css("--ink-soft"), font: { family: "Geist", size: 11.5 }, boxWidth: 10, boxHeight: 10, padding: 14 } },
      tooltip: {
        backgroundColor: css("--ink"),
        titleColor: css("--bg-elev"),
        bodyColor: css("--bg-elev"),
        padding: 10, cornerRadius: 6,
        titleFont: { family: "Geist", size: 12, weight: "500" },
        bodyFont: { family: "Geist Mono", size: 12 }
      }
    },
    scales: {
      x: { grid: { color: css("--border"), drawBorder: false }, ticks: { color: css("--muted"), font: { family: "Geist", size: 11 } }, border: { display: false } },
      y: { grid: { color: css("--border"), drawBorder: false }, ticks: { color: css("--muted"), font: { family: "Geist Mono", size: 11 } }, border: { display: false } }
    }
  };
}

function renderProjectsChart(d) {
  if(chartProjects) chartProjects.destroy();
  const ctx = $("chartProjects").getContext("2d");
  const key = currentView === "task" ? "compito" : "progetto";

  if(chartMode === "byUser") {
    const users = [...new Set(d.map(r => r.utente))];
    const totals = {};
    d.forEach(r => { totals[r[key]] = (totals[r[key]] || 0) + toUnit(r.ore); });
    const labels = Object.entries(totals).sort((a,b)=>b[1]-a[1]).map(e => e[0]).slice(0, 14);
    const datasets = users.map((u, i) => ({
      label: u.split(" ")[0],
      data: labels.map(l => toUnit(d.filter(r => r.utente === u && r[key] === l).reduce((s,r)=>s+r.ore, 0))),
      backgroundColor: css("var(" + USER_PALETTE[i % USER_PALETTE.length] + ")"),
      borderRadius: 3, borderSkipped: false, barPercentage: 0.7, categoryPercentage: 0.7
    }));
    const opts = chartOpts();
    opts.indexAxis = "y";
    opts.scales.x.stacked = true;
    opts.scales.y.stacked = true;
    chartProjects = new Chart(ctx, { type: "bar", data: { labels, datasets }, options: opts });
    return;
  }
  // Total
  const map = {};
  d.forEach(r => { map[r[key]] = (map[r[key]] || 0) + toUnit(r.ore); });
  const sorted = Object.entries(map).sort((a,b)=>b[1]-a[1]).slice(0, 14);
  const labels = sorted.map(e => e[0]);
  const values = sorted.map(e => e[1]);
  const opts = chartOpts();
  opts.indexAxis = "y";
  opts.plugins.legend.display = false;
  chartProjects = new Chart(ctx, {
    type: "bar",
    data: { labels, datasets: [{ data: values, backgroundColor: css("--accent-2"), borderRadius: 3, borderSkipped: false, barPercentage: 0.7, categoryPercentage: 0.7 }] },
    options: opts
  });
}

function renderCategoriesDonut(d) {
  if(chartDonut) chartDonut.destroy();
  const ctx = $("chartDonut").getContext("2d");
  const byCat = {};
  d.forEach(r => { byCat[r.categoria] = (byCat[r.categoria]||0) + toUnit(r.ore); });
  const labels = Object.keys(byCat).filter(k => byCat[k] > 0);
  const data = labels.map(l => byCat[l]);
  const colors = labels.map(l => css(catColor(l)));
  const opts = chartOpts();
  delete opts.scales;
  opts.cutout = "62%";
  opts.plugins.legend.position = "bottom";
  chartDonut = new Chart(ctx, {
    type: "doughnut",
    data: { labels, datasets: [{ data, backgroundColor: colors, borderColor: css("--panel"), borderWidth: 2, hoverOffset: 4 }] },
    options: opts
  });
}

/* ---- Drill-down ---- */
window.openCategoryDetails = (u, cat) => {
  const d = filtered().filter(r => r.utente === u && r.categoria === cat);
  showDetail(d, `${u} · categoria ${cat}`);
};
window.openUserDetails = (u) => {
  const d = filtered().filter(r => r.utente === u);
  showDetail(d, `${u} · tutte le ore`);
};
window.openDetails = (u, val) => {
  const key = currentView === "task" ? "compito" : "progetto";
  const d = filtered().filter(r => r.utente === u && r[key] === val);
  showDetail(d, `${u} · ${val}`);
};
function showDetail(records, title) {
  detailRows = records;
  detailTitle = title;
  detailFilters = {};           // reset filtri su ogni nuova apertura
  $("detailHeader").style.display = "none";
  $("detailTableWrap").style.display = "";
  drawDetail();
  $("detailTableWrap").scrollIntoView({ behavior: "smooth", block: "start" });
}

function drawDetail() {
  /* --- aggiorna frecce di ordinamento nell'header statico --- */
  const headerRow = $("detailHeaderRow");
  if(headerRow) {
    headerRow.querySelectorAll("th.sortable").forEach(th => {
      const k = th.getAttribute("data-k");
      const arr = th.querySelector(".arr");
      if(sortDetail.key === k) {
        th.classList.add("active");
        if(arr) arr.textContent = sortDetail.dir === "asc" ? "▲" : "▼";
      } else {
        th.classList.remove("active");
        if(arr) arr.textContent = "▲▼";
      }
    });
  }

  /* --- filter row: crea o aggiorna --- */
  const detailThead = $("detailTable") && $("detailTable").querySelector("thead");
  if(detailThead) {
    let filterRow = document.getElementById("detailFilterRow");
    if(!filterRow) {
      filterRow = document.createElement("tr");
      filterRow.id = "detailFilterRow";
      filterRow.className = "filter-row";
      detailThead.appendChild(filterRow);
    }
    const uniq = col => [...new Set(detailRows.map(r => String(r[col] || "")).filter(Boolean))].sort();
    const makeSelect = (col, label) => {
      const cur = detailFilters[col] || "";
      const opts = uniq(col).map(v =>
        `<option value="${esc(v)}"${cur === v ? " selected" : ""}>${esc(v)}</option>`
      ).join("");
      return `<select class="col-filter" data-col="${col}">
        <option value="">— ${label} —</option>${opts}
      </select>`;
    };
    filterRow.innerHTML =
      `<td></td>` +
      `<td>${makeSelect("utente","Utente")}</td>` +
      `<td>${makeSelect("progetto","Progetto")}</td>` +
      `<td><input class="col-filter-txt" data-col="compito" placeholder="Cerca compito…" value="${esc(detailFilters.compito||"")}"></td>` +
      `<td>${makeSelect("categoria","Categoria")}</td>` +
      `<td></td>`;
    filterRow.querySelectorAll(".col-filter").forEach(sel => {
      sel.onchange = () => { detailFilters[sel.dataset.col] = sel.value; drawDetail(); };
    });
    filterRow.querySelectorAll(".col-filter-txt").forEach(inp => {
      inp.oninput = () => { detailFilters[inp.dataset.col] = inp.value; drawDetail(); };
    });
  }

  /* --- applica filtri --- */
  const visRows = detailRows.filter(r => {
    if(detailFilters.utente    && String(r.utente    || "") !== detailFilters.utente)    return false;
    if(detailFilters.progetto  && String(r.progetto  || "") !== detailFilters.progetto)  return false;
    if(detailFilters.categoria && String(r.categoria || "") !== detailFilters.categoria) return false;
    if(detailFilters.compito) {
      const q = detailFilters.compito.toLowerCase();
      if(!(r.compito || "").toLowerCase().includes(q)) return false;
    }
    return true;
  });

  /* --- ordina --- */
  const dir = sortDetail.dir === "asc" ? 1 : -1;
  const k = sortDetail.key;
  const sorted = [...visRows].sort((a,b) => {
    let va, vb;
    if(k === "data") { va = a.data ? a.data.getTime() : 0; vb = b.data ? b.data.getTime() : 0; return (va - vb) * dir; }
    if(k === "ore")  { return (a.ore - b.ore) * dir; }
    va = a[k] || ""; vb = b[k] || "";
    return String(va).localeCompare(String(vb)) * dir;
  });

  /* --- render corpo --- */
  const totH   = visRows.reduce((s,r) => s + r.ore, 0);
  const totAll = detailRows.reduce((s,r) => s + r.ore, 0);
  const isFiltered = visRows.length < detailRows.length;

  const rows = sorted.map(r => {
    const dStr = r.data ? r.data.toLocaleDateString("it-IT") : "—";
    const catSw = `<span style="display:inline-block;width:8px;height:8px;border-radius:2px;background:${css(catColor(r.categoria||'Credem - Altro'))};margin-right:6px;vertical-align:middle"></span>`;
    return `<tr>
      <td class="mono">${dStr}</td>
      <td>${esc(r.utente)}</td>
      <td class="muted">${esc(r.progetto || "")}</td>
      <td>${esc(r.compito || "")}</td>
      <td>${catSw}${esc(r.categoria || "Altro")}</td>
      <td class="num mono">${formatUnit(r.ore)}</td>
    </tr>`;
  }).join("");

  $("detailBody").innerHTML = rows ||
    '<tr><td colspan="6" style="text-align:center;color:var(--muted);padding:24px">Nessun record</td></tr>';

  /* --- aggiorna titolo --- */
  $("detailHeader").style.display = "";
  $("detailHeader").classList.remove("detail-empty");
  $("detailHeader").classList.add("detail-header");
  const countStr = isFiltered
    ? `${visRows.length} / ${detailRows.length} record`
    : `${detailRows.length} record`;
  const oreStr = isFiltered
    ? `${formatUnit(totH)} ${unitLabel()} (tot. ${formatUnit(totAll)} ${unitLabel()})`
    : `${formatUnit(totH)} ${unitLabel()}`;
  $("detailHeader").innerHTML =
    `<span><b>${esc(detailTitle)}</b> · ${countStr} · ${oreStr}</span>` +
    `<span class="muted" style="font-size:12px">Click sull'intestazione per ordinare</span>`;
}

/* Ordinamento colonne (sort non resetta i filtri, chiama drawDetail direttamente) */
document.querySelectorAll("#detailHeaderRow th.sortable").forEach(th => {
  th.onclick = () => {
    const k = th.getAttribute("data-k");
    if(sortDetail.key === k) sortDetail.dir = sortDetail.dir === "asc" ? "desc" : "asc";
    else { sortDetail.key = k; sortDetail.dir = "desc"; }
    drawDetail();
  };
});
