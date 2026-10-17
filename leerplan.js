// ===== LEERPLANNER =====
// Maak per tentamen in één keer een planning: welke toets, wat je moet doen,
// en de app verdeelt het over de dagen (met herhaaldagen op het eind).
// De taken die eruit komen zijn gewone "huiswerk"-items met een planId,
// zodat ze ook in je To-do, dashboard en agenda staan.

let planRijen = [];       // de takenlijst in het leerplan-venster
let bewerkPlanId = null;  // welk plan je aan het aanpassen bent (null = nieuw plan)

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

// ----- De planning uitrekenen -----

// Welke dag krijgt elk onderdeel, en welke dagen zijn om te herhalen?
// instellingen: { tentamenDatum, onderdelen, actie, start, herhaalAantal, overslaan, verdeling }
// Geeft terug: [{ datum, titel, onderdeel, planSoort: "leren" of "herhalen" }]
// Welke dagen heb je om te leren, en welke om te herhalen?
function leerEnHerhaalDagen({ tentamenDatum, start, herhaalAantal, overslaan }) {
  const magOp = datum => !overslaan.includes(weekdag(datum));

  // De laatste dagen vóór het tentamen: alles herhalen
  const herhaalDagen = [];
  for (let datum = plusDagen(tentamenDatum, -1); herhaalDagen.length < herhaalAantal && datum >= start; datum = plusDagen(datum, -1)) {
    if (magOp(datum)) herhaalDagen.unshift(datum);
  }

  // De dagen daarvoor: leren
  const eindLeren = herhaalDagen.length ? herhaalDagen[0] : tentamenDatum;
  const leerDagen = [];
  for (let datum = start; datum < eindLeren; datum = plusDagen(datum, 1)) {
    if (magOp(datum)) leerDagen.push(datum);
  }
  // Helemaal geen tijd meer? Dan alles op de eerste dag die er is
  if (leerDagen.length === 0) leerDagen.push(herhaalDagen[0] || start);

  return { leerDagen, herhaalDagen };
}

function maakPlanning(instellingen) {
  const { onderdelen, verdeling } = instellingen;
  const actie = instellingen.actie || "";
  const { leerDagen, herhaalDagen } = leerEnHerhaalDagen(instellingen);

  const planning = onderdelen.map((onderdeel, nummer) => {
    let dag;
    if (verdeling === "elkeDag" && onderdelen.length <= leerDagen.length) {
      dag = leerDagen[nummer]; // elke dag één, zo snel mogelijk
    } else {
      // Gelijk verdelen over alle dagen (bij weinig dagen: meerdere per dag)
      dag = leerDagen[Math.floor(nummer * leerDagen.length / onderdelen.length)];
    }
    return { datum: dag, titel: onderdeel + (actie ? " " + actie : ""), onderdeel: onderdeel, planSoort: "leren" };
  });

  herhaalDagen.forEach((datum, nummer) => planning.push({
    datum: datum,
    titel: "Alles herhalen" + (herhaalDagen.length > 1 ? " (" + (nummer + 1) + "/" + herhaalDagen.length + ")" : ""),
    onderdeel: "",
    planSoort: "herhalen"
  }));

  return planning.sort((a, b) => a.datum.localeCompare(b.datum));
}

// Geef de taken een dag. Taken met dezelfde "groep" (bijv. Hoofdstuk 1 samenvatten
// en Hoofdstuk 1 leren) komen op dezelfde dag.
// Afgevinkte taken, en taken waarvan je zelf de dag hebt gekozen, blijven waar ze zijn.
function verdeel(rijen, instellingen) {
  const blijftStaan = rij => rij.klaar || (rij.handmatig && rij.datum >= instellingen.start);
  const afgevinkt = rijen.filter(blijftStaan);
  const teLeren = rijen.filter(rij => !blijftStaan(rij) && rij.planSoort !== "herhalen");
  const herhaalAf = afgevinkt.filter(rij => rij.planSoort === "herhalen").length;
  // Alleen afgevinkte of zelf gekozen herhaaldagen tellen; de rest maken we opnieuw

  const groepen = [...new Set(teLeren.map(rij => rij.groep || rij.titel))];
  const planning = maakPlanning({
    ...instellingen,
    onderdelen: groepen,
    actie: "",
    herhaalAantal: Math.max(0, instellingen.herhaalAantal - herhaalAf)
  });

  const dagVanGroep = {};
  for (const stap of planning) if (stap.planSoort === "leren") dagVanGroep[stap.onderdeel] = stap.datum;

  const geleerd = teLeren.map(rij => ({ ...rij, datum: dagVanGroep[rij.groep || rij.titel] }));
  const herhalen = planning
    .filter(stap => stap.planSoort === "herhalen")
    .map(stap => ({ titel: stap.titel, datum: stap.datum, planSoort: "herhalen", groep: "", klaar: false }));

  return afgevinkt.concat(geleerd, herhalen);
}

// Nieuwe taken (nog zonder dag) in een bestaand plan: zet ze op de rustigste dag,
// zonder de rest van je planning te verschuiven
function geefNieuweTakenEenDag(rijen, instellingen) {
  const { leerDagen } = leerEnHerhaalDagen(instellingen);
  const groepDag = {};
  const drukte = Object.fromEntries(leerDagen.map(dag => [dag, new Set()]));
  for (const rij of rijen) {
    if (!rij.datum || rij.planSoort === "herhalen") continue;
    groepDag[rij.groep || rij.titel] = rij.datum;
    if (drukte[rij.datum]) drukte[rij.datum].add(rij.groep || rij.titel);
  }

  for (const rij of rijen.filter(rij => !rij.datum)) {
    const groep = rij.groep || rij.titel;
    if (!groepDag[groep]) {
      // De dag met de minste onderdelen (bij gelijk: de eerste)
      const rustigst = leerDagen.reduce((beste, dag) => drukte[dag].size < drukte[beste].size ? dag : beste, leerDagen[0]);
      groepDag[groep] = rustigst;
      drukte[rustigst].add(groep);
    }
    rij.datum = groepDag[groep];
  }
  return rijen;
}

// ----- De pagina "Studie" -----

function toonStudie() {
  const leeg = leerplannen.length === 0;
  document.getElementById("studie-leeg").classList.toggle("verborgen", !leeg);
  document.getElementById("studie-inhoud").classList.toggle("verborgen", leeg);
  if (leeg) return;

  toonStudiePerDag();
  toonStudiePerVak();
}

function planItems(planId) {
  return items.filter(item => item.planId === planId);
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
  if (achter.length) {
    voegKopToe(lijst, "⚠️ Nog niet af van eerdere dagen · " + achter.length, "te-laat");
    for (const item of achter.sort((a, b) => a.datum.localeCompare(b.datum))) {
      const li = maakRegel(item);
      li.classList.add("is-te-laat");
      lijst.appendChild(li);
    }
  }

  for (let datum = vandaag(); datum <= laatsteDag; datum = plusDagen(datum, 1)) {
    const taken = alleTaken.filter(item => item.datum === datum).sort((a, b) => (a.vak || "").localeCompare(b.vak || ""));
    const toetsen = tentamens.filter(item => item.datum === datum);
    if (taken.length === 0 && toetsen.length === 0) continue;

    const open = taken.filter(item => !item.klaar).length;
    voegKopToe(lijst, dagKop(datum) + (taken.length ? (open ? " · " + open + " te doen" : " · ✓ alles af") : ""),
      datum === vandaag() ? "is-vandaag" : "");

    for (const toets of toetsen) {
      const li = document.createElement("li");
      li.className = "tentamen-dag";
      li.textContent = "📝 " + toets.titel + (toets.begintijd ? " · " + toets.begintijd : "") +
        (toets.locatie ? " · " + toets.locatie : "") + " · succes! 💪";
      lijst.appendChild(li);
    }
    for (const item of taken) lijst.appendChild(maakRegel(item));
  }
}

function voegKopToe(lijst, tekst, extraClass) {
  const kop = document.createElement("li");
  kop.className = "dag-kop " + extraClass;
  kop.textContent = tekst;
  lijst.appendChild(kop);
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
    aanpassen.title = "Taken toevoegen, weghalen of naar een andere dag zetten";
    aanpassen.onclick = () => openPlanVenster(plan.id);
    const opnieuw = document.createElement("button");
    opnieuw.textContent = "🔄 Opnieuw plannen";
    opnieuw.title = "Verdeel wat nog niet af is over de dagen die je nog hebt (vanaf vandaag)";
    opnieuw.onclick = () => planOpnieuw(plan.id);
    const weg = document.createElement("button");
    weg.className = "link-knop gevaar";
    weg.textContent = "🗑️ Verwijderen";
    weg.onclick = () => verwijderPlan(plan.id);
    knoppen.append(aanpassen, opnieuw, weg);
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
      'je vult in één keer in wat je moet doen, en de app verdeelt het over de dagen.</p>';
    return;
  }

  for (const plan of plannen) {
    const taken = planItems(plan.id);
    const af = taken.filter(item => item.klaar).length;
    const achter = taken.filter(item => item.datum < vandaag() && !item.klaar).length;
    const dagen = dagenTot(plan.tentamenDatum);

    const knop = document.createElement("button");
    knop.className = "plan-chip" + (achter ? " achter" : "");
    knop.title = "Klik om dit leerplan te bekijken of aan te passen";
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

// ----- Het leerplan-venster: nieuw maken of aanpassen -----

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
  document.getElementById("plan-losse-taak").value = "";

  if (plan) {
    // Bestaand plan: alles invullen zoals het was
    keuze.value = "";
    document.getElementById("plan-vak").value = plan.vak;
    document.getElementById("plan-datum").value = plan.tentamenDatum;
    document.getElementById("plan-start").value = plan.start > vandaag() ? plan.start : vandaag();
    document.getElementById("plan-herhaal").value = plan.herhaalAantal;
    document.getElementById("plan-verdeling").value = plan.verdeling || "elkeDag";
    document.querySelectorAll("#plan-overslaan input").forEach(vakje =>
      vakje.checked = (plan.overslaan || []).includes(Number(vakje.value)));
    planRijen = planItems(plan.id)
      .sort((a, b) => a.datum.localeCompare(b.datum))
      .map(item => ({ id: item.id, titel: item.titel, datum: item.datum, planSoort: item.planSoort,
        groep: item.groep || item.onderdeel || "", klaar: item.klaar, handmatig: item.handmatig }));
  } else {
    document.getElementById("plan-start").value = vandaag();
    planRijen = [];
    kiesPlanTentamen();
  }

  document.getElementById("plan-venster").showModal();
  toonPlanRijen();
  toonPlanVoorbeeld();
}

// Je kiest een tentamen: vul vak en datum alvast in
function kiesPlanTentamen() {
  const waarde = document.getElementById("plan-tentamen").value;
  if (!waarde) return;
  const [datum, titel] = waarde.split("|");
  document.getElementById("plan-vak").value = vakUitTitel(titel);
  document.getElementById("plan-datum").value = datum;
  herverdeel();
}

function leesPlanInstellingen() {
  return {
    vak: document.getElementById("plan-vak").value.trim(),
    tentamenDatum: document.getElementById("plan-datum").value,
    start: document.getElementById("plan-start").value || vandaag(),
    herhaalAantal: Number(document.getElementById("plan-herhaal").value) || 0,
    overslaan: [...document.querySelectorAll("#plan-overslaan input:checked")].map(vakje => Number(vakje.value)),
    verdeling: document.getElementById("plan-verdeling").value
  };
}

// Klopt de datum en de begindag? Dan kunnen we verdelen
function kanVerdelen(instellingen) {
  return instellingen.tentamenDatum && instellingen.start < instellingen.tentamenDatum;
}

// Verdeel de taken (opnieuw) over de dagen en laat het zien
function herverdeel() {
  const instellingen = leesPlanInstellingen();
  if (kanVerdelen(instellingen) && planRijen.length) planRijen = verdeel(planRijen, instellingen);
  toonPlanRijen();
  toonPlanVoorbeeld();
}

// Je hebt taken toegevoegd. Nieuw plan: alles netjes verdelen.
// Bestaand plan: alleen de nieuwe taken een dag geven, de rest blijft staan.
function nieuweTakenToegevoegd() {
  const instellingen = leesPlanInstellingen();
  if (bewerkPlanId && kanVerdelen(instellingen)) {
    planRijen = geefNieuweTakenEenDag(planRijen, instellingen);
    toonPlanRijen();
    toonPlanVoorbeeld();
  } else {
    herverdeel();
  }
}

// "7 × Hoofdstuk, samenvatten + leren" → H1 samenvatten, H1 leren, H2 samenvatten, …
function genereerTaken() {
  const aantal = Number(document.getElementById("plan-aantal").value);
  const naam = document.getElementById("plan-prefix").value.trim() || "Hoofdstuk";
  const acties = [...document.querySelectorAll("#plan-acties input:checked")].map(vakje => vakje.value);
  if (!aantal) return;

  for (let nummer = 1; nummer <= aantal; nummer++) {
    const groep = naam + " " + nummer;
    if (acties.length === 0) planRijen.push({ titel: groep, groep: groep, planSoort: "leren", klaar: false });
    for (const actie of acties) {
      planRijen.push({ titel: groep + " " + actie, groep: groep, planSoort: "leren", klaar: false });
    }
  }
  nieuweTakenToegevoegd();
}

function voegLosseTaakToe() {
  const invoer = document.getElementById("plan-losse-taak");
  const titel = invoer.value.trim();
  if (!titel) return;
  planRijen.push({ titel: titel, groep: titel, planSoort: "leren", klaar: false });
  invoer.value = "";
  nieuweTakenToegevoegd();
  invoer.focus();
}

// De lijst met taken, waarin je de tekst en de dag zelf kunt aanpassen
function toonPlanRijen() {
  const lijst = document.getElementById("plan-rijen");
  lijst.innerHTML = "";
  planRijen.sort((a, b) => (a.datum || "9999").localeCompare(b.datum || "9999"));

  if (planRijen.length === 0) {
    lijst.innerHTML = '<p class="leeg">Nog geen taken. Gebruik "Voeg toe aan de lijst" hierboven, of typ hieronder een losse taak.</p>';
    return;
  }

  const instellingen = leesPlanInstellingen();
  planRijen.forEach((rij, nummer) => {
    const li = document.createElement("li");
    li.className = "plan-taak" + (rij.planSoort === "herhalen" ? " herhalen" : "") + (rij.klaar ? " klaar" : "");

    const tekst = document.createElement("input");
    tekst.className = "tekst";
    tekst.value = rij.titel;
    tekst.setAttribute("aria-label", "Taak");
    tekst.oninput = () => {
      rij.titel = tekst.value;
      toonPlanVoorbeeld();
    };

    const dag = document.createElement("input");
    dag.type = "date";
    dag.value = rij.datum || "";
    if (instellingen.tentamenDatum) dag.max = plusDagen(instellingen.tentamenDatum, -1);
    dag.setAttribute("aria-label", "Dag");
    dag.onchange = () => {
      rij.datum = dag.value;
      rij.handmatig = true; // zelf gekozen: niet meer automatisch verschuiven
      toonPlanVoorbeeld();
    };

    const weg = document.createElement("button");
    weg.type = "button";
    weg.className = "verwijder";
    weg.textContent = "✕";
    weg.title = "Taak weghalen";
    weg.onclick = () => {
      planRijen.splice(nummer, 1);
      toonPlanRijen();
      toonPlanVoorbeeld();
    };

    if (rij.klaar) {
      const vinkje = document.createElement("span");
      vinkje.textContent = "✓";
      vinkje.title = "Al af";
      li.appendChild(vinkje);
    }
    li.append(tekst, dag, weg);
    lijst.appendChild(li);
  });
}

// Laat per dag zien hoe de planning eruitziet, voordat je opslaat
function toonPlanVoorbeeld() {
  const vak = document.getElementById("plan-voorbeeld");
  const melding = document.getElementById("plan-melding");
  vak.innerHTML = "";
  melding.textContent = "";

  const instellingen = leesPlanInstellingen();
  if (instellingen.tentamenDatum && instellingen.start >= instellingen.tentamenDatum) {
    melding.textContent = "⚠️ Je begindatum moet vóór het tentamen liggen.";
  }
  if (planRijen.length === 0) {
    vak.innerHTML = '<p class="leeg">Hier zie je straks per dag wat je moet doen.</p>';
    return;
  }

  const perDag = {};
  for (const rij of planRijen) (perDag[rij.datum || "?"] = perDag[rij.datum || "?"] || []).push(rij);

  const meesteOpEenDag = Math.max(...Object.entries(perDag)
    .map(([, rijen]) => new Set(rijen.map(rij => rij.groep || rij.titel)).size));
  if (meesteOpEenDag > 1 && !melding.textContent) {
    melding.textContent = "⚠️ Op sommige dagen staan " + meesteOpEenDag +
      " onderdelen. Begin eerder, of haal het weekend uit 'Vrij op', als dat kan.";
  }

  for (const datum of Object.keys(perDag).sort()) {
    const li = document.createElement("li");
    const dag = document.createElement("span");
    dag.className = "tijd";
    dag.textContent = datum === "?" ? "Geen dag" : mooieDatum(datum);
    const tekst = document.createElement("span");
    tekst.className = "tekst";
    tekst.textContent = perDag[datum].map(rij => (rij.klaar ? "✓ " : "") + rij.titel).join(" · ");
    li.append(dag, tekst);
    vak.appendChild(li);
  }
  if (instellingen.tentamenDatum) {
    const tentamen = document.createElement("li");
    tentamen.className = "tentamen-dag";
    tentamen.textContent = "📝 " + mooieDatum(instellingen.tentamenDatum) + " · Tentamen " + instellingen.vak;
    vak.appendChild(tentamen);
  }
}

function slaPlanOp(event) {
  event.preventDefault();
  const instellingen = leesPlanInstellingen();
  planRijen = planRijen.filter(rij => rij.titel.trim());

  if (!instellingen.vak || !instellingen.tentamenDatum) {
    alert("Vul het vak en de datum van het tentamen in.");
    return;
  }
  if (planRijen.length === 0) {
    alert("Voeg eerst taken toe bij stap 2.");
    return;
  }
  const zonderDag = planRijen.find(rij => !rij.datum);
  if (zonderDag) {
    alert('Kies een dag voor "' + zonderDag.titel + '".');
    return;
  }

  let plan = leerplannen.find(plan => plan.id === bewerkPlanId);
  if (!plan) {
    plan = { id: Date.now() };
    leerplannen.push(plan);
  }
  Object.assign(plan, instellingen, {
    onderdelen: [...new Set(planRijen.filter(rij => rij.planSoort !== "herhalen").map(rij => rij.groep || rij.titel))],
    actie: "",
    bijgewerkt: Date.now()
  });
  pasPlanToe(plan, planRijen);

  bewaarItems();
  document.getElementById("plan-venster").close();
  toonAlles();
}

// Zet de taken uit het venster om in huiswerk-items (bestaande bijwerken, nieuwe maken, weggehaalde verwijderen)
function pasPlanToe(plan, rijen) {
  const blijven = new Set(rijen.filter(rij => rij.id).map(rij => rij.id));
  items = items.filter(item => item.planId !== plan.id || blijven.has(item.id));

  let id = Date.now();
  for (const rij of rijen) {
    const gegevens = {
      titel: rij.titel.trim(),
      vak: plan.vak,
      datum: rij.datum,
      planSoort: rij.planSoort || "leren",
      groep: rij.groep || "",
      onderdeel: rij.planSoort === "herhalen" ? "" : (rij.groep || rij.titel),
      handmatig: Boolean(rij.handmatig)
    };
    const bestaand = rij.id && items.find(item => item.id === rij.id);
    if (bestaand) {
      Object.assign(bestaand, gegevens);
    } else {
      items.push({ id: ++id, soort: "huiswerk", planId: plan.id, klaar: false, ...gegevens });
    }
  }
}

// Achter geraakt? Verdeel wat nog niet af is over de dagen die je nog hebt
function planOpnieuw(planId) {
  const plan = leerplannen.find(plan => plan.id === planId);
  if (vandaag() >= plan.tentamenDatum) {
    alert("Het tentamen is vandaag of al geweest, dus opnieuw plannen kan niet meer.");
    return;
  }
  const open = planItems(planId).filter(item => !item.klaar).length;
  if (!confirm("De " + open + " dingen die nog niet af zijn opnieuw verdelen vanaf vandaag?")) return;

  const rijen = planItems(planId).map(item => ({
    id: item.id, titel: item.titel, datum: item.datum, planSoort: item.planSoort,
    groep: item.groep || item.onderdeel || "", klaar: item.klaar, handmatig: item.handmatig
  }));
  pasPlanToe(plan, verdeel(rijen, { ...plan, start: vandaag() }));

  plan.bijgewerkt = Date.now();
  bewaarItems();
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
    toonPlanVoorbeeld();
  }
}

// ----- Starten -----
document.querySelectorAll(".nieuw-plan-knop").forEach(knop => knop.addEventListener("click", () => openPlanVenster()));
document.getElementById("plan-tentamen").addEventListener("change", kiesPlanTentamen);
document.getElementById("plan-genereer").addEventListener("click", genereerTaken);
document.getElementById("plan-losse-toevoegen").addEventListener("click", voegLosseTaakToe);
document.getElementById("plan-losse-taak").addEventListener("keydown", event => {
  if (event.key === "Enter") {
    event.preventDefault(); // niet het hele formulier opslaan
    voegLosseTaakToe();
  }
});
// Instellingen veranderd? Dan opnieuw verdelen
for (const id of ["plan-datum", "plan-start", "plan-herhaal", "plan-verdeling"]) {
  document.getElementById(id).addEventListener("change", herverdeel);
}
document.querySelectorAll("#plan-overslaan input").forEach(vakje => vakje.addEventListener("change", herverdeel));
document.getElementById("plan-vak").addEventListener("input", toonPlanVoorbeeld);
document.getElementById("plan-formulier").addEventListener("submit", slaPlanOp);
// Enter in een invulvakje mag het plan niet meteen opslaan
document.getElementById("plan-formulier").addEventListener("keydown", event => {
  if (event.key === "Enter" && event.target.tagName === "INPUT") event.preventDefault();
});
document.getElementById("soort").addEventListener("change", () => {
  if (document.getElementById("soort").value === "leerplan") vanToevoegenNaarPlan();
});
