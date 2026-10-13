// ===== 1. GEGEVENS =====
// Je eigen items. Elk item ziet er zo uit:
// { id, titel, soort, datum, einddatum, begintijd, eindtijd, klaar }
// soort is: "taak", "deadline", "afspraak", "doel" of "vrij"
let items = laadItems();

// Afspraken uit je Google Agenda (worden ingevuld door google.js)
let googleAfspraken = [];

// Wat je aan het bekijken bent
let weergave = laadInstelling("weergave", "dag");    // dag, week, maand of jaar
let stijl = laadInstelling("stijl", "rooster");      // rooster of lijst
let periode = laadInstelling("periode", "2");        // aantal dagen in "Vandaag"
let focusDatum = vandaag();                          // welke week/maand/jaar
let zoekterm = "";

const ICOON = { afspraak: "📅", deadline: "⏰", taak: "✅", doel: "🎯", vrij: "🌴" };

// Haal de items op uit het geheugen van de browser
function laadItems() {
  try {
    return JSON.parse(localStorage.getItem("items")) || [];
  } catch {
    return [];
  }
}

// Sla de items op, zodat ze er na het sluiten nog zijn
function bewaarItems() {
  try {
    localStorage.setItem("items", JSON.stringify(items));
  } catch {
    console.warn("Opslaan lukt niet in deze browser");
  }
  bewaarOpDrive(); // staat in google.js
}

function laadInstelling(naam, standaard) {
  try {
    return localStorage.getItem(naam) ?? standaard;
  } catch {
    return standaard;
  }
}

function bewaarInstelling(naam, waarde) {
  try {
    localStorage.setItem(naam, waarde);
  } catch {}
}

// ===== 2. DATUMS =====
// Een datum als tekst, zoals "2026-10-13" (in jouw tijdzone)
function datumTekst(moment) {
  const kopie = new Date(moment);
  kopie.setMinutes(kopie.getMinutes() - kopie.getTimezoneOffset());
  return kopie.toISOString().slice(0, 10);
}

function vandaag() {
  return datumTekst(new Date());
}

// Een tijd als tekst, zoals "08:30"
function tijdTekst(moment) {
  return moment.toTimeString().slice(0, 5);
}

// "08:30" → 510 (minuten sinds middernacht)
function minuten(tijd) {
  const [uur, minuut] = tijd.split(":").map(Number);
  return uur * 60 + minuut;
}

// Hoeveel dagen is het nog tot een datum? (negatief = voorbij)
function dagenTot(datum) {
  return Math.round((new Date(datum) - new Date(vandaag())) / 86400000);
}

function plusDagen(datum, aantal) {
  const dag = new Date(datum);
  dag.setDate(dag.getDate() + aantal);
  return datumTekst(dag);
}

function plusMaanden(datum, aantal) {
  const dag = new Date(datum.slice(0, 8) + "01");
  dag.setMonth(dag.getMonth() + aantal);
  return datumTekst(dag);
}

// De maandag van de week waarin een datum valt
function startVanWeek(datum) {
  const dagVanWeek = (new Date(datum).getDay() + 6) % 7; // maandag = 0
  return plusDagen(datum, -dagVanWeek);
}

function startVanMaand(datum) {
  return datum.slice(0, 8) + "01";
}

// Maak van "2026-10-09" iets leesbaars als "vr 9 okt"
function mooieDatum(datum) {
  return new Date(datum).toLocaleDateString("nl-NL", { weekday: "short", day: "numeric", month: "short" });
}

function maandNaam(datum) {
  return new Date(datum).toLocaleDateString("nl-NL", { month: "long", year: "numeric" });
}

// Het kopje boven een dag: "Vandaag · di 13 okt"
function dagKop(datum) {
  const dagen = dagenTot(datum);
  if (dagen === 0) return "Vandaag · " + mooieDatum(datum);
  if (dagen === 1) return "Morgen · " + mooieDatum(datum);
  return mooieDatum(datum);
}

// ===== 3. ITEMS KIEZEN EN SORTEREN =====
// Al je items samen (eigen + Google), alleen die passen bij je zoekterm
function alleItems() {
  return items.concat(googleAfspraken).filter(pastBijZoeken);
}

function pastBijZoeken(item) {
  if (!zoekterm) return true;
  const tekst = [item.titel, item.locatie, item.agendaNaam].join(" ").toLowerCase();
  return tekst.includes(zoekterm);
}

// Alles wat op een bepaalde dag valt (ook vakanties van meerdere dagen)
function itemsOpDag(datum, lijst) {
  return lijst
    .filter(item => item.datum && item.datum <= datum && datum <= (item.einddatum || item.datum))
    .sort(volgorde);
}

// Volgorde op een dag: vrij → hele dag → doelen → deadlines → afspraken op tijd
const RANG = { vrij: 0, doel: 2, deadline: 3, afspraak: 4 };
function volgorde(a, b) {
  const rangA = a.heleDag ? 1 : RANG[a.soort];
  const rangB = b.heleDag ? 1 : RANG[b.soort];
  return (rangA - rangB) || (a.begintijd || "").localeCompare(b.begintijd || "");
}

// Is dit een toets? (we kijken naar woorden in de titel)
function isToets(item) {
  return /toets|tentamen|proefwerk|examen|\bso\b|\bpw\b|\bse\b/i.test(item.titel);
}

// Is dit een vrije dag of vakantie? (zelf ingevuld, of herkend aan de titel)
function isVrij(item) {
  return item.soort === "vrij" || /vakantie|vrije dag|studiedag/i.test(item.titel);
}

// Zoek afspraken die tegelijk zijn. Geeft per afspraak de titels terug
// van de afspraken waarmee hij overlapt.
function zoekOverlap(afspraken) {
  const overlappen = new Map();
  const metTijd = afspraken.filter(a => a.soort === "afspraak" && !a.heleDag && a.begintijd && a.eindtijd);

  for (let i = 0; i < metTijd.length; i++) {
    for (let j = i + 1; j < metTijd.length; j++) {
      const a = metTijd[i];
      const b = metTijd[j];
      const tegelijk = a.datum === b.datum && a.begintijd < b.eindtijd && b.begintijd < a.eindtijd;
      if (tegelijk) {
        if (!overlappen.has(a)) overlappen.set(a, []);
        if (!overlappen.has(b)) overlappen.set(b, []);
        overlappen.get(a).push(b.titel);
        overlappen.get(b).push(a.titel);
      }
    }
  }
  return overlappen;
}

// ===== 4. REGELS MAKEN (één item op het scherm) =====
function maakRegelVoor(item, overlaptMet = []) {
  if (item.soort === "afspraak") return maakAfspraakRegel(item, overlaptMet);
  if (item.soort === "vrij") return maakVrijRegel(item);
  return maakRegel(item);
}

function maakAfspraakRegel(afspraak, overlaptMet) {
  const li = document.createElement("li");
  li.className = "afspraak" + (overlaptMet.length ? " heeft-overlap" : "");

  // Afspraken uit Google krijgen de kleur van hun agenda (bijv. Magister)
  if (afspraak.kleur) li.style.borderLeftColor = afspraak.kleur;
  if (afspraak.agendaNaam) li.title = "Uit agenda: " + afspraak.agendaNaam;

  const tijd = document.createElement("span");
  tijd.className = "tijd";
  if (afspraak.heleDag) tijd.textContent = "hele dag";
  else tijd.textContent = afspraak.begintijd + (afspraak.eindtijd ? "–" + afspraak.eindtijd : "");
  li.appendChild(tijd);

  const tekst = document.createElement("span");
  tekst.className = "tekst";
  tekst.textContent = afspraak.titel + " ";

  if (afspraak.locatie) {
    const info = document.createElement("span");
    info.className = "info";
    info.textContent = "· " + afspraak.locatie;
    tekst.appendChild(info);
  }

  if (overlaptMet.length) {
    const waarschuwing = document.createElement("span");
    waarschuwing.className = "overlap";
    waarschuwing.textContent = "⚠️ Tegelijk met: " + overlaptMet.join(", ");
    tekst.appendChild(waarschuwing);
  }
  li.appendChild(tekst);

  // Alleen je eigen afspraken kun je hier verwijderen, die uit Google niet
  if (afspraak.bron !== "google") li.appendChild(maakVerwijderKnop(afspraak.id));
  return li;
}

function maakVrijRegel(item) {
  const li = document.createElement("li");
  li.className = "vrij";

  const tijd = document.createElement("span");
  tijd.className = "tijd";
  tijd.textContent = "🌴 vrij";
  li.appendChild(tijd);

  const tekst = document.createElement("span");
  tekst.className = "tekst";
  tekst.textContent = item.titel + " ";
  if (item.einddatum && item.einddatum !== item.datum) {
    const info = document.createElement("span");
    info.className = "info";
    info.textContent = "· " + mooieDatum(item.datum) + " t/m " + mooieDatum(item.einddatum);
    tekst.appendChild(info);
  }
  li.appendChild(tekst);

  if (item.bron !== "google") li.appendChild(maakVerwijderKnop(item.id));
  return li;
}

// Een taak, deadline of doel (met vinkje)
function maakRegel(item) {
  const li = document.createElement("li");
  li.className = item.soort + (item.klaar ? " klaar" : "");

  const vinkje = document.createElement("input");
  vinkje.type = "checkbox";
  vinkje.checked = item.klaar;
  vinkje.onchange = () => vinkAf(item.id);
  li.appendChild(vinkje);

  const tekst = document.createElement("span");
  tekst.className = "tekst";
  tekst.textContent = (item.soort === "taak" ? "" : ICOON[item.soort] + " ") + item.titel + " ";
  if (item.datum) tekst.appendChild(maakDatumInfo(item));
  li.appendChild(tekst);

  li.appendChild(maakVerwijderKnop(item.id));
  return li;
}

// Het grijze stukje achter een deadline of doel, zoals "· vr 9 okt · nog 2 dagen"
function maakDatumInfo(item) {
  const info = document.createElement("span");
  info.className = "info";

  const dagen = dagenTot(item.datum);
  let wanneer;
  if (dagen < 0) wanneer = item.soort === "deadline" ? "te laat!" : "voorbij";
  else if (dagen === 0) wanneer = "vandaag!";
  else if (dagen === 1) wanneer = "morgen";
  else wanneer = "nog " + dagen + " dagen";

  info.textContent = "· " + mooieDatum(item.datum) + " · " + wanneer;
  if (item.soort === "deadline" && dagen <= 2 && !item.klaar) info.classList.add("dringend");
  return info;
}

function maakVerwijderKnop(id) {
  const kruisje = document.createElement("button");
  kruisje.className = "verwijder";
  kruisje.textContent = "✕";
  kruisje.title = "Verwijderen";
  kruisje.onclick = () => verwijder(id);
  return kruisje;
}

// Een lijst met per dag een kopje (gebruikt door Vandaag, Week en Maand)
function vulDagenLijst(lijst, datums, alle, { welkeSoorten = null, legeDagenTonen = false } = {}) {
  let ietsGetoond = false;

  for (const datum of datums) {
    let dagItems = itemsOpDag(datum, alle);
    if (welkeSoorten) dagItems = dagItems.filter(item => welkeSoorten.includes(item.soort));
    if (dagItems.length === 0 && !legeDagenTonen) continue;

    const kop = document.createElement("li");
    kop.className = "dag-kop" + (datum === vandaag() ? " is-vandaag" : "");
    kop.textContent = dagKop(datum);
    lijst.appendChild(kop);

    if (dagItems.length === 0) {
      const leeg = document.createElement("li");
      leeg.className = "leeg-dag";
      leeg.textContent = "Niks gepland";
      lijst.appendChild(leeg);
    }

    const overlappen = zoekOverlap(dagItems);
    for (const item of dagItems) lijst.appendChild(maakRegelVoor(item, overlappen.get(item) || []));
    ietsGetoond = true;
  }

  if (!ietsGetoond && !legeDagenTonen) {
    lijst.innerHTML = '<p class="leeg">Niks gepland in deze periode.</p>';
  }
}

// ===== 5. WEERGAVE "VANDAAG" =====
function toonDag() {
  const alle = alleItems();

  // Afspraken en vrije dagen van vandaag (en de komende dagen)
  const lijst = document.getElementById("lijst-afspraak");
  lijst.innerHTML = "";
  const datums = [];
  for (let i = 0; i < Number(periode); i++) datums.push(plusDagen(vandaag(), i));
  vulDagenLijst(lijst, datums, alle, { welkeSoorten: ["afspraak", "vrij"] });

  toonLijst("deadline", alle);
  toonLijst("doel", alle);
  toonLijst("taak", alle);
}

function toonLijst(soort, alle) {
  const lijst = document.getElementById("lijst-" + soort);
  lijst.innerHTML = "";

  const gekozen = alle.filter(item => item.soort === soort);

  // Sorteren: eerst niet-klaar, daarna op datum
  gekozen.sort((a, b) =>
    (a.klaar - b.klaar) ||
    (a.datum || "9999").localeCompare(b.datum || "9999")
  );

  if (gekozen.length === 0) {
    lijst.innerHTML = '<p class="leeg">Nog niks hier.</p>';
    return;
  }

  for (const item of gekozen) lijst.appendChild(maakRegel(item));
}

// ===== 6. WISSELEN TUSSEN WEERGAVEN =====
// Wordt na elke wijziging aangeroepen: tekent de gekozen weergave opnieuw
function toonAlles() {
  // Knoppen bovenin goed zetten
  document.querySelectorAll("[data-weergave]").forEach(knop =>
    knop.classList.toggle("actief", knop.dataset.weergave === weergave));
  document.querySelectorAll("[data-stijl]").forEach(knop =>
    knop.classList.toggle("actief", knop.dataset.stijl === stijl));

  document.getElementById("navigatie").classList.toggle("verborgen", weergave === "dag");
  document.getElementById("stijl-knoppen").classList.toggle("verborgen", weergave === "dag" || weergave === "jaar");
  document.getElementById("weergave-dag").classList.toggle("verborgen", weergave !== "dag");
  document.getElementById("weergave-overig").classList.toggle("verborgen", weergave === "dag");

  if (weergave === "dag") toonDag();
  if (weergave === "week") toonWeek();   // staat in weergaven.js
  if (weergave === "maand") toonMaand(); // staat in weergaven.js
  if (weergave === "jaar") toonJaar();   // staat in weergaven.js
}

function kiesWeergave(nieuw) {
  weergave = nieuw;
  bewaarInstelling("weergave", weergave);
  toonAlles();
}

function kiesStijl(nieuw) {
  stijl = nieuw;
  bewaarInstelling("stijl", stijl);
  toonAlles();
}

// Een stap terug (-1) of vooruit (+1) in de tijd
function blader(richting) {
  if (weergave === "week") focusDatum = plusDagen(focusDatum, 7 * richting);
  if (weergave === "maand") focusDatum = plusMaanden(focusDatum, richting);
  if (weergave === "jaar") focusDatum = plusMaanden(focusDatum, 12 * richting);
  toonAlles();
}

function naarVandaag() {
  focusDatum = vandaag();
  toonAlles();
}

// Spring naar de week van een bepaalde dag (als je in de maand op een dag klikt)
function openWeek(datum) {
  focusDatum = datum;
  kiesWeergave("week");
}

function openMaand(datum) {
  focusDatum = datum;
  kiesWeergave("maand");
}

// ===== 7. ACTIES =====
function voegToe(event) {
  event.preventDefault(); // zorgt dat de pagina niet herlaadt

  const soort = document.getElementById("soort").value;
  const datum = document.getElementById("datum").value;
  let einddatum = document.getElementById("einddatum").value;

  if (soort !== "taak" && !datum) {
    alert("Vul een datum in.");
    return;
  }
  if (soort === "vrij" && (!einddatum || einddatum < datum)) einddatum = datum;

  items.push({
    id: Date.now(),
    titel: document.getElementById("titel").value.trim(),
    soort: soort,
    datum: soort === "taak" ? "" : datum,
    einddatum: soort === "vrij" ? einddatum : "",
    begintijd: soort === "afspraak" ? document.getElementById("begintijd").value : "",
    eindtijd: soort === "afspraak" ? document.getElementById("eindtijd").value : "",
    klaar: false
  });

  bewaarItems();
  toonAlles();

  // Formulier leegmaken voor het volgende item
  document.getElementById("titel").value = "";
  document.getElementById("titel").focus();
}

function vinkAf(id) {
  const item = items.find(item => item.id === id);
  item.klaar = !item.klaar;
  bewaarItems();
  toonAlles();
}

function verwijder(id) {
  items = items.filter(item => item.id !== id);
  bewaarItems();
  toonAlles();
}

// Laat alleen de velden zien die bij de gekozen soort horen
function pasVeldenAan() {
  const soort = document.getElementById("soort").value;
  const labels = { deadline: "Inleveren op", afspraak: "Datum", doel: "Wil ik halen op", vrij: "Van" };

  document.getElementById("veld-datum").classList.toggle("verborgen", soort === "taak");
  document.getElementById("datum-label").textContent = labels[soort] || "";
  document.getElementById("veld-einddatum").classList.toggle("verborgen", soort !== "vrij");
  document.getElementById("veld-tijd").classList.toggle("verborgen", soort !== "afspraak");
}

function kiesPeriode() {
  periode = document.getElementById("periode").value;
  bewaarInstelling("periode", periode);
  toonAlles();
}

function zoek() {
  zoekterm = document.getElementById("zoek").value.trim().toLowerCase();
  toonAlles();
}

// ===== 8. STARTEN =====
document.getElementById("formulier").addEventListener("submit", voegToe);
document.getElementById("soort").addEventListener("change", pasVeldenAan);
document.getElementById("periode").addEventListener("change", kiesPeriode);
document.getElementById("periode").value = periode;
document.getElementById("zoek").addEventListener("input", zoek);
document.getElementById("vorige").addEventListener("click", () => blader(-1));
document.getElementById("volgende").addEventListener("click", () => blader(1));
document.getElementById("naar-vandaag").addEventListener("click", naarVandaag);
document.querySelectorAll("[data-weergave]").forEach(knop =>
  knop.addEventListener("click", () => kiesWeergave(knop.dataset.weergave)));
document.querySelectorAll("[data-stijl]").forEach(knop =>
  knop.addEventListener("click", () => kiesStijl(knop.dataset.stijl)));
document.getElementById("datum-vandaag").textContent =
  new Date().toLocaleDateString("nl-NL", { weekday: "long", day: "numeric", month: "long" });

toonAlles();
