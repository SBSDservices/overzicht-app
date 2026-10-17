// ===== HOME: JE HOOFDPAGINA =====
// Links je agenda van deze week (schoolrooster + Google Agenda), rechts je to-do.

function toonHome() {
  const todo = toonHomeTodo();
  const belangrijk = toonDashBelangrijk();
  toonOpties(alleItems(false)); // staat in app.js
  toonHomeRooster();
  toonSamenvatting(todo, belangrijk);
}

// Een groet die past bij het moment van de dag
function groet() {
  const uur = new Date().getHours();
  if (uur < 6) return "Goedenacht";
  if (uur < 12) return "Goedemorgen";
  if (uur < 18) return "Goedemiddag";
  return "Goedenavond";
}

function toonSamenvatting(todo, belangrijk) {
  const vak = document.getElementById("dash-samenvatting");
  vak.innerHTML = "";

  const titel = document.createElement("h2");
  titel.textContent = groet() + "! 👋";
  vak.appendChild(titel);

  const toetsen = komendeTentamens().filter(item => dagenTot(item.datum) <= 14).length; // staat in leerplan.js
  const blokjes = [
    { getal: todo.vandaag, tekst: "vandaag te doen", pagina: "todo" },
    { getal: todo.teLaat, tekst: "te laat", pagina: "todo" },
    { getal: belangrijk, tekst: "belangrijke taken", pagina: "taken" },
    { getal: toetsen, tekst: toetsen === 1 ? "toets in 2 weken" : "toetsen in 2 weken", pagina: "studie" }
  ];

  // Alleen laten zien wat van toepassing is (dus niet "0 te laat")
  const tonen = blokjes.filter(blokje => blokje.getal > 0);
  if (tonen.length === 0) return;

  const rij = document.createElement("div");
  rij.className = "teller-rij";
  for (const blokje of tonen) {
    const teller = document.createElement("button");
    teller.className = "teller";
    teller.onclick = () => kiesPagina(blokje.pagina);
    teller.innerHTML = "<strong></strong><span></span>";
    teller.querySelector("strong").textContent = blokje.getal;
    teller.querySelector("span").textContent = blokje.tekst;
    rij.appendChild(teller);
  }
  vak.appendChild(rij);
}

// 📅 Het rooster van vandaag en de 6 dagen erna, met alles erin (school, Google Agenda, je eigen afspraken)
function toonHomeRooster() {
  const vak = document.getElementById("home-rooster");
  vak.innerHTML = "";
  const datums = [0, 1, 2, 3, 4, 5, 6].map(i => plusDagen(vandaag(), i));
  vak.appendChild(maakWeekRooster(datums, alleItems(false))); // staat in weergaven.js
}

// ✅ Wat je moet doen: te laat, vandaag, morgen en de rest van de week
function toonHomeTodo() {
  const vak = document.getElementById("home-todo");
  vak.innerHTML = "";

  const open = [];
  for (const item of items) {
    if (!["taak", "deadline", "huiswerk", "toets"].includes(item.soort) || !item.datum) continue;
    if (item.herhaal) {
      for (let i = 0; i < 7; i++) {
        const datum = plusDagen(vandaag(), i);
        if (valtOp(item, datum)) open.push(herhaling(item, datum));
      }
    } else {
      open.push(item);
    }
  }

  const teLaat = open.filter(item => groepVoor(item) === "te-laat");
  if (teLaat.length) vak.appendChild(maakDagBlok("Te laat", teLaat, null)); // staat in app.js

  // Vandaag en morgen altijd, de dagen daarna alleen als er iets staat
  let aantalVandaag = 0;
  for (let i = 0; i < 7; i++) {
    const datum = plusDagen(vandaag(), i);
    const taken = open.filter(item => item.datum === datum && groepVoor(item));
    if (i === 0) aantalVandaag = taken.filter(item => !item.klaar).length;
    if (taken.length === 0 && i > 1) continue;
    vak.appendChild(maakDagBlok(dagKop(datum), taken, datum, true));
  }

  return { teLaat: teLaat.filter(item => !item.klaar).length, vandaag: aantalVandaag };
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
