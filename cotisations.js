/* Module Cotisations - chargé après le script principal de index.html */
(()=>{
S.cot=[];S.tgt={};
I.check=I.check||"M5 12l5 5 9-9";
TB.cot="contributions";

// Menu : "Cotisations" avant "Infos"
N.splice(N.findIndex(n=>n[0]=="inf"),0,["cot","Cotisations","check","#f472b6","#db2777","#9d174d"]);

// Chargement des versements et objectifs
const _la=loadAll;
loadAll=async function(){
  await _la();
  try{
    const [cx,tg]=await Promise.all([
      sb.from("contributions").select("*").order("date",{ascending:false}),
      sb.from("contribution_targets").select("*")]);
    S.cot=(cx.data||[]).map(x=>({id:x.id,mid:x.member_id,y:x.year,m:+x.amount,d:x.date,c:x.note}));
    S.tgt={};(tg.data||[]).forEach(x=>S.tgt[x.year]=+x.amount);
  }catch(e){S.cot=[];S.tgt={}}
};

// Mot de passe : 8 caractères minimum à l'inscription
const _su=signup;
signup=function(){const w=$("lw")&&$("lw").value;
  if(w&&w.length<8){err="Le mot de passe doit contenir au moins 8 caractères.";return render()}
  return _su()};

const tgt=y=>S.tgt[y]??50000,
yrs=()=>{const a=[];for(let y=2026;y<=Math.max(2026,new Date().getFullYear());y++)a.push(y);return a},
paid=(m,y)=>S.cot.filter(c=>c.mid==m&&(y==null||c.y==y)).reduce((a,c)=>a+c.m,0),
bar=(p,t)=>`<div style="height:12px;border-radius:99px;background:var(--soft);overflow:hidden;margin:8px 0"><div style="width:${Math.min(100,p/t*100)}%;height:100%;background:linear-gradient(90deg,#34d399,#059669)"></div></div>`;

window.addCot=()=>{const L=S.users.filter(u=>u.on),k=u=>u.n+" · "+u.p,y=new Date().getFullYear();
  form("Enregistrer une cotisation",[["u","sel","",L.map(k)],["m","number","Montant (FCFA)"],["y","number","Année (défaut "+y+")"],["dt","date","Date"],["c","text","Note (facultatif)"]],async v=>{
    const u=L.find(x=>k(x)==v.u),m=Math.abs(+v.m||0);
    if(!u||!m)throw new Error("Membre ou montant invalide");
    await ins("contributions",{member_id:u.id,year:+v.y||y,amount:m,date:v.dt||today(),note:v.c})})};

V.cot=function(){
  const me=U.id,Y=yrs().reverse(),
  yc=(id,y)=>{const p=paid(id,y),t=tgt(y),r=Math.max(0,t-p);
    return `<div class="card"><div class="rw"><b class="ct">${y}</b><span class="tg ${r?"w":""}">${r?"En cours":"Soldé"}</span></div>${bar(p,t)}<div class="rw"><span>Versé : <b class="ok">${fc(p)}</b></span><span>Reste : <b class="${r?"ko":"ok"}">${fc(r)}</b></span></div><div class="sub" style="margin:6px 0 0">Objectif : ${fc(t)}</div></div>`},
  hist=(L,nm)=>L.map(c=>`<div class="ro"><span class="ic in">${ic("up",18)}</span><div class="m"><b>${fc(c.m)}${nm?" · "+esc(nm(c.mid)):""}</b><span>${fd(c.d)} · ${c.y}${c.c?" · "+esc(c.c):""}</span></div>${adm()?`<button class="ib" onclick="del('cot',${S.cot.indexOf(c)})">${ic("trash",17)}</button>`:""}</div>`).join("")||empty,
  mine=S.cot.filter(c=>c.mid==me);
  let h=head("Cotisations","","Votre situation personnelle")
    +`<div class="hero"><small>Total versé depuis le début</small><div class="bal" style="margin:4px 0 0">${fc(paid(me))}</div></div>`
    +Y.map(y=>yc(me,y)).join("")
    +`<div class="card"><b>Mes versements</b>${hist(mine)}</div>`;
  if(adm()){const y=Y[0],A=S.users.filter(u=>u.on),nm=id=>(S.users.find(u=>u.id==id)||{n:"?"}).n;
    h+=`<div class="rw" style="margin:26px 0 12px"><h1 style="margin:0">Suivi des membres ${y}</h1><button class="bt t1 s" onclick="addCot()">${ic("plus",16)}Versement</button></div>`
      +`<div class="card">${A.map(u=>{const p=paid(u.id,y),t=tgt(y);return `<div class="ro"><div class="av">${ini(u.n)}</div><div class="m"><b>${esc(u.n)}</b>${bar(p,t)}<span>Versé ${fc(p)} · Reste ${fc(Math.max(0,t-p))}</span></div></div>`}).join("")||empty}</div>`
      +`<div class="card"><b>Tous les versements</b>${hist(S.cot,nm)}</div>`}
  return h};

// Carte "Mes cotisations" sur le tableau de bord
const _d=V.dash;
V.dash=function(){
  const card=`<div class="card last" onclick="go('cot')"><span class="ti" style="--a:#f472b6;--b:#db2777;--d:#9d174d">${ic("check",22)}</span><div><small>Mes cotisations</small><b>${fc(paid(U.id))} versés</b></div><span class="mut">Voir</span></div>`;
  return _d.call(V).replace('<div class="stats">',card+'<div class="stats">')};

// Si l'utilisateur était déjà chargé avant ce module, on recharge
if(U)loadAll().then(render);
})();
