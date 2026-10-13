// ===== 1. GEGEVENS =====
// Je eigen items. Elk item ziet er zo uit:
// { id, titel, soort, datum, begintijd, eindtijd, klaar }
let items = laadItems();

// Afspraken uit je Google Agenda (worden ingevuld door google.js)
let googleAfspraken = [];

// Hoeveel dagen aan afspraken je wilt zien
let periode = laadInstelling("periode", "2");

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

// Hoeveel dagen is het nog tot een datum? (negatief = voorbij)
function dagenTot(datum) {
  return Math.round((new Date(datum) - new Date(vandaag())) / 86400000);
}

// Maak van "2026-10-09" iets leesbaars als "vr 9 okt"
function mooieDatum(datum) {
  return new Date(datum).toLocaleDateString("nl-NL", { weekday: "short", day: "numeric", month: "short" });
}

// Het kopje boven een dag: "Vandaag · di 13 okt"
function dagKop(datum) {
  const dagen = dagenTot(datum);
  if (dagen === 0) return "Vandaag · " + mooieDatum(datum);
  if (dagen === 1) return "Morgen · " + mooieDatum(datum);
  return mooieDatum(datum);
}

// ===== 3. TONEN OP HET SCHERM =====
function toonAlles() {
  toonAfspraken();
  toonLijst("deadline");
  toonLijst("taak");
}

function toonAfspraken() {
  const lijst = document.getElementById("lijst-afspraak");
  lijst.innerHTML = "";

  // Je eigen afspraken + die uit Google, alleen binnen de gekozen periode
  const afspraken = items
    .filter(item => item.soort === "afspraak")
    .concat(googleAfspraken)
    .filter(item => {
      const dagen = dagenTot(item.datum);
      return dagen >= 0 && dagen < Number(periode);
    });

  // Sorteren op datum, dan "hele dag" bovenaan, dan op begintijd
  afspraken.sort((a, b) =>
    a.datum.localeCompare(b.datum) ||
    (a.heleDag ? "" : a.begintijd || "").localeCompare(b.heleDag ? "" : b.begintijd || "")
  );

  if (afspraken.length === 0) {
    lijst.innerHTML = '<p class="leeg">Geen afspraken in deze periode.</p>';
    return;
  }

  const overlappen = zoekOverlap(afspraken);

  // Per dag een kopje, met daaronder de afspraken van die dag
  let huidigeDag = null;
  for (const afspraak of afspraken) {
    if (afspraak.datum !== huidigeDag) {
      huidigeDag = afspraak.datum;
      const kop = document.createElement("li");
      kop.className = "dag-kop";
      kop.textContent = dagKop(huidigeDag);
      lijst.appendChild(kop);
    }
    lijst.appendChild(maakAfspraakRegel(afspraak, overlappen.get(afspraak) || []));
  }
}

// Zoek afspraken die tegelijk zijn. Geeft per afspraak de titels terug
// van de afspraken waarmee hij overlapt.
function zoekOverlap(afspraken) {
  const overlappen = new Map();
  const metTijd = afspraken.filter(a => !a.heleDag && a.begintijd && a.eindtijd);

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
  if (afspraak.bron !== "google") {
    li.appendChild(maakVerwijderKnop(afspraak.id));
  }

  return li;
}

function toonLijst(soort) {
  const lijst = document.getElementById("lijst-" + soort);
  lijst.innerHTML = "";

  const gekozen = items.filter(item => item.soort === soort);

  // Sorteren: eerst niet-klaar, daarna op datum
  gekozen.sort((a, b) =>
    (a.klaar - b.klaar) ||
    (a.datum || "9999").localeCompare(b.datum || "9999")
  );

  if (gekozen.length === 0) {
    lijst.innerHTML = '<p class="leeg">Nog niks hier.</p>';
    return;
  }

  for (const item of gekozen) {
    lijst.appendChild(maakRegel(item));
  }
}

// Maak één regel (li) voor een taak of deadline
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
  tekst.textContent = item.titel + " ";
  if (item.soort === "deadline") tekst.appendChild(maakDeadlineInfo(item));
  li.appendChild(tekst);

  li.appendChild(maakVerwijderKnop(item.id));
  return li;
}

// Het grijze stukje achter een deadline, zoals "· vr 9 okt · nog 2 dagen"
function maakDeadlineInfo(item) {
  const info = document.createElement("span");
  info.className = "info";

  const dagen = dagenTot(item.datum);
  let wanneer;
  if (dagen < 0) wanneer = "te laat!";
  else if (dagen === 0) wanneer = "vandaag!";
  else if (dagen === 1) wanneer = "morgen";
  else wanneer = "nog " + dagen + " dagen";

  info.textContent = "· " + mooieDatum(item.datum) + " · " + wanneer;
  if (dagen <= 2 && !item.klaar) info.classList.add("dringend");
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

// ===== 4. ACTIES =====
function voegToe(event) {
  event.preventDefault(); // zorgt dat de pagina niet herlaadt

  const soort = document.getElementById("soort").value;
  const datum = document.getElementById("datum").value;

  if (soort !== "taak" && !datum) {
    alert("Vul een datum in.");
    return;
  }

  items.push({
    id: Date.now(),
    titel: document.getElementById("titel").value.trim(),
    soort: soort,
    datum: soort === "taak" ? "" : datum,
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
  document.getElementById("datum").classList.toggle("verborgen", soort === "taak");
  document.getElementById("begintijd").classList.toggle("verborgen", soort !== "afspraak");
  document.getElementById("eindtijd").classList.toggle("verborgen", soort !== "afspraak");
}

function kiesPeriode() {
  periode = document.getElementById("periode").value;
  bewaarInstelling("periode", periode);
  toonAfspraken();
}

// ===== 5. STARTEN =====
document.getElementById("formulier").addEventListener("submit", voegToe);
document.getElementById("soort").addEventListener("change", pasVeldenAan);
document.getElementById("periode").addEventListener("change", kiesPeriode);
document.getElementById("periode").value = periode;
document.getElementById("datum-vandaag").textContent =
  new Date().toLocaleDateString("nl-NL", { weekday: "long", day: "numeric", month: "long" });

toonAlles();
