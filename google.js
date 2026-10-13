// ===== GOOGLE-KOPPELING =====
// Je Client ID: het "naamkaartje" van je app bij Google (dit is niet geheim)
const GOOGLE_CLIENT_ID = "1014948875263-lgjmnml5b0b2d3effh7tk2b8jsde1khl.apps.googleusercontent.com";

// Wat de app mag: je agenda LEZEN, en een eigen verborgen map in je Drive
// gebruiken om je taken op te slaan (de rest van je Drive kan de app niet zien)
const GOOGLE_RECHTEN = [
  "https://www.googleapis.com/auth/calendar.readonly",
  "https://www.googleapis.com/auth/drive.appdata"
].join(" ");

const AGENDA_MAANDEN = 13;                    // hoeveel maanden we ophalen (voor het jaaroverzicht)
const DRIVE_BESTAND = "overzicht-items.json"; // hier staan je taken in je Drive

let tokenClient = null;
let toegangsToken = null;   // de "sleutel" die je krijgt na inloggen (1 uur geldig)
let driveBestandId = null;
let opslaanTimer = null;
let laatstBijgewerkt = null;

// ----- Inloggen en uitloggen -----

// Wordt uitgevoerd zodra het Google-script geladen is (zie index.html)
function startGoogle() {
  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: GOOGLE_CLIENT_ID,
    scope: GOOGLE_RECHTEN,
    callback: naInloggen
  });

  // Ben je in het afgelopen uur al ingelogd? Dan hoeft het niet opnieuw
  toegangsToken = laadToken();
  toonGoogleStatus();
  if (toegangsToken) haalAllesOp();
}

function logIn() {
  if (tokenClient) tokenClient.requestAccessToken();
}

function naInloggen(antwoord) {
  if (antwoord.error) {
    toonGoogleStatus("Inloggen mislukt: " + antwoord.error);
    return;
  }
  toegangsToken = antwoord.access_token;
  bewaarToken(antwoord.access_token, antwoord.expires_in);
  haalAllesOp();
}

function logUit() {
  if (toegangsToken) google.accounts.oauth2.revoke(toegangsToken, () => {});
  vergeetToken();
  driveBestandId = null;
  googleAfspraken = [];
  toonGoogleStatus();
  toonAlles();
}

// De sleutel is maar een uur geldig. Daarna moet je opnieuw op "Verbinden" klikken.
function verbindingVerlopen() {
  vergeetToken();
  toonGoogleStatus("Verbinding verlopen.");
}

function bewaarToken(token, seconden) {
  bewaarInstelling("googleToken", JSON.stringify({
    token: token,
    verlooptOp: Date.now() + (seconden - 60) * 1000
  }));
}

function laadToken() {
  try {
    const opgeslagen = JSON.parse(laadInstelling("googleToken", "null"));
    if (opgeslagen && opgeslagen.verlooptOp > Date.now()) return opgeslagen.token;
  } catch {}
  return null;
}

function vergeetToken() {
  toegangsToken = null;
  try {
    localStorage.removeItem("googleToken");
  } catch {}
}

// ----- Praten met Google -----

// Stuur een vraag naar Google, met je sleutel erbij
async function googleVraag(url, opties = {}) {
  const antwoord = await fetch(url, {
    ...opties,
    headers: { ...opties.headers, Authorization: "Bearer " + toegangsToken }
  });

  if (antwoord.status === 401) {
    verbindingVerlopen();
    throw new Error("verbinding verlopen");
  }
  if (!antwoord.ok) throw new Error("Google gaf foutcode " + antwoord.status);
  return antwoord.json();
}

// Haal je agenda én je taken op
async function haalAllesOp() {
  if (!toegangsToken) return;
  toonGoogleStatus("Bezig met ophalen…");

  try {
    await Promise.all([haalAgendaOp(), haalTakenOp()]);
    laatstBijgewerkt = new Date();
    toonGoogleStatus();
  } catch (fout) {
    console.error(fout);
    if (toegangsToken) toonGoogleStatus("Er ging iets mis: " + fout.message);
  }
  toonAlles();
}

// ----- Agenda -----

async function haalAgendaOp() {
  // 1. Welke agenda's heb je? (je eigen agenda, Magister, feestdagen…)
  const lijst = await googleVraag("https://www.googleapis.com/calendar/v3/users/me/calendarList");
  const zichtbaar = lijst.items.filter(agenda => agenda.selected);
  const agendas = zichtbaar.length ? zichtbaar : lijst.items;

  // 2. Haal van elke agenda de afspraken op: vanaf vorige maand tot een jaar vooruit
  const van = new Date();
  van.setDate(1);
  van.setMonth(van.getMonth() - 1);
  van.setHours(0, 0, 0, 0);
  const tot = new Date(van);
  tot.setMonth(tot.getMonth() + AGENDA_MAANDEN);

  const perAgenda = await Promise.all(agendas.map(async agenda => {
    try {
      const events = await haalEventsOp(agenda, van, tot);
      return events
        .filter(event => event.status !== "cancelled")
        .map(event => naarAfspraak(event, agenda));
    } catch (fout) {
      console.warn("Agenda overgeslagen:", agenda.summary, fout);
      return [];
    }
  }));

  googleAfspraken = perAgenda.flat();
}

// Google geeft maximaal 2500 afspraken per keer ("pagina"), dus we vragen
// net zo lang door tot we alles hebben
async function haalEventsOp(agenda, van, tot) {
  const alles = [];
  let volgendePagina = null;

  do {
    const vraag = new URLSearchParams({
      timeMin: van.toISOString(),
      timeMax: tot.toISOString(),
      singleEvents: "true",
      orderBy: "startTime",
      maxResults: "2500"
    });
    if (volgendePagina) vraag.set("pageToken", volgendePagina);

    const data = await googleVraag("https://www.googleapis.com/calendar/v3/calendars/" +
      encodeURIComponent(agenda.id) + "/events?" + vraag);
    alles.push(...data.items);
    volgendePagina = data.nextPageToken;
  } while (volgendePagina);

  return alles;
}

// Wat voor agenda is het? School (Magister), feestdagen, of je eigen agenda
function soortAgenda(agenda) {
  const naam = (agenda.summaryOverride || agenda.summary || "").toLowerCase();
  if (agenda.id.includes("#holiday@")) return "feestdag";
  if (agenda.id.includes("@import.calendar.google.com") || naam.includes("magister")) return "school";
  return "eigen";
}

// Zet een afspraak van Google om naar hoe onze app afspraken bewaart
function naarAfspraak(event, agenda) {
  const heleDag = !event.start.dateTime;
  const begin = heleDag ? null : new Date(event.start.dateTime);
  const eind = heleDag ? null : new Date(event.end.dateTime);

  // Bij "hele dag" geeft Google de dag ná de laatste dag als einde
  const laatsteDag = heleDag ? plusDagen(event.end.date, -1) : "";

  return {
    id: "google-" + agenda.id + "-" + event.id,
    titel: event.summary || "(geen titel)",
    soort: "afspraak",
    datum: heleDag ? event.start.date : datumTekst(begin),
    einddatum: laatsteDag > event.start.date ? laatsteDag : "",
    begintijd: heleDag ? "" : tijdTekst(begin),
    eindtijd: heleDag ? "" : tijdTekst(eind),
    heleDag: heleDag,
    locatie: event.location || "",
    bron: "google",
    bronType: soortAgenda(agenda),
    agendaNaam: agenda.summaryOverride || agenda.summary,
    kleur: agenda.backgroundColor
  };
}

// ----- Taken synchroniseren via Google Drive -----

async function haalTakenOp() {
  // Zoek je takenbestand in de verborgen app-map van je Drive
  const zoek = await googleVraag("https://www.googleapis.com/drive/v3/files?" + new URLSearchParams({
    spaces: "appDataFolder",
    q: "name='" + DRIVE_BESTAND + "'",
    fields: "files(id)"
  }));

  if (zoek.files.length === 0) {
    // Eerste keer: maak het bestand aan met de taken die je nu hebt
    await maakDriveBestand();
    return;
  }

  driveBestandId = zoek.files[0].id;
  const opDrive = await googleVraag("https://www.googleapis.com/drive/v3/files/" + driveBestandId + "?alt=media");

  // Vroeger stond er alleen een lijst met items in het bestand, nu ook je vakken
  const oudFormaat = Array.isArray(opDrive);
  const data = oudFormaat ? { items: opDrive } : opDrive;
  const driveItems = data.items || [];

  // De versie op Drive is de baas. Alleen items die je hier hebt toegevoegd
  // terwijl je niet verbonden was, voegen we eraan toe.
  const bekend = new Set(driveItems.map(item => item.id));
  const sinds = Number(laadInstelling("laatstGesynct", "0"));
  const nieuwHier = items.filter(item => !bekend.has(item.id) && item.id > sinds);

  items = driveItems.concat(nieuwHier);
  if (data.vakken) vakken = data.vakken;
  if (data.lesVakken) lesVakken = { ...lesVakken, ...data.lesVakken };

  const moetOpslaan = nieuwHier.length || oudFormaat || (!data.vakken && vakken.length);
  if (moetOpslaan) {
    bewaarItems(); // stuurt het ook naar Drive
  } else {
    bewaarLokaal();
    bewaarInstelling("laatstGesynct", Date.now());
  }
}

// Wat we in je Drive opslaan
function driveInhoud() {
  return JSON.stringify({ versie: 2, items: items, vakken: vakken, lesVakken: lesVakken });
}

async function maakDriveBestand() {
  const grens = "overzicht" + Date.now();
  const inhoud =
    "--" + grens + "\r\n" +
    "Content-Type: application/json; charset=UTF-8\r\n\r\n" +
    JSON.stringify({ name: DRIVE_BESTAND, parents: ["appDataFolder"] }) + "\r\n" +
    "--" + grens + "\r\n" +
    "Content-Type: application/json\r\n\r\n" +
    driveInhoud() + "\r\n" +
    "--" + grens + "--";

  const bestand = await googleVraag("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id", {
    method: "POST",
    headers: { "Content-Type": "multipart/related; boundary=" + grens },
    body: inhoud
  });

  driveBestandId = bestand.id;
  bewaarInstelling("laatstGesynct", Date.now());
}

// Wordt aangeroepen bij elke wijziging (vanuit app.js).
// We wachten heel even, zodat 5 snelle vinkjes maar 1 keer opslaan.
function bewaarOpDrive() {
  if (!toegangsToken || !driveBestandId) return;
  clearTimeout(opslaanTimer);
  opslaanTimer = setTimeout(stuurNaarDrive, 800);
}

async function stuurNaarDrive() {
  try {
    await googleVraag("https://www.googleapis.com/upload/drive/v3/files/" + driveBestandId + "?uploadType=media", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: driveInhoud()
    });
    bewaarInstelling("laatstGesynct", Date.now());
  } catch (fout) {
    console.error("Opslaan op Drive mislukt", fout);
  }
}

// ----- De balk bovenin -----

function toonGoogleStatus(melding) {
  const tekst = document.getElementById("google-tekst");
  const knop = document.getElementById("google-knop");
  const uitlog = document.getElementById("google-uitlog");

  if (toegangsToken) {
    const tijd = laatstBijgewerkt ? " · bijgewerkt om " + tijdTekst(laatstBijgewerkt) : "";
    tekst.textContent = melding || "✓ Verbonden met Google" + tijd;
    knop.textContent = "↻ Vernieuwen";
    knop.onclick = haalAllesOp;
    uitlog.classList.remove("verborgen");
  } else {
    tekst.textContent = (melding ? melding + " " : "") + "Verbind om je agenda te zien en je taken te synchroniseren.";
    knop.textContent = "Verbinden met Google";
    knop.onclick = logIn;
    uitlog.classList.add("verborgen");
  }
}

// ----- Automatisch bijwerken -----

// Elke 15 minuten, en als je de app weer opent (bijv. op je telefoon)
setInterval(() => {
  if (toegangsToken) haalAllesOp();
}, 15 * 60 * 1000);

document.addEventListener("visibilitychange", () => {
  const vijfMinutenGeleden = Date.now() - 5 * 60 * 1000;
  if (document.visibilityState === "visible" && toegangsToken &&
      (!laatstBijgewerkt || laatstBijgewerkt < vijfMinutenGeleden)) {
    haalAllesOp();
  }
});
