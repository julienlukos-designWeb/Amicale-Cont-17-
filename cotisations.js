// Amicale Contingent 17 Fatick — Cotisations par capture Wave.
// Chargé par index.html (balise <script src="cotisations.js"> déjà présente) : aucune modification du design ni des écrans existants.
// Ajoute : menu « Cotisations », bouton « Payer ma cotisation », envoi capture + montant (min. 5 000 FCFA),
// écran de vérification pour les administrateurs, numéro Wave modifiable par un administrateur.
(function(){
const PAY_MIN=5000, BUCKET="payment-proofs";
S.pays=[];S.wave="";

// Menu : « Cotisations » après « Caisse », visible par tous
N.splice(2,0,["pay","Cotisations","wallet","#22d3ee","#0891b2","#155e75"]);

// Chargement des paiements en même temps que le reste des données
async function loadPay(){
  const [pc,py]=await Promise.all([
    sb.from("payment_settings").select("wave_number").eq("id",1).maybeSingle(),
    sb.from("payments").select("*").order("created_at",{ascending:false}).limit(300)
  ]);
  S.wave=(pc.data&&pc.data.wave_number)||"";
  S.pays=(py.data||[]).map(p=>{
    const u=S.users.find(x=>x.id==p.user_id);
    return {id:p.id,uid:p.user_id,n:u?u.n:(p.user_id==U.id?U.n:"Membre"),p:u?u.p:"",m:+p.amount,st:p.status,d:p.created_at,u:p.proof_path,note:p.note||""};
  });
}
const _loadAll=loadAll;
loadAll=async function(){await _loadAll();try{await loadPay()}catch(e){console.error(e)}};

const STL={pending:["En attente","w"],validated:["Validé",""],rejected:["Refusé","x"]};

// Ouvre la fenêtre de paiement
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
      $("dg").close();await loadAll();go("pay");
      alert("Merci ! Votre paiement a été envoyé. Un administrateur va le vérifier.");
    }catch(x){b.disabled=false;b.textContent="Envoyer";bad("Erreur : "+(x.message||x))}
  };
};

// Voir une capture (lien signé, valable 10 minutes)
window.payView=async function(i){
  const x=S.pays[i];
  $("dg").innerHTML=`<h2 style="margin:0 0 6px;font-size:18px">${esc(x.n)}</h2><div class="ok" style="font-size:20px">${fc(x.m)}</div><div id="pvw" class="sub" style="margin:10px 0">Chargement…</div><button class="bt t4 s" onclick="$('dg').close()">Fermer</button>`;
  $("dg").showModal();
  const {data,error}=await sb.storage.from(BUCKET).createSignedUrl(x.u,600),b=$("pvw");
  if(!b)return;
  if(error||!data){b.textContent="Capture introuvable.";return}
  b.innerHTML=isP(x.u)?`<a class="lnk" href="${data.signedUrl}" target="_blank" rel="noopener">Ouvrir le PDF</a>`:`<img src="${data.signedUrl}" alt="" style="width:100%;border-radius:14px">`;
};

// Administrateur : valider ou refuser
window.payDecide=async function(i,ok){
  const x=S.pays[i];let note=null;
  if(ok){if(!confirm("Valider "+fc(x.m)+" de "+x.n+" ?\nCe montant sera ajouté à la caisse."))return}
  else{note=prompt("Motif du refus (facultatif) :");if(note===null)return}
  const {data,error}=await sb.from("payments").update({status:ok?"validated":"rejected",reviewed_by:U.id,reviewed_at:new Date().toISOString(),note:note||null}).eq("id",x.id).eq("status","pending").select();
  if(fail(error))return;
  if(!data||!data.length)alert("Ce paiement a déjà été traité.");
  else if(ok){
    const {error:e2}=await sb.from("transactions").insert({label:"Cotisation – "+x.n,description:"Paiement Wave vérifié",amount:x.m,date:today()});
    if(e2)alert("Paiement validé, mais l’écriture en caisse a échoué : ajoutez-la manuellement. ("+e2.message+")");
  }
  await loadAll();render();
};

// Administrateur : numéro Wave
window.paySaveWave=async function(){
  const v=$("pw").value.trim();
  const {data,error}=await sb.from("payment_settings").update({wave_number:v}).eq("id",1).select();
  if(fail(error))return;
  if(!data||!data.length){alert("Enregistrement impossible : exécutez d’abord le script paiements.sql dans Supabase.");return}
  await loadAll();render();
};

// Écran « Cotisations »
const row=(p,adm_)=>{
  const i=S.pays.indexOf(p),s=STL[p.st]||STL.pending;
  return `<div class="ro" style="align-items:flex-start"><span class="ic ${p.st=="rejected"?"out":p.st=="validated"?"in":""}">${ic(p.st=="rejected"?"x":p.st=="validated"?"check":"wallet",18)}</span>
<div class="m"><b>${adm_?esc(p.n)+" · ":""}${fc(p.m)}</b><span>${fd(p.d)}${adm_&&p.p?" · "+esc(p.p):""}${p.note?" · "+esc(p.note):""}</span>
<div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:8px"><button class="bt t4 s" onclick="payView(${i})">${ic("eye",15)}Capture</button>${adm_&&p.st=="pending"?`<button class="bt t1 s" onclick="payDecide(${i},1)">Valider</button><button class="bt t2 s" onclick="payDecide(${i},0)">Refuser</button>`:""}</div></div>
<span class="tg ${s[1]}">${s[0]}</span></div>`;
};
V.pay=function(){
  const a=adm(),pend=a?S.pays.filter(p=>p.st=="pending"):[],
        list=a?S.pays.filter(p=>p.st!="pending"):S.pays.filter(p=>p.uid==U.id);
  return head("Cotisations","","Payez par Wave, puis envoyez votre capture")+
  `<div class="card"><div class="k">Numéro Wave de l’amicale</div><div style="font-size:24px;font-weight:800;margin:4px 0 14px">${S.wave?esc(S.wave):'<span class="mut">Pas encore défini</span>'}</div>
<button class="b3" style="--a:#22d3ee;--b:#0891b2;--d:#155e75;margin-bottom:0" onclick="payOpen()">${ic("wallet",18)}Payer ma cotisation</button></div>`+
  (a?`<div class="card"><div class="k" style="margin-bottom:6px">Numéro Wave (administrateur)</div><input id="pw" type="tel" value="${esc(S.wave)}" placeholder="Ex. 77 123 45 67"><button class="bt t1" onclick="paySaveWave()">Enregistrer</button></div>`:"")+
  (pend.length?`<div class="card" style="border-color:#f59e0b"><b>Paiements à vérifier (${pend.length})</b>${pend.map(p=>row(p,1)).join("")}</div>`:"")+
  `<div class="card"><b>${a?"Historique des paiements":"Mes paiements"}</b>${list.length?list.map(p=>row(p,a)).join(""):'<p class="sub" style="margin:8px 0 0">Aucun paiement pour le moment.</p>'}</div>`;
};

// Tableau de bord : bouton « Payer ma cotisation » + rappel pour les administrateurs
const _dash=V.dash;
V.dash=function(){
  const h=_dash(),n=adm()?S.pays.filter(p=>p.st=="pending").length:0;
  const btn=`<div class="acts"><button class="b3" style="--a:#22d3ee;--b:#0891b2;--d:#155e75" onclick="payOpen()">${ic("wallet",18)}Payer ma cotisation</button></div>`;
  const card=n?`<div class="card last" onclick="go('pay')" style="border-color:#f59e0b"><span class="ti" style="--a:#22d3ee;--b:#0891b2;--d:#155e75">${ic("wallet",22)}</span><div><small>Cotisations à vérifier</small><b>${n} paiement${n>1?"s":""} en attente</b></div><span class="mut">Voir</span></div>`:"";
  return h.replace(/<div class="hi">[^]*?<\/div>/,m=>m+btn+card);
};
})();
