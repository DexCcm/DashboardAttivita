# CCM Quadient · Dashboard

Dashboard interna per l'analisi dei rapportini Zoho, il monitoraggio KPI dei task e la gestione dei plafond CREDEM.

## Funzionalità

| Sezione | Descrizione |
|---------|-------------|
| **Rapportini** | Import Excel/XML da Zoho · analisi ore per utente/progetto/categoria · grafici e drill-down |
| **Task & KPI** | Stima vs log per task · accuracy · overrun · distribuzione |
| **Plafond CREDEM** | Stato giornate per EVAL · import file Excel · suggerimento automatico da rapportini |
| **Firebase** | Storico rapportini e snapshot plafond per mese su Realtime Database |

## Struttura

```
├── index.html          # HTML skeleton (nav, pagine, toolbar)
├── css/
│   ├── base.css        # Variabili, layout, masthead, nav
│   ├── components.css  # Toolbar, KPI strip, panel, user-card, tabelle, grafici
│   └── pages.css       # Stili specifici plafond e Firebase UI
└── js/
    ├── config.js       # Costanti: TEAM_ROLES, HOLIDAYS, CAT_COLORS
    ├── helpers.js      # Utility: $(), esc(), parseDateValue(), formatUnit()…
    ├── rapportini.js   # Import, filtri, render, grafici, drill-down (Page 1)
    ├── tasks.js        # Task & KPI dashboard (Page 2)
    ├── plafond.js      # Plafond CREDEM — lettura/scrittura Excel (Page 3)
    └── firebase.js     # Firebase init · save/load rapportini e plafond
```

## Dipendenze (CDN)

- [SheetJS (xlsx)](https://sheetjs.com/) — lettura rapportini Excel/XML
- [ExcelJS](https://github.com/exceljs/exceljs) — lettura e scrittura file plafond
- [Chart.js 4](https://www.chartjs.org/) — grafici
- [Firebase JS SDK 10 (compat)](https://firebase.google.com/) — Realtime Database

## Come aprire

Serve un web server locale (non `file://` per via delle restrizioni CORS di Firebase):

```bash
# Con Python
python -m http.server 8080

# Con Node
npx serve .
```

Poi apri `http://localhost:8080`.

Con **GitHub Pages** funziona direttamente all'URL pubblico.

## Firebase

Il progetto usa **Firebase Realtime Database** (`dashboard-analisi-tasks`) con due path:

```
/rapportini_ccm/{YYYY_Mese}/rows/{utente__data__compito}
/plafond_ccm/{YYYY_Mese}/{eval_code}
```

Le regole attuali sono aperte (`".read": true, ".write": true`). L'autenticazione verrà aggiunta in una fase successiva.

## Team

| Nome | Ruolo |
|------|-------|
| Simone Viscomi | PM / Lead |
| Damiano Angioletti | Developer |
| Leonardo Fantozzi | Developer |
| Samuela Carnelli | Developer |
