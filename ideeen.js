// ===== IDEEËN =====
// Een notitieboek voor je ideeën: business-ideeën, dingen over AI die je wilt leren, enz.
// Per idee: een titel, een uitwerking (tekst) en links naar video's (TikTok, Instagram, YouTube).

const CATEGORIEEN = {
  business: "💼 Business-idee",
  ai: "🤖 AI & leren",
  overig: "💡 Overig"
};

let openIdeeId = null;       // het idee dat je nu aan het bewerken bent
let ideeFilter = "alles";    // welke categorie je bekijkt

function zoekIdee(id) {
  return ideeen.find(idee => idee.id === id);
}

// ----- Tonen -----

function toonIdeeen() {
  // Filterknoppen
  document.querySelectorAll("[data-categorie]").forEach(knop =>
    knop.classList.toggle("actief", knop.dataset.categorie === ideeFilter));

  toonIdeeenLijst();

  const idee = zoekIdee(openIdeeId);
  document.getElementById("idee-editor").classList.toggle("verborgen", !idee);
  document.getElementById("ideeen-layout").classList.toggle("editor-open", Boolean(idee));
  if (idee) toonLinks(idee);
}

function toonIdeeenLijst() {
  const lijst = document.getElementById("ideeen-lijst");
  lijst.innerHTML = "";

  const gekozen = ideeen
    .filter(idee => ideeFilter === "alles" || idee.categorie === ideeFilter)
    .filter(idee => {
      if (!zoekterm) return true;
      const tekst = [idee.titel, idee.tekst, ...idee.links.map(link => link.notitie + " " + link.url)].join(" ");
      return tekst.toLowerCase().includes(zoekterm);
    })
    .sort((a, b) => b.bijgewerkt - a.bijgewerkt); // laatst bewerkt bovenaan

  if (gekozen.length === 0) {
    lijst.innerHTML = '<p class="leeg">' +
      (ideeen.length ? "Geen ideeën gevonden." : "Nog geen ideeën. Klik op ➕ Nieuw idee om te beginnen.") + "</p>";
    return;
  }

  for (const idee of gekozen) {
    const kaart = document.createElement("li");
    kaart.className = "idee-kaart" + (idee.id === openIdeeId ? " actief" : "");
    kaart.onclick = () => openIdee(idee.id);

    const titel = document.createElement("strong");
    titel.textContent = idee.titel || "Naamloos idee";
    kaart.appendChild(titel);

    const info = document.createElement("span");
    info.className = "info";
    const delen = [CATEGORIEEN[idee.categorie]];
    if (idee.links.length) delen.push("🔗 " + idee.links.length);
    delen.push(new Date(idee.bijgewerkt).toLocaleDateString("nl-NL", { day: "numeric", month: "short" }));
    info.textContent = delen.join(" · ");
    kaart.appendChild(info);

    if (idee.tekst) {
      const stukje = document.createElement("span");
      stukje.className = "idee-stukje";
      stukje.textContent = idee.tekst.slice(0, 100) + (idee.tekst.length > 100 ? "…" : "");
      kaart.appendChild(stukje);
    }
    lijst.appendChild(kaart);
  }
}

// ----- Een idee openen, maken en sluiten -----

function openIdee(id) {
  ruimLeegIdeeOp();
  openIdeeId = id;
  const idee = zoekIdee(id);
  document.getElementById("idee-titel").value = idee.titel;
  document.getElementById("idee-categorie").value = idee.categorie;
  document.getElementById("idee-tekst").value = idee.tekst;
  document.getElementById("idee-opgeslagen").textContent = "";
  toonIdeeen();
  pasTekstvakAan();
  // Op de telefoon: naar de editor scrollen
  document.getElementById("idee-editor").scrollIntoView({ behavior: "smooth", block: "start" });
}

function nieuwIdee() {
  const nu = Date.now();
  ideeen.push({
    id: nu,
    titel: "",
    categorie: ideeFilter === "alles" ? "business" : ideeFilter,
    tekst: "",
    links: [],
    aangemaakt: nu,
    bijgewerkt: nu
  });
  openIdee(nu);
  document.getElementById("idee-titel").focus();
}

function sluitIdee() {
  ruimLeegIdeeOp();
  openIdeeId = null;
  toonIdeeen();
}

// Een idee waar je niks in hebt gezet, gooien we weg als je het sluit
function ruimLeegIdeeOp() {
  const idee = zoekIdee(openIdeeId);
  if (idee && !idee.titel.trim() && !idee.tekst.trim() && idee.links.length === 0) {
    ideeen = ideeen.filter(ander => ander.id !== idee.id);
    bewaarItems();
  }
}

function verwijderIdee() {
  const idee = zoekIdee(openIdeeId);
  if (!confirm('"' + (idee.titel || "Naamloos idee") + '" verwijderen?')) return;
  ideeen = ideeen.filter(ander => ander.id !== openIdeeId);
  openIdeeId = null;
  bewaarItems();
  toonIdeeen();
}

// ----- Bewerken (wordt automatisch opgeslagen) -----

function bewaarIdee() {
  const idee = zoekIdee(openIdeeId);
  if (!idee) return;
  idee.titel = document.getElementById("idee-titel").value;
  idee.categorie = document.getElementById("idee-categorie").value;
  idee.tekst = document.getElementById("idee-tekst").value;
  idee.bijgewerkt = Date.now();

  bewaarItems();
  // Alleen de lijst opnieuw tekenen, niet de editor (anders spring je uit het tekstvak)
  toonIdeeenLijst();
  document.getElementById("idee-opgeslagen").textContent = "✓ Opgeslagen om " + tijdTekst(new Date());
}

// Het tekstvak groeit mee met wat je typt
function pasTekstvakAan() {
  const vak = document.getElementById("idee-tekst");
  vak.style.height = "auto";
  vak.style.height = Math.max(vak.scrollHeight, 200) + "px";
}

// ----- Links naar video's -----

function soortLink(url) {
  if (/tiktok\.com/i.test(url)) return "🎵 TikTok";
  if (/instagram\.com/i.test(url)) return "📸 Instagram";
  if (/youtube\.com|youtu\.be/i.test(url)) return "▶️ YouTube";
  return "🔗 Link";
}

function toonLinks(idee) {
  const lijst = document.getElementById("idee-links");
  lijst.innerHTML = "";
  if (idee.links.length === 0) {
    lijst.innerHTML = '<p class="leeg">Nog geen video\'s of links.</p>';
    return;
  }

  idee.links.forEach((link, nummer) => {
    const li = document.createElement("li");
    li.className = "idee-link";

    const tekst = document.createElement("span");
    tekst.className = "tekst";
    const a = document.createElement("a");
    a.href = link.url;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.textContent = soortLink(link.url);
    tekst.appendChild(a);
    if (link.notitie) tekst.appendChild(document.createTextNode(" " + link.notitie));

    const adres = document.createElement("span");
    adres.className = "info link-adres";
    adres.textContent = link.url;
    tekst.appendChild(adres);
    li.appendChild(tekst);

    const kruisje = document.createElement("button");
    kruisje.className = "verwijder";
    kruisje.textContent = "✕";
    kruisje.title = "Link verwijderen";
    kruisje.onclick = () => {
      idee.links.splice(nummer, 1);
      idee.bijgewerkt = Date.now();
      bewaarItems();
      toonIdeeen();
    };
    li.appendChild(kruisje);
    lijst.appendChild(li);
  });
}

function voegLinkToe(event) {
  event.preventDefault();
  const idee = zoekIdee(openIdeeId);
  let url = document.getElementById("idee-link-url").value.trim();
  if (!url) return;
  if (!/^https?:\/\//i.test(url)) url = "https://" + url; // "tiktok.com/…" werkt dan ook

  idee.links.push({ url: url, notitie: document.getElementById("idee-link-notitie").value.trim() });
  idee.bijgewerkt = Date.now();
  bewaarItems();
  toonIdeeen();

  document.getElementById("idee-link-url").value = "";
  document.getElementById("idee-link-notitie").value = "";
}

// ----- Starten -----
document.getElementById("nieuw-idee").addEventListener("click", nieuwIdee);
document.getElementById("idee-sluiten").addEventListener("click", sluitIdee);
document.getElementById("idee-verwijder").addEventListener("click", verwijderIdee);
document.getElementById("idee-titel").addEventListener("input", bewaarIdee);
document.getElementById("idee-categorie").addEventListener("change", bewaarIdee);
document.getElementById("idee-tekst").addEventListener("input", () => {
  pasTekstvakAan();
  bewaarIdee();
});
document.getElementById("idee-link-formulier").addEventListener("submit", voegLinkToe);
document.querySelectorAll("[data-categorie]").forEach(knop =>
  knop.addEventListener("click", () => {
    ideeFilter = knop.dataset.categorie;
    toonIdeeen();
  }));
