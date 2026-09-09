import {
  db, juomatCol, juomatQuery, KAUPAT, JUOMATYYPIT, deviceId,
  laskeDokabiliteetti, laskePantti, pyorista, escapeHtml, muotoilePvm, sparklineSvg,
  lataaLista, tallennaLista, laheteIlmoitus, kirjaaVirhe,
  OMA_NIMI_AVAIN, SUOSIKIT_AVAIN, PEUKUTUKSET_AVAIN
} from "./core.js";
import { t, kielenVaihtuessa } from "./i18n.js";
import {
  doc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  arrayUnion,
  increment,
  writeBatch,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { vieCSV } from "./csv.js";
import { jaaJuoma } from "./share-image.js";

// onAdmin tulee admin.js:stä. Moduulit tuovat toisiaan ristikkäin (admin.js
// tarvitsee juomat-taulukon ja render()-funktion tästä tiedostosta), mikä on
// turvallista koska arvoa käytetään vain tapahtumakäsittelijöiden sisällä,
// ei heti moduulin lataushetkellä.
import { onAdmin } from "./admin.js";

var form = document.getElementById("lisaa-form");
var nimiEl = document.getElementById("nimi");
var hintaEl = document.getElementById("hinta");
var kokoEl = document.getElementById("koko");
var prosenttiEl = document.getElementById("prosentti");
var pullotyyppiEl = document.getElementById("pullotyyppi");
var panttiNayttoEl = document.getElementById("pantti-naytto");
var juomatyyppiEl = document.getElementById("juomatyyppi");
var tyyppisuodattimetEl = document.getElementById("tyyppisuodattimet");
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
var vieCsvBtn = document.getElementById("vie-csv-btn");

var skannaaBtn = document.getElementById("skannaa-btn");
var skanneriEl = document.getElementById("skanneri");
var skanneriVideo = document.getElementById("skanneri-video");
var skanneriStatus = document.getElementById("skanneri-status");
var skanneriSulje = document.getElementById("skanneri-sulje");

var dupVaroitusEl = document.getElementById("duplikaatti-varoitus");
var dupTekstiEl = document.getElementById("duplikaatti-teksti");
var dupPaivitaBtn = document.getElementById("duplikaatti-paivita");
var dupOhitaBtn = document.getElementById("duplikaatti-ohita");

var hintaindeksiTilastotEl = document.getElementById("hintaindeksi-tilastot");
var hintaindeksiTop10El = document.getElementById("hintaindeksi-top10");
var hintaindeksiKaupatEl = document.getElementById("hintaindeksi-kaupat");

var aktiivisetSuodattimet = {};
var aktiivisetTyyppisuodattimet = {};

var JUOMATYYPPI_AVAIMET = {
  "Olut": "tyyppi_olut",
  "Siideri": "tyyppi_siideri",
  "Lonkero": "tyyppi_lonkero",
  "Viini": "tyyppi_viini",
  "Kuohuviini": "tyyppi_kuohuviini",
  "Väkevä": "tyyppi_vakeva",
  "Shotti": "tyyppi_shotti",
  "Long drink": "tyyppi_longdrink",
  "Muu": "tyyppi_muu"
};

function tyyppiNimi(tyyppi) {
  var avain = JUOMATYYPPI_AVAIMET[tyyppi];
  return avain ? t(avain) : tyyppi;
}
var hakuTeksti = "";
var naytaVainSuosikit = false;
var avoinKommentit = {};
var avoinHintaPaivitys = {};
var avoinMuokkaus = {};
var avoinIlmoitus = {};
var viimeisinNakyvatJuomat = [];

export var juomat = [];
var yhteysVirhe = false;

var suosikit = lataaLista(SUOSIKIT_AVAIN);
var peukutukset = lataaLista(PEUKUTUKSET_AVAIN);

var tallennettuNimi = localStorage.getItem(OMA_NIMI_AVAIN);
if (tallennettuNimi) {
  lisaajaEl.value = tallennettuNimi;
}

var skannattuViivakoodi = null;
var skanneriStream = null;
var skanneriInterval = null;
var odottavaLisays = null;

function renderaaSuodattimet() {
  var eiYhtaanValittuna = Object.keys(aktiivisetSuodattimet).length === 0;
  var kaikkiKaupat = ["Kaikki"].concat(KAUPAT);
  suodattimetEl.innerHTML = kaikkiKaupat.map(function (k) {
    var aktiivinen = k === "Kaikki" ? eiYhtaanValittuna : !!aktiivisetSuodattimet[k];
    var naytettavaNimi = k === "Kaikki" ? t("suodatin_kaikki") : k;
    return '<button type="button" class="filter-chip' + (aktiivinen ? " active" : "") + '" data-kauppa="' + escapeHtml(k) + '">' + escapeHtml(naytettavaNimi) + "</button>";
  }).join("");

  Array.prototype.forEach.call(suodattimetEl.querySelectorAll(".filter-chip"), function (btn) {
    btn.addEventListener("click", function () {
      var k = btn.getAttribute("data-kauppa");
      if (k === "Kaikki") {
        aktiivisetSuodattimet = {};
      } else if (aktiivisetSuodattimet[k]) {
        delete aktiivisetSuodattimet[k];
      } else {
        aktiivisetSuodattimet[k] = true;
      }
      render();
    });
  });

  suosikitToggle.classList.toggle("active", naytaVainSuosikit);
}

function renderaaTyyppisuodattimet() {
  var eiYhtaanValittuna = Object.keys(aktiivisetTyyppisuodattimet).length === 0;
  var kaikkiTyypit = ["Kaikki"].concat(JUOMATYYPIT);
  tyyppisuodattimetEl.innerHTML = kaikkiTyypit.map(function (tyyppi) {
    var aktiivinen = tyyppi === "Kaikki" ? eiYhtaanValittuna : !!aktiivisetTyyppisuodattimet[tyyppi];
    var naytettavaNimi = tyyppi === "Kaikki" ? t("suodatin_kaikki") : tyyppiNimi(tyyppi);
    return '<button type="button" class="filter-chip' + (aktiivinen ? " active" : "") + '" data-tyyppi="' + escapeHtml(tyyppi) + '">' + escapeHtml(naytettavaNimi) + "</button>";
  }).join("");

  Array.prototype.forEach.call(tyyppisuodattimetEl.querySelectorAll(".filter-chip"), function (btn) {
    btn.addEventListener("click", function () {
      var tyyppi = btn.getAttribute("data-tyyppi");
      if (tyyppi === "Kaikki") {
        aktiivisetTyyppisuodattimet = {};
      } else if (aktiivisetTyyppisuodattimet[tyyppi]) {
        delete aktiivisetTyyppisuodattimet[tyyppi];
      } else {
        aktiivisetTyyppisuodattimet[tyyppi] = true;
      }
      render();
    });
  });
}

function renderaaKunniamaininta() {
  if (juomat.length === 0) {
    kunniamainintaEl.hidden = true;
    return;
  }
  var laskuri = {};
  juomat.forEach(function (j) {
    var nimi = (j.lisaaja || "").trim();
    if (!nimi || nimi === "Nimetön") return;
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

  kunniamainintaEl.innerHTML = t("kunniamaininta_prefix") + " " + teksti;
  kunniamainintaEl.hidden = false;
}

function kortinHtml(j, onParas, suhde) {
  var onSuosikki = !!suosikit[j.id];
  var onPeukutettu = !!peukutukset[j.id];
  var kommentitAuki = !!avoinKommentit[j.id];
  var hintaAuki = !!avoinHintaPaivitys[j.id];
  var muokkausAuki = !!avoinMuokkaus[j.id];
  var ilmoitusAuki = !!avoinIlmoitus[j.id];
  var kommentit = j.kommentit || [];
  var peukut = j.peukut || 0;

  var html = '<div class="card' + (onParas ? " best" : "") + '" data-id="' + j.id + '">';
  if (onParas) html += '<span class="badge">' + t("badge_paras_diili") + "</span>";

  html += '<div class="card-top">' +
    '<span><button class="fav-btn' + (onSuosikki ? " active" : "") + '" data-action="suosikki" data-id="' + j.id + '" aria-label="' + (onSuosikki ? "Poista suosikeista" : "Lisää suosikkeihin") + '" aria-pressed="' + onSuosikki + '">' + (onSuosikki ? "★" : "☆") + '</button>' +
    '<span class="card-name">' + escapeHtml(j.nimi) + "</span></span>" +
    (onAdmin ? '<button class="remove-btn" data-action="poista" data-id="' + j.id + '" aria-label="Poista ' + escapeHtml(j.nimi) + '">&times;</button>' : "") +
    "</div>";

  html += '<div class="card-meta">' +
    '<span class="card-details"><span class="card-store">' + escapeHtml(j.kauppa || "Muu") + '</span><span class="card-tyyppi">' + escapeHtml(tyyppiNimi(j.juomatyyppi || "Muu")) + "</span>" + pyorista(j.hinta, 2).toFixed(2) + " € · " + j.koko + " ml · " + j.prosentti + "%" + (j.pantti > 0 ? ' <span class="pantti-tag">+' + j.pantti.toFixed(2) + " € " + t("pantti_tag") + "</span>" : "") + "</span>" +
    '<span class="card-score">' + pyorista(j.dokabiliteetti, 2) + "</span>" +
    "</div>";

  html += '<div class="bar-track"><div class="bar-fill" style="width:' + suhde + '%"></div></div>';

  html += sparklineSvg(j.historia, j.hinta);

  var peukkuTeksti = onPeukutettu ? t("btn_vahvistettu") : t("btn_vahvista");
  html += '<div class="card-actions">' +
    '<button class="action-btn' + (onPeukutettu ? " active" : "") + '" data-action="peukku" data-id="' + j.id + '">' + peukkuTeksti + " (" + peukut + ")</button>" +
    '<button class="action-btn" data-action="toggle-kommentit" data-id="' + j.id + '">' + t("btn_kommentit") + " (" + kommentit.length + ")</button>" +
    '<button class="action-btn" data-action="toggle-hinta" data-id="' + j.id + '">' + t("btn_paivita_hinta") + "</button>" +
    (onAdmin ? '<button class="action-btn" data-action="toggle-muokkaa" data-id="' + j.id + '">' + t("btn_muokkaa") + "</button>" : "") +
    '<button class="action-btn" data-action="jaa" data-id="' + j.id + '">' + t("btn_jaa") + "</button>" +
    '<button class="action-btn report-btn" data-action="toggle-ilmoitus" data-id="' + j.id + '">' + t("btn_ilmoita") + "</button>" +
    "</div>";

  if (kommentitAuki) {
    html += '<div class="kommentit-panel">';
    if (kommentit.length === 0) {
      html += '<p class="kommentti-item" style="border:none; color:var(--text-muted);">' + t("empty_ei_kommentteja") + "</p>";
    } else {
      kommentit.slice().reverse().forEach(function (k, ri) {
        var alkuperainenIdx = kommentit.length - 1 - ri;
        html += '<div class="kommentti-item">' + escapeHtml(k.teksti) +
          '<span class="kommentti-pvm">' + escapeHtml(k.nimi || "Nimetön") + " · " + muotoilePvm(k.pvm) +
          ' · <button type="button" class="kommentti-ilmoita-btn" data-action="ilmoita-kommentti" data-id="' + j.id + '" data-kidx="' + alkuperainenIdx + '">' + t("ilmoita_linkki") + "</button></span></div>";
      });
    }
    html += '<form class="kommentti-form" data-action="lisaa-kommentti" data-id="' + j.id + '">' +
      '<input type="text" maxlength="120" placeholder="' + escapeHtml(t("placeholder_kommentti")) + '" required>' +
      '<button type="submit">' + t("btn_laheta") + "</button>" +
      "</form></div>";
  }

  if (hintaAuki) {
    html += '<div class="hinta-panel">' +
      '<form class="hinta-form" data-action="paivita-hinta" data-id="' + j.id + '">' +
      '<input type="number" min="0.01" step="0.01" placeholder="' + escapeHtml(t("placeholder_uusi_hinta")) + '" required>' +
      '<button type="submit">' + t("btn_paivita") + "</button>" +
      "</form></div>";
  }

  if (muokkausAuki && onAdmin) {
    html += '<div class="hinta-panel">' +
      '<form class="muokkaus-form" data-action="paivita-tiedot" data-id="' + j.id + '">' +
        '<input type="text" name="nimi" maxlength="60" value="' + escapeHtml(j.nimi) + '" aria-label="' + escapeHtml(t("label_nimi")) + '" required>' +
        '<select name="juomatyyppi" aria-label="' + escapeHtml(t("label_juomatyyppi")) + '">' +
          JUOMATYYPIT.map(function (ty) {
            return '<option value="' + escapeHtml(ty) + '"' + (ty === j.juomatyyppi ? " selected" : "") + '>' + escapeHtml(tyyppiNimi(ty)) + "</option>";
          }).join("") +
        "</select>" +
        '<select name="kauppa" aria-label="' + escapeHtml(t("label_kauppa")) + '">' +
          KAUPAT.map(function (k) {
            return '<option value="' + escapeHtml(k) + '"' + (k === j.kauppa ? " selected" : "") + '>' + escapeHtml(k) + "</option>";
          }).join("") +
        "</select>" +
        '<button type="submit">' + t("btn_paivita") + "</button>" +
      "</form></div>";
  }

  if (ilmoitusAuki) {
    html += '<div class="ilmoitus-panel">' +
      '<form class="ilmoitus-form" data-action="ilmoita-juoma" data-id="' + j.id + '">' +
        '<select name="syy" aria-label="Ilmoituksen syy">' +
          '<option value="' + escapeHtml(t("syy_roskaposti")) + '">' + t("syy_roskaposti") + "</option>" +
          '<option value="' + escapeHtml(t("syy_vaara_tieto")) + '">' + t("syy_vaara_tieto") + "</option>" +
          '<option value="' + escapeHtml(t("syy_asiaton")) + '">' + t("syy_asiaton") + "</option>" +
          '<option value="' + escapeHtml(t("syy_muu")) + '">' + t("syy_muu") + "</option>" +
        "</select>" +
        '<input type="text" maxlength="200" placeholder="' + escapeHtml(t("placeholder_lisatieto")) + '">' +
        '<button type="submit">' + t("btn_laheta_ilmoitus") + "</button>" +
      "</form></div>";
  }

  html += "</div>";
  return html;
}

export function render() {
  renderaaSuodattimet();
  renderaaTyyppisuodattimet();
  renderaaKunniamaininta();

  if (yhteysVirhe) {
    toolbarEl.hidden = true;
    tuloksetEl.innerHTML = '<p class="empty-state">' + t("empty_yhteysvirhe") + "</p>";
    return;
  }

  if (juomat.length === 0) {
    toolbarEl.hidden = true;
    tuloksetEl.innerHTML = '<p class="empty-state">' + t("empty_ei_juomia") + "</p>";
    viimeisinNakyvatJuomat = [];
    return;
  }

  var haku = hakuTeksti.trim().toLowerCase();
  var nakyvatJuomat = juomat.filter(function (j) {
    if (Object.keys(aktiivisetSuodattimet).length > 0 && !aktiivisetSuodattimet[j.kauppa]) return false;
    if (Object.keys(aktiivisetTyyppisuodattimet).length > 0 && !aktiivisetTyyppisuodattimet[j.juomatyyppi]) return false;
    if (naytaVainSuosikit && !suosikit[j.id]) return false;
    if (haku && j.nimi.toLowerCase().indexOf(haku) === -1) return false;
    return true;
  });
  viimeisinNakyvatJuomat = nakyvatJuomat;

  toolbarEl.hidden = false;
  tyhjennaBtn.hidden = !onAdmin;
  maaraTekstiEl.textContent = juomat.length + " " + (juomat.length === 1 ? t("juomia_yksikko") : t("juomia_monikko"));

  if (nakyvatJuomat.length === 0) {
    tuloksetEl.innerHTML = '<p class="empty-state">' + t("empty_ei_tuloksia") + "</p>";
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

export function renderaaHintaindeksi() {
  if (juomat.length === 0) {
    hintaindeksiTilastotEl.innerHTML = "";
    hintaindeksiTop10El.innerHTML = '<p class="empty-state">' + t("tilastot_ei_dataa") + "</p>";
    hintaindeksiKaupatEl.innerHTML = "";
    return;
  }

  hintaindeksiTilastotEl.innerHTML =
    '<div class="tilastot-rivi"><span>' + t("hintaindeksi_juomia") + "</span><strong>" + juomat.length + "</strong></div>" +
    '<div class="tilastot-rivi"><span>' + t("hintaindeksi_paivittyy") + "</span><strong>" + t("hintaindeksi_reaaliajassa") + "</strong></div>";

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
    return '<div class="booli-tulos-rivi"><span>' + escapeHtml(k) + " (" + kauppaSummat[k].maara + ")</span><strong>" + pyorista(keskiarvo, 2) + "</strong></div>";
  }).join("");
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
        juomatyyppi: data.juomatyyppi || "Muu",
        lisaaja: data.lisaaja || "Nimetön",
        historia: data.historia || [],
        peukut: data.peukut || 0,
        kommentit: data.kommentit || [],
        viivakoodi: data.viivakoodi || null,
        pullotyyppi: data.pullotyyppi || "ei_panttia",
        pantti: data.pantti || 0,
        luotu: data.luotu && data.luotu.toDate ? data.luotu.toDate() : null
      };
    });
    render();
    renderaaHintaindeksi();
  },
  function (err) {
    console.error("Firestore-yhteysvirhe", err);
    kirjaaVirhe("juomat-onSnapshot", err);
    yhteysVirhe = true;
    render();
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
  dupTekstiEl.textContent = t("dup_teksti", {
    nimi: duplikaatti.nimi,
    koko: duplikaatti.koko,
    kauppa: duplikaatti.kauppa,
    vanhaHinta: pyorista(duplikaatti.hinta, 2).toFixed(2),
    uusiHinta: uusiHinta.toFixed(2)
  });
  dupVaroitusEl.hidden = false;
  dupVaroitusEl.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function piilotaDuplikaattivaroitus() {
  dupVaroitusEl.hidden = true;
  odottavaLisays = null;
}

function suoritaHinnanPaivitys(id, uusiHinta, vanhaHinta, vanhaKoko, vanhaProsentti, pantti) {
  var uusiDoka = laskeDokabiliteetti(uusiHinta, vanhaKoko, vanhaProsentti, pantti);
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
    skanneriStream.getTracks().forEach(function (t2) { t2.stop(); });
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
  skanneriStatus.textContent = t("skanneri_kohdista");
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
        kirjaaVirhe("barcode-detector-luonti", err);
        skanneriStatus.textContent = t("skanneri_ei_tuettu");
        return;
      }
      skanneriInterval = setInterval(function () {
        detector.detect(skanneriVideo).then(function (koodit) {
          if (koodit.length > 0) {
            var koodi = koodit[0].rawValue;
            skanneriStatus.textContent = t("skanneri_loytyi", { koodi: koodi });
            lopetaSkannaus();
            kasitteleSkannattuKoodi(koodi);
          }
        }).catch(function () {});
      }, 400);
    })
    .catch(function (err) {
      console.error("Kameran käyttö epäonnistui", err);
      skanneriStatus.textContent = t("skanneri_epaonnistui");
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
  suoritaHinnanPaivitys(tiedot.duplikaatti.id, tiedot.hinta, tiedot.duplikaatti.hinta, tiedot.duplikaatti.koko, tiedot.duplikaatti.prosentti, tiedot.duplikaatti.pantti)
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
      kirjaaVirhe("duplikaatti-hinnan-paivitys", e);
      alert(t("virhe_hinnan_paivitys"));
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
    juomatyyppi: tiedot.juomatyyppi || "Muu",
    lisaaja: tiedot.lisaaja,
    pullotyyppi: tiedot.pullotyyppi || "ei_panttia",
    pantti: tiedot.pantti || 0,
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
      pullotyyppiEl.value = "ei_panttia";
      naytaPanttiEsikatselu();
      skannattuViivakoodi = null;
      nimiEl.focus();
    }
  }).catch(function (e) {
    console.error("Tallennus epäonnistui", e);
    kirjaaVirhe("luo-uusi-juoma", e);
    if (e && e.code === "permission-denied") {
      errorEl.textContent = t("virhe_liian_nopea");
      errorEl.hidden = false;
    } else if (!navigator.onLine) {
      // ei näytetä virhettä - jää odottamaan yhteyden palautumista
    } else {
      errorEl.textContent = t("virhe_tallennus");
      errorEl.hidden = false;
    }
  }).finally(function () {
    lisaaBtn.disabled = false;
  });

  if (oliOffline) {
    errorEl.hidden = true;
    nimiEl.value = "";
    hintaEl.value = "";
    kokoEl.value = "";
    prosenttiEl.value = "";
    pullotyyppiEl.value = "ei_panttia";
    naytaPanttiEsikatselu();
    skannattuViivakoodi = null;
    lisaaBtn.disabled = false;
    nimiEl.focus();
  }

  return commitPromise;
}

function naytaPanttiEsikatselu() {
  var koko = parseFloat(kokoEl.value);
  var pantti = laskePantti(pullotyyppiEl.value, koko);
  if (pantti > 0) {
    panttiNayttoEl.textContent = t("pantti_esikatselu_prefix") + " " + pantti.toFixed(2) + " € " + t("pantti_esikatselu_suffix");
    panttiNayttoEl.hidden = false;
  } else {
    panttiNayttoEl.hidden = true;
  }
}

kokoEl.addEventListener("input", naytaPanttiEsikatselu);
pullotyyppiEl.addEventListener("change", naytaPanttiEsikatselu);

form.addEventListener("submit", function (e) {
  e.preventDefault();

  var hinta = parseFloat(hintaEl.value);
  var koko = parseFloat(kokoEl.value);
  var prosentti = parseFloat(prosenttiEl.value);

  if (!hinta || hinta <= 0 || !koko || koko <= 0 || isNaN(prosentti) || prosentti < 0) {
    errorEl.textContent = t("virhe_pakolliset");
    errorEl.hidden = false;
    return;
  }
  errorEl.hidden = true;

  var nimi = nimiEl.value.trim() || "Nimetön juoma";
  var pullotyyppi = pullotyyppiEl.value || "ei_panttia";
  var pantti = laskePantti(pullotyyppi, koko);
  var dokabiliteetti = laskeDokabiliteetti(hinta, koko, prosentti, pantti);
  var kauppa = KAUPAT.indexOf(kauppaEl.value) !== -1 ? kauppaEl.value : "Muu";
  var juomatyyppi = JUOMATYYPIT.indexOf(juomatyyppiEl.value) !== -1 ? juomatyyppiEl.value : "Muu";
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
    juomatyyppi: juomatyyppi,
    lisaaja: lisaaja,
    pullotyyppi: pullotyyppi,
    pantti: pantti,
    viivakoodi: skannattuViivakoodi
  };

  var duplikaatti = etsiDuplikaatti(nimi, koko, kauppa, skannattuViivakoodi);
  if (duplikaatti) {
    odottavaLisays = { duplikaatti: duplikaatti, hinta: hinta, nimi: nimi, koko: koko, prosentti: prosentti, dokabiliteetti: dokabiliteetti, kauppa: kauppa, juomatyyppi: juomatyyppi, lisaaja: lisaaja, pullotyyppi: pullotyyppi, pantti: pantti, viivakoodi: skannattuViivakoodi };
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
    kirjaaVirhe("tyhjenna-kaikki", e);
    alert(t("virhe_poisto"));
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

if (vieCsvBtn) {
  vieCsvBtn.addEventListener("click", function () {
    vieCSV(
      viimeisinNakyvatJuomat,
      [
        { otsikko: "Nimi", arvo: function (j) { return j.nimi; } },
        { otsikko: "Kauppa", arvo: function (j) { return j.kauppa; } },
        { otsikko: "Tyyppi", arvo: function (j) { return j.juomatyyppi; } },
        { otsikko: "Hinta (€)", arvo: function (j) { return pyorista(j.hinta, 2); } },
        { otsikko: "Koko (ml)", arvo: function (j) { return j.koko; } },
        { otsikko: "Alkoholi (%)", arvo: function (j) { return j.prosentti; } },
        { otsikko: "Pantti (€)", arvo: function (j) { return pyorista(j.pantti || 0, 2); } },
        { otsikko: "Dokabiliteetti", arvo: function (j) { return pyorista(j.dokabiliteetti, 2); } },
        { otsikko: "Lisääjä", arvo: function (j) { return j.lisaaja; } }
      ],
      "dokabiliteetti.csv"
    );
  });
}

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
      kirjaaVirhe("poista-juoma", e2);
      alert(t("virhe_poisto"));
    });
  } else if (action === "peukku") {
    if (peukutukset[id]) {
      delete peukutukset[id];
      tallennaLista(PEUKUTUKSET_AVAIN, peukutukset);
      updateDoc(doc(db, "juomat", id), { peukut: increment(-1) }).catch(function (e2) {
        console.error("Peukutuksen poisto epäonnistui", e2);
        kirjaaVirhe("peukku-poisto", e2);
        peukutukset[id] = true;
        tallennaLista(PEUKUTUKSET_AVAIN, peukutukset);
        render();
      });
    } else {
      peukutukset[id] = true;
      tallennaLista(PEUKUTUKSET_AVAIN, peukutukset);
      updateDoc(doc(db, "juomat", id), { peukut: increment(1) }).catch(function (e2) {
        console.error("Peukutus epäonnistui", e2);
        kirjaaVirhe("peukku-lisays", e2);
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
  } else if (action === "toggle-muokkaa") {
    if (!onAdmin) return;
    avoinMuokkaus[id] = !avoinMuokkaus[id];
    render();
  } else if (action === "toggle-ilmoitus") {
    avoinIlmoitus[id] = !avoinIlmoitus[id];
    render();
  } else if (action === "jaa") {
    if (!juoma) return;
    jaaJuoma(juoma);
  } else if (action === "ilmoita-kommentti") {
    if (!juoma) return;
    var kidx = Number(btn.getAttribute("data-kidx"));
    var kommenttiObjekti = (juoma.kommentit || [])[kidx];
    if (!kommenttiObjekti) return;
    btn.disabled = true;
    btn.textContent = t("ilmoita_ilmoitettu");
    laheteIlmoitus({
      tyyppi: "kommentti",
      kohdeId: id,
      kommenttiObjekti: kommenttiObjekti,
      syy: "Asiaton kommentti",
      lisatiedot: ""
    }).catch(function (e2) {
      console.error("Ilmoitus epäonnistui", e2);
      kirjaaVirhe("ilmoita-kommentti", e2);
      btn.disabled = false;
      btn.textContent = t("ilmoita_linkki");
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
      kirjaaVirhe("lisaa-kommentti", e2);
      alert(t("virhe_kommentti"));
    });
  } else if (action === "paivita-hinta") {
    e.preventDefault();
    var hintaInput = form2.querySelector("input");
    var uusiHinta = parseFloat(hintaInput.value);
    if (!uusiHinta || uusiHinta <= 0) return;
    var uusiDoka = laskeDokabiliteetti(uusiHinta, juoma.koko, juoma.prosentti, juoma.pantti);
    updateDoc(doc(db, "juomat", id), {
      hinta: uusiHinta,
      dokabiliteetti: uusiDoka,
      historia: arrayUnion({ hinta: juoma.hinta, pvm: Date.now() })
    }).then(function () {
      delete avoinHintaPaivitys[id];
    }).catch(function (e2) {
      console.error("Hinnan päivitys epäonnistui", e2);
      kirjaaVirhe("paivita-hinta", e2);
      alert(t("virhe_hinnan_paivitys"));
    });
  } else if (action === "paivita-tiedot") {
    e.preventDefault();
    if (!onAdmin) return;
    var nimiInput = form2.querySelector("input[name=nimi]");
    var tyyppiSelect = form2.querySelector("select[name=juomatyyppi]");
    var kauppaSelect = form2.querySelector("select[name=kauppa]");
    var uusiNimi = nimiInput.value.trim().slice(0, 60);
    var uusiTyyppi = tyyppiSelect.value;
    var uusiKauppa = kauppaSelect.value;
    if (!uusiNimi || JUOMATYYPIT.indexOf(uusiTyyppi) === -1 || KAUPAT.indexOf(uusiKauppa) === -1) return;
    updateDoc(doc(db, "juomat", id), {
      nimi: uusiNimi,
      juomatyyppi: uusiTyyppi,
      kauppa: uusiKauppa
    }).then(function () {
      delete avoinMuokkaus[id];
    }).catch(function (e2) {
      console.error("Tietojen päivitys epäonnistui", e2);
      kirjaaVirhe("paivita-tiedot", e2);
      alert(t("virhe_hinnan_paivitys"));
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
      kirjaaVirhe("ilmoita-juoma", e2);
      alert(t("virhe_ilmoitus"));
      submitBtn.disabled = false;
    });
  }
});

kielenVaihtuessa(function () {
  render();
  renderaaHintaindeksi();
  naytaPanttiEsikatselu();
});
