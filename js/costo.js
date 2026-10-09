// Motor de presupuesto (mismo cálculo que Presupuesto_Detallado_Casas.xlsx)
function crearMotor(DATA){
  const r9=v=>Math.round(v*1e9)/1e9;
  const up=v=>Math.ceil(r9(v));
  const r1=v=>Math.round(r9(v)*10)/10;
  function presupuesto(mod, rvKey, precio, opts){
    const D=mod.datos, R=DATA.revest[rvKey], imp=opts&&opts.imp!=null?opts.imp:0.05;
    const items=[];
    const nombre=c=>DATA.precios[c].nombre, unidad=c=>DATA.precios[c].unidad, origen=c=>(opts&&opts.origen?opts.origen(c):DATA.precios[c].origen);
    const add=(c,partida,q,criterio,extra)=>{ const pu=precio(c); items.push(Object.assign({c,partida,material:nombre(c),unidad:unidad(c),q,pu,sub:Math.round(q*pu),origen:origen(c),criterio},extra||{})); };
    // revestimiento exterior
    const area=R.gross?D.MB:D.MN;
    const rvItems=[];
    const radd=(c,q,criterio,nom,un)=>{ const pu=precio(c); rvItems.push({c,partida:'Revestimiento exterior',material:nom||nombre(c),unidad:un||unidad(c),q,pu,sub:Math.round(q*pu),origen:origen(c),criterio}); };
    if(R.osb) radd('RVP-osb',up(D.MB/2.977*1.1),'Muro bruto / 2,977 m² + 10 %','OSB estructural 11 mm 1,22x2,44 m (base del revestimiento)','un');
    radd('RV-'+rvKey, R.unit_m2? r1(area*1.08) : up(area*1.10/R.cov), R.unit_m2?'Área a revestir + 8 %':'Área a revestir / cobertura por unidad + 10 %');
    radd('RVP-clavo',up(area*0.06),'0,06 kg por m² revestido');
    if(R.perfiles.includes('jpvc')) radd('RVP-jpvc',up((D.PV+5*D.PE+D.P)/3.8),'Perímetro de vanos y aleros / 3,8 m');
    if(R.perfiles.includes('esq')) radd(rvKey==='pvc'?'RVP-esqpvc':'RVP-esqmet',D.ES*up(D.HM/3),'Esquinas × altura / 3 m');
    else radd('RVP-esq',up(D.ESQH*2*1.1/3.2),'2 tablas por esquina + 10 %','Pino cepillado 1x4" x 3,2 m (esquineros de madera)');
    if(R.perfiles.includes('junta')) radd('RVP-junta',r1(area),'Juntas de placas');
    if(R.pint) radd(R.pint,r1(D.MN),'Muro exterior neto',R.pint_nom||nombre(R.pint),'m²');
    radd('RVP-sell',up((D.PV+D.ESQH)/8),'1 cartucho cada 8 ml de encuentros');
    // materiales
    const FD=DATA.fund&&DATA.fund[(opts&&opts.fund)||'poyos']||null, quita=new Set(FD?FD.quita:[]);
    let fundOk=!FD;
    const qty=m=>{ const v=m.f*(D[m.d]||0)+m.x; return m.e?up(v):r1(v); };
    for(const m of DATA.mat){
      if(!fundOk && m.p==='Fundación'){ fundOk=true; for(const f of FD.items) add(f.c,f.p,qty(f),f.k); }
      if(quita.has(m.c)) continue;
      const q=qty(m);
      if(m.p==='Revestimiento interior' && rvItems.length){ items.push(...rvItems); rvItems.length=0; }
      add(m.c,m.p,q,m.k);
    }
    const partidas=[]; for(const it of items) if(!partidas.includes(it.partida)) partidas.push(it.partida);
    const sub=items.reduce((s,i)=>s+i.sub,0), impv=Math.round(sub*imp), mat=sub+impv;
    const mo=[];
    for(const o0 of DATA.mo){ const o=(FD&&FD.mo&&FD.mo.reemplaza===o0.c)?FD.mo:o0; const q=r1(o.f*D[o.d]); const pu=precio(o.c); mo.push({c:o.c,item:nombre(o.c),unidad:unidad(o.c),q,pu,sub:Math.round(q*pu)}); }
    { const q=r1(area), pu=precio('MOR-'+rvKey); mo.push({c:'MOR-'+rvKey,item:nombre('MOR-'+rvKey),unidad:'m² muro',q,pu,sub:Math.round(q*pu)}); }
    if(R.pint){ const q=r1(D.MN), pu=precio('MOR-pintura'); mo.push({c:'MOR-pintura',item:nombre('MOR-pintura'),unidad:'m²',q,pu,sub:Math.round(q*pu)}); }
    const motot=mo.reduce((s,i)=>s+i.sub,0);
    return {items:items.filter(i=>i.q>0),partidas,sub,imp:impv,mat,mo:mo.filter(i=>i.q>0),motot,total:mat+motot,area:D.AT,fund:(opts&&opts.fund)||'poyos'};
  }
  return {presupuesto};
}
if(typeof module!=='undefined') module.exports=crearMotor;
