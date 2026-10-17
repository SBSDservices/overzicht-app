// ===== LEERPLANNER =====
// Per tentamen: je typt zelf wat je moet doen, en kiest per taak de dag.
// Elke taak wordt een gewone "huiswerk"-taak met een planId,
// zodat hij ook in je To-do, dashboard en agenda staat.

// De taken in het venster. Elke taak: { titel, datum, id (als hij al bestond) }
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

function toonStudie() {
  const leeg = leerplannen.length === 0;
  document.getElementById("studie-leeg").classList.toggle("verborgen", !leeg);
  document.getElementById("studie-inhoud").classList.toggle("verborgen", leeg);
  if (leeg) return;

  toonStudiePerDag();
  toonStudiePerVak();
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
  document.getElementById("plan-nieuwe-datum").value = vandaag();
  planRijen = [];

  if (plan) {
    keuze.value = "";
    document.getElementById("plan-vak").value = plan.vak;
    document.getElementById("plan-datum").value = plan.tentamenDatum;
    planRijen = planItems(plan.id).map(item => ({ id: item.id, titel: item.titel, datum: item.datum }));
  } else {
    kiesPlanTentamen();
  }

  document.getElementById("plan-venster").showModal();
  toonPlanTaken();
  toonPlanDagInfo();
  document.getElementById("plan-nieuwe-taak").focus();
}

// Je kiest een tentamen: vul vak en datum alvast in
function kiesPlanTentamen() {
  const waarde = document.getElementById("plan-tentamen").value;
  if (!waarde) return;
  const [datum, titel] = waarde.split("|");
  document.getElementById("plan-vak").value = vakUitTitel(titel);
  document.getElementById("plan-datum").value = datum;
  toonPlanTaken();
}

// Je typt een taak (of plakt er meerdere tegelijk, één per regel) en kiest de dag
function voegPlanTaakToe(tekst) {
  const invoer = document.getElementById("plan-nieuwe-taak");
  const datum = document.getElementById("plan-nieuwe-datum").value;
  const regels = (typeof tekst === "string" ? tekst : invoer.value)
    // Een opsommingsteken ervoor ("- ", "• " of "1. ") halen we weg
    .split(/\r?\n/).map(regel => regel.replace(/^\s*(?:[-•*]|\d+[.)])\s+/, "").trim()).filter(Boolean);
  for (const titel of regels) planRijen.push({ titel: titel, datum: datum });
  invoer.value = "";
  toonPlanTaken();
  toonPlanDagInfo();
  invoer.focus();
}

// De lijst met taken. Per taak kun je de tekst en de dag aanpassen.
function toonPlanTaken() {
  const vak = document.getElementById("plan-raster");
  vak.innerHTML = "";
  const tentamen = document.getElementById("plan-datum").value;

  // De datumvakjes mogen tot en met de dag van het tentamen (dan kun je die ochtend nog leren)
  const laatste = tentamen || "";
  document.getElementById("plan-nieuwe-datum").max = laatste;

  if (planRijen.length === 0) {
    vak.innerHTML = '<p class="leeg">Nog geen taken. Typ hierboven wat je moet doen.</p>';
    toonPlanMelding();
    return;
  }

  // Op volgorde van datum (taken zonder datum onderaan)
  planRijen.sort((a, b) => (a.datum || "9999").localeCompare(b.datum || "9999"));

  const lijst = document.createElement("ul");
  lijst.className = "plan-taken";
  planRijen.forEach((rij, nummer) => {
    const item = rij.id ? items.find(item => item.id === rij.id) : null;
    const li = document.createElement("li");
    li.className = "plan-taak" + (item && item.klaar ? " klaar" : "") + (!rij.datum ? " zonder-dag" : "");

    if (item && item.klaar) {
      const vinkje = document.createElement("span");
      vinkje.className = "plan-af";
      vinkje.textContent = "✓";
      vinkje.title = "Al af";
      li.appendChild(vinkje);
    }

    const tekst = document.createElement("input");
    tekst.className = "tekst";
    tekst.value = rij.titel;
    tekst.setAttribute("aria-label", "Taak");
    tekst.oninput = () => { rij.titel = tekst.value; };

    const dag = document.createElement("input");
    dag.type = "date";
    dag.value = rij.datum || "";
    dag.max = laatste;
    dag.setAttribute("aria-label", "Op welke dag");
    dag.onchange = () => {
      rij.datum = dag.value;
      toonPlanTaken(); // opnieuw op volgorde zetten
    };

    const weg = document.createElement("button");
    weg.type = "button";
    weg.className = "verwijder";
    weg.textContent = "✕";
    weg.title = "Taak weghalen";
    weg.onclick = () => {
      planRijen.splice(nummer, 1);
      toonPlanTaken();
    };

    li.append(tekst, dag, weg);
    lijst.appendChild(li);
  });
  vak.appendChild(lijst);

  // Ter controle: per dag wat je moet doen
  const perDag = {};
  for (const rij of planRijen) if (rij.datum) (perDag[rij.datum] = perDag[rij.datum] || []).push(rij.titel || "…");
  const dagen = Object.keys(perDag).sort();
  if (dagen.length) {
    const kop = document.createElement("h4");
    kop.textContent = "📅 Zo ziet je planning eruit";
    vak.appendChild(kop);
    const overzicht = document.createElement("ul");
    overzicht.className = "compact plan-overzicht";
    for (const datum of dagen) {
      const li = document.createElement("li");
      const wanneer = document.createElement("span");
      wanneer.className = "tijd";
      wanneer.textContent = mooieDatum(datum);
      const wat = document.createElement("span");
      wat.className = "tekst";
      wat.textContent = perDag[datum].join(" · ");

      // Wat er die dag verder nog staat (andere vakken en je agenda)
      const andere = andereTakenOp(datum);
      if (andere.length) {
        const ook = document.createElement("span");
        ook.className = "plan-ook";
        ook.textContent = "+ ook: " + andere.map(naamMetVak).join(" · ");
        wat.appendChild(ook);
      }
      const agenda = dagSamenvatting(datum);
      if (agenda) {
        const regel = document.createElement("span");
        regel.className = "dag-agenda";
        regel.textContent = agenda;
        wat.appendChild(regel);
      }

      li.append(wanneer, wat);
      overzicht.appendChild(li);
    }
    if (tentamen) {
      const li = document.createElement("li");
      li.className = "tentamen-dag";
      li.textContent = "📝 " + mooieDatum(tentamen) + " · Tentamen " + document.getElementById("plan-vak").value;
      overzicht.appendChild(li);
    }
    vak.appendChild(overzicht);
  }

  toonPlanMelding();
}

// Taken op een dag die NIET bij dit leerplan horen (andere vakken, huiswerk, taken)
function andereTakenOp(datum) {
  return itemsOpDag(datum, items).filter(item =>
    ["taak", "deadline", "huiswerk", "toets"].includes(item.soort) && !item.klaar &&
    !(bewerkPlanId && item.planId === bewerkPlanId));
}

function naamMetVak(item) {
  return item.titel + (item.vak ? " (" + item.vak + ")" : "");
}

// Onder het datumvakje: wat staat er op die dag al?
function toonPlanDagInfo() {
  const vak = document.getElementById("plan-dag-info");
  const datum = document.getElementById("plan-nieuwe-datum").value;
  vak.innerHTML = "";
  vak.className = "plan-dag-info";
  if (!datum) return;

  const ditPlan = planRijen.filter(rij => rij.datum === datum).map(rij => rij.titel + " (dit vak)");
  const andere = andereTakenOp(datum).map(naamMetVak);
  const taken = ditPlan.concat(andere);
  const agenda = dagSamenvatting(datum); // staat in app.js

  const kop = document.createElement("strong");
  kop.textContent = "Op " + mooieDatum(datum) + ": ";
  vak.appendChild(kop);
  vak.appendChild(document.createTextNode(
    taken.length ? taken.length + (taken.length === 1 ? " taak" : " taken") + " — " + taken.join(" · ") : "nog geen taken 👍"));
  if (agenda) {
    const regel = document.createElement("span");
    regel.className = "dag-agenda";
    regel.textContent = agenda;
    vak.appendChild(regel);
  }
}

function toonPlanMelding() {
  const tentamen = document.getElementById("plan-datum").value;
  const zonderDag = planRijen.filter(rij => !rij.datum).length;
  const naTentamen = tentamen ? planRijen.filter(rij => rij.datum && rij.datum > tentamen).length : 0;
  let tekst = "";
  if (naTentamen) tekst = "⚠️ " + naTentamen + (naTentamen === 1 ? " taak staat" : " taken staan") + " ná je tentamen";
  else if (zonderDag) tekst = zonderDag + (zonderDag === 1 ? " taak heeft" : " taken hebben") + " nog geen dag";
  else if (planRijen.length) tekst = "✓ Alles heeft een dag";
  document.getElementById("plan-melding").textContent = tekst;
}

// Hulpje: de taken die nog geen dag hebben op volgorde zetten, elke dag één (vanaf vandaag)
function zetOpVolgorde() {
  const tentamen = document.getElementById("plan-datum").value;
  if (!tentamen) return;
  let datum = vandaag();
  for (const rij of planRijen) {
    if (rij.datum) continue;
    rij.datum = datum < tentamen ? datum : plusDagen(tentamen, -1);
    datum = plusDagen(datum, 1);
  }
  toonPlanTaken();
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
  const zonderDag = planRijen.find(rij => !rij.datum);
  if (zonderDag) {
    alert('Kies nog een dag voor "' + zonderDag.titel + '".');
    return;
  }

  let plan = leerplannen.find(plan => plan.id === bewerkPlanId);
  if (!plan) {
    plan = { id: Date.now() };
    leerplannen.push(plan);
  }
  Object.assign(plan, { vak: vakNaam, tentamenDatum: tentamenDatum, bijgewerkt: Date.now() });

  // Elke taak wordt een huiswerk-item. Bestaande taken houden we (met hun vinkje), de rest maken we nieuw.
  const blijven = new Set();
  let id = Date.now();
  for (const rij of planRijen) {
    const bestaand = rij.id && items.find(item => item.id === rij.id);
    if (bestaand) {
      Object.assign(bestaand, { titel: rij.titel.trim(), vak: vakNaam, datum: rij.datum });
      blijven.add(bestaand.id);
    } else {
      const nieuw = { id: ++id, soort: "huiswerk", titel: rij.titel.trim(), vak: vakNaam, datum: rij.datum,
        planId: plan.id, klaar: false };
      items.push(nieuw);
      blijven.add(nieuw.id);
    }
  }
  // Weggehaalde taken: weg
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
document.getElementById("plan-tentamen").addEventListener("change", kiesPlanTentamen);
document.getElementById("plan-datum").addEventListener("change", toonPlanTaken);
document.getElementById("plan-nieuwe-datum").addEventListener("change", toonPlanDagInfo);
document.getElementById("plan-taak-toevoegen").addEventListener("click", () => voegPlanTaakToe());
document.getElementById("plan-elke-dag").addEventListener("click", zetOpVolgorde);
document.getElementById("plan-nieuwe-taak").addEventListener("keydown", event => {
  if (event.key === "Enter") voegPlanTaakToe();
});// Een lijstje plakken: elke regel wordt een taak
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
