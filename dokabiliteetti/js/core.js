import { firebaseConfig, adminUid } from "../firebase-config.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc,
  doc,
  query,
  orderBy,
  serverTimestamp,
  writeBatch,
  enableIndexedDbPersistence
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

export { adminUid };

export var app = initializeApp(firebaseConfig);
export var db = getFirestore(app);
export var auth = getAuth(app);

export var juomatCol = collection(db, "juomat");
export var juomatQuery = query(juomatCol, orderBy("luotu", "desc"));
export var reseptitCol = collection(db, "boolireseptit");
export var reseptitQuery = query(reseptitCol, orderBy("luotu", "desc"));
export var drinkkireseptitCol = collection(db, "drinkkireseptit");
export var drinkkireseptitQuery = query(drinkkireseptitCol, orderBy("luotu", "desc"));
export var ilmoituksetCol = collection(db, "ilmoitukset");
export var ilmoituksetQuery = query(ilmoituksetCol, orderBy("luotu", "desc"));
export var virheetCol = collection(db, "virheet");
export var virheetQuery = query(virheetCol, orderBy("luotu", "desc"));

enableIndexedDbPersistence(db).catch(function (err) {
  console.warn("Offline-tuki ei käytössä tässä selaimessa:", err.code);
});

export var KAUPAT = ["Alko", "Prisma", "S-market", "Alepa/Sale", "K-citymarket", "K-market", "K-supermarket", "Lidl", "Viro", "Latvia", "Ulkomaat", "Muu"];
export var YKSIKKOKERROIN = { l: 1, dl: 0.1, cl: 0.01 };

export var OMA_NIMI_AVAIN = "dokabiliteetti-oma-nimi";
export var SUOSIKIT_AVAIN = "dokabiliteetti-suosikit";
export var PEUKUTUKSET_AVAIN = "dokabiliteetti-peukutetut";
export var DEVICE_ID_AVAIN = "dokabiliteetti-device-id";

export var deviceId = localStorage.getItem(DEVICE_ID_AVAIN);
if (!deviceId) {
  deviceId = (window.crypto && crypto.randomUUID)
    ? crypto.randomUUID()
    : (Date.now().toString(36) + Math.random().toString(36).slice(2));
  localStorage.setItem(DEVICE_ID_AVAIN, deviceId);
}

export function laskeDokabiliteetti(hinta, koko, prosentti) {
  var puhdasAlkoholiMl = koko * (prosentti / 100);
  return puhdasAlkoholiMl / hinta;
}

export function pyorista(n, desimaalit) {
  var kerroin = Math.pow(10, desimaalit);
  return Math.round(n * kerroin) / kerroin;
}

export function escapeHtml(str) {
  var div = document.createElement("div");
  div.textContent = String(str == null ? "" : str);
  return div.innerHTML;
}

export function muotoilePvm(aikaleima) {
  try {
    return new Date(aikaleima).toLocaleDateString();
  } catch (e) {
    return "";
  }
}

export function sparklineSvg(historia, nykyinenHinta) {
  var pisteet = (historia || []).map(function (h) { return h.hinta; }).concat([nykyinenHinta]);
  if (pisteet.length < 2) return "";
  var min = Math.min.apply(null, pisteet);
  var max = Math.max.apply(null, pisteet);
  var w = 280, h = 32, pad = 4;
  var range = (max - min) || 1;
  var stepX = pisteet.length > 1 ? (w - pad * 2) / (pisteet.length - 1) : 0;
  var pts = pisteet.map(function (v, i) {
    var x = pad + i * stepX;
    var y = pad + (h - pad * 2) * (1 - (v - min) / range);
    return x.toFixed(1) + "," + y.toFixed(1);
  }).join(" ");
  var nousi = pisteet[pisteet.length - 1] > pisteet[0];
  var vari = nousi ? "var(--danger)" : "var(--accent)";
  return '<svg class="sparkline" viewBox="0 0 ' + w + ' ' + h + '" preserveAspectRatio="none" role="img" aria-label="Hintahistoria">' +
    '<polyline points="' + pts + '" fill="none" stroke="' + vari + '" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>' +
    "</svg>";
}

export function lataaLista(avain) {
  try {
    var raw = localStorage.getItem(avain);
    var parsed = raw ? JSON.parse(raw) : [];
    var obj = {};
    parsed.forEach(function (id) { obj[id] = true; });
    return obj;
  } catch (e) {
    return {};
  }
}

export function tallennaLista(avain, obj) {
  try {
    localStorage.setItem(avain, JSON.stringify(Object.keys(obj)));
  } catch (e) {
    console.error("Tallennus epäonnistui", e);
  }
}

// ---- Ilmoitusten lähetys (jaettu useamman moduulin kesken) ----
export function laheteIlmoitus(tiedot) {
  var uusiIlmoitusRef = doc(ilmoituksetCol);
  var rateRef = doc(db, "ratelimits", deviceId);
  var batch = writeBatch(db);

  var data = {
    tyyppi: tiedot.tyyppi,
    kohdeId: tiedot.kohdeId,
    syy: tiedot.syy,
    lisatiedot: tiedot.lisatiedot || "",
    deviceId: deviceId,
    luotu: serverTimestamp()
  };
  if (tiedot.kommenttiObjekti) data.kommenttiObjekti = tiedot.kommenttiObjekti;

  batch.set(uusiIlmoitusRef, data);
  batch.set(rateRef, { viimeisin: serverTimestamp() });
  return batch.commit();
}

// ---- Virheseuranta ----
// Kevyt, parhaan yrityksen virhelokitus: ei koskaan saa itse kaataa sovellusta,
// ja samaa virhettä ei lokiteta uudestaan 30 sekunnin sisällä (estää tulvan jos
// jokin virhe toistuu esim. rikkinäisessä silmukassa).
var viimeVirheet = {};
export function kirjaaVirhe(konteksti, virhe) {
  try {
    var viesti = virhe && virhe.message ? virhe.message : String(virhe == null ? "Tuntematon virhe" : virhe);
    var koodi = virhe && virhe.code ? virhe.code : null;
    var avain = konteksti + "::" + viesti;
    var nyt = Date.now();
    if (viimeVirheet[avain] && nyt - viimeVirheet[avain] < 30000) return;
    viimeVirheet[avain] = nyt;

    addDoc(virheetCol, {
      konteksti: String(konteksti).slice(0, 100),
      viesti: String(viesti).slice(0, 500),
      koodi: koodi ? String(koodi).slice(0, 100) : null,
      deviceId: deviceId,
      url: location.href,
      luotu: serverTimestamp()
    }).catch(function () {
      // virhelokituksen oma epäonnistuminen ei saa aiheuttaa lisää virheitä
    });
  } catch (e) {
    // sama - lokitus ei koskaan saa kaataa sovellusta
  }
}

window.addEventListener("error", function (e) {
  kirjaaVirhe("window.onerror", (e && e.error) || (e && e.message) || "tuntematon");
});
window.addEventListener("unhandledrejection", function (e) {
  kirjaaVirhe("unhandled-promise", e && e.reason);
});

// ---- Offline-tila ----
var offlineBanner = document.getElementById("offline-banner");
function paivitaVerkkotila() {
  if (offlineBanner) offlineBanner.hidden = navigator.onLine;
}
window.addEventListener("online", paivitaVerkkotila);
window.addEventListener("offline", paivitaVerkkotila);
paivitaVerkkotila();
