import { firebaseConfig, adminUid } from "./firebase-config.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
  arrayUnion,
  arrayRemove,
  increment,
  writeBatch,
  enableIndexedDbPersistence
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

var app = initializeApp(firebaseConfig);
var db = getFirestore(app);
var auth = getAuth(app);
var juomatCol = collection(db, "juomat");
var juomatQuery = query(juomatCol, orderBy("luotu", "desc"));
var reseptitCol = collection(db, "boolireseptit");
var reseptitQuery = query(reseptitCol, orderBy("luotu", "desc"));
var ilmoituksetCol = collection(db, "ilmoitukset");
var ilmoituksetQuery = query(ilmoituksetCol, orderBy("luotu", "desc"));

enableIndexedDbPersistence(db).catch(function (err) {
  console.warn("Offline-tuki ei käytössä tässä selaimessa:", err.code);
});

var offlineBanner = document.getElementById("offline-banner");
function paivitaVerkkotila() {
  offlineBanner.hidden = navigator.onLine;
}
window.addEventListener("online", paivitaVerkkotila);
window.addEventListener("offline", paivitaVerkkotila);
paivitaVerkkotila();

var form = document.getElementById("lisaa-form");
var nimiEl = document.getElementById("nimi");
var hintaEl = document.getElementById("hinta");
var kokoEl = document.getElementById("koko");
var prosenttiEl = document.getElementById("prosentti");
var kauppaEl = document.getElementById("kauppa");
var lisaajaEl = document.getElementById("lisaaja");
var errorEl = document.getElementById("error-msg");
var tuloksetEl = document.getElementById("tulokset");
var toolbarEl = document.getElementById("toolbar");
var maaraTekstiEl = document.getElementById("maara-teksti");
var tyhjennaBtn = document.getElementById("tyhjenna-btn");
var lisaaBtn = document.getElementById("lisaa-btn");
var suodattimetEl = document.getElementById("suodattimet");
var kunniamainintaEl = document.getElementById("kunniamaininta");
var hakuEl = document.getElementById("haku");
var suosikitToggle = document.getElementById("suosikit-toggle");

var adminToggle = document.getElementById("admin-toggle");
var adminForm = document.getElementById("admin-form");
var adminEmail = document.getElementById("admin-email");
var adminSalasana = document.getElementById("admin-salasana");
var adminVirhe = document.getElementById("admin-virhe");
var adminLogout = document.getElementById("admin-logout");

var skannaaBtn = document.getElementById("skannaa-btn");
var skanneriEl = document.getElementById("skanneri");
var skanneriVideo = document.getElementById("skanneri-video");
var skanneriStatus = document.getElementById("skanneri-status");
var skanneriSulje = document.getElementById("skanneri-sulje");

var dupVaroitusEl = document.getElementById("duplikaatti-varoitus");
var dupTekstiEl = document.getElementById("duplikaatti-teksti");
var dupPaivitaBtn = document.getElementById("duplikaatti-paivita");
var dupOhitaBtn = document.getElementById("duplikaatti-ohita");

var tabBtns = document.querySelectorAll(".tab-btn");
var dokaNakymaEl = document.getElementById("doka-nakyma");
var booliNakymaEl = document.getElementById("booli-nakyma");
var hintaNakymaEl = document.getElementById("hinta-nakyma");
var ainesosatEl = document.getElementById("ainesosat");
var lisaaAinesosaBtn = document.getElementById("lisaa-ainesosa-btn");
var booliTulosEl = document.getElementById("booli-tulos");
var reseptiNimiEl = document.getElementById("resepti-nimi");
var tallennaReseptiBtn = document.getElementById("tallenna-resepti-btn");
var reseptiVirheEl = document.getElementById("resepti-virhe");
var reseptitEl = document.getElementById("reseptit");

var tilastotToggle = document.getElementById("tilastot-toggle");
var tilastotPaneeliEl = document.getElementById("tilastot-paneeli");

var ilmoituksetToggle = document.getElementById("ilmoitukset-toggle");
var ilmoituksetPaneeliEl = document.getElementById("ilmoitukset-paneeli");

var hintaindeksiTilastotEl = document.getElementById("hintaindeksi-tilastot");
var hintaindeksiTop10El = document.getElementById("hintaindeksi-top10");
var hintaindeksiKaupatEl = document.getElementById("hintaindeksi-kaupat");

var KAUPAT = ["Alko", "Prisma", "S-market", "Alepa/Sale", "K-citymarket", "K-market", "K-supermarket", "Ulkomaat", "Muu"];
var OMA_NIMI_AVAIN = "dokabiliteetti-oma-nimi";
var SUOSIKIT_AVAIN = "dokabiliteetti-suosikit";
var PEUKUTUKSET_AVAIN = "dokabiliteetti-peukutetut";

var aktiivinenSuodatin = "Kaikki";
var hakuTeksti = "";
var naytaVainSuosikit = false;
var avoinKommentit = {};
var avoinHintaPaivitys = {};
var avoinIlmoitus = {};

var juomat = [];
var yhteysVirhe = false;
var onAdmin = false;

function lataaLista(avain) {
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

function tallennaLista(avain, obj) {
  try {
    localStorage.setItem(avain, JSON.stringify(Object.keys(obj)));
  } catch (e) {
    console.error("Tallennus epäonnistui", e);
  }
}

var suosikit = lataaLista(SUOSIKIT_AVAIN);
var peukutukset = lataaLista(PEUKUTUKSET_AVAIN);

var tallennettuNimi = localStorage.getItem(OMA_NIMI_AVAIN);
if (tallennettuNimi) {
  lisaajaEl.value = tallennettuNimi;
}

var DEVICE_ID_AVAIN = "dokabiliteetti-device-id";
var deviceId = localStorage.getItem(DEVICE_ID_AVAIN);
if (!deviceId) {
  deviceId = (window.crypto && crypto.randomUUID)
    ? crypto.randomUUID()
    : (Date.now().toString(36) + Math.random().toString(36).slice(2));
  localStorage.setItem(DEVICE_ID_AVAIN, deviceId);
}

var skannattuViivakoodi = null;
var skanneriStream = null;
var skanneriInterval = null;
var odottavaLisays = null;

function laskeDokabiliteetti(hinta, koko, prosentti) {
  var puhdasAlkoholiMl = koko * (prosentti / 100);
  return puhdasAlkoholiMl / hinta;
}

function pyorista(n, desimaalit) {
  var kerroin = Math.pow(10, desimaalit);
  return Math.round(n * kerroin) / kerroin;
}

function escapeHtml(str) {
  var div = document.createElement("div");
  div.textContent = String(str == null ? "" : str);
  return div.innerHTML;
}

function muotoilePvm(aikaleima) {
  try {
    return new Date(aikaleima).toLocaleDateString("fi-FI");
  } catch (e) {
    return "";
  }
}

function sparklineSvg(historia, nykyinenHinta) {
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

function renderaaSuodattimet() {
  var kaikkiKaupat = ["Kaikki"].concat(KAUPAT);
  suodattimetEl.innerHTML = kaikkiKaupat.map(function (k) {
    return '<button type="button" class="filter-chip' + (k === aktiivinenSuodatin ? " active" : "") + '" data-kauppa="' + escapeHtml(k) + '">' + escapeHtml(k) + "</button>";
  }).join("");

  Array.prototype.forEach.call(suodattimetEl.querySelectorAll(".filter-chip"), function (btn) {
    btn.addEventListener("click", function () {
      aktiivinenSuodatin = btn.getAttribute("data-kauppa");
      render();
    });
  });

  suosikitToggle.classList.toggle("active", naytaVainSuosikit);
}

function renderaaKunniamaininta() {
  if (juomat.length === 0) {
    kunniamainintaEl.hidden = true;
    return;
  }
  var laskuri = {};
  juomat.forEach(function (j) {
    var nimi = (j.lisaaja || "Nimetön").trim() || "Nimetön";
    laskuri[nimi] = (laskuri[nimi] || 0) + 1;
  });
  var jarjestys = Object.keys(laskuri).sort(function (a, b) {
    return laskuri[b] - laskuri[a];
  }).slice(0, 3);

  if (jarjestys.length === 0) {
    kunniamainintaEl.hidden = true;
    return;
  }

  var mitalit = ["🥇", "🥈", "🥉"];
  var teksti = jarjestys.map(function (nimi, i) {
    return mitalit[i] + " " + escapeHtml(nimi) + " (" + laskuri[nimi] + ")";
  }).join("  ·  ");

  kunniamainintaEl.innerHTML = "Eniten lisänneet: " + teksti;
  kunniamainintaEl.hidden = false;
}

function kortinHtml(j, onParas, suhde) {
  var onSuosikki = !!suosikit[j.id];
  var onPeukutettu = !!peukutukset[j.id];
  var kommentitAuki = !!avoinKommentit[j.id];
  var hintaAuki = !!avoinHintaPaivitys[j.id];
  var ilmoitusAuki = !!avoinIlmoitus[j.id];
  var kommentit = j.kommentit || [];
  var peukut = j.peukut || 0;

  var html = '<div class="card' + (onParas ? " best" : "") + '" data-id="' + j.id + '">';
  if (onParas) html += '<span class="badge">Paras diili</span>';

  html += '<div class="card-top">' +
    '<span><button class="fav-btn' + (onSuosikki ? " active" : "") + '" data-action="suosikki" data-id="' + j.id + '" aria-label="' + (onSuosikki ? "Poista suosikeista" : "Lisää suosikkeihin") + '" aria-pressed="' + onSuosikki + '">' + (onSuosikki ? "★" : "☆") + '</button>' +
    '<span class="card-name">' + escapeHtml(j.nimi) + "</span></span>" +
    (onAdmin ? '<button class="remove-btn" data-action="poista" data-id="' + j.id + '" aria-label="Poista ' + escapeHtml(j.nimi) + '">&times;</button>' : "") +
    "</div>";

  html += '<div class="card-meta">' +
    '<span class="card-details"><span class="card-store">' + escapeHtml(j.kauppa || "Muu") + "</span>" + pyorista(j.hinta, 2).toFixed(2) + " € · " + j.koko + " ml · " + j.prosentti + "%</span>" +
    '<span class="card-score">' + pyorista(j.dokabiliteetti, 2) + "</span>" +
    "</div>";

  html += '<div class="bar-track"><div class="bar-fill" style="width:' + suhde + '%"></div></div>';

  html += sparklineSvg(j.historia, j.hinta);

  var peukkuTeksti = onPeukutettu ? "✓ Vahvistettu" : "👍 Vahvista";
  html += '<div class="card-actions">' +
    '<button class="action-btn' + (onPeukutettu ? " active" : "") + '" data-action="peukku" data-id="' + j.id + '">' + peukkuTeksti + " (" + peukut + ")</button>" +
    '<button class="action-btn" data-action="toggle-kommentit" data-id="' + j.id + '">💬 Kommentit (' + kommentit.length + ")</button>" +
    '<button class="action-btn" data-action="toggle-hinta" data-id="' + j.id + '">✏️ Päivitä hinta</button>' +
    '<button class="action-btn report-btn" data-action="toggle-ilmoitus" data-id="' + j.id + '">🚩 Ilmoita</button>' +
    "</div>";

  if (kommentitAuki) {
    html += '<div class="kommentit-panel">';
    if (kommentit.length === 0) {
      html += '<p class="kommentti-item" style="border:none; color:var(--text-muted);">Ei vielä kommentteja.</p>';
    } else {
      kommentit.slice().reverse().forEach(function (k, ri) {
        var alkuperainenIdx = kommentit.length - 1 - ri;
        html += '<div class="kommentti-item">' + escapeHtml(k.teksti) +
          '<span class="kommentti-pvm">' + escapeHtml(k.nimi || "Nimetön") + " · " + muotoilePvm(k.pvm) +
          ' · <button type="button" class="kommentti-ilmoita-btn" data-action="ilmoita-kommentti" data-id="' + j.id + '" data-kidx="' + alkuperainenIdx + '">Ilmoita</button></span></div>';
      });
    }
    html += '<form class="kommentti-form" data-action="lisaa-kommentti" data-id="' + j.id + '">' +
      '<input type="text" maxlength="120" placeholder="esim. Vahvistettu, hyvä diili" required>' +
      '<button type="submit">L&auml;het&auml;</button>' +
      "</form></div>";
  }

  if (hintaAuki) {
    html += '<div class="hinta-panel">' +
      '<form class="hinta-form" data-action="paivita-hinta" data-id="' + j.id + '">' +
      '<input type="number" min="0.01" step="0.01" placeholder="Uusi hinta €" required>' +
      '<button type="submit">P&auml;ivit&auml;</button>' +
      "</form></div>";
  }

  if (ilmoitusAuki) {
    html += '<div class="ilmoitus-panel">' +
      '<form class="ilmoitus-form" data-action="ilmoita-juoma" data-id="' + j.id + '">' +
        '<select name="syy" aria-label="Ilmoituksen syy">' +
          '<option value="Roskapostia">Roskapostia</option>' +
          '<option value="Väärä hinta/tiedot">Väärä hinta/tiedot</option>' +
          '<option value="Asiaton sisältö">Asiaton sisältö</option>' +
          '<option value="Muu syy">Muu syy</option>' +
        "</select>" +
        '<input type="text" maxlength="200" placeholder="Lisätietoa (valinnainen)">' +
        '<button type="submit">L&auml;het&auml; ilmoitus</button>' +
      "</form></div>";
  }

  html += "</div>";
  return html;
}

function render() {
  renderaaSuodattimet();
  renderaaKunniamaininta();

  if (yhteysVirhe) {
    toolbarEl.hidden = true;
    tuloksetEl.innerHTML = '<p class="empty-state">Yhteys tietokantaan ei onnistunut. Tarkista firebase-config.js ja Firestoren Rules-asetukset.</p>';
    return;
  }

  if (juomat.length === 0) {
    toolbarEl.hidden = true;
    tuloksetEl.innerHTML = '<p class="empty-state">Lisää ensimmäinen juoma yllä olevalla lomakkeella. Lista näkyy kaikille sovellusta käyttäville.</p>';
    return;
  }

  var haku = hakuTeksti.trim().toLowerCase();
  var nakyvatJuomat = juomat.filter(function (j) {
    if (aktiivinenSuodatin !== "Kaikki" && j.kauppa !== aktiivinenSuodatin) return false;
    if (naytaVainSuosikit && !suosikit[j.id]) return false;
    if (haku && j.nimi.toLowerCase().indexOf(haku) === -1) return false;
    return true;
  });

  toolbarEl.hidden = false;
  tyhjennaBtn.hidden = !onAdmin;
  maaraTekstiEl.textContent = juomat.length + (juomat.length === 1 ? " juoma jaetussa listassa" : " juomaa jaetussa listassa");

  if (nakyvatJuomat.length === 0) {
    tuloksetEl.innerHTML = '<p class="empty-state">Ei tuloksia valituilla suodattimilla.</p>';
    return;
  }

  var jarjestetty = nakyvatJuomat.slice().sort(function (a, b) {
    return b.dokabiliteetti - a.dokabiliteetti;
  });
  var paras = jarjestetty[0].dokabiliteetti;

  var html = "";
  jarjestetty.forEach(function (j, i) {
    var suhde = paras > 0 ? (j.dokabiliteetti / paras) * 100 : 0;
    html += kortinHtml(j, i === 0, suhde);
  });
  tuloksetEl.innerHTML = html;
}

onSnapshot(
  juomatQuery,
  function (snapshot) {
    yhteysVirhe = false;
    juomat = snapshot.docs.map(function (d) {
      var data = d.data();
      return {
        id: d.id,
        nimi: data.nimi,
        hinta: data.hinta,
        koko: data.koko,
        prosentti: data.prosentti,
        dokabiliteetti: data.dokabiliteetti,
        kauppa: data.kauppa || "Muu",
        lisaaja: data.lisaaja || "Nimetön",
        historia: data.historia || [],
        peukut: data.peukut || 0,
        kommentit: data.kommentit || [],
        viivakoodi: data.viivakoodi || null,
        luotu: data.luotu && data.luotu.toDate ? data.luotu.toDate() : null
      };
    });
    render();
    renderaaHintaindeksi();
    if (!tilastotPaneeliEl.hidden) renderaaTilastot();
  },
  function (err) {
    console.error("Firestore-yhteysvirhe", err);
    yhteysVirhe = true;
    render();
  }
);

var booliReseptit = [];

onSnapshot(
  reseptitQuery,
  function (snapshot) {
    booliReseptit = snapshot.docs.map(function (d) {
      var data = d.data();
      return {
        id: d.id,
        nimi: data.nimi,
        ainesosat: data.ainesosat || [],
        kokonaistilavuus: data.kokonaistilavuus || 0,
        lopullinenProsentti: data.lopullinenProsentti || 0,
        kokonaishinta: data.kokonaishinta || 0,
        lisaaja: data.lisaaja || "Nimetön"
      };
    });
    renderaaReseptit();
  },
  function (err) {
    console.error("Boolireseptien haku epäonnistui", err);
    reseptitEl.innerHTML = '<p class="empty-state">Reseptejä ei voitu hakea.</p>';
  }
);

function etsiDuplikaatti(nimi, koko, kauppa, viivakoodi) {
  var nimiNorm = nimi.trim().toLowerCase();
  return juomat.find(function (j) {
    if (viivakoodi && j.viivakoodi && j.viivakoodi === viivakoodi) return true;
    return j.nimi.trim().toLowerCase() === nimiNorm && j.koko === koko && j.kauppa === kauppa;
  });
}

function naytaDuplikaattivaroitus(duplikaatti, uusiHinta) {
  dupTekstiEl.textContent = '"' + duplikaatti.nimi + '" (' + duplikaatti.koko + " ml, " + duplikaatti.kauppa + ") on jo listalla hintaan " + pyorista(duplikaatti.hinta, 2).toFixed(2) + " €. Päivitetäänkö sen hinta uudeksi (" + uusiHinta.toFixed(2) + " €) sen sijaan, että lisätään uusi rivi?";
  dupVaroitusEl.hidden = false;
  dupVaroitusEl.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function piilotaDuplikaattivaroitus() {
  dupVaroitusEl.hidden = true;
  odottavaLisays = null;
}

function suoritaHinnanPaivitys(id, uusiHinta, vanhaHinta, vanhaKoko, vanhaProsentti) {
  var uusiDoka = laskeDokabiliteetti(uusiHinta, vanhaKoko, vanhaProsentti);
  return updateDoc(doc(db, "juomat", id), {
    hinta: uusiHinta,
    dokabiliteetti: uusiDoka,
    historia: arrayUnion({ hinta: vanhaHinta, pvm: Date.now() })
  });
}

function lopetaSkannaus() {
  if (skanneriInterval) {
    clearInterval(skanneriInterval);
    skanneriInterval = null;
  }
  if (skanneriStream) {
    skanneriStream.getTracks().forEach(function (t) { t.stop(); });
    skanneriStream = null;
  }
  skanneriEl.hidden = true;
}

function kasitteleSkannattuKoodi(koodi) {
  skannattuViivakoodi = koodi;
  var osuma = juomat.find(function (j) { return j.viivakoodi === koodi; });
  if (osuma) {
    nimiEl.value = osuma.nimi;
    kokoEl.value = osuma.koko;
    prosenttiEl.value = osuma.prosentti;
    if (KAUPAT.indexOf(osuma.kauppa) !== -1) kauppaEl.value = osuma.kauppa;
    hintaEl.focus();
  } else {
    nimiEl.focus();
  }
}

if ("BarcodeDetector" in window) {
  skannaaBtn.hidden = false;
}

skannaaBtn.addEventListener("click", function () {
  skanneriStatus.textContent = "Kohdista viivakoodi kameraan…";
  skanneriEl.hidden = false;
  navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } })
    .then(function (stream) {
      skanneriStream = stream;
      skanneriVideo.srcObject = stream;
      var detector;
      try {
        detector = new window.BarcodeDetector({ formats: ["ean_13", "ean_8", "upc_a", "upc_e", "code_128"] });
      } catch (err) {
        console.error("BarcodeDetectorin luonti epäonnistui", err);
        skanneriStatus.textContent = "Viivakoodin tunnistus ei ole tuettu tässä selaimessa.";
        return;
      }
      skanneriInterval = setInterval(function () {
        detector.detect(skanneriVideo).then(function (koodit) {
          if (koodit.length > 0) {
            var koodi = koodit[0].rawValue;
            skanneriStatus.textContent = "Löytyi: " + koodi;
            lopetaSkannaus();
            kasitteleSkannattuKoodi(koodi);
          }
        }).catch(function () {});
      }, 400);
    })
    .catch(function (err) {
      console.error("Kameran käyttö epäonnistui", err);
      skanneriStatus.textContent = "Kameran käyttöoikeus evätty tai kamera ei ole saatavilla.";
    });
});

skanneriSulje.addEventListener("click", lopetaSkannaus);

skanneriEl.addEventListener("click", function (e) {
  if (e.target === skanneriEl) lopetaSkannaus();
});

document.addEventListener("keydown", function (e) {
  if (e.key === "Escape" && !skanneriEl.hidden) lopetaSkannaus();
});

dupPaivitaBtn.addEventListener("click", function () {
  if (!odottavaLisays) return;
  var tiedot = odottavaLisays;
  dupPaivitaBtn.disabled = true;
  suoritaHinnanPaivitys(tiedot.duplikaatti.id, tiedot.hinta, tiedot.duplikaatti.hinta, tiedot.duplikaatti.koko, tiedot.duplikaatti.prosentti)
    .then(function () {
      piilotaDuplikaattivaroitus();
      nimiEl.value = "";
      hintaEl.value = "";
      kokoEl.value = "";
      prosenttiEl.value = "";
      skannattuViivakoodi = null;
      nimiEl.focus();
    })
    .catch(function (e) {
      console.error("Hinnan päivitys epäonnistui", e);
      alert("Hinnan päivitys ei onnistunut. Yritä uudelleen.");
    })
    .finally(function () {
      dupPaivitaBtn.disabled = false;
    });
});

dupOhitaBtn.addEventListener("click", function () {
  if (!odottavaLisays) return;
  var tiedot = odottavaLisays;
  piilotaDuplikaattivaroitus();
  luoUusiJuoma(tiedot);
});

function luoUusiJuoma(tiedot) {
  lisaaBtn.disabled = true;

  var uusiJuomaRef = doc(juomatCol);
  var rateRef = doc(db, "ratelimits", deviceId);
  var batch = writeBatch(db);

  var data = {
    nimi: tiedot.nimi,
    hinta: tiedot.hinta,
    koko: tiedot.koko,
    prosentti: tiedot.prosentti,
    dokabiliteetti: tiedot.dokabiliteetti,
    kauppa: tiedot.kauppa,
    lisaaja: tiedot.lisaaja,
    deviceId: deviceId,
    historia: [],
    peukut: 0,
    kommentit: [],
    luotu: serverTimestamp()
  };
  if (tiedot.viivakoodi) data.viivakoodi = tiedot.viivakoodi;

  batch.set(uusiJuomaRef, data);
  batch.set(rateRef, { viimeisin: serverTimestamp() });

  var oliOffline = !navigator.onLine;

  var commitPromise = batch.commit().then(function () {
    if (!oliOffline) {
      nimiEl.value = "";
      hintaEl.value = "";
      kokoEl.value = "";
      prosenttiEl.value = "";
      skannattuViivakoodi = null;
      nimiEl.focus();
    }
  }).catch(function (e) {
    console.error("Tallennus epäonnistui", e);
    if (e && e.code === "permission-denied") {
      errorEl.textContent = "Lisäys hylättiin (esim. liian nopea tahti). Tarkista tiedot ja yritä uudelleen.";
      errorEl.hidden = false;
    } else if (!navigator.onLine) {
      // ei näytetä virhettä - jää odottamaan yhteyden palautumista
    } else {
      errorEl.textContent = "Tallennus epäonnistui. Tarkista nettiyhteys ja yritä uudelleen.";
      errorEl.hidden = false;
    }
  }).finally(function () {
    lisaaBtn.disabled = false;
  });

  if (oliOffline) {
    // Firestore jonottaa kirjoituksen paikallisesti (IndexedDB) ja lähettää sen
    // automaattisesti kun yhteys palaa - ei odoteta commit-lupausta UI:ssa.
    errorEl.hidden = true;
    nimiEl.value = "";
    hintaEl.value = "";
    kokoEl.value = "";
    prosenttiEl.value = "";
    skannattuViivakoodi = null;
    lisaaBtn.disabled = false;
    nimiEl.focus();
  }

  return commitPromise;
}

form.addEventListener("submit", function (e) {
  e.preventDefault();

  var hinta = parseFloat(hintaEl.value);
  var koko = parseFloat(kokoEl.value);
  var prosentti = parseFloat(prosenttiEl.value);

  if (!hinta || hinta <= 0 || !koko || koko <= 0 || isNaN(prosentti) || prosentti < 0) {
    errorEl.textContent = "Täytä hinta, koko ja alkoholiprosentti kelvollisilla arvoilla.";
    errorEl.hidden = false;
    return;
  }
  errorEl.hidden = true;

  var nimi = nimiEl.value.trim() || "Nimetön juoma";
  var dokabiliteetti = laskeDokabiliteetti(hinta, koko, prosentti);
  var kauppa = KAUPAT.indexOf(kauppaEl.value) !== -1 ? kauppaEl.value : "Muu";
  var lisaaja = lisaajaEl.value.trim().slice(0, 40) || "Nimetön";

  if (lisaajaEl.value.trim()) {
    localStorage.setItem(OMA_NIMI_AVAIN, lisaajaEl.value.trim());
  }

  var tiedot = {
    nimi: nimi,
    hinta: hinta,
    koko: koko,
    prosentti: prosentti,
    dokabiliteetti: dokabiliteetti,
    kauppa: kauppa,
    lisaaja: lisaaja,
    viivakoodi: skannattuViivakoodi
  };

  var duplikaatti = etsiDuplikaatti(nimi, koko, kauppa, skannattuViivakoodi);
  if (duplikaatti) {
    odottavaLisays = { duplikaatti: duplikaatti, hinta: hinta, nimi: nimi, koko: koko, prosentti: prosentti, dokabiliteetti: dokabiliteetti, kauppa: kauppa, lisaaja: lisaaja, viivakoodi: skannattuViivakoodi };
    naytaDuplikaattivaroitus(duplikaatti, hinta);
    return;
  }

  luoUusiJuoma(tiedot);
});

tyhjennaBtn.addEventListener("click", function () {
  if (!onAdmin || juomat.length === 0) return;
  if (!confirm("Poistetaanko KAIKKI jaetun listan juomat?")) return;
  Promise.all(juomat.map(function (j) {
    return deleteDoc(doc(db, "juomat", j.id));
  })).catch(function (e) {
    console.error("Tyhjennys epäonnistui osittain", e);
    alert("Osa poistoista epäonnistui. Tarkista Firestoren Rules-asetukset.");
  });
});

hakuEl.addEventListener("input", function () {
  hakuTeksti = hakuEl.value;
  render();
});

suosikitToggle.addEventListener("click", function () {
  naytaVainSuosikit = !naytaVainSuosikit;
  render();
});

// Delegoitu klikkauskäsittelijä kaikille korttien toiminnoille
tuloksetEl.addEventListener("click", function (e) {
  var btn = e.target.closest("button[data-action]");
  if (!btn) return;
  var action = btn.getAttribute("data-action");
  var id = btn.getAttribute("data-id");
  var juoma = juomat.find(function (j) { return j.id === id; });

  if (action === "suosikki") {
    if (suosikit[id]) { delete suosikit[id]; } else { suosikit[id] = true; }
    tallennaLista(SUOSIKIT_AVAIN, suosikit);
    render();
  } else if (action === "poista") {
    if (!onAdmin) return;
    deleteDoc(doc(db, "juomat", id)).catch(function (e2) {
      console.error("Poisto epäonnistui", e2);
      alert("Poisto ei onnistunut. Yritä uudelleen.");
    });
  } else if (action === "peukku") {
    if (peukutukset[id]) {
      delete peukutukset[id];
      tallennaLista(PEUKUTUKSET_AVAIN, peukutukset);
      updateDoc(doc(db, "juomat", id), { peukut: increment(-1) }).catch(function (e2) {
        console.error("Peukutuksen poisto epäonnistui", e2);
        peukutukset[id] = true;
        tallennaLista(PEUKUTUKSET_AVAIN, peukutukset);
        render();
      });
    } else {
      peukutukset[id] = true;
      tallennaLista(PEUKUTUKSET_AVAIN, peukutukset);
      updateDoc(doc(db, "juomat", id), { peukut: increment(1) }).catch(function (e2) {
        console.error("Peukutus epäonnistui", e2);
        delete peukutukset[id];
        tallennaLista(PEUKUTUKSET_AVAIN, peukutukset);
        render();
      });
    }
    render();
  } else if (action === "toggle-kommentit") {
    avoinKommentit[id] = !avoinKommentit[id];
    render();
  } else if (action === "toggle-hinta") {
    avoinHintaPaivitys[id] = !avoinHintaPaivitys[id];
    render();
  } else if (action === "toggle-ilmoitus") {
    avoinIlmoitus[id] = !avoinIlmoitus[id];
    render();
  } else if (action === "ilmoita-kommentti") {
    if (!juoma) return;
    var kidx = Number(btn.getAttribute("data-kidx"));
    var kommenttiObjekti = (juoma.kommentit || [])[kidx];
    if (!kommenttiObjekti) return;
    btn.disabled = true;
    btn.textContent = "Ilmoitettu";
    laheteIlmoitus({
      tyyppi: "kommentti",
      kohdeId: id,
      kommenttiObjekti: kommenttiObjekti,
      syy: "Asiaton kommentti",
      lisatiedot: ""
    }).catch(function (e2) {
      console.error("Ilmoitus epäonnistui", e2);
      btn.disabled = false;
      btn.textContent = "Ilmoita";
    });
  }
});

// Delegoitu submit-käsittelijä kommentti- ja hintalomakkeille
tuloksetEl.addEventListener("submit", function (e) {
  var form2 = e.target;
  var action = form2.getAttribute("data-action");
  var id = form2.getAttribute("data-id");
  var juoma = juomat.find(function (j) { return j.id === id; });
  if (!juoma) return;

  if (action === "lisaa-kommentti") {
    e.preventDefault();
    var input = form2.querySelector("input");
    var teksti = input.value.trim().slice(0, 120);
    if (!teksti) return;
    var nimi = lisaajaEl.value.trim().slice(0, 40) || "Nimetön";
    updateDoc(doc(db, "juomat", id), {
      kommentit: arrayUnion({ teksti: teksti, nimi: nimi, pvm: Date.now() })
    }).then(function () {
      input.value = "";
    }).catch(function (e2) {
      console.error("Kommentin lisäys epäonnistui", e2);
      alert("Kommentin lisäys ei onnistunut. Yritä uudelleen.");
    });
  } else if (action === "paivita-hinta") {
    e.preventDefault();
    var hintaInput = form2.querySelector("input");
    var uusiHinta = parseFloat(hintaInput.value);
    if (!uusiHinta || uusiHinta <= 0) return;
    var uusiDoka = laskeDokabiliteetti(uusiHinta, juoma.koko, juoma.prosentti);
    updateDoc(doc(db, "juomat", id), {
      hinta: uusiHinta,
      dokabiliteetti: uusiDoka,
      historia: arrayUnion({ hinta: juoma.hinta, pvm: Date.now() })
    }).then(function () {
      delete avoinHintaPaivitys[id];
    }).catch(function (e2) {
      console.error("Hinnan päivitys epäonnistui", e2);
      alert("Hinnan päivitys ei onnistunut. Yritä uudelleen.");
    });
  } else if (action === "ilmoita-juoma") {
    e.preventDefault();
    var syyEl = form2.querySelector("select[name=syy]");
    var lisatietoEl = form2.querySelector("input[type=text]");
    var submitBtn = form2.querySelector("button[type=submit]");
    submitBtn.disabled = true;
    laheteIlmoitus({
      tyyppi: "juoma",
      kohdeId: id,
      syy: syyEl.value,
      lisatiedot: lisatietoEl.value.trim().slice(0, 200)
    }).then(function () {
      delete avoinIlmoitus[id];
      render();
    }).catch(function (e2) {
      console.error("Ilmoitus epäonnistui", e2);
      alert("Ilmoituksen lähetys ei onnistunut. Yritä uudelleen.");
      submitBtn.disabled = false;
    });
  }
});

adminToggle.addEventListener("click", function () {
  adminForm.hidden = !adminForm.hidden;
});

adminForm.addEventListener("submit", function (e) {
  e.preventDefault();
  adminVirhe.hidden = true;
  signInWithEmailAndPassword(auth, adminEmail.value.trim(), adminSalasana.value)
    .then(function () {
      adminSalasana.value = "";
    })
    .catch(function (err) {
      console.error("Kirjautuminen epäonnistui", err);
      adminVirhe.textContent = "Kirjautuminen epäonnistui. Tarkista sähköposti ja salasana.";
      adminVirhe.hidden = false;
    });
});

adminLogout.addEventListener("click", function () {
  signOut(auth);
});

var ilmoitukset = [];
var unsubIlmoitukset = null;

onAuthStateChanged(auth, function (user) {
  onAdmin = !!user && user.uid === adminUid;
  adminToggle.hidden = onAdmin;
  adminForm.hidden = true;
  adminLogout.hidden = !onAdmin;
  tilastotToggle.hidden = !onAdmin;
  if (!onAdmin) tilastotPaneeliEl.hidden = true;

  ilmoituksetToggle.hidden = !onAdmin;
  if (onAdmin && !unsubIlmoitukset) {
    unsubIlmoitukset = onSnapshot(ilmoituksetQuery, function (snapshot) {
      ilmoitukset = snapshot.docs.map(function (d) {
        var data = d.data();
        return {
          id: d.id,
          tyyppi: data.tyyppi,
          kohdeId: data.kohdeId,
          kommenttiObjekti: data.kommenttiObjekti || null,
          syy: data.syy,
          lisatiedot: data.lisatiedot || ""
        };
      });
      ilmoituksetToggle.textContent = "🚨 Ilmoitukset (" + ilmoitukset.length + ")";
      if (!ilmoituksetPaneeliEl.hidden) renderaaIlmoitukset();
    }, function (err) {
      console.error("Ilmoitusten haku epäonnistui", err);
    });
  } else if (!onAdmin && unsubIlmoitukset) {
    unsubIlmoitukset();
    unsubIlmoitukset = null;
    ilmoitukset = [];
    ilmoituksetPaneeliEl.hidden = true;
  }

  render();
  renderaaReseptit();
});

render();

if (document.querySelector(".adsbygoogle")) {
  try {
    (window.adsbygoogle = window.adsbygoogle || []).push({});
  } catch (e) {
    console.error("Mainoksen lataus epäonnistui", e);
  }
}

if ("serviceWorker" in navigator) {
  window.addEventListener("load", function () {
    navigator.serviceWorker.register("sw.js").catch(function (err) {
      console.error("Service workerin rekisteröinti epäonnistui", err);
    });
  });
}

// ---- Välilehdet ----
var TAB_OTSIKOT = {
  doka: "Dokabiliteetti – laske juomien hinta-alkoholisuhde",
  booli: "Boolilaskuri – Dokabiliteetti",
  hinta: "Hintaindeksi – Dokabiliteetti"
};

function vaihdaValilehti(tab, paivitaHash) {
  if (!TAB_OTSIKOT[tab]) tab = "doka";
  Array.prototype.forEach.call(tabBtns, function (b) {
    var onAktiivinen = b.getAttribute("data-tab") === tab;
    b.classList.toggle("active", onAktiivinen);
    b.setAttribute("aria-selected", String(onAktiivinen));
  });
  dokaNakymaEl.hidden = tab !== "doka";
  booliNakymaEl.hidden = tab !== "booli";
  hintaNakymaEl.hidden = tab !== "hinta";
  document.title = TAB_OTSIKOT[tab];
  if (paivitaHash) {
    history.replaceState(null, "", tab === "doka" ? "#" : "#" + tab);
  }
}

Array.prototype.forEach.call(tabBtns, function (btn) {
  btn.addEventListener("click", function () {
    vaihdaValilehti(btn.getAttribute("data-tab"), true);
  });
});

window.addEventListener("hashchange", function () {
  vaihdaValilehti(location.hash.replace("#", "") || "doka", false);
});

vaihdaValilehti(location.hash.replace("#", "") || "doka", false);

// ---- Boolilaskuri ----
var booliAinesosat = [
  { nimi: "", tilavuus: "", yksikko: "l", prosentti: "", hinta: "" },
  { nimi: "", tilavuus: "", yksikko: "l", prosentti: "", hinta: "" }
];

var YKSIKKOKERROIN = { l: 1, dl: 0.1, cl: 0.01 };

function renderaaAinesosat() {
  ainesosatEl.innerHTML = booliAinesosat.map(function (a, i) {
    var yksikko = a.yksikko || "l";
    return '<div class="ainesosa-rivi">' +
      '<input type="text" placeholder="esim. Valkoviini" value="' + escapeHtml(a.nimi) + '" data-idx="' + i + '" data-field="nimi" class="ainesosa-input" aria-label="Ainesosan nimi">' +
      '<div class="ainesosa-grid">' +
        '<div class="tilavuus-wrap">' +
          '<input type="number" placeholder="M&auml;&auml;r&auml;" step="0.01" min="0" inputmode="decimal" value="' + escapeHtml(a.tilavuus) + '" data-idx="' + i + '" data-field="tilavuus" class="ainesosa-input" aria-label="M&auml;&auml;r&auml;">' +
          '<select data-idx="' + i + '" data-field="yksikko" class="ainesosa-input" aria-label="Yksikk&ouml;">' +
            '<option value="l"' + (yksikko === "l" ? " selected" : "") + '>l</option>' +
            '<option value="dl"' + (yksikko === "dl" ? " selected" : "") + '>dl</option>' +
            '<option value="cl"' + (yksikko === "cl" ? " selected" : "") + '>cl</option>' +
          "</select>" +
        "</div>" +
        '<input type="number" placeholder="Alkoholi %" step="0.1" min="0" inputmode="decimal" value="' + escapeHtml(a.prosentti) + '" data-idx="' + i + '" data-field="prosentti" class="ainesosa-input" aria-label="Alkoholiprosentti">' +
        '<input type="number" placeholder="Hinta €" step="0.01" min="0" inputmode="decimal" value="' + escapeHtml(a.hinta) + '" data-idx="' + i + '" data-field="hinta" class="ainesosa-input" aria-label="Hinta euroina">' +
        '<button type="button" class="ainesosa-poista" data-idx="' + i + '" aria-label="Poista ainesosa">&times;</button>' +
      "</div>" +
    "</div>";
  }).join("");
}

function laskeJaNaytaBooliTulos() {
  var kelvolliset = booliAinesosat.filter(function (a) {
    return parseFloat(a.tilavuus) > 0;
  });

  if (kelvolliset.length === 0) {
    booliTulosEl.innerHTML = '<p class="empty-state">Lisää ainakin yksi ainesosa, jolla on määrä.</p>';
    return;
  }

  var kokonaistilavuus = 0;
  var kokonaisAlkoholiLitroina = 0;
  var kokonaishinta = 0;

  kelvolliset.forEach(function (a) {
    var kerroin = YKSIKKOKERROIN[a.yksikko] || 1;
    var l = (parseFloat(a.tilavuus) || 0) * kerroin;
    var p = parseFloat(a.prosentti) || 0;
    var h = parseFloat(a.hinta) || 0;
    kokonaistilavuus += l;
    kokonaisAlkoholiLitroina += l * (p / 100);
    kokonaishinta += h;
  });

  var lopullinenProsentti = kokonaistilavuus > 0 ? (kokonaisAlkoholiLitroina / kokonaistilavuus) * 100 : 0;
  var hintaPerLitra = kokonaistilavuus > 0 ? kokonaishinta / kokonaistilavuus : 0;
  var annoksia = Math.floor(kokonaistilavuus / 0.2);
  var booliDoka = kokonaishinta > 0 ? (kokonaisAlkoholiLitroina * 1000) / kokonaishinta : 0;

  booliTulosEl.innerHTML =
    '<div class="booli-tulos-rivi"><span>Kokonaistilavuus</span><strong>' + pyorista(kokonaistilavuus, 2) + ' l</strong></div>' +
    '<div class="booli-tulos-rivi"><span>Lopullinen vahvuus</span><strong>' + pyorista(lopullinenProsentti, 1) + ' %</strong></div>' +
    '<div class="booli-tulos-rivi"><span>Kokonaishinta</span><strong>' + pyorista(kokonaishinta, 2).toFixed(2) + ' €</strong></div>' +
    '<div class="booli-tulos-rivi"><span>Hinta / litra</span><strong>' + pyorista(hintaPerLitra, 2).toFixed(2) + ' €</strong></div>' +
    '<div class="booli-tulos-rivi"><span>Annoksia (2 dl)</span><strong>~' + annoksia + ' kpl</strong></div>' +
    '<div class="booli-tulos-rivi highlight"><span>Boolin dokabiliteetti</span><strong>' + pyorista(booliDoka, 2) + '</strong></div>';
}

ainesosatEl.addEventListener("input", function (e) {
  var el = e.target;
  if (!el.classList.contains("ainesosa-input")) return;
  var idx = Number(el.getAttribute("data-idx"));
  var field = el.getAttribute("data-field");
  booliAinesosat[idx][field] = el.value;
  laskeJaNaytaBooliTulos();
});

ainesosatEl.addEventListener("click", function (e) {
  var btn = e.target.closest(".ainesosa-poista");
  if (!btn) return;
  var idx = Number(btn.getAttribute("data-idx"));
  booliAinesosat.splice(idx, 1);
  renderaaAinesosat();
  laskeJaNaytaBooliTulos();
});

lisaaAinesosaBtn.addEventListener("click", function () {
  booliAinesosat.push({ nimi: "", tilavuus: "", yksikko: "l", prosentti: "", hinta: "" });
  renderaaAinesosat();
});

renderaaAinesosat();
laskeJaNaytaBooliTulos();

// ---- Boolireseptien tallennus ja jako ----
function renderaaReseptit() {
  if (booliReseptit.length === 0) {
    reseptitEl.innerHTML = '<p class="empty-state">Ei vielä tallennettuja reseptejä.</p>';
    return;
  }
  reseptitEl.innerHTML = booliReseptit.map(function (r) {
    var ainesLista = r.ainesosat.map(function (a) { return a.nimi || "Nimetön"; }).join(", ");
    return '<div class="resepti-kortti">' +
      '<div class="resepti-kortti-top"><span class="resepti-nimi">' + escapeHtml(r.nimi) + "</span></div>" +
      '<div class="resepti-meta">' + pyorista(r.kokonaistilavuus, 2) + " l · " + pyorista(r.lopullinenProsentti, 1) + " % · " + pyorista(r.kokonaishinta, 2).toFixed(2) + " € · lisäsi " + escapeHtml(r.lisaaja) + "<br>" + escapeHtml(ainesLista) + "</div>" +
      '<div class="resepti-actions">' +
        '<button type="button" class="ghost" data-action="lataa-resepti" data-id="' + r.id + '">K&auml;yt&auml; t&auml;t&auml;</button>' +
        (onAdmin ? '<button type="button" class="ghost" data-action="poista-resepti" data-id="' + r.id + '">Poista</button>' : "") +
      "</div>" +
    "</div>";
  }).join("");
}

reseptitEl.addEventListener("click", function (e) {
  var btn = e.target.closest("button[data-action]");
  if (!btn) return;
  var action = btn.getAttribute("data-action");
  var id = btn.getAttribute("data-id");
  var resepti = booliReseptit.find(function (r) { return r.id === id; });
  if (!resepti) return;

  if (action === "lataa-resepti") {
    booliAinesosat = resepti.ainesosat.map(function (a) {
      return { nimi: a.nimi || "", tilavuus: a.tilavuus != null ? String(a.tilavuus) : "", yksikko: "l", prosentti: a.prosentti != null ? String(a.prosentti) : "", hinta: a.hinta != null ? String(a.hinta) : "" };
    });
    if (booliAinesosat.length === 0) booliAinesosat = [{ nimi: "", tilavuus: "", yksikko: "l", prosentti: "", hinta: "" }];
    renderaaAinesosat();
    laskeJaNaytaBooliTulos();
    reseptiNimiEl.value = resepti.nimi;
  } else if (action === "poista-resepti") {
    if (!onAdmin) return;
    deleteDoc(doc(db, "boolireseptit", id)).catch(function (e2) {
      console.error("Reseptin poisto epäonnistui", e2);
      alert("Poisto ei onnistunut.");
    });
  }
});

tallennaReseptiBtn.addEventListener("click", function () {
  reseptiVirheEl.hidden = true;

  var reseptinNimi = reseptiNimiEl.value.trim();
  if (!reseptinNimi) {
    reseptiVirheEl.textContent = "Anna reseptille nimi.";
    reseptiVirheEl.hidden = false;
    return;
  }

  var kelvolliset = booliAinesosat.filter(function (a) { return parseFloat(a.tilavuus) > 0; });
  if (kelvolliset.length === 0) {
    reseptiVirheEl.textContent = "Lisää ainakin yksi ainesosa, jolla on määrä.";
    reseptiVirheEl.hidden = false;
    return;
  }

  var kokonaistilavuus = 0;
  var kokonaisAlkoholiLitroina = 0;
  var kokonaishinta = 0;
  var ainesosatData = kelvolliset.map(function (a) {
    var kerroin = YKSIKKOKERROIN[a.yksikko] || 1;
    var l = (parseFloat(a.tilavuus) || 0) * kerroin;
    var p = parseFloat(a.prosentti) || 0;
    var h = parseFloat(a.hinta) || 0;
    kokonaistilavuus += l;
    kokonaisAlkoholiLitroina += l * (p / 100);
    kokonaishinta += h;
    return { nimi: (a.nimi || "Nimetön").trim().slice(0, 40), tilavuus: l, prosentti: p, hinta: h };
  });
  var lopullinenProsentti = kokonaistilavuus > 0 ? (kokonaisAlkoholiLitroina / kokonaistilavuus) * 100 : 0;
  var lisaaja = lisaajaEl.value.trim().slice(0, 40) || "Nimetön";

  tallennaReseptiBtn.disabled = true;

  var uusiReseptiRef = doc(reseptitCol);
  var rateRef = doc(db, "ratelimits", deviceId);
  var batch = writeBatch(db);

  batch.set(uusiReseptiRef, {
    nimi: reseptinNimi.slice(0, 60),
    ainesosat: ainesosatData,
    kokonaistilavuus: kokonaistilavuus,
    lopullinenProsentti: lopullinenProsentti,
    kokonaishinta: kokonaishinta,
    lisaaja: lisaaja,
    deviceId: deviceId,
    luotu: serverTimestamp()
  });
  batch.set(rateRef, { viimeisin: serverTimestamp() });

  batch.commit().then(function () {
    reseptiNimiEl.value = "";
  }).catch(function (e) {
    console.error("Reseptin tallennus epäonnistui", e);
    if (e && e.code === "permission-denied") {
      reseptiVirheEl.textContent = "Tallennat liian nopeasti peräkkäin — odota hetki ja yritä uudelleen.";
    } else {
      reseptiVirheEl.textContent = "Tallennus epäonnistui. Tarkista nettiyhteys ja yritä uudelleen.";
    }
    reseptiVirheEl.hidden = false;
  }).finally(function () {
    tallennaReseptiBtn.disabled = false;
  });
});

// ---- Ylläpitäjän tilastonäkymä ----
function renderaaTilastot() {
  if (!onAdmin) {
    tilastotPaneeliEl.innerHTML = "";
    return;
  }

  var nyt = Date.now();
  var viikkoSitten = nyt - 7 * 24 * 60 * 60 * 1000;
  var uusiaViikossa = juomat.filter(function (j) { return j.luotu && j.luotu.getTime() > viikkoSitten; }).length;

  var lisaajaLaskuri = {};
  var kauppaLaskuri = {};
  var peukutYhteensa = 0;
  var kommenttejaYhteensa = 0;

  juomat.forEach(function (j) {
    var nimi = (j.lisaaja || "Nimetön").trim() || "Nimetön";
    lisaajaLaskuri[nimi] = (lisaajaLaskuri[nimi] || 0) + 1;
    var kauppa = j.kauppa || "Muu";
    kauppaLaskuri[kauppa] = (kauppaLaskuri[kauppa] || 0) + 1;
    peukutYhteensa += j.peukut || 0;
    kommenttejaYhteensa += (j.kommentit || []).length;
  });

  var topLisaajat = Object.keys(lisaajaLaskuri).sort(function (a, b) {
    return lisaajaLaskuri[b] - lisaajaLaskuri[a];
  }).slice(0, 10);

  var topKaupat = Object.keys(kauppaLaskuri).sort(function (a, b) {
    return kauppaLaskuri[b] - kauppaLaskuri[a];
  });

  var html = "";
  html += '<div class="tilastot-rivi"><span>Juomia yhteensä</span><strong>' + juomat.length + "</strong></div>";
  html += '<div class="tilastot-rivi"><span>Lisätty viim. 7 vrk</span><strong>' + uusiaViikossa + "</strong></div>";
  html += '<div class="tilastot-rivi"><span>Vahvistuksia yhteensä</span><strong>' + peukutYhteensa + "</strong></div>";
  html += '<div class="tilastot-rivi"><span>Kommentteja yhteensä</span><strong>' + kommenttejaYhteensa + "</strong></div>";
  html += '<div class="tilastot-rivi"><span>Tallennettuja reseptejä</span><strong>' + booliReseptit.length + "</strong></div>";

  html += '<div class="tilastot-otsikko">Aktiivisimmat lisääjät</div>';
  if (topLisaajat.length === 0) {
    html += '<div class="tilastot-rivi"><span>Ei vielä dataa</span></div>';
  } else {
    topLisaajat.forEach(function (nimi) {
      html += '<div class="tilastot-rivi"><span>' + escapeHtml(nimi) + "</span><strong>" + lisaajaLaskuri[nimi] + "</strong></div>";
    });
  }

  html += '<div class="tilastot-otsikko">Suosituimmat kaupat</div>';
  if (topKaupat.length === 0) {
    html += '<div class="tilastot-rivi"><span>Ei vielä dataa</span></div>';
  } else {
    topKaupat.forEach(function (kauppa) {
      html += '<div class="tilastot-rivi"><span>' + escapeHtml(kauppa) + "</span><strong>" + kauppaLaskuri[kauppa] + "</strong></div>";
    });
  }

  tilastotPaneeliEl.innerHTML = html;
}

tilastotToggle.addEventListener("click", function () {
  tilastotPaneeliEl.hidden = !tilastotPaneeliEl.hidden;
  if (!tilastotPaneeliEl.hidden) renderaaTilastot();
});

// ---- Ilmoitusten lähetys (jaettu juoma- ja kommenttiraportoinnille) ----
function laheteIlmoitus(tiedot) {
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

// ---- Ylläpitäjän moderointijono ----
function renderaaIlmoitukset() {
  if (ilmoitukset.length === 0) {
    ilmoituksetPaneeliEl.innerHTML = '<p class="empty-state">Ei avoimia ilmoituksia.</p>';
    return;
  }

  ilmoituksetPaneeliEl.innerHTML = ilmoitukset.map(function (ilm) {
    var kohdeKuvaus;
    if (ilm.tyyppi === "kommentti" && ilm.kommenttiObjekti) {
      kohdeKuvaus = 'Kommentti: "' + escapeHtml(ilm.kommenttiObjekti.teksti) + '" (' + escapeHtml(ilm.kommenttiObjekti.nimi || "Nimetön") + ")";
    } else {
      var kohdeJuoma = juomat.find(function (j) { return j.id === ilm.kohdeId; });
      kohdeKuvaus = kohdeJuoma
        ? "Juoma: " + escapeHtml(kohdeJuoma.nimi) + " (" + pyorista(kohdeJuoma.hinta, 2).toFixed(2) + " €, " + escapeHtml(kohdeJuoma.kauppa) + ")"
        : "Juoma ei ole enää listalla (jo poistettu)";
    }
    return '<div class="ilmoitus-kortti">' +
      '<div class="ilmoitus-kohde">' + kohdeKuvaus + "</div>" +
      '<div class="ilmoitus-syy">Syy: ' + escapeHtml(ilm.syy) + (ilm.lisatiedot ? " — " + escapeHtml(ilm.lisatiedot) : "") + "</div>" +
      '<div class="ilmoitus-actions">' +
        '<button type="button" data-action="poista-sisalto" data-id="' + ilm.id + '">Poista sis&auml;lt&ouml;</button>' +
        '<button type="button" class="ghost" data-action="hylkaa-ilmoitus" data-id="' + ilm.id + '">Hylk&auml;&auml;</button>' +
      "</div>" +
    "</div>";
  }).join("");
}

ilmoituksetToggle.addEventListener("click", function () {
  ilmoituksetPaneeliEl.hidden = !ilmoituksetPaneeliEl.hidden;
  if (!ilmoituksetPaneeliEl.hidden) renderaaIlmoitukset();
});

ilmoituksetPaneeliEl.addEventListener("click", function (e) {
  var btn = e.target.closest("button[data-action]");
  if (!btn || !onAdmin) return;
  var action = btn.getAttribute("data-action");
  var id = btn.getAttribute("data-id");
  var ilm = ilmoitukset.find(function (i) { return i.id === id; });
  if (!ilm) return;

  btn.disabled = true;

  if (action === "hylkaa-ilmoitus") {
    deleteDoc(doc(db, "ilmoitukset", id)).catch(function (e2) {
      console.error("Ilmoituksen hylkäys epäonnistui", e2);
      btn.disabled = false;
    });
  } else if (action === "poista-sisalto") {
    var toimenpide;
    if (ilm.tyyppi === "kommentti" && ilm.kommenttiObjekti) {
      toimenpide = updateDoc(doc(db, "juomat", ilm.kohdeId), {
        kommentit: arrayRemove(ilm.kommenttiObjekti)
      });
    } else {
      toimenpide = deleteDoc(doc(db, "juomat", ilm.kohdeId));
    }
    toimenpide.then(function () {
      return deleteDoc(doc(db, "ilmoitukset", id));
    }).catch(function (e2) {
      console.error("Sisällön poisto epäonnistui", e2);
      alert("Poisto ei onnistunut. Tarkista Firestoren Rules-asetukset.");
      btn.disabled = false;
    });
  }
});

// ---- Julkinen hintaindeksi ----
function renderaaHintaindeksi() {
  if (juomat.length === 0) {
    hintaindeksiTilastotEl.innerHTML = "";
    hintaindeksiTop10El.innerHTML = '<p class="empty-state">Ei vielä dataa.</p>';
    hintaindeksiKaupatEl.innerHTML = "";
    return;
  }

  hintaindeksiTilastotEl.innerHTML =
    '<div class="tilastot-rivi"><span>Juomia indeksissä</span><strong>' + juomat.length + "</strong></div>" +
    '<div class="tilastot-rivi"><span>P&auml;ivittyy</span><strong>reaaliajassa</strong></div>';

  var top10 = juomat.slice().sort(function (a, b) {
    return b.dokabiliteetti - a.dokabiliteetti;
  }).slice(0, 10);

  hintaindeksiTop10El.innerHTML = top10.map(function (j, i) {
    return '<div class="booli-tulos-rivi"><span>' + (i + 1) + ". " + escapeHtml(j.nimi) + " (" + escapeHtml(j.kauppa) + ")</span><strong>" + pyorista(j.dokabiliteetti, 2) + "</strong></div>";
  }).join("");

  var kauppaSummat = {};
  juomat.forEach(function (j) {
    var k = j.kauppa || "Muu";
    if (!kauppaSummat[k]) kauppaSummat[k] = { summa: 0, maara: 0 };
    kauppaSummat[k].summa += j.dokabiliteetti;
    kauppaSummat[k].maara += 1;
  });
  var kaupat = Object.keys(kauppaSummat).sort(function (a, b) {
    return (kauppaSummat[b].summa / kauppaSummat[b].maara) - (kauppaSummat[a].summa / kauppaSummat[a].maara);
  });

  hintaindeksiKaupatEl.innerHTML = kaupat.map(function (k) {
    var keskiarvo = kauppaSummat[k].summa / kauppaSummat[k].maara;
    return '<div class="booli-tulos-rivi"><span>' + escapeHtml(k) + " (" + kauppaSummat[k].maara + " juomaa)</span><strong>" + pyorista(keskiarvo, 2) + "</strong></div>";
  }).join("");
}
