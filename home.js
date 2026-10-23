// ===== HOME: HET DASHBOARD =====
// Links je agenda (dag, week, maand of jaar), rechts wat je moet doen.

// Wat je op Home bekijkt (los van de pagina Agenda)
let homeWeergave = null; // "dag", "week", "maand" of "jaar"
let homeFocus = null;    // welke dag/week/maand

function toonHome() {
  if (!homeWeergave) homeWeergave = laadInstelling("homeWeergave", "week");
  if (!homeFocus) homeFocus = vandaag();

  const open = takenMetDatum();
  const teLaat = open.filter(item => groepVoor(item) === "te-laat" && !item.klaar);
  const vandaagLijst = open.filter(item => item.datum === vandaag());
  const morgenLijst = open.filter(item => item.datum === plusDagen(vandaag(), 1));

  // Kaarten zonder iets erin laten we weg
  const vandaagTaken = teLaat.concat(vandaagLijst);
  toonDashLijst("dash-vandaag", vandaagTaken, teLaat);
  toonDashLijst("dash-morgen", morgenLijst);
  document.getElementById("kaart-vandaag").classList.toggle("verborgen", vandaagTaken.length === 0);
  document.getElementById("kaart-morgen").classList.toggle("verborgen", morgenLijst.length === 0);
  document.getElementById("dash-vandaag-titel").textContent = "Vandaag · " + mooieDatum(vandaag());
  document.getElementById("dash-morgen-titel").textContent = "Morgen · " + mooieDatum(plusDagen(vandaag(), 1));

  // Alles zonder deadline (zelfde lijst als in de To-do)
  const geenDeadline = toonTakenlijst("dash-geen-deadline", { alleenZonderDatum: true }); // staat in app.js
  document.getElementById("kaart-geen-deadline").classList.toggle("verborgen", geenDeadline === 0);

  toonOpties(alleItems(false)); // staat in app.js
  const opties = document.getElementById("lijst-optie");
  opties.closest(".kaart").classList.toggle("verborgen", !opties.querySelector("li"));

  // Helemaal niks te doen? Dan een vrolijk berichtje
  document.getElementById("kaart-alles-af").classList.toggle("verborgen",
    vandaagTaken.length + morgenLijst.length + geenDeadline > 0);

  toonHomeAgenda();

  const belangrijk = items.filter(item =>
    item.soort === "taak" && !item.datum && item.prioriteit === "hoog" && !item.klaar).length;
  toonSamenvatting({
    vandaag: vandaagLijst.filter(item => !item.klaar).length,
    teLaat: teLaat.length,
    morgen: morgenLijst.filter(item => !item.klaar).length
  }, belangrijk);
}

// De agenda op Home: dag, week, maand of jaar, met je filter
function toonHomeAgenda() {
  document.querySelectorAll("[data-home-weergave]").forEach(knop =>
    knop.classList.toggle("actief", knop.dataset.homeWeergave === homeWeergave));
  maakAgendaFilter(document.getElementById("home-filter")); // staat in app.js

  tekenAgenda({ // staat in weergaven.js
    vak: document.getElementById("home-rooster"),
    titel: document.getElementById("home-periode"),
    weergave: homeWeergave,
    focus: homeFocus,
    stijl: "rooster",
    items: alleItems(false).filter(zichtbaarInAgenda),
    openDag: datum => kiesHomeWeergave("dag", datum),
    openWeek: datum => kiesHomeWeergave("week", datum),
    openMaand: datum => kiesHomeWeergave("maand", datum)
  });
}

function kiesHomeWeergave(nieuw, datum) {
  homeWeergave = nieuw;
  if (datum) homeFocus = datum;
  bewaarInstelling("homeWeergave", nieuw);
  toonAlles();
}

// ‹ en ›: een dag, week, maand of jaar terug of verder
function bladerHome(richting) {
  if (homeWeergave === "dag") homeFocus = plusDagen(homeFocus, richting);
  if (homeWeergave === "week") homeFocus = plusDagen(homeFocus, 7 * richting);
  if (homeWeergave === "maand") homeFocus = plusMaanden(homeFocus, richting);
  if (homeWeergave === "jaar") homeFocus = plusMaanden(homeFocus, 12 * richting);
  toonAlles();
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
function toonDashLijst(id, taken, teLaat = []) {
  const lijst = document.getElementById(id);
  lijst.innerHTML = "";
  taken.sort((a, b) => (a.klaar - b.klaar) || (a.datum || "").localeCompare(b.datum || "") || opVolgorde(a, b));
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

// ----- Starten -----
document.querySelectorAll("[data-home-weergave]").forEach(knop =>
  knop.addEventListener("click", () => kiesHomeWeergave(knop.dataset.homeWeergave)));
document.getElementById("home-vorige").addEventListener("click", () => bladerHome(-1));
document.getElementById("home-volgende").addEventListener("click", () => bladerHome(1));
document.getElementById("home-vandaag").addEventListener("click", () => {
  homeFocus = vandaag();
  toonAlles();
});
