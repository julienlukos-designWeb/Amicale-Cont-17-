/* ===== Nouveau design : barre du bas, annuaire, profils, solde en grand =====
   Module AJOUTÉ après cotisations.js : ne modifie ni les comptes, ni les données, ni les règles.
   Les cotisations (y compris Wave) n'entrent JAMAIS dans la caisse. */
(()=>{
const FOOT='<b>Julien D. Y. LUKOS</b> : Créateur et administrateur';
S.dir=[];S.pid=null;

/* ---------- Styles ---------- */
const css=document.createElement("style");
css.textContent=`
.tabs{display:none}
@media(max-width:999px){
 .tabs{display:flex;position:fixed;left:0;right:0;bottom:0;z-index:6;justify-content:space-around;background:var(--card);border-top:1px solid var(--line);padding:8px 6px calc(10px + env(safe-area-inset-bottom,0px));box-shadow:0 -8px 24px -14px rgba(76,29,149,.35)}
 .tabs button{display:flex;flex-direction:column;align-items:center;gap:3px;min-width:60px;min-height:46px;font-size:11px;font-weight:700;color:var(--mut);text-align:center;justify-content:center;border-radius:14px;position:relative}
 .tabs button.on{color:var(--pr)}
 .tabs button.on:before{content:"";position:absolute;top:-9px;width:28px;height:4px;border-radius:0 0 4px 4px;background:var(--pr)}
 .tabs .bg{position:absolute;top:0;right:8px;margin:0}
 main{padding-bottom:110px}
}
.hero2{border-radius:28px;padding:20px;color:#fff;margin-bottom:18px;background:linear-gradient(150deg,#6d28d9,#4c1d95);box-shadow:0 8px 0 #3b0f8c,0 16px 26px -10px #5b21b6}
.hero2 small{font-size:12px;font-weight:800;letter-spacing:.05em;text-transform:uppercase;color:#ddd2ff}
.hero2 .bal{font-size:34px;font-weight:800;letter-spacing:-.02em;margin:6px 0 12px}.hero2 .bal span{font-size:16px;color:#ddd2ff}
.pil{display:inline-flex;font-size:12px;font-weight:700;padding:4px 10px;border-radius:99px;background:#d1fae5;color:#065f46}.pil.x{background:#ffe4e6;color:#9f1239}
.srch{display:flex;align-items:center;gap:10px;background:var(--card);border:2px solid var(--line);border-radius:18px;padding:0 16px;margin-bottom:14px;color:var(--mut)}
.srch input{border:0;margin:0;padding:14px 0;background:none}.srch input:focus{outline:0}
.mbr{display:flex;align-items:center;gap:12px;padding:12px 0;border-bottom:1px solid var(--line);cursor:pointer}.mbr:last-child{border:0}
.mbr .m{flex:1;min-width:0}.mbr .m b{display:flex;justify-content:space-between;gap:8px}.mbr .m span{color:var(--mut);font-size:13px}
.mbr .av{width:46px;height:46px;border-radius:15px}
.pbar{height:8px;border-radius:99px;background:var(--soft);overflow:hidden;margin:6px 0 2px}.pbar i{display:block;height:100%;border-radius:99px;background:linear-gradient(90deg,#22d3ee,#0891b2)}.pbar i.f{background:linear-gradient(90deg,#34d399,#059669)}
.pf{border-radius:28px;color:#fff;padding:18px 18px 70px;margin-bottom:0;background:linear-gradient(165deg,#141b45,#262c75 58%,#4338ca)}
.pf .av{width:92px;height:92px;border-radius:30px;font-size:34px;border:4px solid rgba(255,255,255,.9);box-shadow:0 10px 24px -8px rgba(0,0,0,.5)}
.fld{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:13px 0;border-bottom:1px solid var(--line)}.fld:last-child{border:0}.fld span{color:var(--mut);font-weight:600;font-size:14px}
`;
document.head.appendChild(css);

/* ---------- Données : annuaire visible par tous les membres ---------- */
const tgtOf=y=>S.tgt[y]??(y==2026?10000:50000),
 yrs=()=>{const a=[];for(let y=2026;y<=Math.max(2026,new Date().getFullYear());y++)a.push(y);return a},
 paidBy=(id,y)=>S.cot.filter(c=>c.mid==id&&(y==null||c.y==y)).reduce((a,c)=>a+c.m,0),
 due=()=>yrs().reduce((a,y)=>a+tgtOf(y),0),
 pct=id=>Math.min(100,Math.round(paidBy(id)/due()*100));

async function loadDir(){
  let L=[];
  try{
    const {data,error}=await sb.rpc("member_directory");
    if(!error&&Array.isArray(data))L=data.map(p=>({id:p.id,n:(p.first_name+" "+p.last_name).trim(),f:p.first_name,l:p.last_name,p:p.phone,r:p.role,s:(p.created_at||"").slice(0,7)}));
  }catch(e){}
  if(!L.length){ // repli : administrateur (liste complète) ou simplement soi-même
    L=S.users.filter(u=>u.on).map(u=>{const k=u.n.split(" ");return {id:u.id,n:u.n,f:k[0],l:k.slice(1).join(" "),p:u.p,r:u.r,s:""}});
    if(!L.find(x=>x.id==U.id)){const k=U.n.split(" ");L.push({id:U.id,n:U.n,f:k[0],l:k.slice(1).join(" "),p:U.p,r:U.r,s:""})}
  }
  S.dir=L;
}
const _ld=loadAll;
loadAll=async function(){await _ld();try{await loadDir()}catch(e){S.dir=[]}};

/* ---------- Pages ---------- */
const col=["#a78bfa,#6d28d9","#fb923c,#ea580c","#38bdf8,#0369a1","#f472b6,#be185d","#94a3b8,#475569","#34d399,#047857","#fbbf24,#b45309"],
 grad=n=>{let h=0;for(const c of n)h=(h*31+c.charCodeAt(0))%col.length;return `background:linear-gradient(160deg,${col[h]})`},
 roleTag=r=>r=="owner"?'<span class="tg" style="background:#ede9fe;color:#5b21b6">Propriétaire</span>':r=="admin"?'<span class="tg" style="background:#ede9fe;color:#5b21b6">Administrateur</span>':"";

window.openProf=id=>{S.pid=id;go("prof")};
window.filterDir=q=>{q=q.toLowerCase().trim();document.querySelectorAll(".mbr").forEach(e=>{e.style.display=!q||e.dataset.s.includes(q)?"":"none"})};

window.addCotFor=id=>{const m=S.dir.find(x=>x.id==id)||{n:"membre"},y=new Date().getFullYear();
  form("Enregistrer un versement — "+m.n,[["m","number","Montant versé (FCFA)"],["y","number","Année (défaut "+y+")"],["dt","date","Date du versement"],["c","text","Note (facultatif)"]],async v=>{
    const a=Math.abs(+v.m||0);if(!a)throw new Error("Montant invalide");
    await ins("contributions",{member_id:id,year:+v.y||y,amount:a,date:v.dt||today(),note:v.c})})};

V.ann=function(){
  const L=[...S.dir].sort((a,b)=>a.n.localeCompare(b.n,"fr")),d=due();
  return head("Membres",0,L.length+" membres actifs · profils visibles par tous")
   +`<div class="srch">${ic("users",20)}<input placeholder="Rechercher un membre…" oninput="filterDir(this.value)"></div>`
   +`<div class="card" style="padding:6px 16px">${L.map(u=>{const p=paidBy(u.id),q=pct(u.id),ok=p>=d;
     return `<div class="mbr" data-s="${esc((u.n+" "+u.p).toLowerCase())}" onclick="openProf('${u.id}')"><span class="av" style="${grad(u.n)}">${ini(u.n)}</span><div class="m"><b>${esc(u.n)}<span class="tg ${ok?"":"w"}">${ok?"Soldé":q+" %"}</span></b><span>${esc(u.p||"")}</span><div class="pbar"><i class="${ok?"f":""}" style="width:${q}%"></i></div></div></div>`}).join("")||empty}</div>
   <p class="sub" style="text-align:center">Touchez un membre pour ouvrir son profil.</p>`};

V.prof=function(){
  const id=S.pid||U.id,m=S.dir.find(x=>x.id==id)||{id:U.id,n:U.n,f:U.n.split(" ")[0],l:U.n.split(" ").slice(1).join(" "),p:U.p,r:U.r,s:""},
   me=id==U.id,p=paidBy(id),d=due(),q=pct(id),C=2*Math.PI*48,Y=yrs().reverse(),hist=S.cot.filter(c=>c.mid==id);
  const ring=`<svg viewBox="0 0 116 116" width="116" height="116" role="img" aria-label="Progression totale ${q} pour cent"><circle cx="58" cy="58" r="48" fill="none" stroke="#e7eaf4" stroke-width="12"/><circle cx="58" cy="58" r="48" fill="none" stroke="#0891b2" stroke-width="12" stroke-linecap="round" stroke-dasharray="${C.toFixed(1)}" stroke-dashoffset="${(C*(1-q/100)).toFixed(1)}" transform="rotate(-90 58 58)"/><text x="58" y="56" text-anchor="middle" font-size="26" font-weight="800" fill="currentColor">${q} %</text><text x="58" y="74" text-anchor="middle" font-size="11" font-weight="700" fill="#6d6888">atteint</text></svg>`;
  return `${!me?`<button class="lnk" style="margin-bottom:10px" onclick="go('ann')">‹ Membres</button>`:""}
  <div class="pf"><div style="text-align:center"><span class="tg" style="background:rgba(255,255,255,.16);color:#fff">Visible par tous les membres</span>
   <div style="display:flex;flex-direction:column;align-items:center;margin-top:14px"><div class="av" style="${grad(m.n)}">${ini(m.n)}</div><div style="font-size:26px;font-weight:800;margin-top:10px">${esc(m.n)}</div><div style="display:flex;gap:8px;margin-top:6px">${roleTag(m.r)}<span class="tg">Compte actif</span></div></div></div></div>
  <div class="card" style="margin:-48px 0 16px;display:flex;align-items:center;gap:18px;padding:20px">${ring}<div style="flex:1;min-width:0"><div class="k">Progression totale</div><div style="font-size:28px;font-weight:800;margin:2px 0">${fc(p)}</div><div class="sub" style="margin:0">sur ${fc(d)} attendus à ce jour</div></div></div>
  <div class="card"><b class="ct">Informations</b><div class="fld"><span>Prénom</span><b>${esc(m.f||"")}</b></div><div class="fld"><span>Nom</span><b>${esc(m.l||"")}</b></div><div class="fld"><span>Téléphone</span><b>${esc(m.p||"")}</b></div>${m.s?`<div class="fld"><span>Membre depuis</span><b>${esc(m.s)}</b></div>`:""}</div>
  <div class="card"><b class="ct">Cotisation par année</b>${Y.map(y=>{const a=paidBy(id,y),t=tgtOf(y),r=Math.max(0,t-a);return `<div style="margin-top:14px"><div class="rw" style="flex-wrap:nowrap"><b>${y}</b><span class="tg ${r?"w":""}">${r?"En cours":"Soldé"}</span></div><div class="pbar" style="height:10px"><i class="${r?"":"f"}" style="width:${Math.min(100,a/t*100)}%"></i></div><div class="sub" style="margin:0;font-size:13px">${fc(a)} versés sur ${fc(t)}${r?" · reste "+fc(r):""}</div></div>`}).join("")}
   ${Y.indexOf(2026)<0?"":`<p class="sub" style="font-size:12px;margin:14px 0 0">2026 : 10 000 FCFA. À partir de 2027 : 50 000 FCFA par an, en tranches de 5 000 FCFA ou tout montant d’au moins 5 000 FCFA.</p>`}</div>
  <div class="card" style="padding:6px 16px"><b class="ct" style="display:block;padding:12px 0 2px">${me?"Mes versements":"Versements"}</b>${hist.map(c=>`<div class="ro"><span class="ic in">${ic("check",18)}</span><div class="m"><b>${fc(c.m)}</b><span>${fd(c.d)} · ${c.y}${c.c?" · "+esc(c.c):""}</span></div>${adm()?`<button class="ib" onclick="del('cot',${S.cot.indexOf(c)})">${ic("trash",17)}</button>`:""}</div>`).join("")||empty}</div>
  <div class="acts">${me&&window.payOpen?`<button class="b3" style="--a:#22d3ee;--b:#0891b2;--d:#155e75" onclick="payOpen()">${ic("wallet",18)}Payer ma cotisation</button>`:""}${adm()?`<button class="b3 t1" onclick="addCotFor('${id}')">${ic("plus",18)}Enregistrer un versement</button>`:""}${me?`<button class="b3" style="--a:#94a3b8;--b:#475569;--d:#1e293b" onclick="out()">${ic("out",18)}Déconnexion</button>`:""}</div>`};

/* ---------- Menu : on ajoute Membres / Profil ---------- */
N.splice(N.findIndex(n=>n[0]=="cot")+1,0,["ann","Membres","users","#a78bfa","#7c3aed","#4c1d95"],["prof","Mon profil","users","#fb923c","#ea580c","#9a3412"]);
// "Mon profil" dans le menu = toujours mon profil
document.addEventListener("click",e=>{const b=e.target.closest&&e.target.closest("button.mi,.tabs button");if(b&&/go\('prof'\)/.test(b.getAttribute("onclick")||""))S.pid=U&&U.id},true);

/* ---------- Accueil : solde en grand + cartes ---------- */
const _d=V.dash;
V.dash=function(){
  let h=_d.call(V);
  const ent=sum(t=>t.m>0),dep=-sum(t=>t.m<0),ym=today().slice(0,7),net=sum(t=>t.d.slice(0,7)==ym);
  const hero=`<div class="hero2"><small>Solde disponible en banque</small><div class="bal">${Math.round(ent-dep).toLocaleString("fr-FR").replace(/ /g," ")} <span>FCFA</span></div><span class="pil ${net<0?"x":""}">${net<0?"−":"+"} ${fc(Math.abs(net))} ce mois</span></div>`;
  const y=new Date().getFullYear(),Y=Math.max(2026,y),A=Math.max(S.nActive,1),tot=S.cot.filter(c=>c.y==Y).reduce((a,c)=>a+c.m,0),pc=Math.min(100,Math.round(tot/(A*tgtOf(Y))*100));
  const card=`<div class="st" style="--a:#0e7490;--b:#155e75;--d:#0b4a5c"><div class="top2"><span>Cotisations ${Y}</span><span class="sic">${ic("check",22)}</span></div><div class="n">${pc} %</div></div>`;
  h=h.replace(/<div class="st" style="--a:#8b5cf6[\s\S]*?<\/div><\/div>/,"").replace(/(<div class="stats">[\s\S]*?)<\/div>\s*<div class="card"><div class="rw"/,"$1"+card+"</div><div class=\"card\"><div class=\"rw\"");
  // le solde passe en tête, juste après le bonjour
  h=h.replace(/(<div class="hi">[^<]*<\/div>)/,"$1"+hero);
  return h};

/* ---------- Barre du bas + pied de page ---------- */
const TABS=[["dash","Accueil","home"],["cai","Caisse","wallet"],["cot","Cotisations","check"],["ann","Membres","users"],["prof","Profil","users"]];
const _r=render;
render=function(){
  _r();
  document.querySelectorAll(".tabs").forEach(e=>e.remove());
  document.querySelectorAll(".ft").forEach(e=>e.innerHTML=FOOT);
  if(!U)return;
  const pc=adm()&&S.pays?S.pays.filter(p=>p.st=="pending").length:0,
   on=t=>t==cur||(t=="prof"&&cur=="prof"&&(!S.pid||S.pid==U.id))||(t=="ann"&&cur=="prof"&&S.pid&&S.pid!=U.id);
  const nav=document.createElement("nav");nav.className="tabs";nav.setAttribute("aria-label","Navigation principale");
  nav.innerHTML=TABS.map(t=>`<button class="${on(t[0])?"on":""}" onclick="${t[0]=="prof"?"S.pid=U.id;":""}go('${t[0]}')">${ic(t[2],24)}${t[1]}${t[0]=="cot"&&pc?`<em class="bg">${pc}</em>`:""}</button>`).join("");
  document.body.appendChild(nav);
};
if(U)loadAll().then(render);
})();
