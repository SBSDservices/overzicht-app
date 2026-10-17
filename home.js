// ===== HOME: HET DASHBOARD =====
// In één oogopslag: wat moet er vandaag en morgen af, wat staat er vandaag in je agenda.

function toonHome() {
  const open = takenMetDatum();
  const teLaat = open.filter(item => groepVoor(item) === "te-laat" && !item.klaar);
  const vandaagLijst = open.filter(item => item.datum === vandaag());
  const morgenLijst = open.filter(item => item.datum === plusDagen(vandaag(), 1));

  toonDashLijst("dash-vandaag", teLaat.concat(vandaagLijst), "Niks meer voor vandaag 🎉", teLaat);
  toonDashLijst("dash-morgen", morgenLijst, "Niks voor morgen.");
  document.getElementById("dash-vandaag-titel").textContent = "Vandaag · " + mooieDatum(vandaag());
  document.getElementById("dash-morgen-titel").textContent = "Morgen · " + mooieDatum(plusDagen(vandaag(), 1));

  toonDashAgenda();
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

// Wat er vandaag in je agenda staat: lessen, afspraken, vakantie, toetsen
function toonDashAgenda() {
  const lijst = document.getElementById("dash-agenda");
  lijst.innerHTML = "";

  const vandaagItems = itemsOpDag(vandaag(), alleItems(false))
    .filter(item => item.soort === "afspraak" || item.soort === "vrij" || (item.soort === "toets" && item.bron === "google"));

  if (vandaagItems.length === 0) {
    lijst.innerHTML = '<p class="leeg">Niks in je agenda vandaag.</p>';
    return;
  }

  const nu = tijdTekst(new Date());
  let straksGemarkeerd = false;
  for (const afspraak of vandaagItems) {
    const li = maakRegelVoor(afspraak);
    if (heeftTijd(afspraak)) {
      const voorbij = (afspraak.eindtijd || afspraak.begintijd) <= nu;
      const bezig = afspraak.begintijd <= nu && !voorbij;
      if (voorbij) li.classList.add("voorbij");
      if (bezig) li.classList.add("nu-bezig");
      if (!voorbij && !bezig && !straksGemarkeerd) {
        li.classList.add("straks");
        straksGemarkeerd = true;
      }
    }
    lijst.appendChild(li);
  }
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
