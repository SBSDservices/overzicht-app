// ===== HOME: HET DASHBOARD =====
// Een overzicht van je dag: wat er vandaag is, wat je moet doen, wat belangrijk is.

function toonHome() {
  const alle = alleItems();
  const vandaagItems = itemsOpDag(vandaag(), alle);

  toonDashVandaag(vandaagItems);
  const todo = toonDashTodo();
  const belangrijk = toonDashBelangrijk();
  const binnenkort = toonDashBinnenkort();
  toonOpties(alle); // staat in app.js
  toonDashIdeeen();

  toonSamenvatting(todo, belangrijk, binnenkort);
}

// Een groet die past bij het moment van de dag
function groet() {
  const uur = new Date().getHours();
  if (uur < 6) return "Goedenacht";
  if (uur < 12) return "Goedemorgen";
  if (uur < 18) return "Goedemiddag";
  return "Goedenavond";
}

function toonSamenvatting(todo, belangrijk, binnenkort) {
  const vak = document.getElementById("dash-samenvatting");
  vak.innerHTML = "";

  const titel = document.createElement("h2");
  titel.textContent = groet() + "! 👋";
  vak.appendChild(titel);

  const blokjes = [
    { getal: todo.teLaat, tekst: "te laat", soort: todo.teLaat ? "rood" : "" },
    { getal: todo.vandaag, tekst: "vandaag te doen", soort: "" },
    { getal: belangrijk, tekst: "belangrijke taken", soort: belangrijk ? "oranje" : "" },
    { getal: binnenkort.toetsen, tekst: binnenkort.toetsen === 1 ? "toets binnenkort" : "toetsen binnenkort", soort: "" }
  ];

  const rij = document.createElement("div");
  rij.className = "teller-rij";
  for (const blokje of blokjes) {
    const teller = document.createElement("div");
    teller.className = "teller " + blokje.soort;
    teller.innerHTML = "<strong></strong><span></span>";
    teller.querySelector("strong").textContent = blokje.getal;
    teller.querySelector("span").textContent = blokje.tekst;
    rij.appendChild(teller);
  }
  vak.appendChild(rij);
}

// 📅 Vandaag: lessen, afspraken en toetsen van vandaag, met wat er nu/straks is
function toonDashVandaag(vandaagItems) {
  const lijst = document.getElementById("dash-vandaag");
  lijst.innerHTML = "";

  const afspraken = vandaagItems.filter(item =>
    item.soort === "afspraak" || item.soort === "toets" || item.soort === "vrij");

  if (afspraken.length === 0) {
    lijst.innerHTML = '<p class="leeg">Niks gepland vandaag.</p>';
    return;
  }

  const nu = tijdTekst(new Date());
  let strakGemarkeerd = false;
  const overlappen = zoekOverlap(afspraken);

  for (const afspraak of afspraken) {
    const li = maakRegelVoor(afspraak, overlappen.get(afspraak) || []);

    if (heeftTijd(afspraak)) {
      const voorbij = (afspraak.eindtijd || afspraak.begintijd) <= nu;
      const bezig = afspraak.begintijd <= nu && !voorbij;
      if (voorbij) li.classList.add("voorbij");
      if (bezig) li.classList.add("nu-bezig");
      // De eerstvolgende afspraak krijgt "straks"
      if (!voorbij && !bezig && !strakGemarkeerd) {
        li.classList.add("straks");
        strakGemarkeerd = true;
      }
    }
    lijst.appendChild(li);
  }
}

// ✅ Te doen: wat te laat is, en wat vandaag moet
function toonDashTodo() {
  const lijst = document.getElementById("dash-todo");
  lijst.innerHTML = "";

  const open = [];
  for (const item of items) {
    if (!["taak", "deadline", "huiswerk", "toets"].includes(item.soort) || !item.datum) continue;
    if (item.herhaal) {
      if (valtOp(item, vandaag())) open.push(herhaling(item, vandaag()));
    } else {
      open.push(item);
    }
  }

  const teLaat = open.filter(item => groepVoor(item) === "te-laat" && !item.klaar);
  const vandaagLijst = open.filter(item => groepVoor(item) === "vandaag");
  const morgen = open.filter(item => groepVoor(item) === "morgen" && !item.klaar);

  const tonen = teLaat.concat(vandaagLijst.sort((a, b) => a.klaar - b.klaar));
  for (const item of tonen) {
    const li = maakRegel(item);
    if (teLaat.includes(item)) li.classList.add("is-te-laat");
    lijst.appendChild(li);
  }

  if (tonen.length === 0) {
    lijst.innerHTML = '<p class="leeg">Niks voor vandaag 🎉' +
      (morgen.length ? " Morgen: " + morgen.length + " ding" + (morgen.length > 1 ? "en" : "") + "." : "") + "</p>";
  } else if (morgen.length) {
    const meer = document.createElement("p");
    meer.className = "info";
    meer.textContent = "Morgen: " + morgen.length + " ding" + (morgen.length > 1 ? "en" : "");
    lijst.appendChild(meer);
  }

  return { teLaat: teLaat.length, vandaag: vandaagLijst.filter(item => !item.klaar).length };
}

// 🔥 Belangrijk: de taken uit je takenlijst met een vlammetje
function toonDashBelangrijk() {
  const lijst = document.getElementById("dash-belangrijk");
  lijst.innerHTML = "";

  const belangrijk = items.filter(item =>
    item.soort === "taak" && !item.datum && item.prioriteit === "hoog" && !item.klaar);

  for (const item of belangrijk.slice(0, 5)) lijst.appendChild(maakRegel(item));
  if (belangrijk.length > 5) lijst.insertAdjacentHTML("beforeend",
    '<p class="info">+' + (belangrijk.length - 5) + " meer in je takenlijst</p>");
  if (belangrijk.length === 0) {
    lijst.innerHTML = '<p class="leeg">Geen belangrijke taken. Klik in je takenlijst op ☆ om iets belangrijk te maken.</p>';
  }
  return belangrijk.length;
}

// 📝 Toetsen en deadlines in de komende 2 weken
function toonDashBinnenkort() {
  const lijst = document.getElementById("dash-binnenkort");
  lijst.innerHTML = "";

  // Toetsen uit je agenda (ook Google) en je eigen deadlines
  const toetsen = komendeTentamens().filter(item => !item.klaar); // staat in leerplan.js
  const deadlines = items.filter(item => item.soort === "deadline" && item.datum && !item.klaar);
  const binnenkort = toetsen.concat(deadlines)
    .filter(item => dagenTot(item.datum) >= 0 && dagenTot(item.datum) <= 14)
    .sort((a, b) => a.datum.localeCompare(b.datum) || (a.begintijd || "").localeCompare(b.begintijd || ""));

  for (const item of binnenkort.slice(0, 6)) {
    if (item.bron === "google") {
      // Een toets uit Google: laat de dag erbij zien
      const li = maakRegelVoor(item);
      li.querySelector(".tijd").textContent = mooieDatum(item.datum) + (item.begintijd ? " " + item.begintijd : "");
      lijst.appendChild(li);
    } else {
      lijst.appendChild(maakRegel(item));
    }
  }
  if (binnenkort.length > 6) lijst.insertAdjacentHTML("beforeend",
    '<p class="info">+' + (binnenkort.length - 6) + " meer bij To-do</p>");
  if (binnenkort.length === 0) lijst.innerHTML = '<p class="leeg">Geen toetsen of deadlines in de komende 2 weken.</p>';

  return { toetsen: binnenkort.filter(item => isToets(item)).length };
}

// 💡 De 3 ideeën waar je het laatst aan hebt gewerkt
function toonDashIdeeen() {
  const lijst = document.getElementById("dash-ideeen");
  lijst.innerHTML = "";

  const laatste = [...ideeen].sort((a, b) => b.bijgewerkt - a.bijgewerkt).slice(0, 3);
  for (const idee of laatste) {
    const li = document.createElement("li");
    li.className = "idee-kaart";
    li.onclick = () => {
      kiesPagina("ideeen");
      openIdee(idee.id); // staat in ideeen.js
    };
    const titel = document.createElement("strong");
    titel.textContent = idee.titel || "Naamloos idee";
    const info = document.createElement("span");
    info.className = "info";
    info.textContent = CATEGORIEEN[idee.categorie] + (idee.links.length ? " · 🔗 " + idee.links.length : "");
    li.append(titel, info);
    lijst.appendChild(li);
  }
  if (laatste.length === 0) lijst.innerHTML = '<p class="leeg">Nog geen ideeën.</p>';
}
