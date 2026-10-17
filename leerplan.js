// ===== LEERPLANNER =====
// Per tentamen: je typt zelf wat je moet doen, en vinkt per taak de dag(en) aan.
// Elke taak wordt een gewone "huiswerk"-taak met een planId,
// zodat hij ook in je To-do, dashboard en agenda staat.

// De taken in het venster. Elke taak: { titel, dagen: { "2026-10-19": id-van-de-taak of null } }
let planRijen = [];
let bewerkPlanId = null; // welk plan je aan het aanpassen bent (null = nieuw plan)

// ----- Tentamens zoeken -----

// Alle toetsen en tentamens vanaf vandaag (uit je agenda en wat je zelf hebt toegevoegd)
function komendeTentamens() {
  const gezien = new Set();
  return alleItems(false)
    .filter(item => item.soort !== "huiswerk" && isToets(item) && item.datum && item.datum >= vandaag())
    .sort((a, b) => a.datum.localeCompare(b.datum) || (a.begintijd || "").localeCompare(b.begintijd || ""))
    .filter(item => {
      const sleutel = item.titel + item.datum;
      if (gezien.has(sleutel)) return false;
      gezien.add(sleutel);
      return true;
    });
}

// "Tentamen Bedrijfsmanagement" → "Bedrijfsmanagement"
function vakUitTitel(titel) {
  const vak = titel.replace(/tentamen|toets|proefwerk|examen|[:\-–]/gi, " ").replace(/\s+/g, " ").trim();
  return vak ? hoofdletter(vak) : titel;
}

function planItems(planId) {
  return items.filter(item => item.planId === planId);
}

// ----- De pagina "Studie" -----

// De Studie-pagina heeft drie tabbladen: rooster, opdrachten & huiswerk, leerplannen
// (deze worden pas ingevuld als je de pagina opent, want app.js is dan pas geladen)
let studieTab = null;
let studieFocus = null; // welke week je in het schoolrooster bekijkt

function toonStudie() {
  if (!studieTab) studieTab = laadInstelling("studieTab", "rooster");
  if (!studieFocus) studieFocus = vandaag();

  document.querySelectorAll("[data-studie]").forEach(knop =>
    knop.classList.toggle("actief", knop.dataset.studie === studieTab));
  for (const tab of ["rooster", "opdrachten", "plannen"]) {
    document.getElementById("studie-" + tab + "-paneel").classList.toggle("verborgen", tab !== studieTab);
  }

  if (studieTab === "rooster") toonStudieRooster();
  if (studieTab === "opdrachten") toonOpdrachten();
  if (studieTab === "plannen") toonPlannen();
}

function kiesStudieTab(tab) {
  studieTab = tab;
  bewaarInstelling("studieTab", tab);
  toonStudie();
}

// Hoort dit bij school? (lessen, toetsen, huiswerk, opdrachten, leerplannen)
function isSchool(item) {
  return item.bronType === "school" || ["huiswerk", "deadline", "toets"].includes(item.soort) ||
    isToets(item) || Boolean(item.planId);
}

// ----- Tabblad: schoolrooster -----

function toonStudieRooster() {
  const maandag = startVanWeek(studieFocus);
  const datums = [0, 1, 2, 3, 4, 5, 6].map(i => plusDagen(maandag, i));
  document.getElementById("studie-week-titel").textContent = "Week " + weekNummer(maandag) + " · " +
    new Date(datums[0]).toLocaleDateString("nl-NL", { day: "numeric", month: "short" }) + " – " +
    new Date(datums[6]).toLocaleDateString("nl-NL", { day: "numeric", month: "short" });

  const vak = document.getElementById("studie-rooster");
  vak.innerHTML = "";
  vak.appendChild(maakWeekRooster(datums, alleItems().filter(isSchool))); // staat in weergaven.js
}

// ----- Tabblad: opdrachten en huiswerk op een rijtje -----

function bekendeVakken() {
  const namen = new Set();
  for (const plan of leerplannen) namen.add(plan.vak);
  for (const item of items) if (item.vak) namen.add(item.vak);
  for (const naam of Object.values(lesNamen)) namen.add(naam);
  return [...namen].filter(Boolean).sort();
}

function toonOpdrachten() {
  // Vakken die je al eens hebt gebruikt, om snel te kiezen
  const lijst = document.getElementById("school-vakken");
  lijst.innerHTML = "";
  for (const naam of bekendeVakken()) lijst.appendChild(new Option(naam));

  const opdrachten = items.filter(item => item.soort === "deadline" && pastBijZoeken(item));
  toonOpRij("studie-opdrachten", opdrachten, "Nog geen opdrachten. Voeg ze hierboven toe, of klik in je rooster op een les.");

  // Huiswerk (zonder de taken uit je leerplannen, die staan bij Leerplannen) en toetsen
  const huiswerk = items.filter(item => item.soort === "huiswerk" && !item.planId && pastBijZoeken(item));
  toonOpRij("studie-huiswerk", huiswerk, "Geen huiswerk.");

  const toetsen = komendeTentamens().filter(pastBijZoeken);
  const vak = document.getElementById("studie-huiswerk");
  if (toetsen.length) {
    const kop = document.createElement("h3");
    kop.className = "groep-kop";
    kop.textContent = "📝 Komende toetsen";
    const ul = document.createElement("ul");
    ul.className = "compact";
    for (const toets of toetsen) {
      const li = maakRegelVoor(toets);
      const tijd = li.querySelector(".tijd");
      if (tijd) tijd.textContent = mooieDatum(toets.datum) + (toets.begintijd ? " " + toets.begintijd : "");
      ul.appendChild(li);
    }
    vak.append(kop, ul);
  }
}

// Een lijst op een rijtje: te laat, deze week, later, en wat je de afgelopen 2 weken hebt afgerond
function toonOpRij(id, lijst, leegTekst) {
  const vak = document.getElementById(id);
  vak.innerHTML = "";

  const groepen = [
    { titel: "Te laat", taken: lijst.filter(item => !item.klaar && dagenTot(item.datum) < 0) },
    { titel: "Deze week", taken: lijst.filter(item => !item.klaar && dagenTot(item.datum) >= 0 && dagenTot(item.datum) < 7) },
    { titel: "Later", taken: lijst.filter(item => !item.klaar && dagenTot(item.datum) >= 7) },
    { titel: "✓ Af", taken: lijst.filter(item => item.klaar && dagenTot(item.datum) >= -14) }
  ];

  for (const groep of groepen) {
    if (groep.taken.length === 0) continue;
    const kop = document.createElement("h3");
    kop.className = "groep-kop";
    kop.textContent = groep.titel + " · " + groep.taken.length;
    const ul = document.createElement("ul");
    ul.className = "compact";
    for (const item of groep.taken.sort((a, b) => a.datum.localeCompare(b.datum))) ul.appendChild(maakRegel(item));
    vak.append(kop, ul);
  }
  if (vak.children.length === 0) vak.innerHTML = '<p class="leeg">' + leegTekst + "</p>";
}

function voegSchoolTaakToe(event) {
  event.preventDefault();
  items.push({
    id: Date.now(),
    soort: document.getElementById("school-soort").value,
    titel: document.getElementById("school-titel").value.trim(),
    vak: document.getElementById("school-vak").value.trim(),
    datum: document.getElementById("school-datum").value,
    klaar: false
  });
  bewaarItems();
  toonAlles();
  document.getElementById("school-titel").value = "";
  document.getElementById("school-titel").focus();
}

// ----- Tabblad: leerplannen -----

function toonPlannen() {
  const leeg = leerplannen.length === 0;
  document.getElementById("studie-leeg").classList.toggle("verborgen", !leeg);
  document.getElementById("studie-inhoud").classList.toggle("verborgen", leeg);
  if (leeg) return;

  toonStudiePerVak();
  toonStudiePerDag();
}

// Per dag: wat moet je voor elk vak doen?
function toonStudiePerDag() {
  const lijst = document.getElementById("studie-per-dag");
  lijst.innerHTML = "";

  const alleTaken = items.filter(item => item.planId && pastBijZoeken(item));
  const tentamens = komendeTentamens();
  const laatsteDag = leerplannen.map(plan => plan.tentamenDatum).sort().pop();

  // Wat je op eerdere dagen nog niet af hebt
  const achter = alleTaken.filter(item => item.datum < vandaag() && !item.klaar);
  if (achter.length) lijst.appendChild(maakDagBlok("⚠️ Nog niet af van eerdere dagen", achter, null)); // staat in app.js

  // Per dag een blok (met wat er al in je agenda staat, zoals je tentamens)
  for (let datum = vandaag(); datum <= laatsteDag; datum = plusDagen(datum, 1)) {
    const taken = alleTaken.filter(item => item.datum === datum);
    const toetsen = tentamens.filter(item => item.datum === datum);
    if (taken.length === 0 && toetsen.length === 0) continue;

    const blok = maakDagBlok(dagKop(datum), taken, datum);
    if (toetsen.length) blok.classList.add("met-tentamen"); // het tentamen zelf staat al in de agenda-regel
    lijst.appendChild(blok);
  }
}

// Per vak: hoe ver ben je?
function toonStudiePerVak() {
  const vak = document.getElementById("studie-per-vak");
  vak.innerHTML = "";

  const plannen = [...leerplannen].sort((a, b) => a.tentamenDatum.localeCompare(b.tentamenDatum));
  for (const plan of plannen) {
    const taken = planItems(plan.id).sort((a, b) => a.datum.localeCompare(b.datum));
    const af = taken.filter(item => item.klaar).length;
    const dagen = dagenTot(plan.tentamenDatum);

    const kaart = div("kaart plan-kaart");

    const kop = div("kaart-kop");
    const titel = document.createElement("h2");
    titel.textContent = "📚 " + plan.vak;
    const wanneer = document.createElement("span");
    wanneer.className = "info" + (dagen <= 3 && dagen >= 0 ? " dringend" : "");
    wanneer.textContent = "📝 " + mooieDatum(plan.tentamenDatum) + " · " +
      (dagen < 0 ? "geweest" : dagen === 0 ? "vandaag!" : dagen === 1 ? "morgen!" : "nog " + dagen + " dagen");
    kop.append(titel, wanneer);
    kaart.appendChild(kop);

    // Voortgangsbalk
    const balk = div("drukte");
    const vulling = div("drukte-balk drukte-rustig");
    vulling.style.width = (taken.length ? af / taken.length * 100 : 0) + "%";
    balk.appendChild(vulling);
    kaart.appendChild(balk);

    const stand = div("info");
    stand.textContent = af + " van de " + taken.length + " af" + (af === taken.length && taken.length ? " 🎉" : "");
    kaart.appendChild(stand);

    // De hele planning van dit vak (klik om open te klappen)
    const details = document.createElement("details");
    const samenvatting = document.createElement("summary");
    samenvatting.textContent = "Bekijk de planning";
    details.appendChild(samenvatting);
    const ul = document.createElement("ul");
    ul.className = "compact";
    for (const item of taken) ul.appendChild(maakRegel(item));
    details.appendChild(ul);
    kaart.appendChild(details);

    const knoppen = div("plan-knoppen");
    const aanpassen = document.createElement("button");
    aanpassen.textContent = "✏️ Aanpassen";
    aanpassen.title = "Taken toevoegen, weghalen of op een andere dag zetten";
    aanpassen.onclick = () => openPlanVenster(plan.id);
    const weg = document.createElement("button");
    weg.className = "link-knop gevaar";
    weg.textContent = "🗑️ Verwijderen";
    weg.onclick = () => verwijderPlan(plan.id);
    knoppen.append(aanpassen, weg);
    kaart.appendChild(knoppen);

    vak.appendChild(kaart);
  }
}

// ----- Bovenaan de To-do: je leerplannen in het kort -----

function toonTodoPlannen() {
  const vak = document.getElementById("todo-plannen");
  vak.innerHTML = "";

  const plannen = leerplannen
    .filter(plan => dagenTot(plan.tentamenDatum) >= 0) // geweest? dan niet meer laten zien
    .sort((a, b) => a.tentamenDatum.localeCompare(b.tentamenDatum));

  if (plannen.length === 0) {
    vak.innerHTML = '<p class="leeg">Nog geen leerplannen. Maak er een voor je volgende tentamen: ' +
      'typ wat je moet doen en vink aan op welke dag.</p>';
    return;
  }

  for (const plan of plannen) {
    const taken = planItems(plan.id);
    const af = taken.filter(item => item.klaar).length;
    const achter = taken.filter(item => item.datum < vandaag() && !item.klaar).length;
    const dagen = dagenTot(plan.tentamenDatum);

    const knop = document.createElement("button");
    knop.className = "plan-chip" + (achter ? " achter" : "");
    knop.title = "Klik om dit leerplan aan te passen";
    knop.onclick = () => openPlanVenster(plan.id);

    const naam = document.createElement("strong");
    naam.textContent = plan.vak;
    const info = document.createElement("span");
    info.textContent = af + "/" + taken.length + " af · " +
      (dagen === 0 ? "vandaag!" : dagen === 1 ? "morgen!" : "nog " + dagen + " dagen") +
      (achter ? " · ⚠️ " + achter + " achter" : "");

    const balk = div("drukte");
    const vulling = div("drukte-balk " + (achter ? "drukte-gemiddeld" : "drukte-rustig"));
    vulling.style.width = (taken.length ? af / taken.length * 100 : 0) + "%";
    balk.appendChild(vulling);

    knop.append(naam, info, balk);
    vak.appendChild(knop);
  }
}

// ----- Het leerplan-venster -----

function openPlanVenster(planId = null) {
  bewerkPlanId = planId;
  const plan = leerplannen.find(plan => plan.id === planId);

  // De keuzelijst met tentamens uit je agenda
  const keuze = document.getElementById("plan-tentamen");
  keuze.innerHTML = "";
  for (const toets of komendeTentamens()) {
    keuze.appendChild(new Option("📝 " + mooieDatum(toets.datum) + " · " + toets.titel, toets.datum + "|" + toets.titel));
  }
  keuze.appendChild(new Option("✏️ Zelf invullen", ""));

  document.getElementById("plan-venster-titel").textContent = plan ? "✏️ " + plan.vak + " aanpassen" : "📚 Nieuw leerplan";
  document.getElementById("plan-opslaan").textContent = plan ? "✓ Wijzigingen opslaan" : "✓ Leerplan opslaan";
  document.getElementById("plan-nieuwe-taak").value = "";
  planRijen = [];

  if (plan) {
    keuze.value = "";
    document.getElementById("plan-vak").value = plan.vak;
    document.getElementById("plan-datum").value = plan.tentamenDatum;

    // Taken met dezelfde tekst worden één regel, met een vinkje op elke dag
    for (const item of planItems(plan.id).sort((a, b) => a.id - b.id)) {
      let rij = planRijen.find(rij => rij.titel === item.titel);
      if (!rij) {
        rij = { titel: item.titel, dagen: {} };
        planRijen.push(rij);
      }
      rij.dagen[item.datum] = item.id;
    }
  } else {
    kiesPlanTentamen();
  }

  document.getElementById("plan-venster").showModal();
  toonPlanRaster();
  document.getElementById("plan-nieuwe-taak").focus();
}

// Je kiest een tentamen: vul vak en datum alvast in
function kiesPlanTentamen() {
  const waarde = document.getElementById("plan-tentamen").value;
  if (!waarde) return;
  const [datum, titel] = waarde.split("|");
  document.getElementById("plan-vak").value = vakUitTitel(titel);
  document.getElementById("plan-datum").value = datum;
  toonPlanRaster();
}

// Welke dagen laten we zien? Van vandaag tot en met de dag van het tentamen
// (en eerdere dagen als daar al iets op staat)
function planDagen() {
  const tentamen = document.getElementById("plan-datum").value;
  if (!tentamen) return [];
  let eerste = vandaag();
  for (const rij of planRijen) {
    for (const datum of Object.keys(rij.dagen)) if (datum < eerste) eerste = datum;
  }
  const dagen = [];
  for (let datum = eerste; datum <= tentamen && dagen.length < 60; datum = plusDagen(datum, 1)) dagen.push(datum);
  return dagen;
}

// Je typt een taak (of plakt er meerdere tegelijk, één per regel)
function voegPlanTaakToe(tekst) {
  const invoer = document.getElementById("plan-nieuwe-taak");
  const regels = (typeof tekst === "string" ? tekst : invoer.value)
    // Een opsommingsteken ervoor ("- ", "• " of "1. ") halen we weg
    .split(/\r?\n/).map(regel => regel.replace(/^\s*(?:[-•*]|\d+[.)])\s+/, "").trim()).filter(Boolean);
  for (const titel of regels) planRijen.push({ titel: titel, dagen: {} });
  invoer.value = "";
  toonPlanRaster();
  invoer.focus();
}

// Taken op een dag die NIET bij dit leerplan horen (andere vakken, huiswerk, taken)
function andereTakenOp(datum) {
  return itemsOpDag(datum, items).filter(item =>
    ["taak", "deadline", "huiswerk", "toets"].includes(item.soort) && !item.klaar &&
    !(bewerkPlanId && item.planId === bewerkPlanId));
}

// Wat staat er op een dag al gepland? (agenda + andere taken), elk op een eigen regel
function alGepland(datum) {
  const regels = [];
  const agenda = dagSamenvatting(datum, "\n"); // staat in app.js
  if (agenda) regels.push(...agenda.split("\n"));
  for (const item of andereTakenOp(datum)) {
    regels.push((ICOON[item.soort] ? ICOON[item.soort] + " " : "• ") + item.titel + (item.vak ? " (" + item.vak + ")" : ""));
  }
  return regels;
}

// Het overzicht: de dagen naast elkaar, bovenaan wat er al staat,
// en per taak een vakje om aan te vinken op welke dag je het doet
function toonPlanRaster() {
  const vak = document.getElementById("plan-raster");
  vak.innerHTML = "";
  const dagen = planDagen();
  const tentamen = document.getElementById("plan-datum").value;

  if (!tentamen) {
    vak.innerHTML = '<p class="leeg">Kies eerst bij stap 1 je tentamen.</p>';
    toonPlanMelding();
    return;
  }

  const scroll = div("plan-scroll");
  const tabel = document.createElement("table");
  tabel.className = "plan-tabel";
  scroll.appendChild(tabel);

  // Kopregel: de dagen
  const kop = tabel.createTHead().insertRow();
  const hoek = document.createElement("th");
  hoek.className = "taak-kolom";
  kop.appendChild(hoek);
  for (const datum of dagen) {
    const th = document.createElement("th");
    th.className = dagClass(datum, tentamen);
    th.innerHTML = "<span></span><strong></strong>";
    th.querySelector("span").textContent = (datum === tentamen ? "📝 " : "") + DAGNAMEN[weekdag(datum)];
    th.querySelector("strong").textContent = Number(datum.slice(8)) + " " +
      new Date(datum).toLocaleDateString("nl-NL", { month: "short" });
    kop.appendChild(th);
  }
  kop.appendChild(document.createElement("th"));

  const lichaam = tabel.createTBody();

  // Rij "Al gepland": wat er die dag al staat
  const gepland = lichaam.insertRow();
  gepland.className = "al-gepland";
  const geplandNaam = gepland.insertCell();
  geplandNaam.className = "taak-kolom info";
  geplandNaam.textContent = "Al gepland";
  for (const datum of dagen) {
    const cel = gepland.insertCell();
    cel.className = dagClass(datum, tentamen);
    const regels = alGepland(datum);
    cel.textContent = regels.length ? regels.join("\n") : "–";
  }
  gepland.insertCell();

  // Een rij per taak, met een vakje per dag
  planRijen.forEach((rij, nummer) => {
    const tr = lichaam.insertRow();

    const taakCel = tr.insertCell();
    taakCel.className = "taak-kolom";
    const tekst = document.createElement("input");
    tekst.value = rij.titel;
    tekst.setAttribute("aria-label", "Taak");
    tekst.oninput = () => { rij.titel = tekst.value; };
    taakCel.appendChild(tekst);

    for (const datum of dagen) {
      const cel = tr.insertCell();
      cel.className = dagClass(datum, tentamen);
      const aan = datum in rij.dagen;
      const item = aan && rij.dagen[datum] ? items.find(item => item.id === rij.dagen[datum]) : null;
      const knop = document.createElement("button");
      knop.type = "button";
      knop.className = "dag-vakje" + (aan ? " aan" : "") + (item && item.klaar ? " klaar" : "");
      knop.textContent = aan ? "✓" : "";
      knop.title = mooieDatum(datum) + (aan ? " (klik om weg te halen)" : " (klik om aan te vinken)");
      knop.onclick = () => {
        if (datum in rij.dagen) delete rij.dagen[datum];
        else rij.dagen[datum] = null;
        toonPlanRaster();
      };
      cel.appendChild(knop);
    }

    const wegCel = tr.insertCell();
    const weg = document.createElement("button");
    weg.type = "button";
    weg.className = "verwijder";
    weg.textContent = "✕";
    weg.title = "Taak weghalen";
    weg.onclick = () => {
      planRijen.splice(nummer, 1);
      toonPlanRaster();
    };
    wegCel.appendChild(weg);
  });

  if (planRijen.length === 0) {
    const leeg = lichaam.insertRow().insertCell();
    leeg.colSpan = dagen.length + 2;
    leeg.className = "taak-kolom leeg";
    leeg.textContent = "Typ bij stap 2 wat je moet doen, dan kun je hier per dag aanvinken.";
  }

  vak.appendChild(scroll);
  toonPlanMelding();
}

function dagClass(datum, tentamen) {
  const weekend = weekdag(datum) === 0 || weekdag(datum) === 6;
  return (weekend ? "weekend " : "") + (datum === vandaag() ? "is-vandaag " : "") + (datum === tentamen ? "tentamen-kolom" : "");
}

function toonPlanMelding() {
  const zonderDag = planRijen.filter(rij => Object.keys(rij.dagen).length === 0).length;
  document.getElementById("plan-melding").textContent = zonderDag
    ? zonderDag + (zonderDag === 1 ? " taak heeft" : " taken hebben") + " nog geen dag"
    : planRijen.length ? "✓ Alles heeft een dag" : "";
}

// Hulpje: de taken die nog geen dag hebben op volgorde zetten, elke dag één (vanaf vandaag)
function zetOpVolgorde() {
  const dagen = planDagen().filter(datum => datum >= vandaag());
  let nummer = 0;
  for (const rij of planRijen) {
    if (Object.keys(rij.dagen).length > 0) continue;
    const datum = dagen[Math.min(nummer, dagen.length - 1)];
    if (datum) rij.dagen[datum] = null;
    nummer++;
  }
  toonPlanRaster();
}

function slaPlanOp(event) {
  event.preventDefault();
  const vakNaam = document.getElementById("plan-vak").value.trim();
  const tentamenDatum = document.getElementById("plan-datum").value;
  planRijen = planRijen.filter(rij => rij.titel.trim());

  if (!vakNaam || !tentamenDatum) {
    alert("Vul bij stap 1 het vak en de datum van het tentamen in.");
    return;
  }
  if (planRijen.length === 0) {
    alert("Typ bij stap 2 eerst wat je moet doen.");
    return;
  }
  const zonderDag = planRijen.find(rij => Object.keys(rij.dagen).length === 0);
  if (zonderDag) {
    alert('Vink nog een dag aan voor "' + zonderDag.titel + '".');
    return;
  }

  let plan = leerplannen.find(plan => plan.id === bewerkPlanId);
  if (!plan) {
    plan = { id: Date.now() };
    leerplannen.push(plan);
  }
  Object.assign(plan, { vak: vakNaam, tentamenDatum: tentamenDatum, bijgewerkt: Date.now() });

  // Elke aangevinkte dag wordt een taak. Bestaande taken houden we (met hun vinkje), de rest maken we nieuw.
  const blijven = new Set();
  let id = Date.now();
  for (const rij of planRijen) {
    for (const [datum, bestaandId] of Object.entries(rij.dagen)) {
      const bestaand = bestaandId && items.find(item => item.id === bestaandId);
      if (bestaand) {
        Object.assign(bestaand, { titel: rij.titel.trim(), vak: vakNaam, datum: datum });
        blijven.add(bestaand.id);
      } else {
        const nieuw = { id: ++id, soort: "huiswerk", titel: rij.titel.trim(), vak: vakNaam, datum: datum,
          planId: plan.id, klaar: false };
        items.push(nieuw);
        blijven.add(nieuw.id);
      }
    }
  }
  // Weggehaalde vinkjes en taken: weg
  items = items.filter(item => item.planId !== plan.id || blijven.has(item.id));

  bewaarItems();
  document.getElementById("plan-venster").close();
  toonAlles();
}

function verwijderPlan(planId) {
  const plan = leerplannen.find(plan => plan.id === planId);
  if (!confirm('Leerplan "' + plan.vak + '" verwijderen? Alle taken ervan verdwijnen ook.')) return;
  leerplannen = leerplannen.filter(ander => ander.id !== planId);
  items = items.filter(item => item.planId !== planId);
  bewaarItems();
  toonAlles();
}

// Vanuit het Toevoegen-venster: soort "📚 Leerplan" gekozen
function vanToevoegenNaarPlan() {
  const titel = document.getElementById("titel").value.trim();
  document.getElementById("soort").value = "taak"; // voor de volgende keer
  document.getElementById("toevoeg-venster").close();
  openPlanVenster();
  // Had je al een vak getypt? Dan nemen we dat over
  if (titel) {
    document.getElementById("plan-tentamen").value = "";
    document.getElementById("plan-vak").value = vakUitTitel(titel);
    document.getElementById("titel").value = "";
  }
}

// ----- Starten -----
document.querySelectorAll(".nieuw-plan-knop").forEach(knop => knop.addEventListener("click", () => openPlanVenster()));
document.querySelectorAll("[data-studie]").forEach(knop =>
  knop.addEventListener("click", () => kiesStudieTab(knop.dataset.studie)));
document.getElementById("studie-vorige").addEventListener("click", () => {
  studieFocus = plusDagen(studieFocus, -7);
  toonStudie();
});
document.getElementById("studie-volgende").addEventListener("click", () => {
  studieFocus = plusDagen(studieFocus, 7);
  toonStudie();
});
document.getElementById("studie-deze-week").addEventListener("click", () => {
  studieFocus = vandaag();
  toonStudie();
});
document.getElementById("school-formulier").addEventListener("submit", voegSchoolTaakToe);
document.getElementById("school-soort").addEventListener("change", () => {
  const soort = document.getElementById("school-soort").value;
  document.querySelector("#school-formulier .veld").firstChild.textContent =
    soort === "deadline" ? "Inleveren op " : soort === "toets" ? "Op " : "Af op ";
});
document.getElementById("plan-tentamen").addEventListener("change", kiesPlanTentamen);
document.getElementById("plan-datum").addEventListener("change", toonPlanRaster);
document.getElementById("plan-taak-toevoegen").addEventListener("click", () => voegPlanTaakToe());
document.getElementById("plan-elke-dag").addEventListener("click", zetOpVolgorde);
document.getElementById("plan-nieuwe-taak").addEventListener("keydown", event => {
  if (event.key === "Enter") voegPlanTaakToe();
});
// Een lijstje plakken: elke regel wordt een taak
document.getElementById("plan-nieuwe-taak").addEventListener("paste", event => {
  const tekst = event.clipboardData.getData("text");
  if (!tekst.includes("\n")) return; // één regel: gewoon plakken
  event.preventDefault();
  voegPlanTaakToe(tekst);
});
document.getElementById("plan-formulier").addEventListener("submit", slaPlanOp);
// Enter in een invulvakje mag het plan niet meteen opslaan
document.getElementById("plan-formulier").addEventListener("keydown", event => {
  if (event.key === "Enter" && event.target.tagName === "INPUT") event.preventDefault();
});
document.getElementById("soort").addEventListener("change", () => {
  if (document.getElementById("soort").value === "leerplan") vanToevoegenNaarPlan();
});
