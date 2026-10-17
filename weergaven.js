// ===== WEERGAVEN: WEEK, MAAND EN JAAR =====
// Deze functies gebruiken de hulpfuncties uit app.js (zoals itemsOpDag en plusDagen)

// Hoeveel pixels één uur hoog is in het weekrooster.
// Dit wordt elke keer uitgerekend, zodat je hele week op je scherm past.
let UUR_HOOGTE = 48;

// Klein hulpje: maak een <div> met een class
function div(className) {
  const element = document.createElement("div");
  element.className = className;
  return element;
}

function hoofdletter(tekst) {
  return tekst.charAt(0).toUpperCase() + tekst.slice(1);
}

// Wanneer eindigt een afspraak, in minuten? Zonder eindtijd rekenen we 1 uur.
function eindMinuten(afspraak) {
  const begin = minuten(afspraak.begintijd);
  if (!afspraak.eindtijd) return begin + 60;
  const eind = minuten(afspraak.eindtijd);
  return eind > begin ? eind : 24 * 60; // gaat door na middernacht
}

// Weeknummer zoals in je schoolagenda (ISO-week)
function weekNummer(datum) {
  const dag = new Date(datum);
  dag.setUTCDate(dag.getUTCDate() + 3 - ((dag.getUTCDay() + 6) % 7)); // donderdag van die week
  const eersteJanuari = new Date(Date.UTC(dag.getUTCFullYear(), 0, 1));
  return Math.ceil(((dag - eersteJanuari) / 86400000 + 1) / 7);
}

// Een klein labeltje voor in het maandrooster of de "hele dag"-rij
function maakChip(item) {
  const soort = isVrij(item) ? "vrij" : item.soort;
  const chip = div("chip chip-" + soort + (item.klaar ? " klaar" : ""));
  let tekst = (item.planId && item.vak ? item.vak + ": " : "") + item.titel; // bijv. "Bedrijfsmanagement: Hoofdstuk 1…"
  if (heeftTijd(item) || (item.soort === "taak" && item.begintijd)) tekst = item.begintijd + " " + tekst;
  else if (soort !== "afspraak" && soort !== "toets" && ICOON[soort]) tekst = ICOON[soort] + " " + tekst;
  if (isToets(item)) tekst = "📝 " + tekst;

  chip.textContent = tekst;
  chip.title = tekst + (item.agendaNaam ? " (" + item.agendaNaam + ")" : "");
  if (item.kleur) chip.style.borderLeftColor = item.kleur;
  return chip;
}

// ===== WAAR TEKENEN WE DE AGENDA? =====
// De agenda staat op twee plekken: op Home en op de pagina Agenda.
// Daarom geven we telkens mee wáár en wát we tekenen:
// { vak, titel, weergave: "dag"|"week"|"maand"|"jaar", focus, stijl, items, openDag, openWeek, openMaand }
let ctx = null;

function tekenAgenda(instellingen) {
  ctx = instellingen;
  if (ctx.weergave === "dag") toonDag();
  if (ctx.weergave === "week") toonWeek();
  if (ctx.weergave === "maand") toonMaand();
  if (ctx.weergave === "jaar") toonJaar();
}

// ===== DAG =====
function toonDag() {
  ctx.titel.textContent = hoofdletter(new Date(ctx.focus).toLocaleDateString("nl-NL",
    { weekday: "long", day: "numeric", month: "long" })) + (ctx.focus === vandaag() ? " · vandaag" : "");
  ctx.vak.innerHTML = "";

  if (ctx.stijl === "lijst") {
    const lijst = document.createElement("ul");
    vulDagenLijst(lijst, [ctx.focus], ctx.items, { legeDagenTonen: true });
    ctx.vak.appendChild(lijst);
  } else {
    ctx.vak.appendChild(maakWeekRooster([ctx.focus], ctx.items));
  }
}

// ===== WEEK =====
function toonWeek() {
  const maandag = startVanWeek(ctx.focus);
  const datums = [0, 1, 2, 3, 4, 5, 6].map(i => plusDagen(maandag, i));

  const opties = { day: "numeric", month: "short" };
  ctx.titel.textContent =
    "Week " + weekNummer(maandag) + " · " +
    new Date(datums[0]).toLocaleDateString("nl-NL", opties) + " – " +
    new Date(datums[6]).toLocaleDateString("nl-NL", { ...opties, year: "numeric" });

  const vak = ctx.vak;
  vak.innerHTML = "";

  if (ctx.stijl === "lijst") {
    const lijst = document.createElement("ul");
    vulDagenLijst(lijst, datums, ctx.items, { legeDagenTonen: true });
    vak.appendChild(lijst);
  } else {
    vak.appendChild(maakWeekRooster(datums, ctx.items));
  }
}

function maakWeekRooster(datums, alle) {
  const perDag = datums.map(datum => itemsOpDag(datum, alle));
  const metTijd = perDag.map(lijst => lijst.filter(heeftTijd));
  // Huiswerk dat bij een les hoort staat al óp die les, dus niet nog eens bovenin
  const zonderTijd = perDag.map(lijst => lijst.filter(item => !heeftTijd(item) && !item.bijLes));

  // Welke uren laten we zien? Standaard 08:00–22:00 (langer als je eerder of later iets hebt).
  // In het filter kun je kiezen voor "alleen uren met afspraken".
  const alleenEigenUren = laadInstelling("alleenEigenUren", "nee") === "ja";
  let beginUur = alleenEigenUren ? 24 : 8;
  let eindUur = alleenEigenUren ? 0 : 22;
  for (const lijst of metTijd) {
    for (const afspraak of lijst) {
      beginUur = Math.min(beginUur, Math.floor(minuten(afspraak.begintijd) / 60));
      eindUur = Math.max(eindUur, Math.ceil(eindMinuten(afspraak) / 60));
    }
  }
  const heeftUren = beginUur < eindUur; // is er deze week iets met een tijd?
  // Minstens 3 uur laten zien, anders worden de blokjes onleesbaar klein
  while (heeftUren && eindUur - beginUur < 3) {
    if (eindUur < 24) eindUur++;
    else beginUur--;
  }

  // Zo hoog maken dat alles op je scherm past (maar niet te klein of te groot)
  const ruimte = window.innerHeight - 300; // ruimte voor menu, knoppen en dagnamen
  UUR_HOOGTE = Math.max(26, Math.min(56, Math.floor(ruimte / (eindUur - beginUur))));
  const hoogte = (eindUur - beginUur) * UUR_HOOGTE;

  const scroll = div("rooster-scroll");
  const raster = div("week-raster");
  // Zoveel kolommen als er dagen zijn (1 voor de dagweergave, 7 voor een week)
  raster.style.gridTemplateColumns = "52px repeat(" + datums.length + ", minmax(96px, 1fr))";
  raster.style.minWidth = (52 + datums.length * 96) + "px";
  scroll.appendChild(raster);

  // Rij 1: de dagen
  raster.appendChild(div("hoek"));
  for (const datum of datums) {
    const kop = div("rooster-dag-kop" + (datum === vandaag() ? " is-vandaag" : ""));
    kop.textContent = new Date(datum).toLocaleDateString("nl-NL", { weekday: "short", day: "numeric" });
    raster.appendChild(kop);
  }

  // Rij 2: alles zonder tijd (vrije dagen, deadlines, doelen, hele-dag-afspraken)
  const label = div("rooster-label");
  label.textContent = "hele dag";
  raster.appendChild(label);
  for (const lijst of zonderTijd) {
    const cel = div("hele-dag-cel");
    for (const item of lijst) cel.appendChild(maakChip(item));
    raster.appendChild(cel);
  }

  // Niks met een tijd? Dan laten we de uren helemaal weg
  if (!heeftUren) {
    label.textContent = "";
    raster.classList.add("zonder-uren");
    return scroll;
  }

  // Rij 3: de tijdlijn met uren
  const tijdAs = div("tijd-as");
  tijdAs.style.height = hoogte + "px";
  for (let uur = beginUur; uur < eindUur; uur++) {
    const uurLabel = div("uur-label");
    uurLabel.style.top = (uur - beginUur) * UUR_HOOGTE + "px";
    uurLabel.textContent = String(uur).padStart(2, "0") + ":00";
    tijdAs.appendChild(uurLabel);
  }
  raster.appendChild(tijdAs);

  datums.forEach((datum, n) => {
    const kolom = div("dag-kolom" + (datum === vandaag() ? " is-vandaag" : ""));
    kolom.style.height = hoogte + "px";
    kolom.style.backgroundSize = "100% " + UUR_HOOGTE + "px";

    const overlappen = zoekOverlap(metTijd[n]);
    const plekken = verdeelOverBanen(metTijd[n]);
    for (const afspraak of metTijd[n]) {
      kolom.appendChild(maakBlok(afspraak, beginUur, plekken.get(afspraak), overlappen.get(afspraak)));
    }

    // Rode lijn: hoe laat het nu is
    if (datum === vandaag()) {
      const nu = new Date();
      const nuMinuten = nu.getHours() * 60 + nu.getMinutes();
      if (nuMinuten >= beginUur * 60 && nuMinuten <= eindUur * 60) {
        const lijn = div("nu-lijn");
        lijn.style.top = (nuMinuten - beginUur * 60) / 60 * UUR_HOOGTE + "px";
        kolom.appendChild(lijn);
      }
    }
    raster.appendChild(kolom);
  });

  return scroll;
}

// Afspraken die tegelijk zijn, zetten we naast elkaar in "banen".
// Geeft per afspraak terug: in welke baan hij staat en hoeveel banen er zijn.
function verdeelOverBanen(afspraken) {
  const plekken = new Map();
  const gesorteerd = [...afspraken].sort((a, b) => minuten(a.begintijd) - minuten(b.begintijd));

  let groep = [];        // afspraken die (via elkaar) overlappen
  let banen = [];        // per baan: wanneer de laatste afspraak daarin eindigt
  let groepEinde = -1;

  function sluitGroep() {
    for (const afspraak of groep) plekken.get(afspraak).totaal = banen.length;
    groep = [];
    banen = [];
  }

  for (const afspraak of gesorteerd) {
    const begin = minuten(afspraak.begintijd);
    const eind = eindMinuten(afspraak);
    if (begin >= groepEinde) sluitGroep();

    let baan = banen.findIndex(baanEinde => baanEinde <= begin);
    if (baan === -1) {
      baan = banen.length;
      banen.push(eind);
    } else {
      banen[baan] = eind;
    }

    plekken.set(afspraak, { baan: baan, totaal: 1 });
    groep.push(afspraak);
    groepEinde = Math.max(groepEinde, eind);
  }
  sluitGroep();
  return plekken;
}

// Eén blok in het weekrooster
function maakBlok(afspraak, beginUur, plek, overlaptMet) {
  const blok = div("blok" + (overlaptMet ? " blok-overlap" : "") + (isToets(afspraak) ? " blok-tentamen" : "") +
    (afspraak.soort === "optie" ? " blok-optie" + (afspraak.klaar ? " klaar" : "") : ""));
  const begin = minuten(afspraak.begintijd);
  const duur = eindMinuten(afspraak) - begin;

  const blokHoogte = Math.max(duur / 60 * UUR_HOOGTE - 2, 16);
  blok.style.top = (begin - beginUur * 60) / 60 * UUR_HOOGTE + "px";
  blok.style.height = blokHoogte + "px";
  if (blokHoogte < 34) blok.classList.add("blok-klein"); // te klein voor 2 regels: alleen de titel
  blok.style.left = "calc(" + (plek.baan / plek.totaal * 100) + "% + 2px)";
  blok.style.width = "calc(" + (100 / plek.totaal) + "% - 4px)";
  if (afspraak.kleur) blok.style.backgroundColor = afspraak.kleur;

  const titel = document.createElement("strong");
  titel.textContent = (overlaptMet ? "⚠️ " : "") + (isToets(afspraak) ? "📝 " : "") +
    (afspraak.soort === "optie" ? "💪 " + (afspraak.klaar ? "✓ " : "") : "") + afspraak.titel;
  blok.appendChild(titel);

  const info = document.createElement("span");
  info.textContent = afspraak.begintijd + (afspraak.eindtijd ? "–" + afspraak.eindtijd : "") +
    (afspraak.locatie ? " · " + afspraak.locatie : "");
  blok.appendChild(info);

  const labels = lesLabels(afspraak);
  if (labels) {
    const label = document.createElement("span");
    label.className = "blok-labels";
    label.textContent = labels;
    blok.appendChild(label);
  }

  blok.title = afspraak.titel + "\n" + info.textContent +
    (afspraak.origineel ? "\n" + afspraak.origineel : "") +
    (overlaptMet ? "\n⚠️ Tegelijk met: " + overlaptMet.join(", ") : "") +
    (afspraak.bron === "google" ? "\n\nKlik om huiswerk toe te voegen of de les een naam te geven" : "");

  if (afspraak.bron === "google") {
    blok.classList.add("klikbaar");
    blok.onclick = () => openLes(afspraak.id);
  }
  return blok;
}

// ===== MAAND =====
// Opties (zoals elke dag gym) laten we in de maand weg, anders staat het in elk vakje
function zonderOpties() {
  return ctx.items.filter(item => item.soort !== "optie");
}

function toonMaand() {
  const eerste = startVanMaand(ctx.focus);
  const laatste = plusDagen(plusMaanden(eerste, 1), -1);
  ctx.titel.textContent = hoofdletter(maandNaam(eerste));

  const vak = ctx.vak;
  vak.innerHTML = "";

  if (ctx.stijl === "lijst") {
    const datums = [];
    for (let datum = eerste; datum <= laatste; datum = plusDagen(datum, 1)) datums.push(datum);
    const lijst = document.createElement("ul");
    vulDagenLijst(lijst, datums, zonderOpties());
    vak.appendChild(lijst);
  } else {
    vak.appendChild(maakMaandRooster(eerste, laatste, zonderOpties()));
  }
}

function maakMaandRooster(eerste, laatste, alle) {
  const scroll = div("rooster-scroll");
  const raster = div("maand-raster");
  scroll.appendChild(raster);

  for (const naam of ["ma", "di", "wo", "do", "vr", "za", "zo"]) {
    const kop = div("maand-dagnaam");
    kop.textContent = naam;
    raster.appendChild(kop);
  }

  const naarDag = ctx.openDag; // wat er gebeurt als je op een dag klikt
  const eind = plusDagen(startVanWeek(laatste), 6);
  for (let datum = startVanWeek(eerste); datum <= eind; datum = plusDagen(datum, 1)) {
    const dagItems = itemsOpDag(datum, alle);

    // Schoollessen tellen we op ("📚 6 lessen"), anders past het niet.
    // Toetsen laten we wél los zien.
    const lessen = dagItems.filter(item => item.bronType === "school" && heeftTijd(item) && !isToets(item));
    const rest = dagItems.filter(item => !lessen.includes(item));

    const cel = div("maand-dag" +
      (datum.slice(0, 7) !== eerste.slice(0, 7) ? " andere-maand" : "") +
      (datum === vandaag() ? " is-vandaag" : "") +
      (dagItems.some(isVrij) ? " vrije-dag" : ""));

    const nummer = div("dag-nummer");
    nummer.textContent = Number(datum.slice(8));
    cel.appendChild(nummer);

    for (const item of rest.slice(0, 3)) cel.appendChild(maakChip(item));
    if (rest.length > 3) {
      const meer = div("meer");
      meer.textContent = "+" + (rest.length - 3) + " meer";
      cel.appendChild(meer);
    }
    if (lessen.length) {
      const lesChip = div("chip chip-lessen");
      lesChip.textContent = "📚 " + lessen.length + (lessen.length === 1 ? " les" : " lessen");
      cel.appendChild(lesChip);
    }

    const dezeDag = datum;
    cel.title = "Klik om deze dag te bekijken";
    cel.onclick = () => naarDag(dezeDag);
    raster.appendChild(cel);
  }
  return scroll;
}

// ===== JAAR =====
function toonJaar() {
  const begin = startVanMaand(ctx.focus);
  ctx.titel.textContent =
    hoofdletter(maandNaam(begin)) + " – " + maandNaam(plusMaanden(begin, 11));

  const alle = ctx.items;
  const maanden = [];
  for (let i = 0; i < 12; i++) {
    const start = plusMaanden(begin, i);
    const eind = plusDagen(plusMaanden(start, 1), -1);
    const inMaand = alle
      .filter(item => !item.herhaal) // herhalende taken (zoals elke week wegen) tellen niet mee
      .filter(item => item.datum && item.datum <= eind && (item.einddatum || item.datum) >= start)
      .sort((a, b) => a.datum.localeCompare(b.datum));

    const toetsen = inMaand.filter(item => item.soort !== "taak" && isToets(item));
    const deadlines = inMaand.filter(item => item.soort === "deadline" && !isToets(item));
    const doelen = inMaand.filter(item => item.soort === "doel");
    const vrij = inMaand.filter(item => isVrij(item) || item.bronType === "feestdag");
    const afspraken = inMaand.filter(item =>
      item.soort === "afspraak" && item.bronType !== "school" && item.bronType !== "feestdag" &&
      !isToets(item) && !isVrij(item));

    // Hoe druk is het? Toetsen tellen dubbel, afgevinkte deadlines niet.
    const drukte = deadlines.filter(item => !item.klaar).length + toetsen.length * 2 + afspraken.length;
    maanden.push({ start, toetsen, deadlines, doelen, vrij, afspraken, drukte });
  }

  const drukste = Math.max(1, ...maanden.map(maand => maand.drukte));

  const vak = ctx.vak;
  vak.innerHTML = "";
  const raster = div("jaar-raster");
  vak.appendChild(raster);

  for (const maand of maanden) raster.appendChild(maakMaandKaart(maand, drukste, ctx.openMaand));
}

function maakMaandKaart(maand, drukste, naarMaand) {
  const kaart = div("maand-kaart" + (maand.start === startVanMaand(vandaag()) ? " is-vandaag" : ""));

  const kop = document.createElement("button");
  kop.className = "maand-kaart-kop";
  kop.textContent = hoofdletter(maandNaam(maand.start));
  kop.title = "Bekijk deze maand";
  kop.onclick = () => naarMaand(maand.start);
  kaart.appendChild(kop);

  // De drukte-balk
  const verhouding = maand.drukte / drukste;
  let niveau = "rustig";
  if (verhouding > 0.66) niveau = "druk";
  else if (verhouding > 0.33) niveau = "gemiddeld";

  const balk = div("drukte");
  const vulling = div("drukte-balk drukte-" + niveau);
  vulling.style.width = Math.max(verhouding * 100, maand.drukte ? 4 : 0) + "%";
  balk.appendChild(vulling);
  kaart.appendChild(balk);

  const samenvatting = div("info");
  const tellingen = [];
  if (maand.deadlines.length) tellingen.push(maand.deadlines.length + " deadline" + (maand.deadlines.length > 1 ? "s" : ""));
  if (maand.toetsen.length) tellingen.push(maand.toetsen.length + (maand.toetsen.length > 1 ? " toetsen" : " toets"));
  if (maand.afspraken.length) tellingen.push(maand.afspraken.length + " afspra" + (maand.afspraken.length > 1 ? "ken" : "ak"));
  samenvatting.textContent = maand.drukte ? hoofdletter(niveau) + " · " + tellingen.join(" · ") : "Nog niks gepland";
  kaart.appendChild(samenvatting);

  voegJaarLijstToe(kaart, "🎯 Doelen", maand.doelen);
  voegJaarLijstToe(kaart, "⏰ Deadlines & 📝 toetsen",
    maand.deadlines.concat(maand.toetsen).sort((a, b) => a.datum.localeCompare(b.datum)));
  voegJaarLijstToe(kaart, "🌴 Vrij & feestdagen", maand.vrij);

  return kaart;
}

function voegJaarLijstToe(kaart, titel, lijst) {
  if (lijst.length === 0) return;

  const kop = div("jaar-lijst-kop");
  kop.textContent = titel;
  kaart.appendChild(kop);

  const ul = document.createElement("ul");
  ul.className = "jaar-lijst";
  const opties = { day: "numeric", month: "short" };

  for (const item of lijst.slice(0, 5)) {
    const li = document.createElement("li");
    if (item.klaar) li.className = "klaar";
    let wanneer = new Date(item.datum).toLocaleDateString("nl-NL", opties);
    if (item.einddatum && item.einddatum !== item.datum) {
      wanneer += " – " + new Date(item.einddatum).toLocaleDateString("nl-NL", opties);
    }
    li.textContent = wanneer + " · " + item.titel;
    ul.appendChild(li);
  }
  if (lijst.length > 5) {
    const li = document.createElement("li");
    li.className = "info";
    li.textContent = "+" + (lijst.length - 5) + " meer";
    ul.appendChild(li);
  }
  kaart.appendChild(ul);
}
