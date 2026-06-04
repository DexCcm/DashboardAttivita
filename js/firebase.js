/* ============================================================
   FIREBASE MODULE
   ============================================================ */
(function initFirebase() {
  const FB_CONFIG = {
  apiKey: "AIzaSyAfFN7HTUWjcvaRjCLYFT5Rwq_NOIPP2qU",
  authDomain: "dashboard-analisi-tasks.firebaseapp.com",
  databaseURL: "https://dashboard-analisi-tasks-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "dashboard-analisi-tasks",
  storageBucket: "dashboard-analisi-tasks.firebasestorage.app",
  messagingSenderId: "165182734148",
  appId: "1:165182734148:web:2b3b61c830f915185e2111"
  };

  if(typeof firebase === "undefined") {
    console.warn("Firebase SDK non caricato");
    ["fbRapStatus","fbPfStatus"].forEach(id => {
      const el = $(id); if(el) { el.className = "fb-status err"; }
    });
    $("fbRapStatusTxt").textContent = "Firebase non disponibile";
    $("fbPfStatusTxt").textContent  = "Firebase non disponibile";
    return;
  }

  let fbDB;
  try {
    const fbApp = firebase.apps.length ? firebase.apps[0] : firebase.initializeApp(FB_CONFIG);
    fbDB = firebase.database(fbApp);
  } catch(e) {
    console.error("Firebase init:", e);
    $("fbRapStatusTxt").textContent = "Errore init";
    $("fbPfStatusTxt").textContent  = "Errore init";
    ["fbRapStatus","fbPfStatus"].forEach(id => { const el=$(id); if(el) el.className="fb-status err"; });
    return;
  }

  /* --- helpers status badge --- */
  function fbStatus(id, txtId, cls, msg) {
    const el = $(id); if(!el) return;
    el.className = "fb-status " + cls;
    $(txtId).textContent = msg;
  }

  const MESE_NAMES = ["Gennaio","Febbraio","Marzo","Aprile","Maggio","Giugno",
                      "Luglio","Agosto","Settembre","Ottobre","Novembre","Dicembre"];

  /* Sanitizza chiavi Firebase (no . # $ [ ] / spazi) */
  function fbKey(s) { return String(s || "").replace(/[.#$\[\]/\s]/g, "_").substring(0, 64); }

  /* Percorso mese es. "2026_Maggio" */
  function fbPath(anno, mese) { return anno + "_" + mese; }

  /* Rileva mese di riferimento dai rawData */
  function detectRefMonth() {
    const dates = rawData.map(r => r.data).filter(Boolean);
    if(!dates.length) return null;
    const maxD = new Date(Math.max(...dates));
    return { anno: maxD.getFullYear(), mese: MESE_NAMES[maxD.getMonth()] };
  }

  /* Sincronizza i selettori mese Firebase con i dati caricati */
  function syncMonthSelectors() {
    const ref = detectRefMonth(); if(!ref) return;
    $("fbRapMese").value = ref.mese;  $("fbRapAnno").value = ref.anno;
    $("fbPfMese").value  = ref.mese;  $("fbPfAnno").value  = ref.anno;
  }

  /* Aggancia la sincronizzazione ogni volta che vengono caricati nuovi rapportini */
  const _origInitUI = window.initUI;
  window.initUI = function() {
    if(_origInitUI) _origInitUI();
    syncMonthSelectors();
    $("fbBtnSaveRap").disabled = false;
  };

  /* Inizializza selettori con mese corrente */
  (function() {
    const now = new Date();
    const m = MESE_NAMES[now.getMonth()]; const y = now.getFullYear();
    $("fbRapMese").value = m; $("fbRapAnno").value = y;
    $("fbPfMese").value  = m; $("fbPfAnno").value  = y;
  })();

  fbStatus("fbRapStatus","fbRapStatusTxt","ok","Connesso");
  fbStatus("fbPfStatus", "fbPfStatusTxt", "ok","Connesso");

  /* ======================================================
     RAPPORTINI — SAVE
     Path: /rapportini_ccm/{anno_mese}/rows/{key}
     Key: utente__dataIso__compito  → upsert.
     Sessioni multiple dello stesso task nello stesso giorno
     vengono SOMMATE (evita collisioni di chiave che causano
     perdita di ore).
  ====================================================== */
  $("fbBtnSaveRap").onclick = async () => {
    if(!rawData.length) { alert("Nessun dato. Importa prima i rapportini."); return; }
    const mese = $("fbRapMese").value;
    const anno = parseInt($("fbRapAnno").value, 10);
    if(!anno || !mese) { alert("Seleziona anno e mese."); return; }

    fbStatus("fbRapStatus","fbRapStatusTxt","busy","Salvataggio…");
    $("fbBtnSaveRap").disabled = true;

    try {
      const meseIdx = MESE_NAMES.indexOf(mese);
      const subset  = rawData.filter(r => r.data && r.data.getMonth() === meseIdx && r.data.getFullYear() === anno);
      if(!subset.length) {
        alert(`Nessun record con date in ${mese} ${anno} nei rapportini caricati.\nVerifica le date o cambia mese.`);
        fbStatus("fbRapStatus","fbRapStatusTxt","ok","Nessun dato per il mese");
        $("fbBtnSaveRap").disabled = false;
        return;
      }

      // Aggrega per chiave: più sessioni dello stesso task nello stesso giorno → ore sommate
      const updates = {};
      subset.forEach(r => {
        const ds  = r.data ? isoDate(r.data) : "no_date";
        const key = fbKey(r.utente) + "__" + ds + "__" + fbKey(r.compito || "nocompito");
        if(updates[key]) {
          // Stessa chiave → somma le ore, mantieni gli altri campi invariati
          updates[key].ore = Math.round((updates[key].ore + r.ore) * 10000) / 10000;
        } else {
          updates[key] = {
            utente: r.utente||"", progetto: r.progetto||"", compito: r.compito||"",
            parent: r.parent||"", root: r.root||"", ore: r.ore,
            dataIso: ds, categoria: r.categoria||"Credem - Altro", anno, mese
          };
        }
      });

      await fbDB.ref("rapportini_ccm/" + fbPath(anno, mese) + "/rows").update(updates);
      const n = Object.keys(updates).length;
      const rawN = subset.length;
      const merged = rawN - n;
      fbStatus("fbRapStatus","fbRapStatusTxt","ok","Salvati " + n + " record");
      alert(`✅ Salvati ${n} record su Firebase per ${mese} ${anno}.` +
            (merged > 0 ? `\n(${merged} sessioni multiple aggregate per stesso task/giorno)` : ""));
    } catch(err) {
      console.error("fbSaveRap:", err);
      fbStatus("fbRapStatus","fbRapStatusTxt","err","Errore salvataggio");
      alert("Errore: " + err.message);
    } finally { $("fbBtnSaveRap").disabled = false; }
  };

  /* ======================================================
     RAPPORTINI — LOAD
     Carica il mese selezionato in rawData e re-renderizza
  ====================================================== */
  $("fbBtnLoadRap").onclick = async () => {
    const mese = $("fbRapMese").value;
    const anno = parseInt($("fbRapAnno").value, 10);
    if(!anno || !mese) { alert("Seleziona anno e mese da caricare."); return; }

    fbStatus("fbRapStatus","fbRapStatusTxt","busy","Caricamento…");
    $("fbBtnLoadRap").disabled = true;

    try {
      const snap = await fbDB.ref("rapportini_ccm/" + fbPath(anno, mese) + "/rows").once("value");
      const val  = snap.val();
      if(!val) {
        alert("Nessun dato trovato su Firebase per " + mese + " " + anno + ".");
        fbStatus("fbRapStatus","fbRapStatusTxt","ok","Nessun dato");
        $("fbBtnLoadRap").disabled = false;
        return;
      }

      const rows = Object.values(val).map(r => ({
        utente:    r.utente    || "",
        progetto:  r.progetto  || "",
        compito:   r.compito   || "",
        parent:    r.parent    || null,
        root:      r.root      || null,
        ore:       Number(r.ore) || 0,
        data:      r.dataIso ? parseDateValue(r.dataIso) : null,
        categoria: r.categoria || "Altro"
      })).filter(r => r.utente && r.ore > 0);

      if(!rows.length) {
        alert("Record trovati ma tutti non validi per " + mese + " " + anno + ".");
        fbStatus("fbRapStatus","fbRapStatusTxt","ok","0 record validi");
        $("fbBtnLoadRap").disabled = false;
        return;
      }

      rawData = rows;
      selProjects = []; selTasks = []; selUsers = [];
      initUI(); renderAll();
      $("fbBtnSaveRap").disabled = false;
      fbStatus("fbRapStatus","fbRapStatusTxt","ok",rows.length + " record caricati");
    } catch(err) {
      console.error("fbLoadRap:", err);
      fbStatus("fbRapStatus","fbRapStatusTxt","err","Errore caricamento");
      alert("Errore: " + err.message);
    } finally { $("fbBtnLoadRap").disabled = false; }
  };

  /* ======================================================
     PLAFOND — SAVE SNAPSHOT
     Path: /plafond_ccm/{anno_mese}/{eval_code}
  ====================================================== */
  $("fbBtnSavePf").onclick = async () => {
    if(!pfTotali.length) { alert("Nessun dato plafond. Importa prima il file Excel."); return; }
    const mese = $("fbPfMese").value;
    const anno = parseInt($("fbPfAnno").value, 10);
    if(!anno || !mese) { alert("Seleziona anno e mese."); return; }
    if(!confirm("Salvare snapshot plafond per " + mese + " " + anno + " su Firebase?\nI dati esistenti per questo mese verranno sovrascritti.")) return;

    fbStatus("fbPfStatus","fbPfStatusTxt","busy","Salvataggio…");
    $("fbBtnSavePf").disabled = true;

    try {
      const updates = {};
      pfTotali.forEach(p => {
        if(!p.eval) return;
        updates[fbKey(String(p.eval))] = {
          eval: p.eval, plafond: p.plafond||"", progetto: p.progetto||"",
          iniziale: p.iniziale||0, inserite: p.inserite||0,
          rimanenti: p.rimanenti||0, stato: p.stato||"",
          anno, mese, savedAt: new Date().toISOString()
        };
      });

      await fbDB.ref("plafond_ccm/" + fbPath(anno, mese)).set(updates);
      const n = Object.keys(updates).length;
      fbStatus("fbPfStatus","fbPfStatusTxt","ok",n + " plafond salvati");
      alert("✅ Snapshot di " + n + " plafond salvato su Firebase per " + mese + " " + anno + ".");
    } catch(err) {
      console.error("fbSavePf:", err);
      fbStatus("fbPfStatus","fbPfStatusTxt","err","Errore salvataggio");
      alert("Errore: " + err.message);
    } finally { $("fbBtnSavePf").disabled = false; }
  };

  /* ======================================================
     PLAFOND — LOAD SNAPSHOT (sola lettura)
  ====================================================== */
  $("fbBtnLoadPf").onclick = async () => {
    const mese = $("fbPfMese").value;
    const anno = parseInt($("fbPfAnno").value, 10);
    if(!anno || !mese) { alert("Seleziona anno e mese."); return; }

    fbStatus("fbPfStatus","fbPfStatusTxt","busy","Caricamento…");
    $("fbBtnLoadPf").disabled = true;

    try {
      const snap = await fbDB.ref("plafond_ccm/" + fbPath(anno, mese)).once("value");
      const val  = snap.val();
      if(!val) {
        alert("Nessuno snapshot trovato per " + mese + " " + anno + ".");
        fbStatus("fbPfStatus","fbPfStatusTxt","ok","Nessun dato");
        $("fbBtnLoadPf").disabled = false;
        return;
      }

      pfTotali = Object.values(val).map(p => ({
        eval: p.eval, plafond: p.plafond||"", progetto: p.progetto||"",
        iniziale: Number(p.iniziale)||0, inserite: Number(p.inserite)||0,
        rimanenti: Number(p.rimanenti)||0, stato: p.stato||""
      }));
      pfDettaglio = []; pfPending = [];

      pfRenderAll();
      // Mostra sezioni plafond senza file Excel
      const pfCardsEl = $("pfCardsSection");
      if(pfCardsEl) pfCardsEl.style.display = "";
      $("pfEmptyPanel").style.display   = "none";
      $("pfAddSection").style.display    = "none";
      $("pfDettaglioSection").style.display = "none";
      $("pfPendingSection").style.display   = "none";
      $("pfSuggestSection").style.display   = "none";
      // Disabilita azioni che richiedono Excel
      $("pfBtnSave").disabled    = true;
      $("pfBtnSuggest").disabled = rawData.length === 0;
      // Aggiorna badge
      $("pfFileBadge").style.display = "";
      $("pfFileName").textContent = "📦 Firebase · " + mese + " " + anno;

      const n = pfTotali.length;
      fbStatus("fbPfStatus","fbPfStatusTxt","ok", n + " plafond caricati");
    } catch(err) {
      console.error("fbLoadPf:", err);
      fbStatus("fbPfStatus","fbPfStatusTxt","err","Errore caricamento");
      alert("Errore: " + err.message);
    } finally { $("fbBtnLoadPf").disabled = false; }
  };

  /* Abilita "Salva snapshot" tramite MutationObserver su pfCardsSection */
  const pfCardsEl = $("pfCardsSection");
  if(pfCardsEl) {
    new MutationObserver(() => {
      $("fbBtnSavePf").disabled = pfCardsEl.style.display === "none";
    }).observe(pfCardsEl, { attributes: true, attributeFilter: ["style"] });
  }

})(); // end initFirebase
