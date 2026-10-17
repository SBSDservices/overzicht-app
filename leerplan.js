// ===== LEERPLANNER =====
// Per tentamen: je typt zelf wat je moet doen, en vinkt per taak aan op welke dag(en).
// Elke aangevinkte dag wordt een gewone "huiswerk"-taak met een planId,
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

// Welke dagen laten we zien? Van vandaag tot de dag voor het tentamen
// (en eerdere dagen als daar al iets op staat)
function planDagen() {
  const tentamen = document.getElementById("plan-datum").value;
  if (!tentamen) return [];
  let eerste = vandaag();
  for (const rij of planRijen) {
    for (const datum of Object.keys(rij.dagen)) if (datum < eerste) eerste = datum;
  }
  const dagen = [];
  for (let datum = eerste; datum < tentamen && dagen.length < 60; datum = plusDagen(datum, 1)) dagen.push(datum);
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

// Het rooster: per taak een rij, per dag een vakje om aan te vinken
function toonPlanRaster() {
  const vak = document.getElementById("plan-raster");
  vak.innerHTML = "";
  const dagen = planDagen();
  const tentamen = document.getElementById("plan-datum").value;

  if (!tentamen) {
    vak.innerHTML = '<p class="leeg">Kies eerst bij stap 1 je tentamen.</p>';
    return;
  }
  if (planRijen.length === 0) {
    vak.innerHTML = '<p class="leeg">Typ bij stap 2 wat je moet doen. Daarna vink je hier aan op welke dag.</p>';
    toonPlanMelding();
    return;
  }

  const scroll = div("plan-scroll");
  const tabel = document.createElement("table");
  tabel.className = "plan-tabel";
  scroll.appendChild(tabel);

  // Kopregel met de dagen
  const kop = tabel.createTHead().insertRow();
  const hoek = document.createElement("th");
  hoek.className = "taak-kolom";
  hoek.textContent = "Wat moet je doen?";
  kop.appendChild(hoek);
  for (const datum of dagen) {
    const th = document.createElement("th");
    const weekend = weekdag(datum) === 0 || weekdag(datum) === 6;
    th.className = (weekend ? "weekend" : "") + (datum === vandaag() ? " is-vandaag" : "");
    th.innerHTML = "<span></span><strong></strong>";
    th.querySelector("span").textContent = DAGNAMEN[weekdag(datum)];
    th.querySelector("strong").textContent = Number(datum.slice(8));
    kop.appendChild(th);
  }
  const toetsKop = document.createElement("th");
  toetsKop.className = "tentamen-kolom";
  toetsKop.innerHTML = "<span>📝</span><strong></strong>";
  toetsKop.querySelector("strong").textContent = Number(tentamen.slice(8));
  toetsKop.title = "Je tentamen";
  kop.appendChild(toetsKop);
  kop.appendChild(document.createElement("th"));

  // Een rij per taak
  const lichaam = tabel.createTBody();
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
      const weekend = weekdag(datum) === 0 || weekdag(datum) === 6;
      if (weekend) cel.className = "weekend";
      const knop = document.createElement("button");
      knop.type = "button";
      const aan = datum in rij.dagen;
      const item = aan && rij.dagen[datum] ? items.find(item => item.id === rij.dagen[datum]) : null;
      knop.className = "dag-vakje" + (aan ? " aan" : "") + (item && item.klaar ? " klaar" : "");
      knop.textContent = aan ? (item && item.klaar ? "✓" : "●") : "";
      knop.title = mooieDatum(datum) + (aan ? " (klik om weg te halen)" : " (klik om aan te vinken)");
      knop.onclick = () => {
        if (datum in rij.dagen) delete rij.dagen[datum];
        else rij.dagen[datum] = null;
        toonPlanRaster();
      };
      cel.appendChild(knop);
    }

    tr.insertCell().className = "tentamen-kolom";

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

  // Onderste regel: hoeveel je per dag moet doen
  const voet = tabel.createTFoot().insertRow();
  const voetTekst = voet.insertCell();
  voetTekst.className = "taak-kolom info";
  voetTekst.textContent = "Taken per dag";
  for (const datum of dagen) {
    const aantal = planRijen.filter(rij => datum in rij.dagen).length;
    const cel = voet.insertCell();
    cel.className = "aantal" + (aantal >= 3 ? " veel" : "");
    cel.textContent = aantal || "";
  }
  voet.insertCell();
  voet.insertCell();

  vak.appendChild(scroll);
  toonPlanMelding();
}

function toonPlanMelding() {
  const zonderDag = planRijen.filter(rij => Object.keys(rij.dagen).length === 0).length;
  document.getElementById("plan-melding").textContent = zonderDag
    ? zonderDag + (zonderDag === 1 ? " taak heeft" : " taken hebben") + " nog geen dag"
    : planRijen.length ? "✓ Alles heeft een dag" : "";
}

// Hulpje: de taken die nog geen dag hebben op volgorde zetten, elke dag één
function zetOpVolgorde() {
  const dagen = planDagen().filter(datum => datum >= vandaag());
  let nummer = 0;
  for (const rij of planRijen) {
    if (Object.keys(rij.dagen).length > 0) continue;
    if (nummer >= dagen.length) nummer = dagen.length - 1; // te weinig dagen: de rest op de laatste dag
    if (dagen[nummer]) rij.dagen[dagen[nummer]] = null;
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
document.getElementById("plan-tentamen").addEventListener("change", kiesPlanTentamen);
document.getElementById("plan-datum").addEventListener("change", toonPlanRaster);
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
