/* Paiement de cotisation par Wave — module ajouté à la plateforme existante.
   Ne modifie aucun écran existant : il ajoute 2 entrées de menu, une carte sur le tableau de bord
   et deux pages. À charger APRÈS cotisations.js :  <script src="paiement-wave.js"></script> */
(function () {
  if (window.__waveModule) return;
  window.__waveModule = 1;

  var MIN = 5000, BUCKET = "wave-proofs";
  var W = { ok: false, num: "", holder: "", pay: [], err: "", flash: "" };
  var YEAR = function () { return new Date().getFullYear(); };
  var TARGET = function (y) { return y <= 2026 ? 10000 : 50000; };
  var STL = { pending: "En vérification", validated: "Validé", rejected: "Refusé" };
  var STC = { pending: "w", validated: "", rejected: "x" };

  /* ---------- styles (préfixe wv-) ---------- */
  var css = document.createElement("style");
  css.textContent =
    ".wv-hero{border-radius:28px;padding:20px;color:#fff;margin-bottom:18px;background:linear-gradient(150deg,#38bdf8,#2563eb);box-shadow:0 8px 0 #1e3a8a,0 16px 26px -10px #2563eb}" +
    ".wv-hero small{opacity:.85;font-weight:600}" +
    ".wv-num{display:flex;align-items:center;gap:12px;background:rgba(255,255,255,.2);border-radius:20px;padding:14px 16px;margin:10px 0 14px}" +
    ".wv-num b{font-size:22px;letter-spacing:.02em;flex:1;word-break:break-all}" +
    ".wv-bar{height:14px;border-radius:99px;background:var(--soft);overflow:hidden;margin:12px 0 8px}" +
    ".wv-bar i{display:block;height:100%;border-radius:99px;background:linear-gradient(90deg,#2dd4bf,#059669)}" +
    ".wv-chips{display:flex;gap:8px;flex-wrap:wrap;margin:0 0 12px}" +
    ".wv-chips button{background:var(--soft);padding:8px 13px;border-radius:99px;font-weight:700;font-size:13px;color:var(--pr)}" +
    ".wv-step{display:flex;gap:12px;align-items:flex-start;margin:8px 0;font-weight:600}" +
    ".wv-step em{width:26px;height:26px;border-radius:50%;background:rgba(255,255,255,.28);display:grid;place-items:center;font-style:normal;font-weight:800;font-size:13px;flex-shrink:0}" +
    ".wv-acts{display:flex;gap:8px;flex-wrap:wrap;margin-top:8px}" +
    ".wv-msg{padding:12px 16px;border-radius:18px;font-weight:700;margin-bottom:16px}" +
    ".wv-msg.g{background:#d1fae5;color:#065f46}.wv-msg.w{background:#fef3c7;color:#92400e}" +
    ".wv-err{color:var(--ko);font-weight:600;min-height:20px;margin:0 0 8px}";
  document.head.appendChild(css);

  /* ---------- chargement des données (sans jamais bloquer le reste) ---------- */
  async function wload() {
    if (typeof U === "undefined" || !U) return;
    try {
      var r = await Promise.all([
        sb.from("wave_settings").select("*").eq("id", 1).maybeSingle(),
        sb.from("wave_payments").select("*").order("created_at", { ascending: false })
      ]);
      if (r[0].error) throw r[0].error;
      if (r[1].error) throw r[1].error;
      W.ok = true;
      W.num = (r[0].data && r[0].data.number) || "";
      W.holder = (r[0].data && r[0].data.holder) || "";
      W.pay = (r[1].data || []).map(function (p) {
        return { id: p.id, m: p.member_id, y: p.year, a: +p.amount, r: p.reference || "", f: p.proof_path,
                 s: p.status, n: p.note || "", d: p.created_at };
      });
    } catch (e) { W.ok = false; W.err = (e && e.message) || String(e); }
  }
  var _loadAll = loadAll;
  loadAll = async function () { await _loadAll.apply(this, arguments); await wload(); };

  /* ---------- aides ---------- */
  var mine = function () { return W.pay.filter(function (p) { return p.m === U.id; }); };
  var tot = function (list, y, s) {
    return list.filter(function (p) { return p.y === y && p.s === s; }).reduce(function (a, p) { return a + p.a; }, 0);
  };
  var nm = function (id) { var u = S.users.find(function (x) { return x.id === id; }); return u ? u.n : "Membre"; };
  var pendingN = function () { return W.pay.filter(function (p) { return p.s === "pending"; }).length; };
  var dlg = function (h) { $("dg").innerHTML = h; $("dg").showModal(); };
  var notReady = function () {
    return '<div class="card"><b>Paiement par Wave</b><p class="sub" style="margin:8px 0 0">' +
      (adm() ? "Le module n’est pas encore activé : exécutez le fichier <b>paiement-wave.sql</b> dans Supabase (SQL Editor)." : "Cette fonction sera bientôt disponible.") +
      "</p></div>";
  };

  /* ---------- carte de progression ---------- */
  function progress(y) {
    var l = mine(), t = TARGET(y), ok = tot(l, y, "validated"), pe = tot(l, y, "pending"),
        pct = Math.min(100, Math.round(ok / t * 100)), left = Math.max(0, t - ok);
    return '<div class="card"><div class="rw" style="flex-wrap:nowrap"><div><b class="ct">Ma cotisation ' + y + '</b>' +
      '<div class="sub" style="margin:0">Objectif : ' + fc(t) + '</div></div><span class="tg ' + (left ? "w" : "") + '">' + (left ? pct + " %" : "Soldée") + '</span></div>' +
      '<div class="wv-bar"><i style="width:' + pct + '%"></i></div>' +
      '<div class="rw"><span><span class="ok">' + fc(ok) + '</span> versés</span><span class="mut">' + (left ? "Reste " + fc(left) : "Objectif atteint") + '</span></div>' +
      (pe ? '<p class="sub" style="margin:8px 0 0">' + fc(pe) + ' en cours de vérification par un administrateur.</p>' : "") + '</div>';
  }

  /* ---------- page membre : Payer ma cotisation ---------- */
  var viewWav = function () {
    var y = YEAR(), h = head("Payer ma cotisation", "", "Paiement par Wave, vérifié par un administrateur");
    if (!W.ok) return h + notReady();
    var flash = W.flash ? '<div class="wv-msg g">' + esc(W.flash) + "</div>" : "";
    var hero;
    if (!W.num) {
      hero = '<div class="card"><b>Numéro Wave non défini</b><p class="sub" style="margin:8px 0 0">' +
        (adm() ? "Renseignez-le dans la page « Paiements Wave »." : "Un administrateur doit d’abord renseigner le numéro Wave de l’amicale.") + "</p></div>";
    } else {
      hero = '<div class="wv-hero"><small>Numéro Wave de l’amicale' + (W.holder ? " · " + esc(W.holder) : "") + '</small>' +
        '<div class="wv-num"><b>' + esc(W.num) + '</b><button class="bt t3 s" id="wv_cp" onclick="wvCopy()">Copier</button></div>' +
        '<div class="wv-step"><em>1</em><span>Ouvrez Wave et envoyez votre cotisation à ce numéro (minimum ' + fc(MIN) + ').</span></div>' +
        '<div class="wv-step"><em>2</em><span>Faites une capture d’écran de la transaction.</span></div>' +
        '<div class="wv-step"><em>3</em><span>Revenez ici et envoyez-la : un administrateur vérifie puis valide.</span></div>' +
        '<div style="margin-top:14px"><button class="b3" style="--a:#fcd34d;--b:#f59e0b;--d:#b45309;color:#3b1d00;margin:0" onclick="wvPay()">' + ic("plus", 18) + 'J’ai payé, envoyer ma capture</button></div></div>';
    }
    var l = mine();
    var hist = '<div class="card"><b class="ct">Mes versements</b>' + (l.length ? l.map(rowMine).join("") : '<p class="sub" style="margin:10px 0 0">Aucun versement pour le moment.</p>') + "</div>";
    return h + flash + progress(y) + hero + hist;
  };
  function rowMine(p) {
    return '<div class="ro"><span class="ic ' + (p.s === "validated" ? "in" : "") + '">' + ic(p.s === "validated" ? "check" : p.s === "rejected" ? "x" : "wallet", 18) + '</span>' +
      '<div class="m"><b>' + fc(p.a) + '</b><span>' + fd(p.d) + (p.r ? " · " + esc(p.r) : "") + (p.s === "rejected" && p.n ? " · Motif : " + esc(p.n) : "") + '</span></div>' +
      '<span class="tg ' + STC[p.s] + '">' + STL[p.s] + "</span></div>";
  }

  /* ---------- page administrateur : Paiements Wave ---------- */
  var viewWvr = function () {
    if (!adm()) return "";
    var h = head("Paiements Wave", "", "Vérifier les paiements et gérer le numéro");
    if (!W.ok) return h + notReady();
    var pend = W.pay.filter(function (p) { return p.s === "pending"; });
    var done = W.pay.filter(function (p) { return p.s !== "pending"; }).slice(0, 40);
    var num = '<div class="card"><div class="rw" style="flex-wrap:nowrap"><div><b class="ct">Numéro Wave de l’amicale</b>' +
      '<div class="sub" style="margin:0">Visible par tous les membres</div></div><button class="bt t4 s" onclick="wvSet()">Modifier</button></div>' +
      '<div style="font-size:22px;font-weight:800;margin-top:12px">' + (W.num ? esc(W.num) : '<span class="mut">Non défini</span>') + '</div>' +
      (W.holder ? '<div class="sub" style="margin:2px 0 0">' + esc(W.holder) + "</div>" : "") + "</div>";
    var pv = '<div class="card" style="' + (pend.length ? "border-color:#f59e0b" : "") + '"><b class="ct">À vérifier (' + pend.length + ')</b>' +
      '<p class="sub" style="margin:2px 0 4px">Comparez avec votre compte Wave avant de valider.</p>' +
      (pend.length ? pend.map(function (p) {
        var i = W.pay.indexOf(p);
        return '<div class="ro" style="align-items:flex-start"><div class="av">' + ini(nm(p.m)) + '</div><div class="m"><b>' + esc(nm(p.m)) + " · " + fc(p.a) + "</b>" +
          "<span>" + fd(p.d) + " · Cotisation " + p.y + (p.r ? " · " + esc(p.r) : "") + "</span>" +
          '<div class="wv-acts"><button class="bt t4 s" onclick="wvView(' + i + ')">' + ic("eye", 15) + 'Capture</button>' +
          '<button class="bt t1 s" onclick="wvOk(' + i + ')">' + ic("check", 15) + 'Valider</button>' +
          '<button class="bt t2 s" onclick="wvNo(' + i + ')">' + ic("x", 15) + "Refuser</button></div></div></div>";
      }).join("") : '<p class="sub" style="margin:10px 0 0">Aucun paiement en attente.</p>') + "</div>";
    var hv = '<div class="card"><b class="ct">Historique</b><p class="sub" style="margin:2px 0 4px">Les paiements validés comptent dans la situation du membre, pas dans la caisse.</p>' +
      (done.length ? done.map(function (p) {
        var i = W.pay.indexOf(p);
        return '<div class="ro"><div class="av">' + ini(nm(p.m)) + '</div><div class="m"><b>' + esc(nm(p.m)) + " · " + fc(p.a) + "</b><span>" + fd(p.d) + (p.r ? " · " + esc(p.r) : "") + '</span></div>' +
          '<span class="tg ' + STC[p.s] + '">' + STL[p.s] + '</span><button class="ib" onclick="wvDel(' + i + ')">' + ic("trash", 17) + "</button></div>";
      }).join("") : '<p class="sub" style="margin:10px 0 0">Rien pour le moment.</p>') + "</div>";
    return h + num + pv + hv;
  };

  /* ---------- actions membre ---------- */
  window.wvCopy = function () {
    var v = W.num.replace(/[^\d+]/g, ""), b = $("wv_cp");
    var done = function () { if (b) { b.textContent = "Copié ✓"; setTimeout(function () { if (b) b.textContent = "Copier"; }, 1800); } };
    try { navigator.clipboard.writeText(v).then(done, done); } catch (e) { done(); }
  };
  window.wvAmt = function (v) { $("wv_am").value = v; };
  window.wvPay = function () {
    dlg('<h2 style="margin:0 0 6px;font-size:18px">Envoyer ma preuve de paiement</h2>' +
      '<p class="sub" style="margin:0 0 12px">Cotisation ' + YEAR() + ' · envoyée au ' + esc(W.num) + "</p>" +
      '<div class="k" style="margin:2px 0 6px">Montant envoyé (FCFA, minimum ' + MIN.toLocaleString("fr-FR") + ")</div>" +
      '<div class="wv-chips">' + [5000, 10000, 25000, 50000].map(function (v) { return '<button onclick="wvAmt(' + v + ')">' + v.toLocaleString("fr-FR") + "</button>"; }).join("") + "</div>" +
      '<input id="wv_am" type="number" inputmode="numeric" min="' + MIN + '" step="500" placeholder="Montant">' +
      '<div class="k" style="margin:2px 0 6px">Capture d’écran de la transaction Wave</div><input id="wv_f" type="file" accept="image/*">' +
      '<input id="wv_rf" placeholder="Référence de la transaction (facultatif)">' +
      '<p class="wv-err" id="wv_er"></p>' +
      '<div class="rw"><button class="lnk" onclick="$(\'dg\').close()">Annuler</button><button class="bt t1" id="wv_ok" onclick="wvSend()">Envoyer</button></div>');
  };
  window.wvSend = async function () {
    var er = $("wv_er"), b = $("wv_ok"), am = Math.round(+$("wv_am").value), f = $("wv_f").files[0], rf = $("wv_rf").value.trim();
    var bad = function (m) { er.textContent = m; };
    if (!am || am < MIN) return bad("Le montant minimum est de " + fc(MIN) + ".");
    if (!f) return bad("Ajoutez la capture d’écran de la transaction.");
    if (!/^image\//.test(f.type)) return bad("La capture doit être une image.");
    if (f.size > 8e6) return bad("Image trop volumineuse (8 Mo maximum).");
    b.disabled = true; b.textContent = "Envoi…"; er.textContent = "";
    try {
      var path = U.id + "/" + Date.now() + "-" + f.name.replace(/[^\w.-]+/g, "_");
      var r = await sb.storage.from(BUCKET).upload(path, f, { contentType: f.type });
      if (r.error) throw r.error;
      r = await sb.from("wave_payments").insert({ member_id: U.id, year: YEAR(), amount: am, reference: rf, proof_path: path });
      if (r.error) throw r.error;
      W.flash = "Merci ! Votre paiement a été envoyé. Un administrateur va le vérifier.";
      $("dg").close(); await wload(); render();
    } catch (e) { b.disabled = false; b.textContent = "Envoyer"; bad("Échec de l’envoi : " + ((e && e.message) || e)); }
  };

  /* ---------- actions administrateur ---------- */
  window.wvSet = function () {
    dlg('<h2 style="margin:0 0 14px;font-size:18px">Numéro Wave de l’amicale</h2>' +
      '<input id="wv_n" type="tel" placeholder="Numéro Wave (ex. 77 123 45 67)" value="' + esc(W.num) + '">' +
      '<input id="wv_h" placeholder="Nom du titulaire (facultatif)" value="' + esc(W.holder) + '">' +
      '<div class="rw" style="margin-top:6px"><button class="lnk" onclick="$(\'dg\').close()">Annuler</button><button class="bt t1" id="wv_sv" onclick="wvSaveSet()">Enregistrer</button></div>');
  };
  window.wvSaveSet = async function () {
    var n = $("wv_n").value.trim(), h = $("wv_h").value.trim();
    if (!n) return;
    $("wv_sv").disabled = true;
    var r = await sb.from("wave_settings").upsert({ id: 1, number: n, holder: h, updated_at: new Date().toISOString() });
    $("dg").close();
    if (fail(r.error)) return;
    await wload(); render();
  };
  window.wvView = async function (i) {
    var p = W.pay[i]; if (!p || !p.f) return;
    var r = await sb.storage.from(BUCKET).createSignedUrl(p.f, 600);
    if (fail(r.error)) return;
    dlg('<h2 style="margin:0 0 4px;font-size:18px">' + esc(nm(p.m)) + " · " + fc(p.a) + "</h2>" +
      '<p class="sub" style="margin:0 0 10px">' + fd(p.d) + (p.r ? " · " + esc(p.r) : "") + "</p>" +
      '<img src="' + r.data.signedUrl + '" alt="" style="width:100%;border-radius:18px;margin-bottom:12px">' +
      '<div class="rw"><button class="lnk" onclick="$(\'dg\').close()">Fermer</button>' +
      '<span style="display:flex;gap:8px"><button class="bt t2 s" onclick="$(\'dg\').close();wvNo(' + i + ')">Refuser</button><button class="bt t1 s" onclick="$(\'dg\').close();wvOk(' + i + ')">Valider</button></span></div>');
  };
  var decide = async function (i, st, note) {
    var p = W.pay[i];
    var r = await sb.from("wave_payments").update({ status: st, note: note || "", decided_by: U.id, decided_at: new Date().toISOString() }).eq("id", p.id);
    if (fail(r.error)) return;
    await wload(); render();
  };
  window.wvOk = function (i) {
    var p = W.pay[i];
    if (confirm("Valider " + fc(p.a) + " de " + nm(p.m) + " ?\n(Cela met à jour sa situation, pas la caisse.)")) decide(i, "validated");
  };
  window.wvNo = function (i) {
    var m = prompt("Motif du refus (facultatif) :");
    if (m === null) return;
    decide(i, "rejected", m.trim());
  };
  window.wvDel = async function (i) {
    var p = W.pay[i];
    if (!confirm("Supprimer ce paiement de l’historique ?")) return;
    var r = await sb.from("wave_payments").delete().eq("id", p.id);
    if (fail(r.error)) return;
    if (p.f) await sb.storage.from(BUCKET).remove([p.f]);
    await wload(); render();
  };

  /* ---------- branchement sur l'existant (sans rien remplacer) ---------- */
  V.wav = viewWav;
  V.wvr = viewWvr;
  if (!N.some(function (n) { return n[0] === "wav"; })) {
    var ci = N.findIndex(function (n) { return n[0] === "cai"; });
    N.splice(ci < 0 ? 1 : ci + 1, 0, ["wav", "Payer ma cotisation", "wallet", "#38bdf8", "#2563eb", "#1e3a8a"]);
    var mi = N.findIndex(function (n) { return n[0] === "mem"; });
    N.splice(mi < 0 ? N.length : mi, 0, ["wvr", "Paiements Wave", "receipt", "#2dd4bf", "#0d9488", "#115e59", 1]);
  }

  var _dash = V.dash;
  V.dash = function () {
    var html = _dash.apply(this, arguments);
    W.flash = "";
    if (!W.ok) return html;
    var extra = "";
    if (adm() && pendingN()) {
      extra += '<div class="card last" onclick="go(\'wvr\')" style="border-color:#f59e0b"><span class="ti" style="--a:#38bdf8;--b:#2563eb;--d:#1e3a8a">' + ic("wallet", 22) + '</span><div><small>Paiements Wave</small><b>' + pendingN() + " à vérifier</b></div><span class=\"mut\">Voir</span></div>";
    }
    var y = YEAR(), t = TARGET(y), ok = tot(mine(), y, "validated");
    extra += '<div class="card last" onclick="go(\'wav\')"><span class="ti" style="--a:#38bdf8;--b:#2563eb;--d:#1e3a8a">' + ic("wallet", 22) + '</span><div><small>Ma cotisation ' + y + '</small><b>' + fc(ok) + " / " + fc(t) + '</b></div><span class="mut">Payer</span></div>';
    var k = '<div class="stats">';
    return html.indexOf(k) > -1 ? html.replace(k, extra + k) : html + extra;
  };

  var _render = render;
  render = function () {
    _render.apply(this, arguments);
    try {
      var n = (typeof U !== "undefined" && U && adm() && W.ok) ? pendingN() : 0;
      var b = n && document.querySelector('.mi[onclick="go(\'wvr\')"]');
      if (b && !b.querySelector(".bg")) b.insertAdjacentHTML("beforeend", '<em class="bg">' + n + "</em>");
    } catch (e) {}
  };
})();
