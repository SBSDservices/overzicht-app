// ===== HET LES-VENSTER =====
// Dit venstertje opent als je op een les uit je rooster klikt.
// Je kunt er huiswerk ("wat moet ik voor deze les doen") toevoegen,
// de les een naam geven zoals in Magister, en aangeven dat het een tentamen is.

let huidigeLesId = null; // de les die nu open staat

function openLes(lesId) {
  huidigeLesId = lesId;
  document.getElementById("les-venster").showModal();
  document.getElementById("les-nieuw-huiswerk").value = "";
  document.getElementById("les-naam").value = lesNamen[lesId] || "";
  vernieuwLesVenster();
  document.getElementById("les-nieuw-huiswerk").focus();
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

  const naam = lesNamen[les.id] || "";
  document.getElementById("les-titel").textContent = (lesTentamen() ? "📝 " : "") + (naam || les.titel);
  document.getElementById("les-info").textContent =
    dagKop(les.datum) + " · " + les.begintijd + (les.eindtijd ? "–" + les.eindtijd : "") +
    (les.locatie ? " · " + les.locatie : "") + (naam ? " · " + les.titel : "");
  document.getElementById("les-tentamen").checked = Boolean(lesTentamen());

  // Wat je voor deze les moet doen
  const lijst = document.getElementById("les-huiswerk");
  lijst.innerHTML = "";
  const huiswerk = items.filter(item => item.soort === "huiswerk" && item.lesId === les.id);
  if (huiswerk.length === 0) lijst.innerHTML = '<p class="leeg">Nog niks. Typ hieronder wat je moet doen.</p>';
  for (const item of huiswerk) lijst.appendChild(maakRegel(item));
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
    datum: les.datum, // af hebben vóór deze les
    lesId: les.id,
    klaar: false
  });

  bewaarItems();
  toonAlles();
  invoer.value = "";
  invoer.focus();
}

// Je geeft de les een naam, zoals in Magister (bijv. "1H-BMA-BAS-T")
function bewaarLesNaam() {
  const naam = document.getElementById("les-naam").value.trim();
  if (naam) lesNamen[huidigeLesId] = naam;
  else delete lesNamen[huidigeLesId];

  // Eindigt de naam op "-T"? Dan is het een tentamen
  if (isTentamenNaam(naam) && !lesTentamen()) maakTentamen();

  // Heeft het tentamen een naam gekregen? Dan krijgt het tentamen die ook
  const tentamen = lesTentamen();
  if (tentamen) tentamen.titel = naam || "Tentamen";

  bewaarItems();
  toonAlles();
}

// Je vinkt "dit is een tentamen" aan of uit
function wisselTentamen() {
  if (document.getElementById("les-tentamen").checked) {
    maakTentamen();
  } else {
    items = items.filter(item => !(item.soort === "toets" && item.lesId === huidigeLesId));
  }
  bewaarItems();
  toonAlles();
}

function maakTentamen() {
  const les = huidigeLes();
  items.push({
    id: Date.now(),
    soort: "toets",
    titel: lesNamen[les.id] || "Tentamen",
    datum: les.datum,
    begintijd: les.begintijd,
    eindtijd: les.eindtijd,
    locatie: les.locatie,
    lesId: les.id,
    klaar: false
  });
}

// ----- Starten -----
document.getElementById("les-huiswerk-formulier").addEventListener("submit", voegLesHuiswerkToe);
document.getElementById("les-naam").addEventListener("change", bewaarLesNaam);
document.getElementById("les-tentamen").addEventListener("change", wisselTentamen);
