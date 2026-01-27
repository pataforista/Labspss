const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];

const LS_KEY = "labnotes_records_v1";
const LS_THEME = "labnotes_theme";

const state = {
  catalog: null,
  records: [],
  selected: null,
  new: {
    selectedPanels: new Set()
  },
  filters: {
    search: ""
  }
};

const CONVERSIONS = {
  glucose_fasting: { factor: 1 / 18.01, unit: "mmol/L" },
  creatinine: { factor: 88.4, unit: "µmol/L" },
  bun: { factor: 1 / 2.8, unit: "mmol/L" },
  chol_total: { factor: 1 / 38.67, unit: "mmol/L" },
  ldl: { factor: 1 / 38.67, unit: "mmol/L" },
  hdl: { factor: 1 / 38.67, unit: "mmol/L" },
  triglycerides: { factor: 1 / 88.57, unit: "mmol/L" },
  bili_total: { factor: 17.1, unit: "µmol/L" },
  bili_direct: { factor: 17.1, unit: "µmol/L" }
};

/* ---------- helpers ---------- */
function localISODate() {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
    .toISOString().slice(0, 10);
}

function sanitize(str) {
  if (!str) return "";
  const d = document.createElement("div");
  d.textContent = str;
  return d.innerHTML;
}

function getActualValue(v, mod) {
  if (v === "" || v === undefined) return undefined;
  return mod === "x10^3" ? Number(v) * 1000 : Number(v);
}

function updateModDisplay(el) {
  const w = el.closest(".num-with-mod");
  if (w) w.classList.toggle("active-mod", w.querySelector("input[type=checkbox]").checked);
}

function updateConversionHint(id, val, aid) {
  const hintEl = $(`#hint_${id}`);
  if (!hintEl || !CONVERSIONS[aid]) return;
  const num = Number(val);
  if (!val || isNaN(num)) {
    hintEl.textContent = "";
    return;
  }
  const conv = CONVERSIONS[aid];
  const res = num * conv.factor;
  hintEl.textContent = `≈ ${res.toFixed(2)} ${conv.unit}`;
}

/* ---------- theme ---------- */
function initTheme() {
  const saved = localStorage.getItem(LS_THEME) || "dark";
  document.body.dataset.theme = saved;
}

function toggleTheme() {
  const current = document.body.dataset.theme === "light" ? "dark" : "light";
  document.body.dataset.theme = current;
  localStorage.setItem(LS_THEME, current);
}

/* ---------- init ---------- */
window.onload = async () => {
  initTheme();
  state.catalog = await fetch("lab_catalog.json").then(r => r.json());
  const saved = localStorage.getItem(LS_KEY);
  state.records = saved ? JSON.parse(saved).records : [];
  $("#nrDate").value = localISODate();
  initUI();
  renderDashboard();
};

/* ---------- UI ---------- */
function initUI() {
  $("#btnNew").onclick = openNew;
  $("#btnBackFromNew").onclick = () => show("#viewDashboard");
  $("#btnBackFromDetail").onclick = () => show("#viewDashboard");
  $("#btnBackFromExport").onclick = () => show("#viewDetail");
  $("#btnBackFromSettings").onclick = () => show("#viewDashboard");
  $("#btnSettings").onclick = () => show("#viewSettings");
  $("#btnSaveRecord").onclick = saveNewRecord;
  $("#btnExport").onclick = openExport;
  $("#btnCopyExport").onclick = () => navigator.clipboard.writeText($("#exportText").value);
  $("#btnReset").onclick = () => { if (confirm("¿Borrar todo?")) { state.records = []; persist(); renderDashboard(); } };
  $("#btnExportAll").onclick = exportAll;
  $("#btnTheme").onclick = toggleTheme;

  $("#nrSearch").oninput = (e) => {
    state.filters.search = e.target.value.toLowerCase();
    renderDashboard();
  };

  const p = $("#nrPanels");
  state.catalog.panels.forEach(panel => {
    const b = document.createElement("button");
    b.className = "pill";
    b.textContent = panel.name;
    b.onclick = () => {
      state.new.selectedPanels.has(panel.panel_id)
        ? state.new.selectedPanels.delete(panel.panel_id)
        : state.new.selectedPanels.add(panel.panel_id);
      b.classList.toggle("active");
      renderCapture();
    };
    p.appendChild(b);
  });
}

function show(id) {
  $$(".view").forEach(v => v.classList.add("hidden"));
  $(id).classList.remove("hidden");
}

/* ---------- dashboard ---------- */
function renderDashboard() {
  show("#viewDashboard");
  const l = $("#recordsList");
  l.innerHTML = "";

  const filtered = state.records
    .filter(r => {
      const s = state.filters.search;
      if (!s) return true;
      return r.date.includes(s) ||
        (r.context && r.context.toLowerCase().includes(s)) ||
        (r.lab && r.lab.toLowerCase().includes(s));
    })
    .sort((a, b) => b.date.localeCompare(a.date));

  if (!filtered.length) {
    $("#emptyState").classList.remove("hidden");
    $("#emptyState").textContent = state.filters.search ? "No se encontraron resultados." : "No hay registros.";
    return;
  }
  $("#emptyState").classList.add("hidden");

  filtered.forEach(r => {
    const c = document.createElement("div");
    c.className = "card-item";
    c.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <div>
          <h3>${r.date} · ${sanitize(r.context || "Sin contexto")}</h3>
          <div class="muted small">${r.eval.alerts.length} alertas · ${r.panels.length} paneles</div>
        </div>
        <button class="btn btn-danger btn-sm" onclick="event.stopPropagation(); deleteRecord('${r.id}')">×</button>
      </div>`;
    c.onclick = () => openDetail(r.id);
    l.appendChild(c);
  });
}

function deleteRecord(id) {
  if (confirm("¿Eliminar este registro?")) {
    state.records = state.records.filter(x => x.id !== id);
    persist();
    renderDashboard();
  }
}

/* ---------- new ---------- */
function openNew() {
  state.new.selectedPanels.clear();
  $$(".pill").forEach(p => p.classList.remove("active"));
  renderCapture();
  show("#viewNew");
}

function renderCapture() {
  const a = $("#nrCaptureArea");
  a.innerHTML = "";
  state.new.selectedPanels.forEach(pid => {
    const p = state.catalog.panels.find(x => x.panel_id === pid);
    const c = document.createElement("div");
    c.className = "card";
    c.innerHTML = `<h3>${p.name}</h3>`;
    p.analytes.forEach(an => {
      const mod = pid === "cbc" && ["wbc", "anc", "alc", "plt"].includes(an.analyte_id);
      const r = document.createElement("div");
      r.className = "analyte-grid";

      let inputHtml = "";
      const inputId = `in_${pid}_${an.analyte_id}`;

      if (an.units === "qual") {
        inputHtml = `
          <select id="${inputId}">
             <option value="">--</option>
             <option value="negativo">Negativo</option>
             <option value="positivo">Positivo</option>
             <option value="traza">Traza</option>
          </select>`;
      } else if (an.units === "text") {
        inputHtml = `<input id="${inputId}" type="text" placeholder="Observación">`;
      } else {
        inputHtml = `
          <div>
            <div class="${mod ? 'num-with-mod' : ''}">
              <input id="${inputId}" class="font-mono" type="number" step="any" 
                oninput="updateConversionHint('${inputId}', this.value, '${an.analyte_id}')">
              ${mod ? `<label class="tinycheck">
                <input type="checkbox" id="mod_${pid}_${an.analyte_id}"
                  onchange="updateModDisplay(this.parentElement.previousElementSibling)">×10³
              </label>` : ""}
            </div>
            <div id="hint_${inputId}" class="conversion-hint font-mono"></div>
          </div>`;
      }

      r.innerHTML = `
        <div>${an.name}</div>
        <div>${inputHtml}</div>
        <div class="muted small">${an.units || ""}</div>`;
      c.appendChild(r);
    });
    a.appendChild(c);
  });
}

function saveNewRecord() {
  if (!$("#nrDate").value) { alert("Fecha obligatoria"); return; }
  if (!state.new.selectedPanels.size) { alert("Selecciona al menos un panel"); return; }

  const panels = [];
  state.new.selectedPanels.forEach(pid => {
    const res = [];
    state.catalog.panels.find(p => p.panel_id === pid).analytes.forEach(a => {
      const el = $(`#in_${pid}_${a.analyte_id}`);
      const v = el.value;
      if (v !== "") {
        if (a.units === "qual" || a.units === "text") {
          res.push({ analyte_id: a.analyte_id, value: v });
        } else {
          const numV = Number(v);
          if (numV < 0 && !["urine_ph"].includes(a.analyte_id)) return;
          const m = $(`#mod_${pid}_${a.analyte_id}`)?.checked ? "x10^3" : null;
          res.push({ analyte_id: a.analyte_id, value: numV, modifier: m });
        }
      }
    });
    panels.push({ panel_id: pid, results: res });
  });

  const rec = {
    id: "rec_" + Date.now(),
    date: $("#nrDate").value,
    sex: $("#nrSex").value,
    context: $("#nrContext").value,
    lab: $("#nrLabName").value,
    med: { clozapine: $("#nrClozapine").checked, ben: $("#nrBEN").checked },
    panels
  };

  rec.eval = evaluate(rec);
  state.records.push(rec);
  persist();

  // Feedback visual
  $("#btnSaveRecord").textContent = "Guardado...";
  setTimeout(() => {
    $("#btnSaveRecord").textContent = "Guardar";
    openDetail(rec.id);
  }, 400);
}

/* ---------- evaluation ---------- */
function evaluate(rec) {
  const alerts = [];
  const panelEvals = {};
  const allAnalytes = {};

  rec.panels.forEach(p => {
    const panelDef = state.catalog.panels.find(x => x.panel_id === p.panel_id);
    panelEvals[p.panel_id] = p.results.map(r => {
      const a = panelDef.analytes.find(x => x.analyte_id === r.analyte_id);
      const v = (a.units === "qual" || a.units === "text") ? r.value : getActualValue(r.value, r.modifier);

      let status = "normal";
      let statusLabel = "";

      if (a.critical && typeof v === 'number') {
        const crit = a.critical.find(c => (c.op === "<" && v < c.value) || (c.op === ">" && v > c.value));
        if (crit) { status = "critical"; statusLabel = crit.label; alerts.push({ type: 'critical', msg: `${a.name}: CRÍTICO (${v} ${a.units})` }); }
      }

      if (status !== 'critical' && a.flags && typeof v === 'number') {
        const flag = a.flags.find(f => (f.op === "<" && v < f.value) || (f.op === "<=" && v <= f.value) || (f.op === ">" && v > f.value) || (f.op === ">=" && v >= f.value));
        if (flag) { status = "warn"; statusLabel = flag.label; alerts.push({ type: 'warn', msg: `${a.name}: ${flag.label.replace(/_/g, ' ')}` }); }
      }

      if (status === "normal" && a.ref_ranges) {
        let ref = a.ref_ranges.find(x => x.sex === rec.sex) || a.ref_ranges.find(x => x.sex === "any") || a.ref_ranges[0];
        if (a.units === "qual") { if (v !== ref.qualitative_normal) status = "warn"; }
        else if (typeof v === 'number') {
          if (ref.low !== undefined && v < ref.low) status = "low";
          if (ref.high !== undefined && v > ref.high) status = "high";
        }
      }

      const evalResult = {
        ...r, scaled: v, name: a.name, units: a.units, status, statusLabel,
        hints: a.interpretation_hints || [], checklist: a.follow_up_checklist || [],
        conv: CONVERSIONS[r.analyte_id] ? { val: (v * CONVERSIONS[r.analyte_id].factor).toFixed(2), unit: CONVERSIONS[r.analyte_id].unit } : null
      };
      allAnalytes[r.analyte_id] = evalResult;
      return evalResult;
    });
  });

  // Derived Metrics (Anion Gap, BUN/Cr, AST/ALT)
  rec.panels.forEach(p => {
    const panelDef = state.catalog.panels.find(x => x.panel_id === p.panel_id);
    if (!panelDef.derived_metrics) return;
    panelDef.derived_metrics.forEach(m => {
      let val = null;
      if (m.metric_id === "anion_gap") { const na = allAnalytes.sodium?.scaled, cl = allAnalytes.chloride?.scaled, hco3 = allAnalytes.bicarb?.scaled; if (na && cl && hco3) val = na - (cl + hco3); }
      else if (m.metric_id === "bun_cr_ratio") { const bun = allAnalytes.bun?.scaled, cr = allAnalytes.creatinine?.scaled; if (bun && cr && cr > 0) val = bun / cr; }
      else if (m.metric_id === "ast_alt_ratio") { const ast = allAnalytes.ast?.scaled, alt = allAnalytes.alt?.scaled; if (ast && alt && alt > 0) val = ast / alt; }

      if (val !== null) {
        let status = "normal";
        if (m.ref_range) { if (val < m.ref_range.low) status = "low"; if (val > m.ref_range.high) status = "high"; }
        panelEvals[p.panel_id].push({ name: `(Calc) ${m.name}`, value: val.toFixed(1), scaled: val, units: m.units || "", status, isDerived: true, hints: m.interpretation_hints || [] });
        if (status !== "normal") alerts.push({ type: 'info', msg: `Métrica: ${m.name} fuera de rango (${val.toFixed(1)})` });
      }
    });
  });

  if (rec.med.clozapine) {
    const anc = allAnalytes.anc?.scaled;
    if (anc !== undefined) {
      const thr = rec.med.ben ? 500 : 1000;
      if (anc < thr) alerts.unshift({ type: 'critical', msg: `🛑 ALERTA CLOZAPINA: ANC ${anc} < ${thr}!` });
    }
  }

  return { alerts, panelEvals };
}

/* ---------- detail ---------- */
function openDetail(id) {
  const r = state.records.find(x => x.id === id);
  state.selected = r;
  $("#detailHeader").innerHTML = `<strong>${r.date}</strong> · ${sanitize(r.context)}`;

  // Context-aware automatic theme switch
  if (r.med.clozapine || r.eval.alerts.some(a => a.type === 'critical')) {
    document.body.dataset.theme = "dark";
  }

  if (r.eval.alerts.length) {
    $("#detailAlerts").innerHTML = r.eval.alerts.map(a => `<div class="badge ${a.type}">${a.msg}</div>`).join("");
  } else {
    $("#detailAlerts").innerHTML = `<span class="badge ok">Resultados sin alertas críticas</span>`;
  }

  const checklists = [];
  Object.values(r.eval.panelEvals).flat().forEach(e => { if (e.status !== 'normal' && e.checklist?.length) checklists.push({ name: e.name, items: e.checklist }); });

  if (checklists.length) {
    $("#detailChecklists").innerHTML = `<h3>Seguimiento sugerido</h3>` + checklists.map(c =>
      `<div class="card" style="font-size:0.9em"><strong>${c.name}:</strong><ul style="margin:5px 0; padding-left:20px;">${c.items.map(i => `<li>${i}</li>`).join("")}</ul></div>`
    ).join("");
  } else { $("#detailChecklists").innerHTML = ""; }

  const w = $("#detailPanels");
  w.innerHTML = "";
  r.panels.forEach(p => {
    const panelDef = state.catalog.panels.find(x => x.panel_id === p.panel_id);
    const c = document.createElement("div");
    c.className = "card";
    c.innerHTML = `<h3>${panelDef.name}</h3>`;
    r.eval.panelEvals[p.panel_id].forEach(e => {
      let v = e.value;
      if (e.modifier) v = `${e.value} ${e.modifier} (= ${e.scaled})`;

      const convHtml = e.conv ? `<div class="conv-val font-mono">SI: ${e.conv.val} ${e.conv.unit}</div>` : "";

      c.innerHTML += `
        <div class="analyte-row">
          <div class="analyte-grid">
            <div style="${e.isDerived ? 'font-style:italic' : ''}">${e.name}</div>
            <div class="font-mono">
              <div>${v} <small>${e.units || ""}</small></div>
              ${convHtml}
            </div>
            <div><span class="badge ${e.status}">${e.statusLabel || e.status}</span></div>
          </div>
          ${(e.status !== 'normal' && e.hints?.length) ? `<div class="hints small muted">${e.hints[0]}</div>` : ""}
        </div>`;
    });
    w.appendChild(c);
  });
  show("#viewDetail");
}

/* ---------- export ---------- */
function openExport() {
  const r = state.selected;
  let text = `REPORTE DE LABORATORIO - ${r.date}\n`;
  text += `Contexto: ${r.context || "—"}\n`;
  text += `Paciente: ${r.sex === 'male' ? 'Masculino' : r.sex === 'female' ? 'Femenino' : '—'}\n\n`;

  if (r.eval.alerts.length) text += `ALERTAS:\n` + r.eval.alerts.map(a => `- ${a.msg}`).join("\n") + "\n\n";

  r.panels.forEach(p => {
    const panelDef = state.catalog.panels.find(x => x.panel_id === p.panel_id);
    text += `--- ${panelDef.name} ---\n`;
    r.eval.panelEvals[p.panel_id].forEach(e => {
      const v = e.modifier ? e.scaled : e.value;
      let line = `${e.name}: ${v} ${e.units || ""}`;
      if (e.conv) line += ` (${e.conv.val} ${e.conv.unit})`;
      text += `${line} [${e.status}]\n`;
    });
    text += `\n`;
  });

  $("#exportText").value = text;
  show("#viewExport");
}

function exportAll() {
  const b = new Blob([JSON.stringify({ records: state.records }, null, 2)], { type: "application/json" });
  const u = URL.createObjectURL(b);
  const a = document.createElement("a");
  a.href = u; a.download = `labnotes_${localISODate()}.json`; a.click();
  URL.revokeObjectURL(u);
}

function persist() {
  localStorage.setItem(LS_KEY, JSON.stringify({ records: state.records }));
}
