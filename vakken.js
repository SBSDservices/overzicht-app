// ===== VAKKEN EN LESSEN =====
// Hier stel je je vakken in, en dit opent het venstertje als je op een les klikt.

let huidigeLesId = null; // de les die nu open staat in het venster

// ----- Mijn vakken -----

function toonVakken() {
  // De lijst in "📚 Mijn vakken"
  const lijst = document.getElementById("vakken-lijst");
  lijst.innerHTML = "";
  if (vakken.length === 0) {
    lijst.innerHTML = '<p class="leeg">Nog geen vakken. Voeg hieronder je eerste vak toe.</p>';
  }
  for (const vak of vakken) {
    const li = document.createElement("li");
    li.appendChild(maakVakLabel(vak.code));
    const naam = document.createElement("span");
    naam.className = "tekst";
    naam.textContent = vak.naam;
    li.appendChild(naam);

    const kruisje = document.createElement("button");
    kruisje.className = "verwijder";
    kruisje.textContent = "✕";
    kruisje.title = "Vak verwijderen";
    kruisje.onclick = () => verwijderVak(vak.code);
    li.appendChild(kruisje);
    lijst.appendChild(li);
  }

  // De keuzelijstjes met vakken (in het formulier en in het les-venster)
  vulVakKeuze(document.getElementById("vak"), "— geen vak —");
  vulVakKeuze(document.getElementById("les-vak"), "— kies een vak —");
}

function vulVakKeuze(keuze, legeTekst) {
  const gekozen = keuze.value;
  keuze.innerHTML = "";
  keuze.appendChild(new Option(legeTekst, ""));
  for (const vak of vakken) keuze.appendChild(new Option(vak.code + " · " + vak.naam, vak.code));
  keuze.value = gekozen;
}

function voegVakToe(event) {
  event.preventDefault();
  const code = document.getElementById("vak-code").value.trim().toUpperCase();
  const naam = document.getElementById("vak-naam").value.trim();
  if (!code || !naam) return;

  const bestaand = vakken.find(vak => vak.code === code);
  if (bestaand) bestaand.naam = naam; // zelfde code? dan passen we de naam aan
  else vakken.push({ code, naam });
  vakken.sort((a, b) => a.code.localeCompare(b.code));

  bewaarItems();
  toonAlles();
  document.getElementById("vak-code").value = "";
  document.getElementById("vak-naam").value = "";
  document.getElementById("vak-code").focus();
}

function verwijderVak(code) {
  if (!confirm("Vak " + code + " verwijderen? Je huiswerk en toetsen blijven bewaard.")) return;
  vakken = vakken.filter(vak => vak.code !== code);
  bewaarItems();
  toonAlles();
}

// ----- Het les-venster -----

function openLes(lesId) {
  huidigeLesId = lesId;
  document.getElementById("les-venster").showModal();
  document.getElementById("les-nieuw-huiswerk").value = "";
  vernieuwLesVenster();
}

function huidigeLes() {
  return googleAfspraken.find(les => les.id === huidigeLesId);
}

function lesTentamen() {
  return items.find(item => item.soort === "toets" && item.lesId === huidigeLesId);
}

// Vul het venster met wat er bij deze les hoort (ook na elke wijziging)
function vernieuwLesVenster() {
  const venster = document.getElementById("les-venster");
  const les = huidigeLes();
  if (!venster.open || !les) return;

  const vak = lesVakken[les.id] || "";
  document.getElementById("les-titel").textContent = vak ? vakNaam(vak) : les.titel;
  document.getElementById("les-info").textContent =
    dagKop(les.datum) + " · " + les.begintijd + (les.eindtijd ? "–" + les.eindtijd : "") +
    (les.locatie ? " · " + les.locatie : "") + (vak ? " · " + les.titel : "");

  document.getElementById("les-vak").value = vak;
  document.getElementById("les-geen-vakken").classList.toggle("verborgen", vakken.length > 0);
  document.getElementById("les-tentamen").checked = Boolean(lesTentamen());

  // Huiswerk bij deze les
  const huiswerkLijst = document.getElementById("les-huiswerk");
  huiswerkLijst.innerHTML = "";
  const huiswerk = items.filter(item => item.soort === "huiswerk" && item.lesId === les.id);
  if (huiswerk.length === 0) huiswerkLijst.innerHTML = '<p class="leeg">Nog geen huiswerk.</p>';
  for (const item of huiswerk) huiswerkLijst.appendChild(maakRegel(item));

  // Opdrachten (deadlines) voor dit vak op deze dag
  const opdrachtLijst = document.getElementById("les-opdrachten");
  opdrachtLijst.innerHTML = "";
  const opdrachten = vak
    ? items.filter(item => item.soort === "deadline" && item.vak === vak && item.datum === les.datum)
    : [];
  document.getElementById("les-opdrachten-blok").classList.toggle("verborgen", !vak);
  if (vak && opdrachten.length === 0) {
    opdrachtLijst.innerHTML = '<p class="leeg">Geen opdrachten voor ' + vak + ' op deze dag.</p>';
  }
  for (const item of opdrachten) opdrachtLijst.appendChild(maakRegel(item));
}

// Je kiest een vak voor deze les
function kiesLesVak() {
  const vak = document.getElementById("les-vak").value;
  if (vak) lesVakken[huidigeLesId] = vak;
  else delete lesVakken[huidigeLesId];

  // Is het een tentamen? Dan krijgt dat ook het nieuwe vak
  const tentamen = lesTentamen();
  if (tentamen) {
    tentamen.vak = vak;
    tentamen.titel = "Tentamen" + (vak ? " " + vakNaam(vak) : "");
  }

  bewaarItems();
  toonAlles();
}

// Je vinkt "dit is een tentamen" aan of uit
function wisselTentamen() {
  const les = huidigeLes();
  const vak = lesVakken[les.id] || "";

  if (document.getElementById("les-tentamen").checked) {
    items.push({
      id: Date.now(),
      soort: "toets",
      titel: "Tentamen" + (vak ? " " + vakNaam(vak) : ""),
      vak: vak,
      datum: les.datum,
      begintijd: les.begintijd,
      eindtijd: les.eindtijd,
      locatie: les.locatie,
      lesId: les.id,
      klaar: false
    });
  } else {
    items = items.filter(item => !(item.soort === "toets" && item.lesId === les.id));
  }

  bewaarItems();
  toonAlles();
}

function voegLesHuiswerkToe(event) {
  event.preventDefault();
  const invoer = document.getElementById("les-nieuw-huiswerk");
  const tekst = invoer.value.trim();
  if (!tekst) return;

  const les = huidigeLes();
  items.push({
    id: Date.now(),
    soort: "huiswerk",
    titel: tekst,
    vak: lesVakken[les.id] || "",
    datum: les.datum,
    lesId: les.id,
    klaar: false
  });

  bewaarItems();
  toonAlles();
  invoer.value = "";
  invoer.focus();
}

// ----- Starten -----
document.getElementById("vak-formulier").addEventListener("submit", voegVakToe);
document.getElementById("les-vak").addEventListener("change", kiesLesVak);
document.getElementById("les-tentamen").addEventListener("change", wisselTentamen);
document.getElementById("les-huiswerk-formulier").addEventListener("submit", voegLesHuiswerkToe);
document.getElementById("les-naar-vakken").addEventListener("click", () => {
  document.getElementById("les-venster").close();
  document.getElementById("vakken-beheer").open = true;
  document.getElementById("vak-code").focus();
});
