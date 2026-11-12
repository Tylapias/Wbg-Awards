import { db, auth, fs, au, login, logout, esc, $, resize } from "./firebase.js";
import { OWNER_EMAIL } from "./config.js";

const app = $("#app");
let me, isOwner = false, tab = "evento", S = {}, cats = [], votes = [], admins = [];
const toast = t => { const el = $("#toast"); el.textContent = t; el.className = "on"; setTimeout(() => (el.className = ""), 1500); };
const wrap = h => (app.innerHTML = `<div class="gate"><div class="box">${h}</div></div>`);

au.onAuthStateChanged(auth, async u => {
  me = u;
  $("#user").innerHTML = u ? `${esc(u.email)} · <a href="#" data-a="out">sair</a>` : "";
  if (!u) return wrap(`<h2>Área do organizador</h2><button class="btn" data-a="login">Entrar com Google</button>`);
  isOwner = u.email.toLowerCase() === OWNER_EMAIL.toLowerCase();
  const ok = isOwner || (await fs.getDoc(fs.doc(db, "admins", u.email.toLowerCase()))).exists();
  if (!ok) return wrap(`<h2>Sem permissão</h2><p>${esc(u.email)} não é administrador. Peça ao dono do site.</p>`);
  await load();
});

async function load() {
  const [s, c, v, a] = await Promise.all([
    fs.getDoc(fs.doc(db, "settings", "main")),
    fs.getDocs(fs.query(fs.collection(db, "categories"), fs.orderBy("order"))),
    fs.getDocs(fs.collection(db, "votes")),
    fs.getDocs(fs.collection(db, "admins")),
  ]);
  S = s.exists() ? s.data() : {};
  cats = c.docs.map(d => ({ id: d.id, ...d.data() }));
  votes = v.docs.map(d => d.data());
  admins = a.docs.map(d => d.id);
  draw();
}

const tabs = [["evento", "Evento"], ["cats", "Categorias"], ["res", "Resultados"], ["adm", "Administradores"]];
function draw() {
  app.innerHTML = `<div class="adm"><div class="tabs">${tabs.map(([k, n]) => `<button class="tab ${tab === k ? "on" : ""}" data-a="tab" data-k="${k}">${n}</button>`).join("")}</div>
  ${{ evento: pEvento, cats: pCats, res: pRes, adm: pAdm }[tab]()}</div>`;
}

const pEvento = () => `<div class="card"><h3>Dados do evento</h3>
  <label>Nome do evento<input type="text" id="e-name" value="${esc(S.name || "White Boy Awards")}"></label>
  <label>Local<input type="text" id="e-place" value="${esc(S.place || "")}"></label>
  <label>Data da cerimônia<input type="date" id="e-date" value="${S.eventDate || ""}"></label>
  <label>Imagem principal da home (opcional)<input type="file" id="e-hero" accept="image/*"></label>
  ${S.heroImg ? `<img src="${S.heroImg}" style="max-width:260px;margin-top:8px">` : ""}
  <p><button class="btn" data-a="saveEvent">Salvar evento</button></p></div>
  <div class="card row"><b>Votação: ${S.votingOpen ? "ABERTA" : "FECHADA"}</b>
  <button class="btn ${S.votingOpen ? "red" : ""}" data-a="toggle">${S.votingOpen ? "Fechar votação" : "Abrir votação"}</button></div>`;

const pCats = () => `<div class="card"><h3>Nova categoria</h3><input type="text" id="newcat" placeholder="Ex: Mais atrasado do grupo">
  <p><button class="btn" data-a="addcat">Criar categoria</button></p></div>
  ${cats.map((c, i) => `<div class="card">
    <label>Título da categoria<input type="text" data-f="title" data-i="${i}" value="${esc(c.title)}"></label>
    <label>Descrição (aparece embaixo do título)<textarea data-f="desc" data-i="${i}" rows="2">${esc(c.desc || "")}</textarea></label>
    <label><input type="checkbox" data-f="required" data-i="${i}" ${c.required !== false ? "checked" : ""}> Resposta obrigatória</label>
    <h4>Indicados</h4>
    ${(c.nominees || []).map((n, j) => `<div class="mini">${n.img ? `<img src="${n.img}">` : `<img alt="">`}
      <input type="text" data-f="name" data-i="${i}" data-n="${j}" value="${esc(n.name)}" placeholder="Nome">
      <input type="text" data-f="sub" data-i="${i}" data-n="${j}" value="${esc(n.sub || "")}" placeholder="Subtítulo">
      <input type="file" accept="image/*" data-f="img" data-i="${i}" data-n="${j}" style="max-width:190px">
      <button class="btn ghost" data-a="delnom" data-i="${i}" data-n="${j}">Remover</button></div>`).join("")}
    <div class="mini"><input type="text" id="nn-${i}" placeholder="Novo indicado"><input type="text" id="ns-${i}" placeholder="Subtítulo (opcional)">
      <input type="file" id="nf-${i}" accept="image/*" style="max-width:190px"><button class="btn" data-a="addnom" data-i="${i}">Adicionar</button></div>
    <p class="row"><button class="btn ghost" data-a="up" data-i="${i}">↑ Subir</button><button class="btn ghost" data-a="down" data-i="${i}">↓ Descer</button>
    <button class="btn red" data-a="delcat" data-i="${i}">Apagar categoria</button></p></div>`).join("")}`;

function pRes() {
  const out = cats.map(c => {
    const cnt = {}; votes.forEach(v => { const k = v.choices?.[c.id]; if (k) cnt[k] = (cnt[k] || 0) + 1; });
    const sum = Object.values(cnt).reduce((a, b) => a + b, 0);
    return `<div class="card"><h3>${esc(c.title)}</h3>${[...(c.nominees || [])].sort((a, b) => (cnt[b.id] || 0) - (cnt[a.id] || 0)).map(n => {
      const k = cnt[n.id] || 0, p = sum ? Math.round(k * 100 / sum) : 0;
      return `<div class="res"><div class="t"><span>${esc(n.name)}</span><b>${k} voto(s) · ${p}%</b></div><div class="b"><i style="width:${p}%"></i></div></div>`;
    }).join("")}</div>`;
  }).join("");
  const who = [...votes].sort((a, b) => (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0))
    .map(v => `<div class="res" style="display:flex;justify-content:space-between;align-items:center;gap:10px"><span>${esc(v.email)}</span><span>${v.createdAt ? v.createdAt.toDate().toLocaleString("pt-BR") : ""}</span>${isOwner ? `<button class="btn ghost" data-a="delvote" data-e="${esc(v.email)}">Apagar voto</button>` : ""}</div>`).join("");
  return `<div class="card"><h3>${votes.length} pessoa(s) votaram</h3>${who || "Ninguém votou ainda."}${isOwner && votes.length ? `<p><button class="btn red" data-a="clearvotes">Zerar todos os votos</button></p>` : ""}</div>${out}`;
}

const pAdm = () => `<div class="card"><h3>Administradores</h3>
  <div class="res t"><span>${esc(OWNER_EMAIL)}</span><b>Dono</b></div>
  ${admins.map(e => `<div class="res t"><span>${esc(e)}</span>${isOwner ? `<button class="btn red" data-a="deladmin" data-e="${esc(e)}">Remover</button>` : ""}</div>`).join("")}
  ${isOwner ? `<label>Dar acesso de admin a (e-mail Google)<input type="text" id="newadm" placeholder="amigo@gmail.com"></label>
  <p><button class="btn" data-a="addadmin">Adicionar admin</button></p>` : `<p>Só o dono pode alterar administradores.</p>`}</div>`;

const cref = c => fs.doc(db, "categories", c.id);
const saveCat = c => fs.updateDoc(cref(c), { title: c.title, desc: c.desc || "", required: c.required !== false, nominees: c.nominees || [] });

document.addEventListener("change", async e => {
  const t = e.target, f = t.dataset.f; if (!f) return;
  const c = cats[+t.dataset.i];
  if (t.dataset.n !== undefined) {
    const n = c.nominees[+t.dataset.n];
    if (f === "img") n.img = await resize(t.files[0]); else n[f] = t.value;
  } else c[f] = f === "required" ? t.checked : t.value;
  await saveCat(c); toast("Salvo"); if (f === "img") draw();
});

document.addEventListener("click", async e => {
  const b = e.target.closest("[data-a]"); if (!b) return;
  const { a, i, n, k, e: em } = b.dataset, c = cats[+i];
  if (a === "login") return login();
  if (a === "out") { e.preventDefault(); return logout(); }
  if (a === "tab") { tab = k; return draw(); }
  try {
    if (a === "saveEvent") {
      const file = $("#e-hero").files[0];
      await fs.setDoc(fs.doc(db, "settings", "main"), { ...S, name: $("#e-name").value, place: $("#e-place").value, eventDate: $("#e-date").value, heroImg: file ? await resize(file, 1600, 0.75) : S.heroImg || "" });
    }
    if (a === "toggle") await fs.setDoc(fs.doc(db, "settings", "main"), { ...S, votingOpen: !S.votingOpen });
    if (a === "addcat") { const t = $("#newcat").value.trim(); if (!t) return; await fs.addDoc(fs.collection(db, "categories"), { title: t, desc: "", required: true, order: Date.now(), nominees: [] }); }
    if (a === "delcat") { if (!confirm("Apagar esta categoria?")) return; await fs.deleteDoc(cref(c)); }
    if (a === "up" || a === "down") {
      const o = cats[+i + (a === "up" ? -1 : 1)]; if (!o) return;
      await Promise.all([fs.updateDoc(cref(c), { order: o.order }), fs.updateDoc(cref(o), { order: c.order })]);
    }
    if (a === "addnom") {
      const name = $("#nn-" + i).value.trim(); if (!name) return alert("Digite o nome.");
      const f = $("#nf-" + i).files[0];
      c.nominees = [...(c.nominees || []), { id: "n" + Date.now(), name, sub: $("#ns-" + i).value.trim(), img: f ? await resize(f) : "" }];
      await saveCat(c);
    }
    if (a === "delnom") { c.nominees.splice(+n, 1); await saveCat(c); }
    if (a === "addadmin") { const m = $("#newadm").value.trim().toLowerCase(); if (!m.includes("@")) return alert("E-mail inválido."); await fs.setDoc(fs.doc(db, "admins", m), { addedBy: me.email }); }
    if (a === "deladmin") await fs.deleteDoc(fs.doc(db, "admins", em));
    if (a === "delvote") { if (!confirm("Apagar o voto de " + em + "? Essa pessoa poderá votar de novo.")) return; await fs.deleteDoc(fs.doc(db, "votes", em)); }
    if (a === "clearvotes") { if (!confirm("Apagar TODOS os votos? Não dá para desfazer.")) return; await Promise.all(votes.map(v => fs.deleteDoc(fs.doc(db, "votes", v.email)))); }
    await load(); toast("Salvo");
  } catch (err) { console.error(err); alert("Erro: " + err.message); }
});