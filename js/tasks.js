/* ============================================================
   TASK & KPI DASHBOARD (Page 2)
   ============================================================ */
(function() {
  let tkRaw = [];
  let tkFiles = [];
  let tkSortKey = "differenceH";
  let tkSortDir = "asc";
  let tkBar = null, tkDonut = null;
  let tkUnit = "hours";  // "hours" | "days"

  // Converte ore → giorni se la modalità è "days", altrimenti ritorna invariato
  const tkToUnit = h => tkUnit === "days" ? h / 8 : h;
  // Formatta un valore in ore nella unità corrente: HH:MM (ore) oppure X.XX gg (giorni)
  const tkFmtVal = h => {
    if(!isFinite(h)) return "—";
    if(tkUnit === "days") {
      const sign = h < 0 ? "−" : "";
      return `${sign}${(Math.abs(h) / 8).toFixed(2)}`;
    }
    return tkFmtH(h);
  };
  const tkUnitLabel = () => tkUnit === "days" ? "gg" : "h";

  const tkParseHours = v => {
    if(v == null || v === "") return 0;
    if(typeof v === "number") return isFinite(v) ? v : 0;
    let s = String(v).trim();
    if(!s || s === "-") return 0;
    let sign = 1;
    const mSign = s.match(/^\(\s*([+-])\s*\)\s*(.+)$/);
    if(mSign) { sign = mSign[1] === "-" ? -1 : 1; s = mSign[2].trim(); }
    const m = s.match(/^(\d+)\s*:\s*(\d{1,2})$/);
    if(m) return sign * (parseInt(m[1],10) + parseInt(m[2],10)/60);
    s = s.replace(",", ".");
    const n = parseFloat(s);
    return isNaN(n) ? 0 : sign * n;
  };
  const tkFmtH = h => {
    if(!isFinite(h)) return "—";
    const sign = h < 0 ? "-" : "";
    const a = Math.abs(h);
    const hh = Math.floor(a);
    const mm = Math.round((a - hh) * 60);
    return `${sign}${hh}:${String(mm).padStart(2,"0")}`;
  };
  const tkHeaderIdx = (h, cands) => {
    const norm = s => String(s ?? "").trim().toLowerCase();
    const hs = h.map(norm);
    for(const c of cands) { const i = hs.indexOf(c.toLowerCase()); if(i !== -1) return i; }
    return -1;
  };
  const tkFiltered = () => {
    const q = $("tkSearchTxt").value.trim().toLowerCase();
    const st = $("tkFilterStatus").value;
    const ow = $("tkFilterOwner").value;
    return tkRaw.filter(r => {
      if(q && !r.taskName.toLowerCase().includes(q)) return false;
      if(st && String(r.status || "") !== st) return false;
      if(ow && String(r.owner  || "") !== ow) return false;
      return true;
    });
  };

  function tkSetKPI() {
    const d = tkFiltered();
    const n = d.length;
    const est = d.reduce((s,r)=>s+r.workH, 0);
    const log = d.reduce((s,r)=>s+r.logH, 0);
    const diff = d.reduce((s,r)=>s+r.differenceH, 0);
    const over = d.filter(r=>r.differenceH < 0).length;
    const zero = d.filter(r=>r.differenceH === 0).length;
    const early = d.filter(r=>r.differenceH > 0).length;

    $("tkKpiTasks").textContent = n.toString();
    $("tkKpiFiles").textContent = tkFiles.length ? `${tkFiles.length} file` : "Nessun file";
    $("tkKpiEst").textContent = tkFmtVal(est);
    $("tkKpiLog").textContent = tkFmtVal(log);
    $("tkKpiDiff").textContent = tkFmtVal(diff);
    // Aggiorna le label unità nei KPI box
    ["tkUnitEst","tkUnitLog","tkUnitDiff"].forEach(id => $( id).textContent = tkUnitLabel());

    const valEl = $("tkKpiDiff");
    valEl.classList.remove("good","bad","warn");
    if(diff > 0)  valEl.parentElement.style.color = css("--good");
    else if(diff < 0) valEl.parentElement.style.color = css("--bad");
    else valEl.parentElement.style.color = "";

    $("tkKpiDiffSub").textContent = diff > 0 ? "sotto stima" : diff < 0 ? "oltre stima" : "in linea";
    let acc = NaN;
    if(est > 0) acc = (log / est) * 100;
    $("tkKpiAcc").textContent = isFinite(acc) ? acc.toFixed(1) : "—";
    $("tkKpiOver").textContent = over;
    $("tkKpiOverPct").textContent = n ? `${(over/n*100).toFixed(1)}% del totale` : "—";

    const pct = v => n ? `${(v/n*100).toFixed(1)}%` : "—";
    $("tkSumOver").textContent = over;   $("tkSumOverPct").textContent = pct(over);
    $("tkSumZero").textContent = zero;   $("tkSumZeroPct").textContent = pct(zero);
    $("tkSumEarly").textContent = early; $("tkSumEarlyPct").textContent = pct(early);
    $("tkDonutSub").textContent = `${n} task`;

    // Nav meta
    $("navMetaT").innerHTML = `${n} task<br/>${isFinite(acc) ? acc.toFixed(1)+'% acc' : '—'}`;
  }

  function tkRenderCharts() {
    const d = tkFiltered();
    const topN = parseInt($("tkTopN").value, 10) || 15;
    const sorted = [...d].sort((a,b)=>a.differenceH - b.differenceH);
    const sliced = sorted.slice(0, Math.min(topN, sorted.length));
    const labels = sliced.map(r => {
      const n = String(r.taskName || "");
      return n.length > 40 ? (n.slice(0, 38) + "…") : n;
    });
    const data = sliced.map(r => tkToUnit(r.differenceH));
    const colors = sliced.map(r => r.differenceH >= 0 ? css("--good") : css("--bad"));

    if(tkBar) tkBar.destroy();
    const opts1 = chartOpts();
    opts1.indexAxis = "y";
    opts1.plugins.legend.display = false;
    opts1.plugins.tooltip = opts1.plugins.tooltip || {};
    opts1.plugins.tooltip.callbacks = {
      label: ctx => `Δ: ${ctx.parsed.x >= 0 ? "+" : ""}${ctx.parsed.x.toFixed(2)} ${tkUnitLabel()}`
    };
    tkBar = new Chart($("tkChartBar").getContext("2d"), {
      type: "bar",
      data: { labels, datasets: [{ data, backgroundColor: colors, borderRadius: 3, borderSkipped: false, barThickness: 16 }] },
      options: opts1
    });

    const over  = d.filter(r=>r.differenceH < 0).length;
    const zero  = d.filter(r=>r.differenceH === 0).length;
    const early = d.filter(r=>r.differenceH > 0).length;
    if(tkDonut) tkDonut.destroy();
    const opts2 = chartOpts();
    delete opts2.scales;
    opts2.cutout = "68%";
    opts2.plugins.legend.position = "bottom";
    tkDonut = new Chart($("tkChartDonut").getContext("2d"), {
      type: "doughnut",
      data: {
        labels: ["Anticipo","In linea","Overrun"],
        datasets: [{
          data: [early, zero, over],
          backgroundColor: [css("--good"), css("--muted-2"), css("--bad")],
          borderColor: css("--panel"), borderWidth: 2, hoverOffset: 4
        }]
      },
      options: opts2
    });
  }

  function tkRenderTable() {
    const d = tkFiltered();
    const dir = tkSortDir === "asc" ? 1 : -1;
    const sorted = [...d].sort((a,b) => {
      const va = a[tkSortKey], vb = b[tkSortKey];
      if(typeof va === "number" && typeof vb === "number") return (va - vb) * dir;
      return String(va ?? "").localeCompare(String(vb ?? "")) * dir;
    });
    const hasOwner  = sorted.some(r => r.owner);
    const hasStatus = sorted.some(r => r.status);
    const arr = k => tkSortKey === k ? (tkSortDir === "asc" ? "▲" : "▼") : "▲▼";
    const cls = k => "sortable" + (tkSortKey === k ? " active" : "");
    const th = (label, key, numeric=false) =>
      `<th class="${cls(key)}${numeric?' num':''}" data-k="${key}">${esc(label)} <span class="arr">${arr(key)}</span></th>`;

    const ul = tkUnitLabel();
    let html = `<thead><tr>
      ${th("Task","taskName")}
      ${hasOwner ? th("Owner","owner") : ""}
      ${hasStatus ? th("Status","status") : ""}
      ${th(`Stima (${ul})`,"workH",true)}
      ${th(`Log (${ul})`,"logH",true)}
      ${th(`Δ (${ul})`,"differenceH",true)}
      ${th("Δ%","deltaPct",true)}
      <th>Stato</th>
    </tr></thead><tbody>`;

    let totWork = 0, totLog = 0, totDiff = 0;
    for(const r of sorted) {
      totWork += r.workH; totLog += r.logH; totDiff += r.differenceH;
      const pct = r.deltaPct;
      const pctTxt = isFinite(pct) ? `${pct.toFixed(1)}%` : "—";
      const over = r.differenceH < 0;
      const pill = over ? `<span class="pill over">overrun</span>` :
                   r.differenceH > 0 ? `<span class="pill under">anticipo</span>` :
                                       `<span class="pill line">in linea</span>`;
      const diffColor = r.differenceH < 0 ? "var(--bad)" : r.differenceH > 0 ? "var(--good)" : "var(--muted)";
      const pctColor  = isFinite(pct) && pct > 0 ? "var(--bad)" : isFinite(pct) && pct < 0 ? "var(--good)" : "var(--muted)";
      html += `<tr>
        <td title="${esc(r.taskName)}">${esc(r.taskName)}</td>
        ${hasOwner ? `<td class="muted">${esc(r.owner||"")}</td>` : ""}
        ${hasStatus ? `<td class="muted">${esc(r.status||"")}</td>` : ""}
        <td class="num mono">${tkFmtVal(r.workH)}</td>
        <td class="num mono">${tkFmtVal(r.logH)}</td>
        <td class="num mono" style="color:${diffColor};font-weight:500">${tkFmtVal(r.differenceH)}</td>
        <td class="num mono" style="color:${pctColor}">${pctTxt}</td>
        <td>${pill}</td>
      </tr>`;
    }
    html += "</tbody>";

    const totColor = totDiff < 0 ? "var(--bad)" : totDiff > 0 ? "var(--good)" : "var(--muted)";
    html += `<tfoot><tr>
      <td colspan="${1 + (hasOwner?1:0) + (hasStatus?1:0)}"><b>Totale</b></td>
      <td class="num mono">${tkFmtVal(totWork)}</td>
      <td class="num mono">${tkFmtVal(totLog)}</td>
      <td class="num mono" style="color:${totColor};font-weight:600">${tkFmtVal(totDiff)}</td>
      <td></td><td></td>
    </tr></tfoot>`;

    $("tkTbl").innerHTML = html;
    $("tkTbl").querySelectorAll("th.sortable").forEach(th => {
      th.onclick = () => {
        const k = th.getAttribute("data-k");
        if(tkSortKey === k) tkSortDir = tkSortDir === "asc" ? "desc" : "asc";
        else { tkSortKey = k; tkSortDir = "asc"; }
        tkRenderTable();
      };
    });
  }

  function tkBuildFilters() {
    const statuses = [...new Set(tkRaw.map(r=>r.status).filter(Boolean))].sort((a,b)=>String(a).localeCompare(String(b)));
    const owners   = [...new Set(tkRaw.map(r=>r.owner ).filter(Boolean))].sort((a,b)=>String(a).localeCompare(String(b)));
    const ks = $("tkFilterStatus").value, ko = $("tkFilterOwner").value;
    $("tkFilterStatus").innerHTML = `<option value="">Stato: tutti</option>` + statuses.map(s=>`<option>${esc(s)}</option>`).join("");
    $("tkFilterOwner").innerHTML  = `<option value="">Owner: tutti</option>` + owners.map(s=>`<option>${esc(s)}</option>`).join("");
    if(statuses.includes(ks)) $("tkFilterStatus").value = ks;
    if(owners.includes(ko))  $("tkFilterOwner").value  = ko;
  }
  function tkRefresh() { tkSetKPI(); tkRenderCharts(); tkRenderTable(); }

  document.querySelectorAll("#tkSegUnit button").forEach(b => {
    b.onclick = () => {
      document.querySelectorAll("#tkSegUnit button").forEach(x => x.classList.toggle("active", x === b));
      tkUnit = b.dataset.unit;
      tkRefresh();
    };
  });

  $("tkBtnImport").onclick = () => $("tkFileInput").click();
  $("tkBtnClear").onclick = () => {
    tkRaw = []; tkFiles = [];
    tkSortKey = "differenceH"; tkSortDir = "asc";
    $("tkSearchTxt").value = "";
    $("tkFilterStatus").innerHTML = `<option value="">Stato: tutti</option>`;
    $("tkFilterOwner").innerHTML  = `<option value="">Owner: tutti</option>`;
    tkRefresh();
  };
  $("tkFileInput").onchange = async (e) => {
    const files = [...e.target.files];
    if(!files.length) return;
    for(const f of files) {
      try {
        const buf = await f.arrayBuffer();
        const wb = XLSX.read(buf, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true });
        if(!rows.length) continue;
        const h = rows[0] || [];
        const iTask  = tkHeaderIdx(h, ["task name","task"]);
        const iWork  = tkHeaderIdx(h, ["work hours","work hours (stima)","work hours (h)"]);
        const iLog   = tkHeaderIdx(h, ["total log hours","total log hour","log hours","total logged hours"]);
        const iDiff  = tkHeaderIdx(h, ["difference","diff","work-log","work - log"]);
        const iOwner = tkHeaderIdx(h, ["owner","assignee"]);
        const iStat  = tkHeaderIdx(h, ["custom status","status"]);

        if(iTask === -1 || iWork === -1 || iLog === -1) {
          alert(`File "${f.name}": colonne richieste non trovate.\nServono: Task Name, Work hours, Total Log Hours.`);
          continue;
        }
        for(const r of rows.slice(1)) {
          const name = r[iTask];
          if(name == null || String(name).trim() === "") continue;
          const workH = tkParseHours(r[iWork]);
          const logH  = tkParseHours(r[iLog]);
          let diff = 0;
          if(iDiff !== -1 && r[iDiff] != null && String(r[iDiff]).trim() !== "") diff = tkParseHours(r[iDiff]);
          else diff = workH - logH;
          let deltaPct = NaN;
          if(workH > 0) deltaPct = ((logH - workH) / workH) * 100;
          const key = String(name).trim();
          const existing = tkRaw.find(t => t.taskName === key);
          if(existing) {
            existing.workH = Math.max(existing.workH, workH);
            existing.logH += logH;
            existing.differenceH = existing.workH - existing.logH;
            existing.deltaPct = existing.workH > 0 ? ((existing.logH - existing.workH) / existing.workH) * 100 : NaN;
          } else {
            tkRaw.push({
              taskName: key,
              owner:  iOwner !== -1 ? (r[iOwner] ?? "") : "",
              status: iStat  !== -1 ? (r[iStat]  ?? "") : "",
              workH, logH, differenceH: diff, deltaPct
            });
          }
        }
        if(!tkFiles.includes(f.name)) tkFiles.push(f.name);
      } catch(err) {
        console.error(err);
        alert(`Errore lettura file "${f.name}"`);
      }
    }
    tkBuildFilters();
    tkRefresh();
    $("tkFileInput").value = "";
  };

  ["tkSearchTxt","tkFilterStatus","tkFilterOwner","tkTopN"].forEach(id => {
    $(id).addEventListener("input", tkRefresh);
    $(id).addEventListener("change", tkRefresh);
  });

  tkRefresh();
})();

