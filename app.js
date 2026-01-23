const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];

const LS_KEY = "labnotes_records_v1";

const state = {
  catalog:null,
  records:[],
  selected:null,
  new:{
    selectedPanels:new Set()
  }
};

/* ---------- helpers ---------- */
function localISODate(){
  const d = new Date();
  return new Date(d.getTime()-d.getTimezoneOffset()*60000)
    .toISOString().slice(0,10);
}

function sanitize(str){
  const d=document.createElement("div");
  d.textContent=str;
  return d.innerHTML;
}

function getActualValue(v,mod){
  return mod==="x10^3"?Number(v)*1000:Number(v);
}

function updateModDisplay(el){
  const w=el.closest(".num-with-mod");
  if(w) w.classList.toggle("active-mod", w.querySelector("input[type=checkbox]").checked);
}

/* ---------- init ---------- */
window.onload=async()=>{
  state.catalog=await fetch("data/lab_catalog.json").then(r=>r.json());
  const saved=localStorage.getItem(LS_KEY);
  state.records=saved?JSON.parse(saved).records:[];
  $("#nrDate").value=localISODate();
  initUI();
  renderDashboard();
};

/* ---------- UI ---------- */
function initUI(){
  $("#btnNew").onclick=openNew;
  $("#btnBackFromNew").onclick=()=>show("#viewDashboard");
  $("#btnBackFromDetail").onclick=()=>show("#viewDashboard");
  $("#btnBackFromExport").onclick=()=>show("#viewDetail");
  $("#btnBackFromSettings").onclick=()=>show("#viewDashboard");
  $("#btnSettings").onclick=()=>show("#viewSettings");
  $("#btnSaveRecord").onclick=saveNewRecord;
  $("#btnExport").onclick=openExport;
  $("#btnCopyExport").onclick=()=>navigator.clipboard.writeText($("#exportText").value);
  $("#btnReset").onclick=()=>{if(confirm("¿Borrar todo?")){state.records=[];persist();renderDashboard();}};
  $("#btnExportAll").onclick=exportAll;

  const p=$("#nrPanels");
  state.catalog.panels.forEach(panel=>{
    const b=document.createElement("button");
    b.className="pill";
    b.textContent=panel.name;
    b.onclick=()=>{
      state.new.selectedPanels.has(panel.panel_id)
        ?state.new.selectedPanels.delete(panel.panel_id)
        :state.new.selectedPanels.add(panel.panel_id);
      b.classList.toggle("active");
      renderCapture();
    };
    p.appendChild(b);
  });
}

function show(id){
  $$(".view").forEach(v=>v.classList.add("hidden"));
  $(id).classList.remove("hidden");
}

/* ---------- dashboard ---------- */
function renderDashboard(){
  show("#viewDashboard");
  const l=$("#recordsList");
  l.innerHTML="";
  if(!state.records.length){
    $("#emptyState").classList.remove("hidden");
    return;
  }
  $("#emptyState").classList.add("hidden");

  state.records.sort((a,b)=>b.date.localeCompare(a.date)).forEach(r=>{
    const c=document.createElement("div");
    c.className="card-item";
    c.innerHTML=`<h3>${r.date} · ${sanitize(r.context||"—")}</h3>`;
    c.onclick=()=>openDetail(r.id);
    l.appendChild(c);
  });
}

/* ---------- new ---------- */
function openNew(){
  state.new.selectedPanels.clear();
  $$(".pill").forEach(p=>p.classList.remove("active"));
  renderCapture();
  show("#viewNew");
}

function renderCapture(){
  const a=$("#nrCaptureArea");
  a.innerHTML="";
  state.new.selectedPanels.forEach(pid=>{
    const p=state.catalog.panels.find(x=>x.panel_id===pid);
    const c=document.createElement("div");
    c.className="card";
    c.innerHTML=`<h3>${p.name}</h3>`;
    p.analytes.forEach(an=>{
      const mod=pid==="cbc" && ["wbc","anc","alc","plt"].includes(an.analyte_id);
      const r=document.createElement("div");
      r.className="analyte-grid";
      r.innerHTML=`
        <div>${an.name}</div>
        <div>
          <div class="${mod?'num-with-mod':''}">
            <input id="in_${pid}_${an.analyte_id}" type="number" step="any"
              ${mod?'onchange="updateModDisplay(this)"':''}>
            ${mod?`<label class="tinycheck">
              <input type="checkbox" id="mod_${pid}_${an.analyte_id}"
                onchange="updateModDisplay(this.parentElement.previousElementSibling)">×10³
            </label>`:""}
          </div>
        </div>
        <div class="muted">${an.units||""}</div>`;
      c.appendChild(r);
    });
    a.appendChild(c);
  });
}

function saveNewRecord(){
  if(!$("#nrDate").value){alert("Fecha obligatoria");return;}
  if(!state.new.selectedPanels.size){alert("Selecciona panel");return;}

  const panels=[];
  state.new.selectedPanels.forEach(pid=>{
    const res=[];
    state.catalog.panels.find(p=>p.panel_id===pid).analytes.forEach(a=>{
      const v=$(`#in_${pid}_${a.analyte_id}`).value;
      if(v!==""){
        const m=$(`#mod_${pid}_${a.analyte_id}`)?.checked?"x10^3":null;
        res.push({analyte_id:a.analyte_id,value:Number(v),modifier:m});
      }
    });
    panels.push({panel_id:pid,results:res});
  });

  const rec={
    id:"rec_"+Date.now(),
    date:$("#nrDate").value,
    sex:$("#nrSex").value,
    context:$("#nrContext").value,
    lab:$("#nrLabName").value,
    med:{clozapine:$("#nrClozapine").checked,ben:$("#nrBEN").checked},
    panels
  };

  rec.eval=evaluate(rec);
  state.records.push(rec);
  persist();
  openDetail(rec.id);
}

/* ---------- evaluation ---------- */
function evaluate(rec){
  const alerts=[];
  const panelEvals={};

  rec.panels.forEach(p=>{
    panelEvals[p.panel_id]=p.results.map(r=>{
      const a=state.catalog.panels
        .find(x=>x.panel_id===p.panel_id)
        .analytes.find(x=>x.analyte_id===r.analyte_id);
      const v=getActualValue(r.value,r.modifier);
      let status="normal";
      if(a.ref_ranges){
        const ref=a.ref_ranges.find(x=>x.sex===rec.sex)||a.ref_ranges[0];
        if(ref?.low!==undefined && v<ref.low)status="low";
        if(ref?.high!==undefined && v>ref.high)status="high";
      }
      return {...r,scaled:v,name:a.name,units:a.units,status};
    });
  });

  if(rec.med.clozapine){
    const anc=panelEvals.cbc?.find(x=>x.analyte_id==="anc")?.scaled;
    if(anc!==undefined){
      const thr=rec.med.ben?500:1000;
      if(anc<thr)alerts.push(`⚠️ CLOZAPINA: ANC ${anc} < ${thr}`);
    }
  }

  return {alerts,panelEvals};
}

/* ---------- detail ---------- */
function openDetail(id){
  const r=state.records.find(x=>x.id===id);
  state.selected=r;
  $("#detailHeader").innerHTML=`<strong>${r.date}</strong> · ${sanitize(r.context)}`;
  $("#detailAlerts").innerHTML=r.eval.alerts.map(a=>`<span class="badge warn">${a}</span>`).join("")||"Normal";

  const w=$("#detailPanels");
  w.innerHTML="";
  r.panels.forEach(p=>{
    const c=document.createElement("div");
    c.className="card";
    c.innerHTML=`<h3>${p.panel_id}</h3>`;
    r.eval.panelEvals[p.panel_id].forEach(e=>{
      const v=e.modifier?`${e.value} ${e.modifier} (= ${e.scaled})`:e.value;
      c.innerHTML+=`
        <div class="analyte-grid">
          <div>${e.name}</div>
          <div>${v} ${e.units||""}</div>
          <div><span class="badge ${e.status}">${e.status}</span></div>
        </div>`;
    });
    w.appendChild(c);
  });
  show("#viewDetail");
}

/* ---------- export ---------- */
function openExport(){
  const r=state.selected;
  $("#exportText").value=r.panels.map(p=>
    r.eval.panelEvals[p.panel_id]
      .map(e=>{
        const v=e.modifier?e.scaled:e.value;
        return `${e.name}: ${v} ${e.units||""}`;
      }).join("  ")
  ).join("\n\n");
  show("#viewExport");
}

function exportAll(){
  const b=new Blob([JSON.stringify({records:state.records},null,2)],{type:"application/json"});
  const u=URL.createObjectURL(b);
  const a=document.createElement("a");
  a.href=u;a.download=`labnotes_${localISODate()}.json`;a.click();
  URL.revokeObjectURL(u);
}

function persist(){
  localStorage.setItem(LS_KEY,JSON.stringify({records:state.records}));
}
