// ===== LEERPLANNER =====
// Maak per tentamen een planning: elke dag een stukje leren, en op het eind alles herhalen.
// De taken die eruit komen zijn gewone "huiswerk"-items met een planId,
// zodat ze ook in je To-do, dashboard en agenda staan.

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

// instellingen: { tentamenDatum, onderdelen, actie, start, herhaalAantal, overslaan, verdeling }
// Geeft een lijst terug: [{ datum, titel, onderdeel, planSoort: "leren" of "herhalen" }]
function maakPlanning(instellingen) {
  const { tentamenDatum, onderdelen, actie, start, herhaalAantal, overslaan, verdeling } = instellingen;
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
    const opnieuw = document.createElement("button");
    opnieuw.textContent = "🔄 Opnieuw plannen vanaf vandaag";
    opnieuw.title = "Verdeel wat nog niet af is over de dagen die je nog hebt";
    opnieuw.onclick = () => planOpnieuw(plan.id);
    const weg = document.createElement("button");
    weg.className = "link-knop gevaar";
    weg.textContent = "🗑️ Verwijderen";
    weg.onclick = () => verwijderPlan(plan.id);
    knoppen.append(opnieuw, weg);
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
    vak.innerHTML = '<p class="leeg">Nog geen leerplannen. Maak er een voor je volgende tentamen, ' +
      'dan verdeelt de app het leren over de dagen.</p>';
    return;
  }

  for (const plan of plannen) {
    const taken = planItems(plan.id);
    const af = taken.filter(item => item.klaar).length;
    const achter = taken.filter(item => item.datum < vandaag() && !item.klaar).length;
    const dagen = dagenTot(plan.tentamenDatum);

    const knop = document.createElement("button");
    knop.className = "plan-chip" + (achter ? " achter" : "");
    knop.title = "Bekijk dit leerplan";
    knop.onclick = () => kiesPagina("studie");

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

// ----- Een nieuw leerplan maken -----

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

function openPlanVenster() {
  // De keuzelijst met tentamens uit je agenda
  const keuze = document.getElementById("plan-tentamen");
  keuze.innerHTML = "";
  for (const toets of komendeTentamens()) {
    const optie = new Option("📝 " + mooieDatum(toets.datum) + " · " + toets.titel, toets.datum + "|" + toets.titel);
    keuze.appendChild(optie);
  }
  keuze.appendChild(new Option("✏️ Zelf invullen", ""));
  kiesPlanTentamen();

  document.getElementById("plan-start").value = vandaag();
  document.getElementById("plan-onderdelen").value = "";
  document.getElementById("plan-venster").showModal();
  toonPlanVoorbeeld();
}

// Je kiest een tentamen: vul vak en datum alvast in
function kiesPlanTentamen() {
  const waarde = document.getElementById("plan-tentamen").value;
  if (!waarde) return;
  const [datum, titel] = waarde.split("|");
  document.getElementById("plan-vak").value = vakUitTitel(titel);
  document.getElementById("plan-datum").value = datum;
  toonPlanVoorbeeld();
}

// "7 hoofdstukken" → Hoofdstuk 1 t/m Hoofdstuk 7
function vulHoofdstukken() {
  const aantal = Number(document.getElementById("plan-aantal").value);
  if (!aantal) return;
  const regels = [];
  for (let i = 1; i <= aantal; i++) regels.push("Hoofdstuk " + i);
  document.getElementById("plan-onderdelen").value = regels.join("\n");
  toonPlanVoorbeeld();
}

function leesPlanInstellingen() {
  return {
    vak: document.getElementById("plan-vak").value.trim(),
    tentamenDatum: document.getElementById("plan-datum").value,
    onderdelen: document.getElementById("plan-onderdelen").value
      .split("\n").map(regel => regel.trim()).filter(Boolean),
    actie: document.getElementById("plan-actie").value.trim(),
    start: document.getElementById("plan-start").value || vandaag(),
    herhaalAantal: Number(document.getElementById("plan-herhaal").value) || 0,
    overslaan: [...document.querySelectorAll("#plan-overslaan input:checked")].map(vakje => Number(vakje.value)),
    verdeling: document.getElementById("plan-verdeling").value
  };
}

// Laat zien hoe de planning eruit komt te zien, voordat je opslaat
function toonPlanVoorbeeld() {
  const vak = document.getElementById("plan-voorbeeld");
  const melding = document.getElementById("plan-melding");
  vak.innerHTML = "";
  melding.textContent = "";

  const instellingen = leesPlanInstellingen();
  if (!instellingen.tentamenDatum || instellingen.onderdelen.length === 0) {
    vak.innerHTML = '<p class="leeg">Vul een datum en wat je moet leren in, dan zie je hier je planning.</p>';
    return;
  }
  if (instellingen.start >= instellingen.tentamenDatum) {
    melding.textContent = "⚠️ Je begindatum moet vóór het tentamen liggen.";
    return;
  }

  const planning = maakPlanning(instellingen);
  const perDag = {};
  for (const taak of planning) (perDag[taak.datum] = perDag[taak.datum] || []).push(taak.titel);

  const meesteOpEenDag = Math.max(...Object.values(perDag).map(lijst => lijst.length));
  if (meesteOpEenDag > 1) {
    melding.textContent = "⚠️ Je hebt niet genoeg dagen voor één per dag, dus soms staan er " +
      meesteOpEenDag + " op één dag. Begin eerder als dat kan.";
  }

  for (const [datum, titels] of Object.entries(perDag)) {
    const li = document.createElement("li");
    const dag = document.createElement("span");
    dag.className = "tijd";
    dag.textContent = mooieDatum(datum);
    const tekst = document.createElement("span");
    tekst.className = "tekst";
    tekst.textContent = titels.join(" + ");
    li.append(dag, tekst);
    vak.appendChild(li);
  }
  const tentamen = document.createElement("li");
  tentamen.className = "tentamen-dag";
  tentamen.textContent = "📝 " + mooieDatum(instellingen.tentamenDatum) + " · Tentamen " + (instellingen.vak || "");
  vak.appendChild(tentamen);
}

function slaPlanOp(event) {
  event.preventDefault();
  const instellingen = leesPlanInstellingen();
  if (!instellingen.vak || !instellingen.tentamenDatum || instellingen.onderdelen.length === 0) {
    alert("Vul het vak, de datum van het tentamen en wat je moet leren in.");
    return;
  }
  if (instellingen.start >= instellingen.tentamenDatum) {
    alert("Je begindatum moet vóór het tentamen liggen.");
    return;
  }

  const plan = { id: Date.now(), ...instellingen, bijgewerkt: Date.now() };
  leerplannen.push(plan);
  voegPlanTakenToe(plan, maakPlanning(instellingen));

  bewaarItems();
  document.getElementById("plan-venster").close();
  toonAlles();
}

// Zet de planning om in huiswerk-items
function voegPlanTakenToe(plan, planning) {
  let id = Date.now();
  for (const taak of planning) {
    items.push({
      id: ++id,
      soort: "huiswerk",
      titel: taak.titel,
      vak: plan.vak,
      datum: taak.datum,
      planId: plan.id,
      planSoort: taak.planSoort,
      onderdeel: taak.onderdeel,
      klaar: false
    });
  }
}

// Achter geraakt? Verdeel wat nog niet af is over de dagen die je nog hebt
function planOpnieuw(planId) {
  const plan = leerplannen.find(plan => plan.id === planId);
  const nogTeDoen = planItems(planId).filter(item => !item.klaar);
  const onderdelen = nogTeDoen.filter(item => item.planSoort === "leren").map(item => item.onderdeel || item.titel);

  if (vandaag() >= plan.tentamenDatum) {
    alert("Het tentamen is vandaag of al geweest, dus opnieuw plannen kan niet meer.");
    return;
  }
  if (!confirm("De " + nogTeDoen.length + " dingen die nog niet af zijn opnieuw verdelen vanaf vandaag?")) return;

  items = items.filter(item => !nogTeDoen.includes(item));
  const instellingen = { ...plan, onderdelen: onderdelen, start: vandaag() };
  // Herhaaldagen die al af zijn, hoeven niet opnieuw
  const herhaalAf = planItems(planId).filter(item => item.planSoort === "herhalen" && item.klaar).length;
  instellingen.herhaalAantal = Math.max(0, plan.herhaalAantal - herhaalAf);
  voegPlanTakenToe(plan, maakPlanning(instellingen));

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

// ----- Starten -----
document.querySelectorAll(".nieuw-plan-knop").forEach(knop => knop.addEventListener("click", openPlanVenster));
document.getElementById("plan-tentamen").addEventListener("change", kiesPlanTentamen);
document.getElementById("soort").addEventListener("change", () => {
  if (document.getElementById("soort").value === "leerplan") vanToevoegenNaarPlan();
});
document.getElementById("plan-vul-hoofdstukken").addEventListener("click", vulHoofdstukken);
document.getElementById("plan-formulier").addEventListener("input", toonPlanVoorbeeld);
document.getElementById("plan-formulier").addEventListener("change", toonPlanVoorbeeld);
document.getElementById("plan-formulier").addEventListener("submit", slaPlanOp);
