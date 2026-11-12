import { db, auth, fs, au, login, logout, esc, $ } from "./firebase.js";

// ✏️ Textos padrão (o organizador muda o nome/data/local pelo admin.html)
let S = { name: "White Boy Awards", eventDate: "", place: "", votingOpen: false, heroImg: "" };
let cats = [], user = null, voted = false;
let choices = JSON.parse(localStorage.getItem("wba-choices") || "{}");
const app = $("#app");
const persist = () => localStorage.setItem("wba-choices", JSON.stringify(choices));

async function boot() {
  const s = await fs.getDoc(fs.doc(db, "settings", "main"));
  if (s.exists()) S = { ...S, ...s.data() };
  const c = await fs.getDocs(fs.query(fs.collection(db, "categories"), fs.orderBy("order")));
  cats = c.docs.map(d => ({ id: d.id, ...d.data() })).filter(x => x.nominees?.length);
  document.title = S.name;
}
const booted = boot();
au.onAuthStateChanged(auth, async u => {
  user = u; voted = false;
  await booted;
  if (u) voted = (await fs.getDoc(fs.doc(db, "votes", u.email))).exists();
  route();
});
addEventListener("hashchange", route);

function route() {
  const [page, n] = location.hash.replace("#/", "").split("/");
  $("#nav").innerHTML = `<a class="logo" href="#/">${esc(S.name)}</a>
    <a class="l ${!page ? "on" : ""}" href="#/">Início</a>
    <a class="l ${page === "categorias" ? "on" : ""}" href="#/categorias">Categorias</a>
    <a class="l ${page === "votar" ? "on" : ""}" href="#/votar/0">Votar</a><span class="sp"></span>
    ${user ? `<a class="l" href="#" data-a="out">Sair (${esc(user.email)})</a>` : `<a class="l" href="#" data-a="login">Entrar</a>`}`;
  if (page === "votar") voteView(+n || 0);
  else if (page === "categorias") listView();
  else homeView();
}

function countdown() {
  if (!S.eventDate) return "";
  const d = Math.ceil((new Date(S.eventDate + "T00:00:00") - Date.now()) / 864e5);
  return d > 1 ? `${d} dias para a cerimônia` : d === 1 ? "É amanhã!" : d === 0 ? "A cerimônia é hoje!" : "A cerimônia já aconteceu";
}

function homeView() {
  const date = S.eventDate ? new Date(S.eventDate + "T00:00:00").toLocaleDateString("pt-BR", { day: "numeric", month: "long" }) : "";
  app.innerHTML = `${S.eventDate ? `<div class="count">${countdown()}</div>` : ""}
  <section class="hero" ${S.heroImg ? `style="background-image:linear-gradient(90deg,#0000 20%,#0a141ccc),url(${S.heroImg})"` : ""}>
    <div class="in"><h1>${esc(S.name)}</h1>
      ${date ? `<p class="date">${date}</p>` : ""}${S.place ? `<p class="place">${esc(S.place)}</p>` : ""}
      <a class="btn" href="#/votar/0">${S.votingOpen ? "Votar agora" : "Ver categorias"}</a></div>
  </section>
  <section class="explore"><h2>Categorias</h2><div class="tiles">
    ${cats.map((c, i) => `<a class="tile" href="#/votar/${i}">${esc(c.title)}</a>`).join("") || "<p>Em breve.</p>"}</div></section>`;
}

const box = (t, p, x = "") => `<section class="gate"><div class="box"><h2>${t}</h2><p>${p}</p>${x}</div></section>`;
function gate() {
  if (!user) return box("Entre para votar", "Usamos seu e-mail Google para garantir <b>um voto por pessoa</b>.", `<button class="btn" data-a="login">Entrar com Google</button>`);
  if (voted) return box("✔ Voto registrado", `Você já votou com ${esc(user.email)}. Cada e-mail só pode votar uma vez.`);
  if (!S.votingOpen) return box("Votação fechada", "Aguarde o organizador abrir a votação.");
  if (!cats.length) return box("Sem categorias", "O organizador ainda não cadastrou as categorias.");
}

function voteView(i) {
  const g = gate(); if (g) return (app.innerHTML = g);
  i = Math.min(Math.max(i, 0), cats.length - 1);
  const c = cats[i], last = i === cats.length - 1;
  app.innerHTML = `<section class="vote">
    <div class="sub"><a href="#/">← Sair da votação</a><div>
      ${i > 0 ? `<a href="#/votar/${i - 1}">← Anterior</a>` : ""}
      <a class="hl" href="#/categorias">Ver todas as categorias</a>
      <a href="${last ? "#/categorias" : "#/votar/" + (i + 1)}">${last ? "Revisar e enviar" : "Próxima"} →</a></div></div>
    <h1>${esc(c.title)}</h1><p class="d">${esc(c.desc || "")}</p>
    <div class="grid">${c.nominees.map(n => `
      <button class="nom ${choices[c.id] === n.id ? "sel" : ""}" data-cat="${c.id}" data-nom="${n.id}" data-i="${i}">
        ${n.img ? `<img class="ph" src="${n.img}" alt="${esc(n.name)}">` : `<div class="ph"></div>`}
        <div class="v">${choices[c.id] === n.id ? "✔ SEU VOTO" : "VOTAR"}</div>
        <b>${esc(n.name)}</b><small>${esc(n.sub || "")}</small></button>`).join("")}</div>
  </section>`;
}

function listView() {
  const g = gate(); if (g) return (app.innerHTML = g);
  const done = cats.filter(c => choices[c.id]).length;
  const missing = cats.filter(c => c.required !== false && !choices[c.id]).length;
  app.innerHTML = `<section class="vote"><h1>Suas escolhas</h1><p class="d">Revise antes de enviar. Depois de enviar, não dá para alterar.</p>
    <div class="list">${cats.map((c, i) => {
      const n = c.nominees.find(x => x.id === choices[c.id]);
      return `<div class="it"><div><b>${esc(c.title)}</b><br>${n ? esc(n.name) : `<span class="miss">${c.required !== false ? "Falta escolher" : "Sem voto (opcional)"}</span>`}</div>
        <a class="btn ghost" href="#/votar/${i}">${n ? "Alterar" : "Escolher"}</a></div>`;
    }).join("")}</div>
    <div class="bar"><span>${done} de ${cats.length} categorias</span>
    <button class="btn" data-a="send" ${missing ? "disabled" : ""}>Enviar meus votos</button></div></section>`;
}

document.addEventListener("click", async e => {
  const a = e.target.closest("[data-a]")?.dataset.a;
  if (a === "login") { e.preventDefault(); login(); }
  if (a === "out") { e.preventDefault(); logout(); }
  const n = e.target.closest(".nom");
  if (n) { choices[n.dataset.cat] = n.dataset.nom; persist(); const y = scrollY; voteView(+n.dataset.i); scrollTo(0, y); }
  if (a === "send") {
    if (!confirm("Confirmar? Depois de enviar, não dá para mudar.")) return;
    try {
      await fs.setDoc(fs.doc(db, "votes", user.email), { email: user.email, choices, createdAt: fs.serverTimestamp() });
      voted = true; localStorage.removeItem("wba-choices"); location.hash = "#/votar/0"; route();
    } catch { app.innerHTML = box("Não foi possível votar", "Você já votou ou a votação foi fechada."); }
  }
});
