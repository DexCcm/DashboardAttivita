/* ============================================================
   PLAFOND PAGE (Page 3) — Excel read / pending rows / write back
   ============================================================ */
(function() {
  // State locale (pfTotali, pfDettaglio, pfPending sono globali in config.js)
  let pfWorkbook = null;        // ExcelJS workbook
  let pfFileName = "Fatturazioni_Plafond_Mensili_Credem.xlsx";
  let pfDettShow = 20;          // visualizzazione storico

  const PALETTE = ["--accent-3","--accent-2","--accent-1","--accent-4","--accent-5","--muted-2","--border-strong"];

  // Read cell value handling formula objects, dates, rich text, etc.
  function readCell(cell) {
    if(cell == null) return null;
    const v = cell.value;
    if(v == null) return null;
    if(typeof v === "object") {
      if("result" in v) return v.result;
      if("text" in v) return v.text;
      if("richText" in v) return v.richText.map(x => x.text).join("");
      if(v instanceof Date) return v;
    }
    return v;
  }

  function setBadge(name) {
    pfFileName = name;
    $("pfFileBadge").style.display = "inline-flex";
    $("pfFileName").textContent = name;
  }

  function showSections(hasFile) {
    $("pfEmptyPanel").style.display      = hasFile ? "none" : "";
    // Reset suggest panel on ogni cambio file (evita di mostrare dati di un'analisi precedente)
    $("pfSuggestSection").style.display  = "none";
    $("pfSuggestContent").innerHTML      = "";
    $("pfCardsSection").style.display    = hasFile ? "" : "none";
    $("pfAddSection").style.display      = hasFile ? "" : "none";
    $("pfDettaglioSection").style.display = hasFile ? "" : "none";
  }

  /* ---------- IMPORT ---------- */
  $("pfBtnImport").onclick = () => $("pfFileInput").click();
  $("pfFileInput").onchange = async (e) => {
    const f = e.target.files[0];
    if(!f) return;
    try {
      const buf = await f.arrayBuffer();
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(buf);
      pfWorkbook = wb;
      setBadge(f.name);
      pfReadData();
      showSections(true);
      pfRenderAll();
      $("pfBtnSuggest").disabled = false;
    } catch(err) {
      console.error(err);
      alert("Errore lettura file: " + err.message);
    }
    $("pfFileInput").value = "";
  };

  /* ---------- READ DATA ---------- */
  function pfReadData() {
    pfTotali = [];
    pfDettaglio = [];
    if(!pfWorkbook) return;

    // Totali sheet
    const totSheet = pfWorkbook.getWorksheet("FatturazioniMensili_Aggiornate");
    if(totSheet) {
      // Dati dalla riga 6 (sotto header riga 5) fino alla prima riga vuota
      for(let r = 6; r <= 50; r++) {
        const row = totSheet.getRow(r);
        const plafond = readCell(row.getCell("C"));
        if(plafond == null || String(plafond).trim() === "") break;
        const evalV   = readCell(row.getCell("D"));
        const iniz    = readCell(row.getCell("E"));
        const ins     = readCell(row.getCell("F"));
        const rim     = readCell(row.getCell("G"));
        const stato   = readCell(row.getCell("H"));
        pfTotali.push({
          plafond: String(plafond).trim(),
          eval: evalV,
          iniziale: Number(iniz) || 0,
          inserite: Number(ins) || 0,
          rimanenti: Number(rim) || ((Number(iniz)||0) - (Number(ins)||0)),
          stato: stato ? String(stato).trim() : "Aperto",
          rowIdx: r
        });
      }
    }

    // Dettaglio sheet
    const detSheet = pfWorkbook.getWorksheet("Dettaglio Plafond");
    if(detSheet) {
      // Dati dalla riga 4 (sotto header riga 3).
      // Si usa un contatore di righe vuote consecutive per terminare
      // il loop in modo sicuro anche se actualRowCount è sovrastimato.
      const MAX_EMPTY = 5;
      let emptyStreak = 0;
      const rowLimit = Math.max(detSheet.actualRowCount + 10, 200);
      for(let r = 4; r <= rowLimit; r++) {
        const row = detSheet.getRow(r);
        const anno = readCell(row.getCell("B"));
        if(anno == null || String(anno).trim() === "") {
          emptyStreak++;
          if(emptyStreak >= MAX_EMPTY) break;
          continue;
        }
        emptyStreak = 0;
        pfDettaglio.push({
          anno: anno,
          mese: readCell(row.getCell("C")),
          progetto: readCell(row.getCell("D")),
          task: readCell(row.getCell("E")),
          eval: readCell(row.getCell("F")),
          ore: Number(readCell(row.getCell("G"))) || 0,
          // giorni è una formula calcolata (=ore/8); usiamo ore/8 per robustezza
          giorni: (Number(readCell(row.getCell("G"))) || 0) / 8,
          rowIdx: r
        });
      }
    }

    // BUG FIX: ricalcola 'inserite' dalla TabellaTask invece di usare il result
    // cached delle formule SUMIF di TabellaTotali5, che ExcelJS non riesegue e che
    // risulterebbe stale se il file è stato salvato dalla dashboard senza passare da Excel.
    if(pfTotali.length && pfDettaglio.length) {
      pfTotali.forEach(p => {
        const matchingRows = pfDettaglio.filter(r => String(r.eval) === String(p.eval));
        // Aggiorna solo se ci sono righe (evita di azzerare plafond senza dati storici)
        if(matchingRows.length > 0) {
          const sumGiorni = matchingRows.reduce((s, r) => s + (r.ore / 8), 0);
          p.inserite = sumGiorni;
          p.rimanenti = p.iniziale - p.inserite;
        }
      });
    }
  }

  /* ---------- RENDER ---------- */
  function pfRenderAll() {
    pfRenderKPI();
    pfRenderCards();
    pfRenderEvalSelect();
    pfRenderPending();
    pfRenderDettaglio();
    pfUpdateNavMeta();
  }

  function pfRenderKPI() {
    if(!pfTotali.length) {
      ["pfKpiCount","pfKpiInit","pfKpiUsed","pfKpiRem"].forEach(id => { $(id).textContent = "—"; });
      $("pfKpiCountSub").textContent = "importa il file";
      $("pfKpiUsedPct").textContent = "—";
      $("pfKpiRemSub").textContent = "—";
      return;
    }
    // Recompute "inserite" includendo pending
    const totIniz = pfTotali.reduce((s,p) => s + p.iniziale, 0);
    const totIns  = pfTotali.reduce((s,p) => s + p.inserite, 0) + pfPendingDaysTotal();
    const totRim  = totIniz - totIns;
    const pct     = totIniz ? (totIns / totIniz * 100) : 0;
    $("pfKpiCount").textContent = pfTotali.length;
    $("pfKpiCountSub").textContent = pfTotali.filter(p => p.stato === "Aperto").length + " aperti";
    $("pfKpiInit").textContent = totIniz.toFixed(2);
    $("pfKpiUsed").textContent = totIns.toFixed(2);
    $("pfKpiUsedPct").textContent = pct.toFixed(1) + "% consumato";
    $("pfKpiRem").textContent = totRim.toFixed(2);
    $("pfKpiRemSub").textContent = pfPending.length
      ? `include ${pfPending.length} righe in attesa`
      : "dal file caricato";
  }

  // pending → somma giorni (ore/8) per ogni eval
  function pfPendingDaysTotal() { return pfPending.reduce((s,p) => s + (p.ore/8), 0); }

  function pfRenderCards() {
    const grid = $("plafondGrid");
    if(!pfTotali.length) {
      grid.innerHTML = `<div class="pf-cards-empty">Nessun plafond caricato</div>`;
      return;
    }
    grid.innerHTML = pfTotali.map((p, i) => {
      // Add pending consumption for this EVAL
      const pendingDays = pfPending
        .filter(r => String(r.eval) === String(p.eval))
        .reduce((s,r) => s + (r.ore/8), 0);
      const totIns = p.inserite + pendingDays;
      const totRim = p.iniziale - totIns;
      const pct = p.iniziale ? Math.min(100, Math.round(totIns / p.iniziale * 100)) : 0;
      const over = totIns > p.iniziale;
      let status;
      if(p.stato === "Terminato") status = { cls: "info", label: "Terminato" };
      else if(over)               status = { cls: "bad",  label: "Superato" };
      else if(pct > 80)           status = { cls: "bad",  label: "Critico" };
      else if(pct > 60)           status = { cls: "warn", label: "In esaurimento" };
      else                        status = { cls: "ok",   label: "In linea" };
      const color = css("var(" + PALETTE[i % PALETTE.length] + ")");
      const evalDisplay = (p.eval == null || p.eval === "") ? "—" : `EVAL ${p.eval}`;
      return `<div class="plafond-card">
        <div class="pf-head">
          <div>
            <div class="pf-title">${esc(p.plafond)}</div>
            <div class="pf-id">${esc(evalDisplay)}</div>
          </div>
          <div class="tag ${status.cls}">${status.label}</div>
        </div>
        <div class="pf-big tnum">${totRim.toFixed(2)}<span class="of"> / ${p.iniziale} gg</span></div>
        <div class="pf-bar"><div class="pf-fill" style="width:${pct}%;background:${over?css('--bad'):color}"></div></div>
        <div class="pf-rows">
          <div><span class="l">Iniziali</span><span class="v">${p.iniziale.toFixed(2)} gg</span></div>
          <div><span class="l">Consumate</span><span class="v">${totIns.toFixed(2)} gg</span></div>
          <div><span class="l">Residue</span><span class="v" style="color:${over?'var(--bad)':'var(--ink)'}">${totRim.toFixed(2)} gg</span></div>
          <div><span class="l">% consumo</span><span class="v">${pct}%</span></div>
          ${pendingDays > 0 ? `<div style="grid-column:1/-1"><span class="l">In attesa</span><span class="v" style="color:var(--warn)">+ ${pendingDays.toFixed(2)} gg</span></div>` : ""}
        </div>
      </div>`;
    }).join("");
  }

  function pfRenderEvalSelect() {
    const sel = $("pfFEval");
    if(!pfTotali.length) { sel.innerHTML = '<option value="">—</option>'; return; }
    sel.innerHTML = pfTotali.map(p =>
      `<option value="${esc(p.eval)}">${esc(p.eval)} · ${esc(p.plafond)}</option>`
    ).join("");
  }

  function pfRenderPending() {
    const tbl = $("pfPendingTbl");
    $("pfPendingCount").textContent = pfPending.length;
    $("pfPendingSection").style.display = pfPending.length ? "" : "none";
    $("pfBtnSave").disabled = !(pfPending.length && pfWorkbook);
    if(!pfPending.length) { tbl.innerHTML = ""; return; }
    let html = `<thead><tr>
      <th>Anno</th><th>Mese</th><th>Progetto</th><th>Task</th><th>EVAL</th>
      <th class="num">Totale Ore</th><th class="num">Totale Giorni</th><th></th>
    </tr></thead><tbody>`;
    pfPending.forEach((r, i) => {
      html += `<tr>
        <td class="mono">${r.anno}</td>
        <td>${esc(r.mese)}</td>
        <td>${esc(r.progetto)}</td>
        <td>${esc(r.task)}</td>
        <td class="mono">${esc(r.eval)}</td>
        <td class="num mono">${r.ore.toFixed(2)}</td>
        <td class="num mono">${(r.ore/8).toFixed(2)}</td>
        <td class="num"><button class="icon-btn" data-i="${i}" title="Rimuovi">✕</button></td>
      </tr>`;
    });
    html += "</tbody>";
    tbl.innerHTML = html;
    tbl.querySelectorAll(".icon-btn").forEach(b => {
      b.onclick = () => {
        pfPending.splice(parseInt(b.dataset.i,10), 1);
        pfRenderKPI(); pfRenderCards(); pfRenderPending();
      };
    });
  }

  function pfRenderDettaglio() {
    const tbl = $("pfDettaglioTbl");
    if(!pfDettaglio.length) {
      tbl.innerHTML = '<thead><tr><th>—</th></tr></thead><tbody><tr><td style="text-align:center;color:var(--muted);padding:24px">Nessuna riga</td></tr></tbody>';
      $("pfDettCount").textContent = "0";
      return;
    }
    const slice = pfDettaglio.slice(-pfDettShow).reverse();
    $("pfDettCount").textContent = slice.length;
    let html = `<thead><tr>
      <th>Anno</th><th>Mese</th><th>Progetto</th><th>Task</th><th>EVAL</th>
      <th class="num">Ore</th><th class="num">Giorni</th>
    </tr></thead><tbody>`;
    slice.forEach(r => {
      html += `<tr>
        <td class="mono">${esc(r.anno)}</td>
        <td>${esc(r.mese)}</td>
        <td>${esc(r.progetto)}</td>
        <td>${esc(r.task)}</td>
        <td class="mono">${esc(r.eval)}</td>
        <td class="num mono">${Number(r.ore).toFixed(2)}</td>
        <td class="num mono">${Number(r.giorni).toFixed(2)}</td>
      </tr>`;
    });
    html += "</tbody>";
    tbl.innerHTML = html;
  }

  function pfUpdateNavMeta() {
    if(!pfTotali.length) { $("navMetaP").innerHTML = `— gg<br/>residuo`; return; }
    const totIniz = pfTotali.reduce((s,p) => s + p.iniziale, 0);
    const totIns  = pfTotali.reduce((s,p) => s + p.inserite, 0) + pfPendingDaysTotal();
    const totRim  = totIniz - totIns;
    $("navMetaP").innerHTML = `${totRim.toFixed(0)} gg<br/>residuo`;
  }

  /* ---------- ADD / CLEAR PENDING ---------- */
  $("pfBtnAddRow").onclick = () => {
    const anno = parseInt($("pfFAnno").value, 10);
    const mese = $("pfFMese").value;
    const progetto = $("pfFProg").value.trim();
    const task = $("pfFTask").value.trim();
    const evalV = $("pfFEval").value;
    const ore = parseFloat($("pfFOre").value);
    if(!progetto || !task) { alert("Compila Progetto e Task"); return; }
    if(!isFinite(ore) || ore <= 0) { alert("Inserisci un valore di ore valido"); return; }
    // EVAL might be number → cast appropriately
    const evalCast = isNaN(Number(evalV)) ? evalV : Number(evalV);
    pfPending.push({ anno, mese, progetto, task, eval: evalCast, ore });
    // Reset solo campi testo per facilitare inserimento multiple
    $("pfFProg").value = "";
    $("pfFTask").value = "";
    $("pfFOre").value = "";
    pfRenderKPI(); pfRenderCards(); pfRenderPending(); pfUpdateNavMeta();
  };

  $("pfBtnClearPending").onclick = () => {
    if(!pfPending.length) return;
    if(!confirm("Svuotare tutte le righe in attesa?")) return;
    pfPending = [];
    pfRenderKPI(); pfRenderCards(); pfRenderPending(); pfUpdateNavMeta();
  };

  /* ---------- DETTAGLIO PAGINATION ---------- */
  document.querySelectorAll("#pfSegDett button").forEach(b => {
    b.onclick = () => {
      document.querySelectorAll("#pfSegDett button").forEach(x => x.classList.toggle("active", x === b));
      pfDettShow = parseInt(b.dataset.n, 10);
      pfRenderDettaglio();
    };
  });

  /* ---------- SUGGEST DETAIL RENDER ---------- */
  function pfRenderSuggestDetail(groups, mese, anno) {
    $("pfSuggestLabel").textContent = `${mese} ${anno}`;
    const container = $("pfSuggestContent");
    if(!groups.length) {
      container.innerHTML = "";
      $("pfSuggestSection").style.display = "none";
      return;
    }

    container.innerHTML = groups.map(g => {
      const totalGG = g.totalOre / 8;

      // Riga subtotale per task × utente
      const rowsHtml = g.rows.map(r => {
        const pct = g.totalOre > 0 ? (r.ore / g.totalOre * 100).toFixed(0) : 0;
        const giorni = (r.ore / 8).toFixed(2);
        return `<tr>
          <td>${esc(r.task)}</td>
          <td>${esc(r.utente)}</td>
          <td class="num mono">${r.ore.toFixed(2)}</td>
          <td class="num mono">${giorni}</td>
          <td class="num" style="color:var(--muted);font-size:11px">${pct}%</td>
        </tr>`;
      }).join("");

      return `<div class="pf-suggest-group">
        <div class="pf-suggest-group-head">
          <div class="pf-suggest-group-meta">
            <span class="pf-suggest-group-title">${esc(g.plafond)}</span>
            <span class="pf-suggest-group-eval">EVAL ${esc(String(g.eval))}</span>
          </div>
          <span class="tag info tnum">${totalGG.toFixed(2)} gg &nbsp;·&nbsp; ${g.totalOre.toFixed(2)} h</span>
        </div>
        <div style="overflow:auto">
          <table class="t" style="width:100%">
            <thead>
              <tr>
                <th>Task</th>
                <th>Utente</th>
                <th class="num">Ore</th>
                <th class="num">Giorni</th>
                <th class="num">%</th>
              </tr>
            </thead>
            <tbody>${rowsHtml}</tbody>
            <tfoot>
              <tr>
                <td colspan="2">Totale ${esc(g.plafond)}</td>
                <td class="num mono">${g.totalOre.toFixed(2)}</td>
                <td class="num mono">${totalGG.toFixed(2)}</td>
                <td class="num">100%</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>`;
    }).join("");

    $("pfSuggestSection").style.display = "";
  }

  $("pfBtnCloseSuggest").onclick = () => {
    $("pfSuggestSection").style.display = "none";
  };

  /* ---------- SUGGERISCI DAI RAPPORTINI (bonus) ---------- */
  $("pfBtnSuggest").onclick = () => {
    if(!pfTotali.length) return;
    if(!rawData.length) { alert("Importa prima i rapportini in pagina 1."); return; }

    // Determina mese/anno dal massimo delle date dei rapportini
    const dates = rawData.map(r => r.data).filter(Boolean);
    let mese = $("pfFMese").value, anno = parseInt($("pfFAnno").value, 10);
    if(dates.length) {
      const maxD = new Date(Math.max(...dates));
      const meseNames = ["Gennaio","Febbraio","Marzo","Aprile","Maggio","Giugno","Luglio","Agosto","Settembre","Ottobre","Novembre","Dicembre"];
      mese = meseNames[maxD.getMonth()];
      anno = maxD.getFullYear();
      // Aggiorna anche i campi del form per coerenza con i successivi inserimenti manuali
      $("pfFMese").value = mese;
      $("pfFAnno").value = anno;
    }

    const propose = [];   // righe da aggiungere a pfPending (1 per plafond)
    const groups  = [];   // dettaglio per task × utente (per la view suggerimenti)

    pfTotali.forEach(p => {
      if(p.eval == null || p.eval === "" || p.eval === "?") return;
      const evalStr = String(p.eval);
      const matches = rawData.filter(r => {
        const fields = `${r.compito||""} ${r.parent||""} ${r.root||""} ${r.progetto||""}`;
        return new RegExp("EVA[L]?\\s*0*" + evalStr + "\\b","i").test(fields);
      });

      const totalOre = matches.reduce((s, r) => s + r.ore, 0);
      if(totalOre <= 0) return;

      // Subtotali per task × utente (ordinati per ore decrescenti)
      const rowMap = {};
      matches.forEach(r => {
        const key = `${r.compito||""}|||${r.utente||""}`;
        if(!rowMap[key]) rowMap[key] = { task: r.compito || "—", utente: r.utente || "—", ore: 0 };
        rowMap[key].ore += r.ore;
      });
      const detailRows = Object.values(rowMap)
        .map(r => ({ ...r, ore: Math.round(r.ore * 100) / 100 }))
        .sort((a, b) => b.ore - a.ore);

      const roundedTotal = Math.round(totalOre * 100) / 100;

      groups.push({ plafond: p.plafond, eval: p.eval, rows: detailRows, totalOre: roundedTotal });

      propose.push({
        anno, mese,
        progetto: p.plafond,
        task: `Consumo ${mese} ${anno} · ${p.plafond}`,
        eval: isNaN(Number(p.eval)) ? p.eval : Number(p.eval),
        ore: roundedTotal
      });
    });

    // Mostra sempre la view detail (anche se vuota, si nasconde da sola)
    pfRenderSuggestDetail(groups, mese, anno);

    if(!groups.length) {
      alert("Nessun timelog con EVAL corrispondente ai plafond è stato trovato nei rapportini caricati.");
      return;
    }

    if(!confirm(`Trovate ${propose.length} righe candidate dai rapportini per ${mese} ${anno}.\nAggiungerle alla coda in attesa?`)) return;
    pfPending = pfPending.concat(propose);
    pfRenderKPI(); pfRenderCards(); pfRenderPending(); pfUpdateNavMeta();
  };

  /* ---------- AGGIORNA EXCEL ----------
     NOTA TECNICA: ExcelJS 4.4 dopo xlsx.load() NON popola table.rows / table.ref /
     table.worksheet. Se chiamiamo addRow() così come si trova, crasha. Inoltre la
     serializzazione perde calculatedColumnFormula e (su questo file) la colonna
     Stato di TabellaTotali5. Quindi rehydratiamo manualmente le tabelle prima
     di scrivere, e riapplichiamo i metadati prima del save.
  */
  function pfColLetterToNum(letters) {
    let n = 0;
    for(const c of letters.toUpperCase()) n = n*26 + (c.charCodeAt(0) - 64);
    return n;
  }
  function pfRehydrateTable(ws, tbl) {
    if(!tbl || !tbl.table) return;
    const ref = tbl.table.ref || tbl.table.tableRef;
    if(!ref) throw new Error("Table ref non disponibile");
    tbl.table.ref = ref;
    tbl.worksheet = ws;
    if(!tbl.table.headerRow) tbl.table.headerRow = true;
    const m = ref.match(/^([A-Z]+)(\d+):([A-Z]+)(\d+)$/);
    if(!m) throw new Error("Ref tabella non valida: " + ref);
    const c0 = pfColLetterToNum(m[1]), r0 = parseInt(m[2],10);
    const c1 = pfColLetterToNum(m[3]), r1 = parseInt(m[4],10);
    const rows = [];
    for(let r = r0 + 1; r <= r1; r++) {
      const row = [];
      for(let c = c0; c <= c1; c++) {
        const v = ws.getRow(r).getCell(c).value;
        if(v && typeof v === "object" && "formula" in v) {
          row.push({ formula: v.formula, result: v.result });
        } else {
          row.push(v);
        }
      }
      rows.push(row);
    }
    tbl.table.rows = rows;
  }

  $("pfBtnSave").onclick = async () => {
    if(!pfWorkbook || !pfPending.length) return;
    try {
      const detSheet = pfWorkbook.getWorksheet("Dettaglio Plafond");
      if(!detSheet) throw new Error("Foglio 'Dettaglio Plafond' non trovato");
      const detTable = detSheet.getTable("TabellaTask");
      if(!detTable) throw new Error("Tabella 'TabellaTask' non trovata");

      // Rehydration (fix bug ExcelJS)
      pfRehydrateTable(detSheet, detTable);

      // Riapplica calculated column formula su 'Totale Giorni' (col 7, 0-based idx 6)
      // (ExcelJS purtroppo non sempre serializza questo metadato; la formula è già
      //  scritta a livello di cella su ogni riga, quindi Excel calcola comunque)
      if(detTable.table.columns && detTable.table.columns[6]) {
        detTable.table.columns[6].calculatedColumnFormula = "TabellaTask[[#This Row],[Totale Ore]]/8";
      }
      // Cosmetica: evita che ExcelJS imposti totalsRowShown=1 e filter hidden
      detTable.table.totalsRowShown = false;
      detTable.table.totalsRowCount = 0;
      if(Array.isArray(detTable.table.columns)) {
        detTable.table.columns.forEach(c => { delete c.filterButton; });
      }

      const calcFormula = "TabellaTask[[#This Row],[Totale Ore]]/8";
      pfPending.forEach(r => {
        detTable.addRow([
          r.anno,
          r.mese,
          r.progetto,
          r.task,
          (typeof r.eval === "number") ? r.eval : (isNaN(Number(r.eval)) ? r.eval : Number(r.eval)),
          r.ore,
          { formula: calcFormula, result: r.ore / 8 }
        ]);
      });
      detTable.commit();

      // Anche TabellaTotali5: rehydrate + ripristina colonna 'Stato' e calc formula
      const totSheet = pfWorkbook.getWorksheet("FatturazioniMensili_Aggiornate");
      const totTable = totSheet && totSheet.getTable("TabellaTotali5");
      if(totTable && totTable.table) {
        pfRehydrateTable(totSheet, totTable);
        if(Array.isArray(totTable.table.columns)) {
          if(totTable.table.columns.length === 5) {
            totTable.table.columns.push({ name: "Stato" });
          }
          if(totTable.table.columns[4]) {
            totTable.table.columns[4].calculatedColumnFormula =
              "TabellaTotali5[[#This Row],[Iniziale (gg)]]-TabellaTotali5[[#This Row],[Inserite (gg)]]";
          }
          totTable.table.columns.forEach(c => { delete c.filterButton; });
        }
        totTable.table.totalsRowShown = false;
        totTable.table.totalsRowCount = 0;
        totTable.commit();
      }

      // Forza Excel a ricalcolare all'apertura
      pfWorkbook.calcProperties = pfWorkbook.calcProperties || {};
      pfWorkbook.calcProperties.fullCalcOnLoad = true;

      // Scrivi e scarica
      const buf = await pfWorkbook.xlsx.writeBuffer();
      const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const ts = new Date().toISOString().slice(0,10);
      const baseName = pfFileName.replace(/\.xlsx$/i, "");
      a.download = `${baseName}_aggiornato_${ts}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      // Ri-leggi dal workbook in memoria per aggiornare lo stato locale
      pfPending.forEach(r => {
        const idx = pfTotali.findIndex(p => String(p.eval) === String(r.eval));
        if(idx >= 0) {
          pfTotali[idx].inserite += (r.ore / 8);
          pfTotali[idx].rimanenti = pfTotali[idx].iniziale - pfTotali[idx].inserite;
        }
        pfDettaglio.push({
          anno: r.anno, mese: r.mese, progetto: r.progetto, task: r.task,
          eval: r.eval, ore: r.ore, giorni: r.ore/8
        });
      });
      pfPending = [];
      pfRenderAll();

      alert("File aggiornato e scaricato.\nApri il file in Excel: i totali SUMIF nel primo foglio si ricalcoleranno automaticamente.");
    } catch(err) {
      console.error(err);
      alert("Errore durante l'aggiornamento del file: " + err.message);
    }
  };

  // Init: pre-popola Anno e Mese — usa dati rapportini se disponibili, altrimenti mese corrente
  (function initFormDate() {
    const meseNames = ["Gennaio","Febbraio","Marzo","Aprile","Maggio","Giugno","Luglio","Agosto","Settembre","Ottobre","Novembre","Dicembre"];
    let anno, mese;
    if(rawData.length) {
      const dates = rawData.map(r => r.data).filter(Boolean);
      if(dates.length) {
        const maxD = new Date(Math.max(...dates));
        anno = maxD.getFullYear();
        mese = meseNames[maxD.getMonth()];
      }
    }
    if(!anno) { const now = new Date(); anno = now.getFullYear(); mese = meseNames[now.getMonth()]; }
    $("pfFAnno").value = anno;
    $("pfFMese").value = mese;
  })();

  // Init: empty state
  showSections(false);

  // Espone pfRenderAll globalmente per firebase.js
  window.pfRenderAll = pfRenderAll;
})();

