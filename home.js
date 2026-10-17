// ===== HOME: HET DASHBOARD =====
// Links je rooster van de komende 7 dagen, rechts wat er vandaag en morgen af moet.

function toonHome() {
  const open = takenMetDatum();
  const teLaat = open.filter(item => groepVoor(item) === "te-laat" && !item.klaar);
  const vandaagLijst = open.filter(item => item.datum === vandaag());
  const morgenLijst = open.filter(item => item.datum === plusDagen(vandaag(), 1));

  toonDashLijst("dash-vandaag", teLaat.concat(vandaagLijst), "Niks meer voor vandaag 🎉", teLaat);
  toonDashLijst("dash-morgen", morgenLijst, "Niks voor morgen.");
  document.getElementById("dash-vandaag-titel").textContent = "Vandaag · " + mooieDatum(vandaag());
  document.getElementById("dash-morgen-titel").textContent = "Morgen · " + mooieDatum(plusDagen(vandaag(), 1));

  toonHomeRooster();
  const belangrijk = toonDashBelangrijk();
  toonOpties(alleItems(false)); // staat in app.js
  // Geen sport of andere opties vandaag? Dan het kaartje helemaal weglaten
  const opties = document.getElementById("lijst-optie");
  opties.closest(".kaart").classList.toggle("verborgen", !opties.querySelector("li"));

  toonSamenvatting({
    vandaag: vandaagLijst.filter(item => !item.klaar).length,
    teLaat: teLaat.length,
    morgen: morgenLijst.filter(item => !item.klaar).length
  }, belangrijk);
}

// Alle taken met een datum (herhalende taken: de keren in de komende 7 dagen)
function takenMetDatum() {
  const lijst = [];
  for (const item of items) {
    if (!["taak", "deadline", "huiswerk", "toets"].includes(item.soort) || !item.datum) continue;
    if (item.herhaal) {
      for (let i = 0; i < 7; i++) {
        const datum = plusDagen(vandaag(), i);
        if (valtOp(item, datum)) lijst.push(herhaling(item, datum));
      }
    } else {
      lijst.push(item);
    }
  }
  return lijst;
}

// Een lijstje met taken; wat te laat is krijgt een rood labeltje
function toonDashLijst(id, taken, leegTekst, teLaat = []) {
  const lijst = document.getElementById(id);
  lijst.innerHTML = "";
  taken.sort((a, b) => (a.klaar - b.klaar) || (a.datum || "").localeCompare(b.datum || ""));
  for (const item of taken) {
    const li = maakRegel(item);
    if (teLaat.includes(item)) {
      li.classList.add("is-te-laat");
      const label = document.createElement("span");
      label.className = "te-laat-label";
      label.textContent = "te laat";
      li.querySelector(".tekst").prepend(label);
    }
    lijst.appendChild(li);
  }
  if (taken.length === 0) lijst.innerHTML = '<p class="leeg">' + leegTekst + "</p>";
}

// Een groet die past bij het moment van de dag
function groet() {
  const uur = new Date().getHours();
  if (uur < 6) return "Goedenacht";
  if (uur < 12) return "Goedemorgen";
  if (uur < 18) return "Goedemiddag";
  return "Goedenavond";
}

function toonSamenvatting(aantallen, belangrijk) {
  const vak = document.getElementById("dash-samenvatting");
  vak.innerHTML = "";

  const titel = document.createElement("h2");
  titel.textContent = groet() + "! 👋";
  vak.appendChild(titel);

  const toetsen = komendeTentamens().filter(item => dagenTot(item.datum) <= 14).length; // staat in leerplan.js
  const blokjes = [
    { getal: aantallen.vandaag, tekst: "vandaag te doen", pagina: "todo" },
    { getal: aantallen.teLaat, tekst: "te laat", pagina: "todo", rood: true },
    { getal: aantallen.morgen, tekst: "morgen te doen", pagina: "todo" },
    { getal: belangrijk, tekst: "belangrijk zonder deadline", pagina: "todo" },
    { getal: toetsen, tekst: toetsen === 1 ? "toets in 2 weken" : "toetsen in 2 weken", pagina: "studie" }
  ];

  // Alleen laten zien wat van toepassing is (dus niet "0 te laat")
  const tonen = blokjes.filter(blokje => blokje.getal > 0);
  if (tonen.length === 0) return;

  const rij = document.createElement("div");
  rij.className = "teller-rij";
  for (const blokje of tonen) {
    const teller = document.createElement("button");
    teller.className = "teller" + (blokje.rood ? " rood" : "");
    teller.onclick = () => kiesPagina(blokje.pagina);
    teller.innerHTML = "<strong></strong><span></span>";
    teller.querySelector("strong").textContent = blokje.getal;
    teller.querySelector("span").textContent = blokje.tekst;
    rij.appendChild(teller);
  }
  vak.appendChild(rij);
}

// 📅 Het rooster van vandaag en de 6 dagen erna: school, Google Agenda en je eigen afspraken.
// Taken staan rechts in de to-do, dus die laten we hier weg (dat houdt het rooster rustig).
function toonHomeRooster() {
  const vak = document.getElementById("home-rooster");
  vak.innerHTML = "";
  const datums = [0, 1, 2, 3, 4, 5, 6].map(i => plusDagen(vandaag(), i));
  const agenda = alleItems(false).filter(item =>
    ["afspraak", "vrij", "optie"].includes(item.soort) || (item.soort === "toets" && item.begintijd));
  vak.appendChild(maakWeekRooster(datums, agenda)); // staat in weergaven.js
}

// Belangrijk zonder deadline: de taken met een vlammetje
function toonDashBelangrijk() {
  const lijst = document.getElementById("dash-belangrijk");
  lijst.innerHTML = "";

  const belangrijk = items.filter(item =>
    item.soort === "taak" && !item.datum && item.prioriteit === "hoog" && !item.klaar);

  for (const item of belangrijk.slice(0, 5)) lijst.appendChild(maakRegel(item));
  if (belangrijk.length > 5) lijst.insertAdjacentHTML("beforeend",
    '<p class="info">+' + (belangrijk.length - 5) + " meer in je To-do</p>");
  if (belangrijk.length === 0) {
    lijst.innerHTML = '<p class="leeg">Niks belangrijks zonder deadline. In je To-do maak je iets belangrijk met ☆.</p>';
  }
  return belangrijk.length;
}
