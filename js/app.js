// Presupuestos Casas · interfaz: catálogo, modelo, presupuesto, precios y descargas
(function(){
const D=window.APP_DATA, PL=window.PLANOS, motor=crearMotor(D);
const $=id=>document.getElementById(id);
const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const clp=v=>'$'+Math.round(v).toLocaleString('es-CL');
const mill=v=>'$'+(v/1e6).toLocaleString('es-CL',{minimumFractionDigits:1,maximumFractionDigits:1})+' M';
const m2=v=>v.toLocaleString('es-CL',{minimumFractionDigits:2,maximumFractionDigits:2})+' m²';
const qfmt=(q,u)=>(Number.isInteger(q)?q.toLocaleString('es-CL'):q.toLocaleString('es-CL',{maximumFractionDigits:1}))+' '+u;
const fdate=iso=>{ try{ return new Date(iso).toLocaleDateString('es-CL',{day:'numeric',month:'short',year:'numeric'}); }catch(e){ return iso; } };
const MODS=D.modelos, byId=Object.fromEntries(MODS.map(m=>[m.id,m])), RVK=Object.keys(D.revest);
const nm=m=>m.nombre+(/\d$/.test(m.nombre)?' m²':'');
const load=(k,d)=>{ try{ const v=localStorage.getItem('ct.'+k); return v==null?d:JSON.parse(v); }catch(e){ return d; } };
const save=(k,v)=>{ try{ localStorage.setItem('ct.'+k,JSON.stringify(v)); }catch(e){} };
const FDK=Object.keys(D.fund||{poyos:{}});
const S={ tab:'catalogo', id:load('id','m54'), rv:load('rv','tinglado'), fund:load('fund','poyos'), color:0, imp:load('imp',5), gg:load('gg',20) };
if(!byId[S.id]) S.id='m54'; if(!D.revest[S.rv]) S.rv='tinglado'; if(!FDK.includes(S.fund)) S.fund='poyos';
const fundNom=k=>D.fund&&D.fund[k]?D.fund[k].nombre:'Poyos de hormigón';
let OVR={}, META=null, LOG=[], DB=null, LIVE=false, CAN_EDIT=false, viewer=null, thumbs={};
/* precio de venta por m²: valor común del equipo + ajuste propio de cada persona */
let SHARED_VENTA=null;
S.venta=load('venta',null); S.ventaIva=load('ventaIva',null);
const VM2=()=>S.venta!=null?S.venta:(SHARED_VENTA&&typeof SHARED_VENTA.m2==='number'?SHARED_VENTA.m2:550000);
const VIVA=()=>S.ventaIva!=null?S.ventaIva:(SHARED_VENTA&&typeof SHARED_VENTA.iva==='boolean'?SHARED_VENTA.iva:true);
const ownVenta=()=>S.venta!=null||S.ventaIva!=null;
function ventaCalc(m,P){
  const v=VM2()*m.datos.AT, inc=VIVA(), neto=inc?v/1.19:v, cliente=inc?v:v*1.19, costoNeto=P.mat/1.19+P.motot, margen=neto-costoNeto;
  return {v,neto,cliente,iva:cliente-neto,costoNeto,margen,pct:neto>0?margen/neto:0};
}
const mgTag=V=>`<span class="mg ${V.pct<.1?'bad':V.pct<.18?'warn':'ok'}">${V.margen<0?'−':''}${clp(Math.abs(V.margen))} · ${(V.pct*100).toLocaleString('es-CL',{maximumFractionDigits:1})} %</span>`;
function setVenta(m2v,iva){ if(m2v!=null){ S.venta=Math.max(0,Math.round(m2v)); save('venta',S.venta); } if(iva!=null){ S.ventaIva=!!iva; save('ventaIva',S.ventaIva); } render(); }
function resetVenta(){ S.venta=null; S.ventaIva=null; save('venta',null); save('ventaIva',null); render(); toast('Usando el valor del equipo'); }
async function shareVenta(){ if(!DB) return; try{ await DB.doc('meta/venta').set({m2:VM2(),iva:VIVA(),fecha:new Date().toISOString()}); S.venta=null; S.ventaIva=null; save('venta',null); save('ventaIva',null); toast('Valor guardado para todo el equipo'); }catch(e){ toast('No se pudo guardar el valor del equipo.'); } }
function ventaNote(){
  const sh=SHARED_VENTA&&typeof SHARED_VENTA.m2==='number';
  if(ownVenta()) return `Estás usando tu propio valor.${sh?` <button type="button" class="linkbtn" data-venta="reset">Usar el valor del equipo (${clp(SHARED_VENTA.m2)})</button>`:''}${CAN_EDIT&&DB?` · <button type="button" class="linkbtn" data-venta="share">Guardar para todo el equipo</button>`:''}`;
  return sh?`Valor del equipo, definido el ${fdate(SHARED_VENTA.fecha||D.fecha_base)}.`:'Valor sugerido. Cámbialo y queda guardado en este dispositivo.';
}
document.addEventListener('click',e=>{ const b=e.target.closest('[data-venta]'); if(!b) return; if(b.dataset.venta==='reset') resetVenta(); else shareVenta(); });

const precio=c=>{ const o=OVR[c]; return (o && typeof o.precio==='number' && o.precio>=0)?o.precio:D.precios[c].precio; };
const origen=c=>{ const o=OVR[c]; return (o&&o.origen)||D.precios[c].origen; };
const calc=(m,rv,f)=>motor.presupuesto(m,rv,precio,{imp:S.imp/100,origen,fund:f||S.fund});
const minTotal=m=>Math.min(...RVK.map(k=>calc(m,k).total));
const srcTag=s=>{ const cls=s==='Sodimac'?'s':s==='Manual'?'m':/Sodimac/.test(s)?'a':'e'; return `<span class="src ${cls}">${esc(s)}</span>`; };
function toast(t){ const el=$('toast'); el.textContent=t; el.hidden=false; clearTimeout(toast.t); toast.t=setTimeout(()=>el.hidden=true,2600); }

/* ---------------- navegación */
function go(tab, push){
  S.tab=tab; for(const s of document.querySelectorAll('section[data-tab]')) s.hidden=s.dataset.tab!==tab;
  for(const b of document.querySelectorAll('nav button')) b.setAttribute('aria-selected',String(b.dataset.tab===tab));
  if(push!==false){ try{ history.replaceState(null,'','#'+(tab==='modelo'?S.id:tab)); }catch(e){} }
  render(); if(tab==='modelo') ensureViewer();
  window.scrollTo({top:0});
}
$('nav').addEventListener('click',e=>{ const b=e.target.closest('button[data-tab]'); if(b) go(b.dataset.tab); });
$('status').addEventListener('click',()=>go('precios'));
function openModel(id){ S.id=id; save('id',id); go('modelo'); }

/* ---------------- catálogo */
function renderCatalog(){
  const card=m=>{ const t=minTotal(m), V=ventaCalc(m,calc(m,S.rv)), img=thumbs[m.id]?`<img src="${thumbs[m.id]}" alt="Vista 3D del modelo ${esc(nm(m))}">`:`<img class="plan" src="${PL[m.id]}" alt="Planta del modelo ${esc(nm(m))}">`;
    return `<button type="button" class="card" id="card-${m.id}" data-id="${m.id}"><div class="img">${img}<span class="tag">${esc(m.techo)}</span></div>
      <div class="body"><span class="t">${esc(nm(m))}</span><span class="p">${m.dorms} dormitorios · ${m.banos} baño${m.banos>1?'s':''} · ${m2(m.datos.AT)}</span>
      <div class="c"><span class="muted" style="font-size:13px">costo desde</span><b>${clp(t)}</b></div><span class="p">${clp(t/m.datos.AT)} por m²</span>
      <div class="c"><span class="muted" style="font-size:13px">venta</span><b>${clp(V.v)}</b></div><span class="p">margen ${mgTag(V)}</span></div></button>`; };
  $('cards1').innerHTML=MODS.filter(m=>m.grupo==='dos_aguas').map(card).join('');
  $('cards2').innerHTML=MODS.filter(m=>m.grupo!=='dos_aguas').map(card).join('');
}
for(const id of ['cards1','cards2']) $(id).addEventListener('click',e=>{ const c=e.target.closest('.card'); if(c) openModel(c.dataset.id); });

/* ---------------- modelo */
function renderModel(){
  const m=byId[S.id], R=D.revest[S.rv], P=calc(m,S.rv), d=m.datos, V=ventaCalc(m,P);
  const others=RVK.map(k=>[k,calc(m,k).total,ventaCalc(m,calc(m,k))]);
  $('mPanel').innerHTML=`
    <div><span class="lbl">${esc(m.techo)}</span><h2 style="font-size:30px">${esc(nm(m))}</h2><p class="note" style="margin-top:4px">${esc(m.resumen)}</p></div>
    <div><span class="lbl">Costo directo estimado</span><div class="big num">${clp(P.total)}</div>
      <div class="muted" style="font-size:13.5px">${clp(P.total/d.AT)} por m² · ${(P.total/D.uf).toLocaleString('es-CL',{maximumFractionDigits:0})} UF · con contratista ${clp(P.total*(1+S.gg/100))}</div></div>
    <div class="sale"><span class="lbl">Precio de venta</span>
      <div class="salein"><label for="ventaM2">Valor por m²</label><input type="number" id="ventaM2" min="0" step="5000" value="${VM2()}">
        <label class="tog" for="ventaIva"><input type="checkbox" id="ventaIva" ${VIVA()?'checked':''}> incluye IVA</label></div>
      <dl class="kv"><dt>Venta (${m2(d.AT)})</dt><dd class="num">${clp(V.v)}</dd><dt>El cliente paga${VIVA()?'':' (con IVA)'}</dt><dd class="num">${clp(V.cliente)}</dd>
        <dt>Margen sobre venta neta</dt><dd>${mgTag(V)}</dd></dl>
      <p class="note" style="font-size:12.5px">${ventaNote()}</p></div>
    <dl class="kv"><dt>Superficie</dt><dd class="num">${d.EP?`${m2(d.A)} + altillo ${m2(d.AT-d.A)}`:m2(d.AT)}${d.AC?` + corredor ${Math.round(d.AC)} m²`:''}</dd>
      <dt>Dormitorios / baños</dt><dd class="num">${m.dorms} / ${m.banos}</dd>
      <dt>Materiales</dt><dd class="num">${clp(P.mat)}</dd><dt>Mano de obra</dt><dd class="num">${clp(P.motot)}</dd>
      <dt>Cubierta de zinc</dt><dd class="num">${m2(d.CU)}</dd><dt>Muro exterior</dt><dd class="num">${m2(d.MN)}</dd></dl>
    <div style="display:flex;flex-direction:column;gap:7px"><span class="lbl">Revestimiento exterior</span>
      <div class="rv" role="radiogroup" aria-label="Revestimiento exterior" id="rvList">${others.map(([k,t])=>`<button type="button" role="radio" id="rv-${k}" data-k="${k}" aria-checked="${k===S.rv}"><span class="n">${esc(D.revest[k].nombre)}</span><span class="x">${clp(t)}</span><span class="d">${esc(D.revest[k].detalle)}</span></button>`).join('')}</div></div>
    <div style="display:flex;flex-direction:column;gap:7px"><span class="lbl">Fundación o base</span>
      <div class="rv" role="radiogroup" aria-label="Fundación" id="fundList">${FDK.map(k=>{ const t=calc(m,S.rv,k).total, dif=t-calc(m,S.rv,'poyos').total, F=D.fund[k];
        return `<button type="button" role="radio" id="fund-${k}" data-k="${k}" aria-checked="${k===S.fund}"><span class="n">${esc(F.nombre)}</span><span class="x">${clp(t)}${k==='poyos'?'':` <span class="${dif>0?'up':'down'}">(${dif>0?'+':'−'}${clp(Math.abs(dif))})</span>`}</span><span class="d">${esc(F.detalle)}</span>${k===S.fund?`<span class="d"><b>A favor:</b> ${esc(F.pros)} <b>En contra:</b> ${esc(F.contras)}</span>`:''}</button>`; }).join('')}</div></div>
    <div style="display:flex;flex-direction:column;gap:7px"><span class="lbl">Color</span><div class="seg" id="colors">${R.colores.map(([n,hx],i)=>`<button type="button" id="col-${i}" data-i="${i}" aria-pressed="${i===S.color}"><span class="sw" style="background:${hx}"></span>${esc(n)}</button>`).join('')}</div></div>
    <button class="btn" type="button" id="toBudget">Ver la lista de materiales</button>`;
  $('planTitle').textContent='Planta · '+nm(m);
  $('planImg').src=PL[m.id]; $('planImg').alt='Planta de arquitectura del modelo '+nm(m);
  $('rooms').innerHTML=m.rooms.map((rs,fi)=>(m.rooms.length>1?`<div style="grid-column:1/-1;border:0"><span class="lbl">${fi?'Altillo':'Planta baja'}</span></div>`:'')+rs.map(([n,x,y,a])=>`<div><span>${esc(n.charAt(0)+n.slice(1).toLowerCase())}</span><span class="num">${m2(a)}</span></div>`).join('')).join('');
  $('planNote').textContent='Archivo AutoCAD: '+m.dxf+'. Superficies útiles, descontando muros.'+(d.EP?' En el altillo cuenta solo la zona con más de 1,60 m de altura.':'');
  const cats={}; for(const it of P.items) cats[it.partida]=(cats[it.partida]||0)+it.sub;
  const rows=Object.entries(cats).map(([k,v])=>({k,v})); rows.push({k:'Mano de obra',v:P.motot,mo:true});
  const max=Math.max(...rows.map(r=>r.v));
  $('bars').innerHTML=rows.map(r=>`<div class="bar"><span>${esc(r.k)}</span><div class="track"><div class="fill${r.mo?' mo':''}" style="width:${(r.v/max*100).toFixed(1)}%"></div></div><span class="v num">${clp(r.v)}</span></div>`).join('')
    +`<div class="bar"><span>Imprevistos (${S.imp} %)</span><span></span><span class="v num">${clp(P.imp)}</span></div><div class="bar" style="font-weight:700"><span>Total</span><span></span><span class="v num">${clp(P.total)}</span></div>`;
  $('cmpTitle').textContent='Comparación de revestimientos · '+nm(m);
  const base=others.find(o=>o[0]==='tinglado')[1];
  $('cmp').innerHTML=`<thead><tr><th>Revestimiento</th><th class="r">Total casa</th><th class="r">vs. tinglado</th><th class="r">Margen</th><th>Vida útil y mantención</th><th>Ventajas</th><th>Desventajas</th></tr></thead><tbody>${others.map(([k,t,Vk])=>{ const r=D.revest[k], dif=t-base;
    return `<tr data-k="${k}" class="${k===S.rv?'sel':''}" style="cursor:pointer"><td><strong>${esc(r.nombre)}</strong><span class="k">${esc(r.detalle)}</span></td><td class="r num">${clp(t)}</td><td class="r num">${k==='tinglado'?'—':`<span class="${dif>0?'up':'down'}">${dif>0?'+':'−'}${clp(Math.abs(dif))}</span>`}</td><td class="r">${mgTag(Vk)}</td><td>${esc(r.vida)}</td><td>${esc(r.pros)}</td><td>${esc(r.contras)}</td></tr>`; }).join('')}</tbody>`;
}
$('mPanel').addEventListener('change',e=>{
  if(e.target.id==='ventaM2'){ const v=+e.target.value; if(v>=0) setVenta(v,null); else e.target.value=VM2(); }
  if(e.target.id==='ventaIva') setVenta(null,e.target.checked);
});
$('mPanel').addEventListener('click',e=>{
  const b=e.target.closest('#rvList button'); if(b){ pickRv(b.dataset.k); return; }
  const fb=e.target.closest('#fundList button'); if(fb){ pickFund(fb.dataset.k); return; }
  const c=e.target.closest('#colors button'); if(c){ S.color=+c.dataset.i; viewer?.setCladding(S.rv,S.color); renderModel(); return; }
  if(e.target.closest('#toBudget')) go('presupuesto');
});
$('cmp').addEventListener('click',e=>{ const tr=e.target.closest('tr[data-k]'); if(tr) pickRv(tr.dataset.k); });
function pickRv(k){ S.rv=k; S.color=0; save('rv',k); viewer?.setCladding(k,0); render(); }
function pickFund(k){ if(!FDK.includes(k)) return; S.fund=k; save('fund',k); viewer?.setFoundation?.(k); render(); }

/* visor 3D */
let shownId=null;
function ensureViewer(){
  if(viewer){ if(shownId!==S.id){ viewer.show(byId[S.id]); shownId=S.id; } return; }
  if(!window.__createViewer){ return; }
  try{
    viewer=window.__createViewer($('viewer'));
    $('viewerMsg').remove();
    viewer.setCladding(S.rv,S.color); viewer.setFoundation?.(S.fund); viewer.show(byId[S.id],true); shownId=S.id;
    $('qT').checked=viewer.state.quality==='alta';
    setTimeout(async()=>{ try{ thumbs=await viewer.thumbnails(MODS); if(S.tab==='catalogo') renderCatalog(); if(S.tab==='modelo') ensureViewer(); }catch(e){} },1200);
  }catch(err){ $('viewerMsg').textContent='Este navegador no pudo iniciar el visor 3D. La planta y el presupuesto siguen disponibles.'; }
}
window.addEventListener('v3d-ready',()=>{ if(S.tab==='modelo') ensureViewer(); else setTimeout(()=>{ if(!viewer){ ensureViewerHidden(); } },400); });
function ensureViewerHidden(){ // crear el visor en segundo plano para las miniaturas del catálogo
  const sec=$('s-modelo'); const was=sec.hidden; sec.hidden=false; sec.style.position='absolute'; sec.style.left='-9999px'; sec.style.width='1100px';
  ensureViewer(); sec.style.position=''; sec.style.left=''; sec.style.width=''; sec.hidden=was;
}
setTimeout(()=>{ if(!window.__createViewer && $('viewerMsg')) $('viewerMsg').textContent='No se pudo cargar el visor 3D (sin conexión con la librería). La planta y el presupuesto siguen disponibles.'; },20000);
document.querySelector('.views').addEventListener('click',e=>{ const b=e.target.closest('button[data-view]'); if(b) viewer?.goView(b.dataset.view); });
const hourTxt=h=>`${Math.floor(h)}:${String(Math.round((h%1)*60)).padStart(2,'0')}`;
$('hour').addEventListener('input',e=>{ const h=+e.target.value; $('hourTxt').textContent=hourTxt(h); viewer?.setHour(h); });
$('facade').addEventListener('change',e=>viewer?.setFacade(e.target.value));
$('roofT').addEventListener('change',e=>viewer?.setRoof(e.target.checked));
$('rotT').addEventListener('change',e=>viewer?.setAutorotate(e.target.checked));
$('qT').addEventListener('change',e=>viewer?.setQuality(e.target.checked?'alta':'normal'));

/* ---------------- presupuesto */
$('pModel').innerHTML=MODS.map(m=>`<option value="${m.id}">${esc(nm(m))}</option>`).join('');
$('pRv').innerHTML=RVK.map(k=>`<option value="${k}">${esc(D.revest[k].nombre)}</option>`).join('');
$('pModel').addEventListener('change',e=>{ S.id=e.target.value; save('id',S.id); render(); });
$('pRv').addEventListener('change',e=>{ pickRv(e.target.value); });
$('pFund').innerHTML=FDK.map(k=>`<option value="${k}">${esc(fundNom(k))}</option>`).join('');
$('pFund').addEventListener('change',e=>{ pickFund(e.target.value); });
$('pImp').addEventListener('change',e=>{ S.imp=Math.max(0,Math.min(30,+e.target.value||0)); save('imp',S.imp); render(); });
$('pGG').addEventListener('change',e=>{ S.gg=Math.max(0,Math.min(50,+e.target.value||0)); save('gg',S.gg); render(); });
$('pVenta').addEventListener('change',e=>{ const v=+e.target.value; if(v>=0) setVenta(v,null); else e.target.value=VM2(); });
$('pVentaIva').addEventListener('change',e=>setVenta(null,e.target.checked));
function renderBudget(){
  const m=byId[S.id], P=calc(m,S.rv), V=ventaCalc(m,P);
  $('pModel').value=S.id; $('pRv').value=S.rv; $('pFund').value=S.fund; $('pImp').value=S.imp; $('pGG').value=S.gg; $('pVenta').value=VM2(); $('pVentaIva').checked=VIVA();
  $('tiles').innerHTML=[['Materiales',P.mat,`${P.items.length} ítems, con ${S.imp} % de imprevistos`],['Mano de obra',P.motot,`${P.mo.length} faenas`],['Costo directo',P.total,`${clp(P.total/m.datos.AT)} por m²`,true],[`Con contratista (+${S.gg} %)`,P.total*(1+S.gg/100),`${(P.total*(1+S.gg/100)/D.uf).toLocaleString('es-CL',{maximumFractionDigits:0})} UF`]]
    .map(([l,v,s,main])=>`<div class="tile${main?' main':''}"><span class="lbl">${esc(l)}</span><b>${clp(v)}</b><span class="muted" style="font-size:12.5px">${esc(s)}</span></div>`).join('')
    +`<div class="tile sale-t"><span class="lbl">Precio de venta</span><b>${clp(V.v)}</b><span class="muted" style="font-size:12.5px">${clp(VM2())} por m² · ${VIVA()?'incluye IVA':'+ IVA: cliente paga '+clp(V.cliente)}</span></div>`
    +`<div class="tile sale-t"><span class="lbl">Margen</span><b>${V.margen<0?'−':''}${clp(Math.abs(V.margen))}</b><span><span class="mg ${V.pct<.1?'bad':V.pct<.18?'warn':'ok'}">${(V.pct*100).toLocaleString('es-CL',{maximumFractionDigits:1})} % de la venta neta</span></span></div>`;
  let h=`<thead><tr><th>Código</th><th>Material</th><th class="r">Cantidad</th><th class="r">Precio unit.</th><th class="r">Subtotal</th><th>Origen</th></tr></thead><tbody>`;
  for(const p of P.partidas){ const its=P.items.filter(i=>i.partida===p); if(!its.length) continue; const st=its.reduce((s,i)=>s+i.sub,0);
    h+=`<tr class="grp"><td colspan="4">${esc(p)}</td><td class="r num">${clp(st)}</td><td></td></tr>`;
    h+=its.map(i=>`<tr><td class="num">${esc(i.c)}</td><td>${esc(i.material)}<span class="k">${esc(i.criterio)}</span></td><td class="r num">${qfmt(i.q,i.unidad)}</td><td class="r num">${clp(i.pu)}</td><td class="r num">${clp(i.sub)}</td><td>${srcTag(i.origen)}</td></tr>`).join(''); }
  h+=`<tr class="sum"><td></td><td>Subtotal materiales</td><td></td><td></td><td class="r num">${clp(P.sub)}</td><td></td></tr><tr><td></td><td>Imprevistos y pérdidas (${S.imp} %)</td><td></td><td></td><td class="r num">${clp(P.imp)}</td><td></td></tr><tr class="sum"><td></td><td>Total materiales</td><td></td><td></td><td class="r num">${clp(P.mat)}</td><td></td></tr>`;
  h+=`<tr class="grp"><td colspan="4">Mano de obra</td><td class="r num">${clp(P.motot)}</td><td></td></tr>`;
  h+=P.mo.map(i=>`<tr><td class="num">${esc(i.c)}</td><td>${esc(i.item)}</td><td class="r num">${qfmt(i.q,i.unidad)}</td><td class="r num">${clp(i.pu)}</td><td class="r num">${clp(i.sub)}</td><td></td></tr>`).join('');
  h+=`<tr class="sum"><td></td><td>Costo directo de construcción</td><td></td><td></td><td class="r num">${clp(P.total)}</td><td></td></tr><tr class="sum"><td></td><td>Con gastos generales y utilidad (${S.gg} %)</td><td></td><td></td><td class="r num">${clp(P.total*(1+S.gg/100))}</td><td></td></tr>
  <tr class="grp"><td colspan="4">Venta y margen</td><td></td><td></td></tr>
  <tr><td></td><td>Precio de venta (${clp(VM2())} × ${m2(m.datos.AT)}, ${VIVA()?'incluye IVA':'más IVA'})</td><td></td><td></td><td class="r num">${clp(V.v)}</td><td></td></tr>
  <tr><td></td><td>Venta neta (sin IVA)</td><td></td><td></td><td class="r num">${clp(V.neto)}</td><td></td></tr>
  <tr><td></td><td>IVA de la venta (19 %)</td><td></td><td></td><td class="r num">${clp(V.iva)}</td><td></td></tr>
  <tr><td></td><td>Costo neto (materiales sin IVA + mano de obra)</td><td></td><td></td><td class="r num">${clp(V.costoNeto)}</td><td></td></tr>
  <tr class="sum"><td></td><td>Margen antes de flete, permisos y gastos fijos</td><td></td><td></td><td class="r num">${clp(V.margen)}</td><td>${mgTag(V)}</td></tr></tbody>`;
  $('ptable').innerHTML=h;
}

/* descargas */
async function saveFile(filename,data){
  try{ const blob=data instanceof Blob?data:new Blob([data]); const url=URL.createObjectURL(blob), a=document.createElement('a');
    a.href=url; a.download=filename; document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(url),4000); toast('Descargando '+filename); }
  catch(e){ toast('No se pudo descargar el archivo.'); } }
function loadXLSX(){ return new Promise((ok,ko)=>{ if(window.XLSX) return ok(window.XLSX); const s=document.createElement('script'); s.src='https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'; s.onload=()=>ok(window.XLSX); s.onerror=ko; document.head.appendChild(s); }); }
$('dlXlsx').addEventListener('click',async()=>{
  const btn=$('dlXlsx'); btn.disabled=true;
  try{
    const X=await loadXLSX(), m=byId[S.id], P=calc(m,S.rv), R=D.revest[S.rv];
    const rows=[[`Presupuesto · ${nm(m)} · ${R.nombre} · ${fundNom(S.fund)}`],[`Precios vigentes al ${fdate(META?.ultima||D.fecha_base)} · IVA incluido · Presupuestos Casas`],[],['Código','Partida','Material','Criterio','Cantidad','Unidad','Precio unitario','Subtotal','Origen']];
    for(const i of P.items) rows.push([i.c,i.partida,i.material,i.criterio,i.q,i.unidad,i.pu,i.sub,i.origen]);
    rows.push([],['','','Subtotal materiales','','','','',P.sub],['','','Imprevistos ('+S.imp+' %)','','','','',P.imp],['','','Total materiales','','','','',P.mat],[],['Código','','Faena','','Cantidad','Unidad','Valor unitario','Subtotal']);
    for(const i of P.mo) rows.push([i.c,'Mano de obra',i.item,'',i.q,i.unidad,i.pu,i.sub]);
    const V=ventaCalc(m,P);
    rows.push([],['','','Total mano de obra','','','','',P.motot],['','','COSTO DIRECTO','','','','',P.total],['','','Con gastos generales y utilidad ('+S.gg+' %)','','','','',Math.round(P.total*(1+S.gg/100))],
      [],['','','Precio de venta ('+clp(VM2())+' por m², '+(VIVA()?'incluye IVA':'más IVA')+')','',m.datos.AT,'m²',VM2(),Math.round(V.v)],['','','Venta neta (sin IVA)','','','','',Math.round(V.neto)],
      ['','','Costo neto (materiales sin IVA + mano de obra)','','','','',Math.round(V.costoNeto)],['','','Margen antes de flete, permisos y gastos fijos','','','',(V.pct*100).toFixed(1)+' %',Math.round(V.margen)]);
    const ws=X.utils.aoa_to_sheet(rows); ws['!cols']=[{wch:10},{wch:26},{wch:58},{wch:40},{wch:10},{wch:7},{wch:14},{wch:14},{wch:12}];
    for(let r=4;r<rows.length;r++) for(const c of [6,7]){ const ref=X.utils.encode_cell({r,c}); if(ws[ref]&&typeof ws[ref].v==='number') ws[ref].z='$#,##0'; }
    const wb=X.utils.book_new(); X.utils.book_append_sheet(wb,ws,'Presupuesto');
    const buf=X.write(wb,{bookType:'xlsx',type:'array'});
    await saveFile(`Presupuesto_${m.nombre.replace(/\s+/g,'_')}_${S.rv}_${S.fund}.xlsx`,new Uint8Array(buf));
  }catch(e){ toast('No se pudo generar el Excel. Revisa tu conexión e intenta de nuevo.'); }
  btn.disabled=false;
});
function loadJSZip(){ return new Promise((ok,ko)=>{ if(window.JSZip) return ok(window.JSZip); const s=document.createElement('script'); s.src='https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js'; s.onload=()=>ok(window.JSZip); s.onerror=ko; document.head.appendChild(s); }); }
$('dlPlanos').addEventListener('click',async()=>{
  const btn=$('dlPlanos'); btn.disabled=true;
  try{ const JZ=await loadJSZip(), z=new JZ();
    for(const m of MODS){ const r=await fetch('planos/'+m.id+'.dxf'); if(!r.ok) throw 0; z.file('DXF/'+m.dxf, await r.text()); }
    const pdf=await fetch('planos/Planos_8_Modelos.pdf'); if(pdf.ok) z.file('Planos_8_Modelos.pdf', await pdf.arrayBuffer());
    z.file('LEEME.txt','Planos de arquitectura de los 8 modelos de Presupuestos Casas.\r\nDXF en milimetros, escala real (1:1), abrir en AutoCAD con Archivo > Abrir > tipo DXF.\r\nCapas: MUROS, PUERTAS, VENTANAS, MOBILIARIO, ARTEFACTOS, TEXTO, COTAS, ROTULO.\r\nAnteproyecto: requiere revision de arquitecto para permiso de edificacion.\r\n');
    await saveFile('Planos_Presupuestos_Casas.zip', await z.generateAsync({type:'uint8array',compression:'DEFLATE'}));
  }catch(e){ toast('No se pudieron preparar los planos. Revisa tu conexión e intenta de nuevo.'); }
  btn.disabled=false;
});
$('dlPlanilla').addEventListener('click',async()=>{
  const btn=$('dlPlanilla'); btn.disabled=true;
  try{ const X=await loadXLSX(), wb=X.utils.book_new(), R=D.revest[S.rv];
    const res=[['Presupuesto de los 8 modelos · revestimiento: '+R.nombre+' · fundación: '+fundNom(S.fund)],[`Precios vigentes al ${fdate(META?.ultima||D.fecha_base)} · IVA incluido · imprevistos ${S.imp} % · contratista ${S.gg} % · venta ${clp(VM2())} por m² ${VIVA()?'con IVA':'más IVA'}`],[],['Modelo','Techo','Superficie útil (m²)','Materiales','Mano de obra','Costo directo','$ por m²','UF','Con contratista','Precio de venta','Margen','Margen %']];
    const sheets=[];
    for(const m of MODS){ const P=calc(m,S.rv);
      const V=ventaCalc(m,P); res.push([nm(m),m.techo,m.datos.AT,P.mat,P.motot,P.total,Math.round(P.total/m.datos.AT),Math.round(P.total/D.uf),Math.round(P.total*(1+S.gg/100)),Math.round(V.v),Math.round(V.margen),+(V.pct*100).toFixed(1)]);
      const rows=[[nm(m)+' · '+R.nombre+' · '+fundNom(S.fund)],[],['Código','Partida','Material','Criterio','Cantidad','Unidad','Precio unitario','Subtotal','Origen']];
      for(const i of P.items) rows.push([i.c,i.partida,i.material,i.criterio,i.q,i.unidad,i.pu,i.sub,i.origen]);
      rows.push([],['','','Subtotal materiales','','','','',P.sub],['','','Imprevistos','','','','',P.imp],['','','Total materiales','','','','',P.mat],[]);
      for(const i of P.mo) rows.push([i.c,'Mano de obra',i.item,'',i.q,i.unidad,i.pu,i.sub]);
      rows.push([],['','','Total mano de obra','','','','',P.motot],['','','COSTO DIRECTO','','','','',P.total]);
      const ws=X.utils.aoa_to_sheet(rows); ws['!cols']=[{wch:10},{wch:26},{wch:58},{wch:40},{wch:10},{wch:7},{wch:14},{wch:14},{wch:12}];
      sheets.push([m.nombre.slice(0,31),ws]); }
    const ws0=X.utils.aoa_to_sheet(res); ws0['!cols']=[{wch:22},{wch:26},{wch:12},{wch:14},{wch:14},{wch:14},{wch:12},{wch:8},{wch:16},{wch:16},{wch:14},{wch:10}];
    X.utils.book_append_sheet(wb,ws0,'Resumen'); for(const [n,ws] of sheets) X.utils.book_append_sheet(wb,ws,n);
    await saveFile(`Presupuesto_8_modelos_${S.rv}_${S.fund}.xlsx`, new Uint8Array(X.write(wb,{bookType:'xlsx',type:'array'})));
  }catch(e){ toast('No se pudo generar el Excel. Revisa tu conexión e intenta de nuevo.'); }
  btn.disabled=false;
});

/* ---------------- precios */
function nextRun(){ if(META&&META.proxima) return META.proxima; const d=new Date(); const add=(8-d.getDay())%7||7; const n=new Date(d); n.setDate(d.getDate()+add); n.setHours(8,58,0,0); return n.toISOString(); }
function renderStatus(){
  const live=LIVE, last=META?.ultima, nChanged=META?.cambios_ultima;
  $('status').classList.toggle('ref',!live||!last);
  $('statusTxt').textContent= live&&last ? `Precios al ${fdate(last)} · próxima revisión ${fdate(nextRun())}` : `Precios de referencia del ${fdate(D.fecha_base)}`;
  const ps=$('priceStatus'); if(!ps) return;
  ps.innerHTML=`<h3>Estado de los precios</h3>
    <dl class="kv"><dt>Última revisión</dt><dd>${last?fdate(last):'Aún no hay revisiones automáticas'}</dd>
      <dt>Próxima revisión automática</dt><dd>${live?fdate(nextRun())+', 08:58':'—'}</dd>
      <dt>Cambios en la última revisión</dt><dd class="num">${nChanged!=null?nChanged:'—'}</dd>
      <dt>Precios cambiados desde la referencia</dt><dd class="num">${Object.keys(OVR).length} de ${Object.keys(D.precios).length}</dd>
      ${META?.indice?`<dt>Último índice aplicado</dt><dd>${esc(META.indice)}</dd>`:''}</dl>
    <p class="note">${live?'La revisión corre cada lunes: actualiza los precios de Sodimac y, una vez al mes, ajusta estimados y mano de obra por el Índice de Costo de Edificación (CChC).':'No se pudieron leer los precios publicados, así que se usan los guardados en este dispositivo o los de referencia del 6 de octubre de 2026.'} Para corregir un precio, el equipo usa el <a href="https://claude.ai/artifact/LhcBCtThdMnjfcLKHUPJS8" target="_blank" rel="noopener">panel de precios</a>; los cambios llegan a la app en la siguiente sincronización.</p>`;
}
function renderLog(){
  const el=$('log');
  if(!LIVE&&!LOG.length){ el.innerHTML=`<div class="empty">El historial aparece cuando la app logra leer los precios publicados.</div>`; return; }
  if(!LOG.length){ el.innerHTML=`<div class="empty">Todavía no hay actualizaciones. La primera revisión automática corre el ${fdate(nextRun())}.</div>`; return; }
  el.innerHTML=LOG.map(l=>{ const ch=Array.isArray(l.cambios)?l.cambios:[];
    return `<details><summary><span class="num" style="font-size:13px">${fdate(l.fecha)}</span><span class="src ${l.tipo==='manual'?'m':'a'}">${l.tipo==='manual'?'Manual':'Automática'}</span><span>${esc(l.resumen||'')}</span></summary>
      ${ch.length?`<ul>${ch.slice(0,60).map(c=>{ const p=D.precios[c.c]; const dif=c.despues-c.antes; return `<li>${esc(p?p.nombre:c.c)}: <span class="num">${clp(c.antes)} → ${clp(c.despues)}</span> <span class="${dif>0?'up':'down'}">(${dif>0?'+':''}${(c.antes?dif/c.antes*100:0).toFixed(1)} %)</span></li>`; }).join('')}${ch.length>60?`<li>y ${ch.length-60} más</li>`:''}</ul>`:''}
      ${l.nota?`<p class="note" style="margin-top:6px">${esc(l.nota)}</p>`:''}</details>`; }).join('');
}
['q','fTipo','fOrig'].forEach(id=>$(id).addEventListener('input',renderPrices));
function renderPrices(){
  if(document.activeElement && document.activeElement.classList.contains('pin')) return;
  const q=$('q').value.trim().toLowerCase(), ft=$('fTipo').value, fo=$('fOrig').value;
  const rows=Object.entries(D.precios).filter(([c,p])=>(!ft||p.tipo===ft)&&(!fo||(fo==='Manual'?origen(c)==='Manual':origen(c).startsWith(fo)))&&(!q||(c+' '+p.nombre+' '+p.partida).toLowerCase().includes(q)));
  $('pcount').textContent=`${rows.length} de ${Object.keys(D.precios).length}`;
  $('prices').innerHTML=`<thead><tr><th>Código</th><th>Material o faena</th><th>Unidad</th><th class="r">Precio vigente</th><th class="r">Anterior</th><th class="r">Variación</th><th>Origen</th><th>Actualizado</th></tr></thead><tbody>${rows.map(([c,p])=>{
    const o=OVR[c], cur=precio(c), prev=o&&typeof o.anterior==='number'?o.anterior:null, dif=prev?((cur-prev)/prev*100):null;
    const cell=CAN_EDIT?`<input class="pin" type="number" min="0" step="1" id="p-${esc(c)}" data-c="${esc(c)}" value="${cur}" aria-label="Precio de ${esc(p.nombre)}">${o?` <button class="iconbtn" type="button" data-reset="${esc(c)}" title="Volver al precio de referencia">↺</button>`:''}`:`<span class="num">${clp(cur)}</span>`;
    return `<tr><td class="num">${esc(c)}</td><td>${esc(p.nombre)}<span class="k">${esc(p.partida)}</span></td><td>${esc(p.unidad)}</td><td class="r">${cell}</td><td class="r num">${prev!=null?clp(prev):'—'}</td><td class="r num">${dif!=null?`<span class="${dif>0?'up':'down'}">${dif>0?'+':''}${dif.toFixed(1)} %</span>`:'—'}</td><td>${srcTag(origen(c))}</td><td class="num" style="font-size:12.5px">${fdate(o&&o.fecha||D.fecha_base)}</td></tr>`; }).join('')}</tbody>`;
}
$('prices').addEventListener('change',async e=>{
  const inp=e.target.closest('input.pin'); if(!inp||!DB) return;
  const c=inp.dataset.c, v=Math.round(+inp.value), old=precio(c);
  if(!(v>=0)||v===old){ inp.value=old; return; }
  inp.classList.add('saving');
  try{ const now=new Date().toISOString();
    await DB.doc('precios/'+c).set({precio:v,anterior:old,fecha:now,origen:'Manual',fuente:'',nota:'Editado en la app'});
    await DB.collection('actualizaciones').add({fecha:now,tipo:'manual',resumen:`${D.precios[c].nombre}: ${clp(old)} → ${clp(v)}`,cambios:[{c,antes:old,despues:v}]});
    inp.classList.remove('saving'); inp.classList.add('saved'); toast('Precio guardado');
  }catch(err){ inp.classList.remove('saving'); inp.value=old; toast(err&&err.code==='invalid_argument'?'No tienes permiso para editar precios.':'No se pudo guardar el precio.'); }
});
$('prices').addEventListener('click',async e=>{
  const b=e.target.closest('button[data-reset]'); if(!b||!DB) return;
  const c=b.dataset.reset, old=precio(c), ref=D.precios[c].precio;
  try{ await DB.doc('precios/'+c).delete(); await DB.collection('actualizaciones').add({fecha:new Date().toISOString(),tipo:'manual',resumen:`${D.precios[c].nombre}: vuelve al precio de referencia`,cambios:[{c,antes:old,despues:ref}]}); toast('Precio restablecido'); }
  catch(err){ toast('No se pudo restablecer el precio.'); }
});
$('prices').addEventListener('focusout',()=>setTimeout(()=>{ if(!document.activeElement||!document.activeElement.classList.contains('pin')) renderPrices(); },50));

/* ---------------- render general */
function render(){
  renderStatus();
  if(S.tab==='catalogo') renderCatalog();
  if(S.tab==='modelo'){ renderModel(); ensureViewer(); }
  if(S.tab==='presupuesto') renderBudget();
  if(S.tab==='precios'){ renderPrices(); renderLog(); }
}

/* ---------------- precios publicados (data/precios.json) */
function applyPrices(j){
  const o={}; for(const [c,v] of Object.entries(j.precios||{})) if(D.precios[c]&&typeof v.precio==='number') o[c]=v;
  SHARED_VENTA=j.venta||null; OVR=o; META={ultima:j.actualizado,cambios_ultima:j.cambios_ultima,proxima:j.proxima,indice:j.indice}; LOG=Array.isArray(j.historial)?j.historial:[];
}
async function loadPrices(){
  try{ const r=await fetch('data/precios.json?t='+Date.now(),{cache:'no-store'}); if(!r.ok) throw 0; const j=await r.json();
    applyPrices(j); LIVE=true; $('offline').hidden=true; try{ localStorage.setItem('ct.precios',JSON.stringify(j)); }catch(e){} }
  catch(e){ try{ const j=JSON.parse(localStorage.getItem('ct.precios')||'null'); if(j) applyPrices(j); }catch(e2){} LIVE=false; $('offline').hidden=false; }
  render();
}
try{ const j=JSON.parse(localStorage.getItem('ct.precios')||'null'); if(j) applyPrices(j); }catch(e){}
loadPrices();
document.addEventListener('visibilitychange',()=>{ if(document.visibilityState==='visible') loadPrices(); });
window.addEventListener('online',loadPrices);

/* ---------------- instalación como app */
let deferredInstall=null;
window.addEventListener('beforeinstallprompt',e=>{ e.preventDefault(); deferredInstall=e; $('installBtn').hidden=false; });
const isIOS=/iphone|ipad|ipod/i.test(navigator.userAgent), standalone=matchMedia('(display-mode: standalone)').matches||navigator.standalone;
if(isIOS&&!standalone) $('installBtn').hidden=false;
$('installBtn').addEventListener('click',async()=>{
  if(deferredInstall){ deferredInstall.prompt(); const r=await deferredInstall.userChoice; deferredInstall=null; if(r.outcome==='accepted') $('installBtn').hidden=true; return; }
  if(isIOS) toast('En Safari toca Compartir y luego "Agregar a pantalla de inicio".');
});
window.addEventListener('appinstalled',()=>{ $('installBtn').hidden=true; toast('App instalada'); });
if('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(()=>{});

/* ---------------- inicio */
const h=(location.hash||'').slice(1);
if(byId[h]){ S.id=h; go('modelo',false); } else if(['catalogo','modelo','presupuesto','precios','info'].includes(h)) go(h,false); else go('catalogo',false);
})();
