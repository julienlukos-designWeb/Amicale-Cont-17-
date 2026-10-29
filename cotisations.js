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

/* ===== Paiement par Wave (ajout) : capture + vérification par un administrateur =====
   Un paiement validé s'ajoute à la cotisation du membre (table contributions), jamais à la caisse. */
(()=>{
const PAY_MIN=5000,BUCKET="payment-proofs";
S.pays=[];S.wave="";S.payOk=false;
const STL={pending:["En vérification","w"],validated:["Validé",""],rejected:["Refusé","x"]};
const NOTE=id=>"Paiement Wave #"+id;

async function loadPay(){
  try{
    const [pc,py]=await Promise.all([
      sb.from("payment_settings").select("wave_number").eq("id",1).maybeSingle(),
      sb.from("payments").select("*").order("created_at",{ascending:false}).limit(300)]);
    S.payOk=!pc.error&&!py.error;
    S.wave=(pc.data&&pc.data.wave_number)||"";
    S.pays=(py.data||[]).map(p=>{const u=S.users.find(x=>x.id==p.user_id);
      return {id:p.id,uid:p.user_id,n:u?u.n:(p.user_id==U.id?U.n:"Membre"),p:u?u.p:"",m:+p.amount,st:p.status,d:p.created_at,u:p.proof_path,note:p.note||""}});
  }catch(e){S.payOk=false;S.pays=[];S.wave=""}
}
const _lp=loadAll;
loadAll=async function(){await _lp();await loadPay()};

// Fenêtre de paiement (membre)
window.payOpen=function(){
  if(!S.wave){alert("Le numéro Wave n’a pas encore été défini par un administrateur.");return}
  $("dg").innerHTML=`<h2 style="margin:0 0 6px;font-size:18px">Payer ma cotisation</h2>
<p class="sub" style="margin:0 0 12px">1. Envoyez votre paiement par Wave au numéro ci-dessous.<br>2. Indiquez le montant payé et joignez la capture d’écran.</p>
<div class="card" style="padding:12px 16px;margin-bottom:12px"><div class="k">Numéro Wave</div><div class="rw" style="flex-wrap:nowrap"><b style="font-size:20px">${esc(S.wave)}</b><button class="lnk" id="pcp">Copier</button></div></div>
<input id="pm" type="number" inputmode="numeric" min="${PAY_MIN}" placeholder="Montant payé (min. 5 000 FCFA)">
<div class="k" style="margin:2px 0 6px">Capture du paiement</div><input id="pf" type="file" accept="image/*,application/pdf">
<p class="err" id="pe" style="display:none"></p>
<div class="rw" style="margin-top:6px"><button class="lnk" onclick="$('dg').close()">Annuler</button><button class="bt t1" id="pok">Envoyer</button></div>`;
  $("dg").showModal();
  $("pcp").onclick=async()=>{try{await navigator.clipboard.writeText(S.wave);$("pcp").textContent="Copié"}catch(e){}};
  $("pok").onclick=async()=>{
    const m=Math.round(+$("pm").value),f=$("pf").files[0],e=$("pe"),b=$("pok");
    const bad=t=>{e.textContent=t;e.style.display="block"};
    if(!(m>=PAY_MIN))return bad("Le montant minimum est de 5 000 FCFA.");
    if(!f)return bad("Veuillez joindre la capture du paiement.");
    if(f.size>8e6)return bad("Fichier trop volumineux (8 Mo max).");
    b.disabled=true;b.textContent="Envoi…";e.style.display="none";
    try{
      const p=U.id+"/"+Date.now()+"-"+f.name.replace(/[^\w.-]+/g,"_");
      const a=await sb.storage.from(BUCKET).upload(p,f,{contentType:f.type});if(a.error)throw a.error;
      const r=await sb.from("payments").insert({amount:m,proof_path:p});if(r.error)throw r.error;
      $("dg").close();await loadAll();render();
      alert("Merci ! Votre paiement a été envoyé. Un administrateur va le vérifier.");
    }catch(x){b.disabled=false;b.textContent="Envoyer";bad("Erreur : "+(x.message||x))}
  };
};

// Voir une capture
window.payView=async function(i){
  const x=S.pays[i];
  $("dg").innerHTML=`<h2 style="margin:0 0 6px;font-size:18px">${esc(x.n)}</h2><div class="ok" style="font-size:20px">${fc(x.m)}</div><div id="pvw" class="sub" style="margin:10px 0">Chargement…</div><button class="bt t4 s" onclick="$('dg').close()">Fermer</button>`;
  $("dg").showModal();
  const {data,error}=await sb.storage.from(BUCKET).createSignedUrl(x.u,600),b=$("pvw");
  if(!b)return;
  if(error||!data){b.textContent="Capture introuvable.";return}
  b.innerHTML=isP(x.u)?`<a class="lnk" href="${data.signedUrl}" target="_blank" rel="noopener">Ouvrir le PDF</a>`:`<img src="${data.signedUrl}" alt="" style="width:100%;border-radius:14px">`;
};

// Administrateur : valider (=> versement ajouté à la cotisation, pas à la caisse) ou refuser
window.payDecide=async function(i,ok){
  const x=S.pays[i];let note=null;
  if(ok){if(!confirm("Valider "+fc(x.m)+" de "+x.n+" ?\nLe montant sera ajouté à sa cotisation (pas à la caisse)."))return}
  else{note=prompt("Motif du refus (facultatif) :");if(note===null)return}
  const {data,error}=await sb.from("payments").update({status:ok?"validated":"rejected",reviewed_by:U.id,reviewed_at:new Date().toISOString(),note:note||null}).eq("id",x.id).eq("status","pending").select();
  if(fail(error))return;
  if(!data||!data.length)alert("Ce paiement a déjà été traité.");
  else if(ok){
    const r=await sb.from("contributions").insert({member_id:x.uid,year:new Date(x.d).getFullYear(),amount:x.m,date:today(),note:NOTE(x.id)});
    if(r.error){await sb.from("payments").update({status:"pending",reviewed_by:null,reviewed_at:null}).eq("id",x.id);
      alert("Validation annulée : le versement n’a pas pu être enregistré. ("+r.error.message+")")}
  }
  await loadAll();render();
};

// Administrateur : annuler une validation faite par erreur (retire le versement lié, remet en vérification)
window.payUndo=async function(i){
  const x=S.pays[i];
  if(!confirm("Annuler la validation de "+fc(x.m)+" de "+x.n+" ?\nLe montant sera retiré de sa cotisation et le paiement repassera « en vérification »."))return;
  const d=await sb.from("contributions").delete().eq("note",NOTE(x.id)).select();
  if(fail(d.error))return;
  if(!d.data||!d.data.length&&!confirm("Aucun versement lié trouvé (déjà supprimé ?). Remettre quand même ce paiement en vérification ?"))return;
  const u=await sb.from("payments").update({status:"pending",reviewed_by:null,reviewed_at:null,note:null}).eq("id",x.id).select();
  if(fail(u.error))return;
  await loadAll();render();
};

// Administrateur : supprimer un paiement (et son versement lié s'il était validé)
window.payDel=async function(i){
  const x=S.pays[i];
  if(!confirm("Supprimer ce paiement de "+x.n+" ("+fc(x.m)+") ?"+(x.st=="validated"?"\nLe versement ajouté à sa cotisation sera aussi retiré.":"")))return;
  if(x.st=="validated"){const d=await sb.from("contributions").delete().eq("note",NOTE(x.id)).select();if(fail(d.error))return}
  const r=await sb.from("payments").delete().eq("id",x.id).select();
  if(fail(r.error))return;
  if(!r.data||!r.data.length){alert("Suppression impossible : exécutez paiement-cotisations.sql dans Supabase (droits de suppression).");return}
  if(x.u)await sb.storage.from(BUCKET).remove([x.u]);
  await loadAll();render();
};

// Administrateur : numéro Wave
window.paySaveWave=async function(){
  const v=$("pw").value.trim();
  const {data,error}=await sb.from("payment_settings").update({wave_number:v}).eq("id",1).select();
  if(fail(error))return;
  if(!data||!data.length){alert("Enregistrement impossible : exécutez d’abord paiement-cotisations.sql dans Supabase.");return}
  await loadAll();render();
};

const prow=(p,a,mode)=>{
  const i=S.pays.indexOf(p),s=STL[p.st]||STL.pending;
  return `<div class="ro" style="align-items:flex-start"><span class="ic ${p.st=="rejected"?"out":p.st=="validated"?"in":""}">${ic(p.st=="rejected"?"x":p.st=="validated"?"check":"wallet",18)}</span>
<div class="m"><b>${a?esc(p.n)+" · ":""}${fc(p.m)}</b><span>${fd(p.d)}${a&&p.p?" · "+esc(p.p):""}${p.note?" · "+esc(p.note):""}</span>
<div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:8px"><button class="bt t4 s" onclick="payView(${i})">${ic("eye",15)}Capture</button>${a&&p.st=="pending"?`<button class="bt t1 s" onclick="payDecide(${i},1)">Valider</button><button class="bt t2 s" onclick="payDecide(${i},0)">Refuser</button>`:""}${a&&p.st=="validated"?`<button class="bt t3 s" onclick="payUndo(${i})">Annuler la validation</button>`:""}</div></div>
<span class="tg ${s[1]}">${s[0]}</span>${a&&p.st!="pending"?`<button class="ib" onclick="payDel(${i})">${ic("trash",17)}</button>`:""}</div>`;
};

// Page Cotisations : on garde tout l'existant et on ajoute les blocs Wave
const _cot=V.cot;
V.cot=function(){
  let h=_cot.call(V);const a=adm();
  if(!S.payOk){
    if(!a)return h;
    return h.replace('<div class="hero">',`<div class="card" style="border-color:#f59e0b"><b>Paiement par Wave non activé</b><p class="sub" style="margin:6px 0 0">Exécutez le fichier <b>paiement-cotisations.sql</b> dans Supabase (SQL Editor) pour l’activer.</p></div><div class="hero">`);
  }
  const mine=S.pays.filter(p=>p.uid==U.id),pend=a?S.pays.filter(p=>p.st=="pending"):[];
  let top=`<div class="card"><div class="k">Numéro Wave de l’amicale</div><div style="font-size:24px;font-weight:800;margin:4px 0 14px">${S.wave?esc(S.wave):'<span class="mut">Pas encore défini</span>'}</div></div>`;
  if(mine.length)top+=`<div class="card"><b>Mes paiements Wave</b>${mine.map(p=>prow(p,0)).join("")}</div>`;
  if(a){
    top+=`<div class="card"><div class="k" style="margin-bottom:6px">Numéro Wave (administrateur)</div><input id="pw" type="tel" value="${esc(S.wave)}" placeholder="Ex. 77 123 45 67"><button class="bt t1" onclick="paySaveWave()">Enregistrer</button></div>`;
    if(pend.length)top+=`<div class="card" style="border-color:#f59e0b"><b>Paiements à vérifier (${pend.length})</b>${pend.map(p=>prow(p,1)).join("")}</div>`;
  }
  h=h.indexOf('<div class="hero">')>-1?h.replace('<div class="hero">',top+'<div class="hero">'):top+h;
  if(a){const done=S.pays.filter(p=>p.st!="pending");
    h+=`<div class="card"><b>Historique des paiements Wave</b><p class="sub" style="margin:2px 0 4px">Validé = ajouté à la cotisation du membre, pas à la caisse.</p>${done.map(p=>prow(p,1)).join("")||'<p class="sub" style="margin:8px 0 0">Aucun paiement pour le moment.</p>'}</div>`}
  return h;
};

// Tableau de bord : bouton « Payer ma cotisation » + rappel pour les administrateurs
const _dw=V.dash;
V.dash=function(){
  const h=_dw.call(V);if(!S.payOk)return h;
  const n=adm()?S.pays.filter(p=>p.st=="pending").length:0;
  const btn="";
  const card=n?`<div class="card last" onclick="go('cot')" style="border-color:#f59e0b"><span class="ti" style="--a:#22d3ee;--b:#0891b2;--d:#155e75">${ic("wallet",22)}</span><div><small>Paiements Wave</small><b>${n} à vérifier</b></div><span class="mut">Voir</span></div>`:"";
  return h.replace(/<div class="hi">[^]*?<\/div>/,m=>m+btn+card);
};

// Pastille rouge sur le menu Cotisations pour les administrateurs
const _rw=render;
render=function(){
  _rw.apply(this,arguments);
  try{const n=U&&adm()&&S.payOk?S.pays.filter(p=>p.st=="pending").length:0,
    b=n&&document.querySelector('.mi[onclick="go(\'cot\')"]');
    if(b&&!b.querySelector(".bg"))b.insertAdjacentHTML("beforeend",`<em class="bg">${n}</em>`)}catch(e){}
};

if(U)loadPay().then(render);
})();
