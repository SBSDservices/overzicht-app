// ===== 1. GEGEVENS =====
// Je eigen items. Elk item ziet er zo uit:
// { id, titel, soort, datum, einddatum, begintijd, eindtijd, lesId, klaar }
// soort is: "taak", "deadline", "afspraak", "doel", "vrij", "toets" of "huiswerk"
// lesId: bij welke les uit je rooster het hoort (bij toetsen en huiswerk)
let items = laadJson("items", []);

// De naam die je zelf aan een les geeft, zoals in Magister:
// { "id-van-de-les": "1H-BMA-BAS-T" }
// (vroeger heette dit "lesVakken"; dat nemen we over als het er nog is)
let lesNamen = { ...laadJson("lesVakken", {}), ...laadJson("lesNamen", {}) };

// Je ideeën (zie ideeen.js). Elk idee:
// { id, titel, categorie, tekst, links: [{ url, notitie }], aangemaakt, bijgewerkt }
let ideeen = laadJson("ideeen", []);

// Je leerplannen voor tentamens (zie leerplan.js). Elk plan:
// { id, vak, tentamenDatum, onderdelen, actie, start, herhaalAantal, overslaan, verdeling, bijgewerkt }
let leerplannen = laadJson("leerplannen", []);

// Afspraken uit je Google Agenda (worden ingevuld door google.js)
let googleAfspraken = [];

// Wat je aan het bekijken bent
const PAGINAS = { home: "Home", todo: "To-do", taken: "Takenlijst", studie: "Studie", agenda: "Agenda", ideeen: "Ideeën" };
let pagina = PAGINAS[location.hash.slice(1)] ? location.hash.slice(1) : "home"; // bijv. #agenda
let weergave = laadInstelling("weergave", "week");   // in de agenda: week, maand of jaar
if (!["week", "maand", "jaar"].includes(weergave)) weergave = "week";
let stijl = laadInstelling("stijl", "rooster");      // rooster of lijst
let focusDatum = vandaag();                          // welke week/maand/jaar
let zoekterm = "";

const ICOON = { afspraak: "📅", deadline: "⏰", taak: "✅", doel: "🎯", vrij: "🌴", toets: "📝", huiswerk: "📖", optie: "💪" };
const DAGNAMEN = ["zo", "ma", "di", "wo", "do", "vr", "za"];

// Haal iets op uit het geheugen van de browser
function laadJson(naam, standaard) {
  try {
    return JSON.parse(localStorage.getItem(naam)) || standaard;
  } catch {
    return standaard;
  }
}

// Sla alles op in de browser, zodat het er na het sluiten nog is
function bewaarLokaal() {
  try {
    localStorage.setItem("items", JSON.stringify(items));
    localStorage.setItem("lesNamen", JSON.stringify(lesNamen));
    localStorage.setItem("ideeen", JSON.stringify(ideeen));
    localStorage.setItem("leerplannen", JSON.stringify(leerplannen));
  } catch {
    console.warn("Opslaan lukt niet in deze browser");
  }
}

// Opslaan in de browser én in je Google Drive
function bewaarItems() {
  bewaarLokaal();
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
function alleItems(metZoeken = true) {
  const lesIds = new Set(googleAfspraken.map(les => les.id));

  const eigen = items
    // Een tentamen dat aan een les vastzit, laten we zien ÓP die les (niet nog eens apart)
    .filter(item => !(item.soort === "toets" && lesIds.has(item.lesId)))
    // Huiswerk dat bij een les hoort, krijgt een merkje (dan zetten we het niet dubbel in het rooster)
    .map(item => item.lesId && lesIds.has(item.lesId) ? { ...item, bijLes: true } : item);

  const alles = eigen.concat(googleAfspraken.map(verrijkLes));
  return metZoeken ? alles.filter(pastBijZoeken) : alles;
}

// Voeg aan een les uit Google toe wat jij erbij hebt gezet: naam, tentamen, huiswerk
function verrijkLes(les) {
  const naam = lesNamen[les.id] || "";
  const tentamen = items.some(item => item.soort === "toets" && item.lesId === les.id);
  const huiswerk = items.filter(item => item.soort === "huiswerk" && item.lesId === les.id);

  if (!naam && !tentamen && !huiswerk.length) return les;

  return {
    ...les,
    origineel: les.titel,                       // zoals Google het noemt ("6-7 enge, brus")
    titel: naam || (tentamen ? "Tentamen" : les.titel), // zoals jij het noemt ("1H-BMA-BAS-T")
    tentamen: tentamen,
    huiswerk: huiswerk
  };
}

// Een naam zoals in Magister die eindigt op "-T" is een tentamen (bijv. 1H-BMA-BAS-T)
function isTentamenNaam(naam) {
  return /-T\b/i.test(naam);
}

function pastBijZoeken(item) {
  if (!zoekterm) return true;
  const tekst = [item.titel, item.origineel, item.locatie, item.agendaNaam, item.vak].join(" ").toLowerCase();
  return tekst.includes(zoekterm);
}

// Iets met een begintijd dat in het rooster een blok wordt (afspraak, toets of optie)
function heeftTijd(item) {
  return ["afspraak", "toets", "optie"].includes(item.soort) && !item.heleDag && item.begintijd;
}

// Valt dit item op deze dag? (ook vakanties van meerdere dagen en herhalende taken)
function valtOp(item, datum) {
  if (!item.datum || datum < item.datum) return false;
  if (item.herhaal === "dag") return true;
  if (item.herhaal === "week") return dagenTussen(item.datum, datum) % 7 === 0;
  if (item.herhaal === "dagen") return (item.herhaalDagen || []).includes(weekdag(datum));
  return datum <= (item.einddatum || item.datum);
}

// 0 = zondag, 1 = maandag, … 6 = zaterdag
function weekdag(datum) {
  return new Date(datum).getUTCDay();
}

// "elke dag", "elke week" of "ma, wo, vr"
function herhaalTekst(item) {
  if (item.herhaal === "dag") return "🔁 elke dag";
  if (item.herhaal === "week") return "🔁 elke " + DAGNAMEN[weekdag(item.datum)];
  if (item.herhaal === "dagen") {
    // Op volgorde van maandag t/m zondag
    const dagen = [...item.herhaalDagen].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7));
    return "🔁 " + dagen.map(dag => DAGNAMEN[dag]).join(", ");
  }
  return "";
}

function dagenTussen(van, tot) {
  return Math.round((new Date(tot) - new Date(van)) / 86400000);
}

// Een herhalende taak op één bepaalde dag ("Meal preppen" op zondag 18 okt)
function herhaling(item, datum) {
  return {
    ...item,
    datum: datum,
    herhalingVan: item.id,
    klaar: (item.klaarOp || []).includes(datum)
  };
}

// Alles wat op een bepaalde dag valt
function itemsOpDag(datum, lijst) {
  return lijst
    .filter(item => valtOp(item, datum))
    .map(item => item.herhaal ? herhaling(item, datum) : item)
    .sort(volgorde);
}

// Volgorde op een dag: vrij → hele dag → doelen → deadlines → afspraken op tijd
const RANG = { vrij: 0, doel: 2, deadline: 3, huiswerk: 3, taak: 3, toets: 4, afspraak: 4, optie: 5 };
function volgorde(a, b) {
  const rangA = a.heleDag ? 1 : RANG[a.soort];
  const rangB = b.heleDag ? 1 : RANG[b.soort];
  return (rangA - rangB) || (a.begintijd || "").localeCompare(b.begintijd || "");
}

// Is dit een toets? (zelf aangegeven, of herkend aan woorden in de titel)
function isToets(item) {
  if (item.soort === "toets" || item.tentamen) return true;
  if (item.soort === "huiswerk" || item.soort === "taak") return false;
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
  // Opties (zoals sport) tellen niet mee: die hoeven niet, dus geen waarschuwing
  const metTijd = afspraken.filter(a => heeftTijd(a) && a.eindtijd && a.soort !== "optie");

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
  if (item.soort === "afspraak" || item.soort === "toets") return maakAfspraakRegel(item, overlaptMet);
  if (item.soort === "vrij") return maakVrijRegel(item);
  return maakRegel(item);
}

function maakAfspraakRegel(afspraak, overlaptMet) {
  const li = document.createElement("li");
  li.className = "afspraak" + (overlaptMet.length ? " heeft-overlap" : "") + (isToets(afspraak) ? " is-tentamen" : "");

  // Afspraken uit Google krijgen de kleur van hun agenda (bijv. Magister)
  if (afspraak.kleur) li.style.borderLeftColor = afspraak.kleur;

  // Klik op een les uit Google om huiswerk, een naam of een tentamen toe te voegen
  if (afspraak.bron === "google") {
    li.classList.add("klikbaar");
    li.title = "Klik om huiswerk toe te voegen of de les een naam te geven";
    li.onclick = () => openLes(afspraak.id); // staat in lessen.js
  }

  const tijd = document.createElement("span");
  tijd.className = "tijd";
  if (afspraak.heleDag) tijd.textContent = "hele dag";
  else tijd.textContent = afspraak.begintijd + (afspraak.eindtijd ? "–" + afspraak.eindtijd : "");
  li.appendChild(tijd);

  const tekst = document.createElement("span");
  tekst.className = "tekst";
  tekst.textContent = (isToets(afspraak) ? "📝 " : "") + afspraak.titel + " ";

  const extra = [afspraak.origineel !== afspraak.titel && afspraak.origineel, afspraak.locatie].filter(Boolean);
  if (extra.length) {
    const info = document.createElement("span");
    info.className = "info";
    info.textContent = "· " + extra.join(" · ");
    tekst.appendChild(info);
  }

  const labels = lesLabels(afspraak);
  if (labels) {
    const label = document.createElement("span");
    label.className = "les-labels";
    label.textContent = labels;
    tekst.appendChild(label);
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

// Het tekstje onder een les, zoals "📖 2 te doen" (of "✓ alles af")
function lesLabels(les) {
  if (!les.huiswerk || les.huiswerk.length === 0) return "";
  const open = les.huiswerk.filter(item => !item.klaar).length;
  return open === 0 ? "📖 ✓ alles af" : "📖 " + open + " te doen";
}

// De naam van een les: jouw naam (zoals in Magister), anders die uit Google
function lesNaam(lesId) {
  if (lesNamen[lesId]) return lesNamen[lesId];
  const les = googleAfspraken.find(les => les.id === lesId);
  return les ? les.titel : "";
}

// Een klein label, bijvoorbeeld met de les waar huiswerk bij hoort
function maakLabel(tekst) {
  const label = document.createElement("span");
  label.className = "vak-label";
  label.textContent = tekst;
  return label;
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

// Een taak, deadline, huiswerk, toets of doel (met vinkje)
function maakRegel(item) {
  const li = document.createElement("li");
  li.className = item.soort + (item.klaar ? " klaar" : "");

  // Bij een herhalende taak hoort het vinkje alleen bij díe ene dag
  const id = item.herhalingVan || item.id;
  const vinkje = document.createElement("input");
  vinkje.type = "checkbox";
  vinkje.checked = item.klaar;
  vinkje.onchange = () => vinkAf(id, item.herhalingVan ? item.datum : null);
  li.appendChild(vinkje);

  const tekst = document.createElement("span");
  tekst.className = "tekst";
  tekst.textContent = item.soort === "taak" ? "" : ICOON[item.soort] + " ";
  const bijLes = item.lesId ? lesNaam(item.lesId) : item.vak; // (vak: van een oudere versie)
  if (bijLes && bijLes !== item.titel) tekst.appendChild(maakLabel(bijLes));
  tekst.appendChild(document.createTextNode(item.titel + " "));
  if (item.datum) tekst.appendChild(maakDatumInfo(item));
  li.appendChild(tekst);

  // Taken zonder datum: knopje om te kiezen hoe belangrijk ze zijn
  if (item.soort === "taak" && !item.datum) li.appendChild(maakPrioriteitKnop(item));

  li.appendChild(maakVerwijderKnop(id));
  return li;
}

const PRIORITEIT = {
  hoog:   { icoon: "🔥", titel: "Belangrijk", volgende: "laag" },
  normaal:{ icoon: "☆",  titel: "Normaal", volgende: "hoog" },
  laag:   { icoon: "💤", titel: "Als ik tijd heb", volgende: "normaal" }
};

function maakPrioriteitKnop(item) {
  const prioriteit = PRIORITEIT[item.prioriteit || "normaal"];
  const knop = document.createElement("button");
  knop.className = "prioriteit-knop";
  knop.textContent = prioriteit.icoon;
  knop.title = prioriteit.titel + " (klik om te wijzigen)";
  knop.onclick = () => {
    const echt = items.find(ander => ander.id === item.id);
    echt.prioriteit = prioriteit.volgende;
    bewaarItems();
    toonAlles();
  };
  return knop;
}

// Het grijze stukje achter een item, zoals "· vr 9 okt · nog 2 dagen"
function maakDatumInfo(item) {
  const info = document.createElement("span");
  info.className = "info";

  const dagen = dagenTot(item.datum);
  let wanneer;
  if (dagen < 0) wanneer = item.soort === "deadline" || item.soort === "huiswerk" ? "te laat!" : "voorbij";
  else if (dagen === 0) wanneer = "vandaag!";
  else if (dagen === 1) wanneer = "morgen";
  else wanneer = "nog " + dagen + " dagen";

  const delen = [mooieDatum(item.datum)];
  if (item.begintijd) delen.push(item.begintijd + (item.eindtijd ? "–" + item.eindtijd : ""));
  if (item.herhaal) delen.push(herhaalTekst(item));
  else delen.push(wanneer);

  info.textContent = "· " + delen.join(" · ");
  if ((item.soort === "deadline" || item.soort === "huiswerk") && dagen <= 2 && !item.klaar) {
    info.classList.add("dringend");
  }
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

// ===== 5. PAGINA "TAKEN": takenlijst en doelen =====
function toonTaken() {
  toonTakenlijst();
  toonLijst("lijst-doel", ["doel"], alleItems());
}

// ===== "KAN VANDAAG": opties zoals sport (hoeft niet, mag wel) =====
function toonOpties(alle) {
  const lijst = document.getElementById("lijst-optie");
  lijst.innerHTML = "";

  const vandaagAlles = itemsOpDag(vandaag(), alle);
  const opties = vandaagAlles.filter(item => item.soort === "optie");
  const bezet = vandaagAlles.filter(item => heeftTijd(item) && item.soort !== "optie" && item.eindtijd);

  if (opties.length === 0) {
    lijst.innerHTML = '<p class="leeg">Niks voor vandaag. Voeg een 💪 optie toe, zoals sporten.</p>';
  }

  for (const optie of opties) {
    const li = maakRegel(optie);

    // Botst het met iets wat je al hebt? (les, werk, afspraak)
    if (optie.begintijd) {
      const optieEind = optie.eindtijd || optie.begintijd;
      const botst = bezet.filter(item => item.begintijd < optieEind && optie.begintijd < item.eindtijd);
      const melding = document.createElement("span");
      if (botst.length) {
        melding.className = "overlap";
        melding.textContent = "⚠️ Botst met: " + botst.map(item => item.titel).join(", ");
        li.classList.add("botst");
      } else {
        melding.className = "past";
        melding.textContent = "✓ Past in je dag";
      }
      li.querySelector(".tekst").appendChild(melding);
    }
    lijst.appendChild(li);
  }
}

// ===== "TE DOEN": alles wat je nog moet doen, op volgorde van wanneer =====
const GROEPEN = [
  { sleutel: "te-laat", titel: "⚠️ Te laat" },
  { sleutel: "vandaag", titel: "Vandaag" },
  { sleutel: "morgen", titel: "Morgen" },
  { sleutel: "week", titel: "Deze week" },
  { sleutel: "later", titel: "Later" }
];

function toonTeDoen() {
  const lijst = document.getElementById("lijst-te-doen");
  lijst.innerHTML = "";

  // Alles wat je moet DOEN (dus geen afspraken, vakanties of doelen)
  const teDoen = [];
  for (const item of items.filter(pastBijZoeken)) {
    if (!["taak", "deadline", "huiswerk", "toets"].includes(item.soort)) continue;

    if (item.herhaal) {
      // Herhalende taken: de keren in de komende 7 dagen
      for (let i = 0; i < 7; i++) {
        const datum = plusDagen(vandaag(), i);
        if (valtOp(item, datum)) teDoen.push(herhaling(item, datum));
      }
    } else {
      teDoen.push(item);
    }
  }

  // Verdeel over de groepen
  const perGroep = {};
  for (const item of teDoen) {
    const groep = groepVoor(item);
    if (!groep) continue;
    if (!perGroep[groep]) perGroep[groep] = [];
    perGroep[groep].push(item);
  }

  let open = 0;
  for (const { sleutel, titel } of GROEPEN) {
    const groep = perGroep[sleutel];
    if (!groep) continue;

    // Eerst wat nog open staat, dan op datum en tijd
    groep.sort((a, b) =>
      (a.klaar - b.klaar) ||
      (a.datum || "").localeCompare(b.datum || "") ||
      (a.begintijd || "").localeCompare(b.begintijd || ""));

    const nogOpen = groep.filter(item => !item.klaar).length;
    open += nogOpen;

    const kop = document.createElement("li");
    kop.className = "dag-kop" + (sleutel === "vandaag" ? " is-vandaag" : "") + (sleutel === "te-laat" ? " te-laat" : "");
    kop.textContent = titel + (nogOpen ? " · " + nogOpen : " · ✓");
    lijst.appendChild(kop);

    for (const item of groep) lijst.appendChild(maakRegel(item));
  }

  if (lijst.children.length === 0) {
    lijst.innerHTML = '<p class="leeg">Niks met een datum te doen. Voeg hierboven iets toe.</p>';
  } else if (open === 0) {
    lijst.insertAdjacentHTML("afterbegin", '<p class="alles-af">🎉 Alles is af!</p>');
  }
}

// ===== TAKENLIJST: dingen zonder datum, op volgorde van hoe belangrijk =====
function toonTakenlijst() {
  const lijst = document.getElementById("lijst-takenlijst");
  lijst.innerHTML = "";

  // Afgevinkte taken laten we nog 2 dagen zien, daarna verdwijnen ze
  const tweeDagenGeleden = Date.now() - 2 * 86400000;
  const taken = items.filter(item =>
    item.soort === "taak" && !item.datum && pastBijZoeken(item) &&
    !(item.klaar && (item.klaarSinds || 0) < tweeDagenGeleden));

  for (const sleutel of ["hoog", "normaal", "laag"]) {
    const groep = taken.filter(item => (item.prioriteit || "normaal") === sleutel);
    if (groep.length === 0) continue;
    groep.sort((a, b) => a.klaar - b.klaar || a.id - b.id);

    const nogOpen = groep.filter(item => !item.klaar).length;
    const kop = document.createElement("li");
    kop.className = "dag-kop" + (sleutel === "hoog" ? " te-laat" : "");
    kop.textContent = PRIORITEIT[sleutel].icoon + " " + PRIORITEIT[sleutel].titel + (nogOpen ? " · " + nogOpen : " · ✓");
    lijst.appendChild(kop);

    for (const item of groep) lijst.appendChild(maakRegel(item));
  }

  if (taken.length === 0) {
    lijst.innerHTML = '<p class="leeg">Leeg. Kies bovenin "✅ Taak" zonder datum om iets toe te voegen.</p>';
  }
}

// In welke groep hoort een item? (null = niet laten zien)
function groepVoor(item) {
  if (!item.datum) return null; // die staan in de takenlijst

  const dagen = dagenTot(item.datum);
  if (dagen < 0) {
    // Wat af is of al voorbij is (zoals een toets), hoef je niet meer te zien
    if (item.klaar || item.soort === "toets" || item.soort === "taak") return null;
    return "te-laat";
  }
  if (dagen === 0) return "vandaag";
  if (dagen === 1) return "morgen";
  if (dagen < 7) return "week";
  return "later";
}

function toonLijst(lijstId, soorten, alle) {
  const lijst = document.getElementById(lijstId);
  lijst.innerHTML = "";

  const gekozen = alle.filter(item => soorten.includes(item.soort));

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

// ===== 6. WISSELEN TUSSEN PAGINA'S =====
// Wordt na elke wijziging aangeroepen: tekent de pagina die open staat opnieuw
function toonAlles() {
  // Menu en knoppen goed zetten
  document.querySelectorAll("[data-pagina]").forEach(knop =>
    knop.classList.toggle("actief", knop.dataset.pagina === pagina));
  document.querySelectorAll(".pagina").forEach(sectie =>
    sectie.classList.toggle("verborgen", sectie.id !== "pagina-" + pagina));
  document.getElementById("pagina-titel").textContent = PAGINAS[pagina];
  document.getElementById("zoek").classList.toggle("verborgen", pagina === "home");

  document.querySelectorAll("[data-weergave]").forEach(knop =>
    knop.classList.toggle("actief", knop.dataset.weergave === weergave));
  document.querySelectorAll("[data-stijl]").forEach(knop =>
    knop.classList.toggle("actief", knop.dataset.stijl === stijl));
  document.getElementById("stijl-knoppen").classList.toggle("verborgen", weergave === "jaar");

  if (pagina === "home") toonHome();         // staat in home.js
  if (pagina === "todo") toonTeDoen();
  if (pagina === "taken") toonTaken();
  if (pagina === "studie") toonStudie();     // staat in leerplan.js
  if (pagina === "ideeen") toonIdeeen();     // staat in ideeen.js
  if (pagina === "agenda") {
    if (weergave === "week") toonWeek();     // staat in weergaven.js
    if (weergave === "maand") toonMaand();
    if (weergave === "jaar") toonJaar();
  }

  vernieuwLesVenster();  // staat in lessen.js
}

function kiesPagina(nieuw) {
  if (!PAGINAS[nieuw]) nieuw = "home";
  pagina = nieuw;
  // Het adres krijgt #agenda enz., zodat de terug-knop van je telefoon werkt
  if (location.hash !== "#" + pagina) history.pushState(null, "", "#" + pagina);
  toonAlles();
  window.scrollTo(0, 0);
}

// Week, maand of jaar in de agenda
function kiesWeergave(nieuw) {
  weergave = nieuw;
  bewaarInstelling("weergave", weergave);
  if (pagina !== "agenda") kiesPagina("agenda");
  else toonAlles();
}

// ----- Het toevoeg-venster -----
function openToevoegen() {
  // Op de Studie-pagina voeg je een leerplan toe
  if (pagina === "studie") return openPlanVenster(); // staat in leerplan.js

  // Kies alvast de soort die past bij de pagina waar je bent
  const standaard = { todo: "deadline", taken: "taak", agenda: "afspraak", home: "taak" };
  if (standaard[pagina]) document.getElementById("soort").value = standaard[pagina];
  pasVeldenAan();
  document.getElementById("toevoeg-venster").showModal();
  document.getElementById("titel").focus();
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

  const kanHerhalen = soort === "taak" || soort === "optie";
  const herhaal = kanHerhalen ? document.getElementById("herhaal").value : "";

  // Welke dagen zijn aangevinkt? (bij "op vaste dagen")
  const herhaalDagen = [...document.querySelectorAll("#veld-dagen input:checked")].map(vakje => Number(vakje.value));
  if (herhaal === "dagen" && herhaalDagen.length === 0) {
    alert("Vink aan op welke dagen.");
    return;
  }

  if (!kanHerhalen && soort !== "taak" && !datum) {
    alert("Vul een datum in.");
    return;
  }
  if (soort === "optie" && !herhaal && !datum) {
    alert("Vul een datum in, of kies hoe vaak het herhaalt.");
    return;
  }
  if (soort === "vrij" && (!einddatum || einddatum < datum)) einddatum = datum;
  const metTijd = ["afspraak", "toets", "taak", "optie"].includes(soort);

  items.push({
    id: Date.now(),
    titel: document.getElementById("titel").value.trim(),
    soort: soort,
    datum: datum || (herhaal ? vandaag() : ""), // herhalen zonder datum? Dan vanaf vandaag
    einddatum: soort === "vrij" ? einddatum : "",
    begintijd: metTijd ? document.getElementById("begintijd").value : "",
    eindtijd: metTijd && soort !== "taak" ? document.getElementById("eindtijd").value : "",
    herhaal: herhaal,
    herhaalDagen: herhaal === "dagen" ? herhaalDagen : [],
    prioriteit: soort === "taak" ? document.getElementById("prioriteit").value : "",
    klaarOp: [],
    klaar: false
  });

  bewaarItems();
  toonAlles();

  // Formulier leegmaken voor de volgende keer, en het venster sluiten
  document.getElementById("titel").value = "";
  document.getElementById("toevoeg-venster").close();
}

// Afvinken. Bij een herhalende taak onthouden we op wélke dag je hem af hebt.
function vinkAf(id, datum) {
  const item = items.find(item => item.id === id);
  if (item.herhaal && datum) {
    const klaarOp = item.klaarOp || [];
    item.klaarOp = klaarOp.includes(datum) ? klaarOp.filter(d => d !== datum) : klaarOp.concat(datum);
  } else {
    item.klaar = !item.klaar;
    item.klaarSinds = item.klaar ? Date.now() : 0;
  }
  bewaarItems();
  toonAlles();
}

function verwijder(id) {
  const item = items.find(item => item.id === id);
  if (item && item.herhaal && !confirm('"' + item.titel + '" herhaalt zich. Alle keren verwijderen?')) return;
  items = items.filter(item => item.id !== id);
  bewaarItems();
  toonAlles();
}

// Laat alleen de velden zien die bij de gekozen soort horen
function pasVeldenAan() {
  const soort = document.getElementById("soort").value;
  const kanHerhalen = soort === "taak" || soort === "optie";
  const herhaal = kanHerhalen ? document.getElementById("herhaal").value : "";

  let herhaalLabel = "Wanneer (mag leeg)";
  if (herhaal === "week") herhaalLabel = "Eerste keer op";
  if (herhaal === "dag" || herhaal === "dagen") herhaalLabel = "Vanaf (mag leeg)";
  if (soort === "optie" && !herhaal) herhaalLabel = "Datum";

  const labels = {
    deadline: "Inleveren op", afspraak: "Datum", doel: "Wil ik halen op",
    vrij: "Van", toets: "Datum", huiswerk: "Af hebben op",
    taak: herhaalLabel, optie: herhaalLabel
  };

  document.getElementById("datum-label").textContent = labels[soort] || "";
  document.getElementById("veld-datum").classList.remove("verborgen");
  document.getElementById("veld-herhaal").classList.toggle("verborgen", !kanHerhalen);
  document.getElementById("veld-dagen").classList.toggle("verborgen", herhaal !== "dagen");
  document.getElementById("veld-prioriteit").classList.toggle("verborgen", soort !== "taak" || herhaal !== "");
  document.getElementById("veld-einddatum").classList.toggle("verborgen", soort !== "vrij");
  document.getElementById("veld-tijd").classList.toggle("verborgen",
    !["afspraak", "toets", "taak", "optie"].includes(soort));
  // Een taak heeft alleen een begintijd ("om 07:30"), geen eindtijd
  document.getElementById("tijd-tot").classList.toggle("verborgen", soort === "taak");
  document.getElementById("tijd-van-label").textContent = soort === "taak" ? "om" : "van";
}

function zoek() {
  zoekterm = document.getElementById("zoek").value.trim().toLowerCase();
  toonAlles();
}

// ===== 8. STARTEN =====
document.getElementById("formulier").addEventListener("submit", voegToe);
document.getElementById("soort").addEventListener("change", pasVeldenAan);
document.getElementById("herhaal").addEventListener("change", pasVeldenAan);
document.getElementById("zoek").addEventListener("input", zoek);
document.getElementById("toevoegen-knop").addEventListener("click", openToevoegen);
document.querySelectorAll("[data-pagina]").forEach(knop =>
  knop.addEventListener("click", () => kiesPagina(knop.dataset.pagina)));
document.querySelectorAll("[data-ga-naar]").forEach(knop =>
  knop.addEventListener("click", () => kiesPagina(knop.dataset.gaNaar)));
// Venster groter of kleiner gemaakt? Dan het rooster opnieuw passend maken
let herschaalTimer = null;
window.addEventListener("resize", () => {
  clearTimeout(herschaalTimer);
  herschaalTimer = setTimeout(() => {
    if (pagina === "agenda" && weergave === "week") toonAlles();
  }, 200);
});
// De terug-knop van je browser of telefoon
window.addEventListener("popstate", () => {
  pagina = PAGINAS[location.hash.slice(1)] ? location.hash.slice(1) : "home";
  toonAlles();
});
document.getElementById("vorige").addEventListener("click", () => blader(-1));
document.getElementById("volgende").addEventListener("click", () => blader(1));
document.getElementById("naar-vandaag").addEventListener("click", naarVandaag);
document.querySelectorAll("[data-weergave]").forEach(knop =>
  knop.addEventListener("click", () => kiesWeergave(knop.dataset.weergave)));
document.querySelectorAll("[data-stijl]").forEach(knop =>
  knop.addEventListener("click", () => kiesStijl(knop.dataset.stijl)));
document.getElementById("datum-vandaag").textContent =
  new Date().toLocaleDateString("nl-NL", { weekday: "long", day: "numeric", month: "long" });

pasVeldenAan();
toonAlles();
