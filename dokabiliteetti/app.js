import { firebaseConfig } from "./firebase-config.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

var app = initializeApp(firebaseConfig);
var db = getFirestore(app);
var juomatCol = collection(db, "juomat");
var juomatQuery = query(juomatCol, orderBy("luotu", "desc"));

var form = document.getElementById("lisaa-form");
var nimiEl = document.getElementById("nimi");
var hintaEl = document.getElementById("hinta");
var kokoEl = document.getElementById("koko");
var prosenttiEl = document.getElementById("prosentti");
var errorEl = document.getElementById("error-msg");
var tuloksetEl = document.getElementById("tulokset");
var toolbarEl = document.getElementById("toolbar");
var maaraTekstiEl = document.getElementById("maara-teksti");
var tyhjennaBtn = document.getElementById("tyhjenna-btn");
var lisaaBtn = document.getElementById("lisaa-btn");

var juomat = [];
var yhteysVirhe = false;

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
  div.textContent = str;
  return div.innerHTML;
}

function render() {
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

  toolbarEl.hidden = false;
  maaraTekstiEl.textContent = juomat.length + (juomat.length === 1 ? " juoma jaetussa listassa" : " juomaa jaetussa listassa");

  var jarjestetty = juomat.slice().sort(function (a, b) {
    return b.dokabiliteetti - a.dokabiliteetti;
  });
  var paras = jarjestetty[0].dokabiliteetti;

  var html = "";
  jarjestetty.forEach(function (j, i) {
    var suhde = paras > 0 ? (j.dokabiliteetti / paras) * 100 : 0;
    var onParas = i === 0;
    html += "" +
      '<div class="card' + (onParas ? " best" : "") + '">' +
        (onParas ? '<span class="badge">Paras diili</span>' : "") +
        '<div class="card-top">' +
          '<span class="card-name">' + escapeHtml(j.nimi) + "</span>" +
          '<button class="remove-btn" data-id="' + j.id + '" aria-label="Poista ' + escapeHtml(j.nimi) + '">&times;</button>' +
        "</div>" +
        '<div class="card-meta">' +
          '<span class="card-details">' + pyorista(j.hinta, 2).toFixed(2) + " € · " + j.koko + " ml · " + j.prosentti + "%</span>" +
          '<span class="card-score">' + pyorista(j.dokabiliteetti, 2) + "</span>" +
        "</div>" +
        '<div class="bar-track"><div class="bar-fill" style="width:' + suhde + '%"></div></div>' +
      "</div>";
  });
  tuloksetEl.innerHTML = html;

  Array.prototype.forEach.call(document.querySelectorAll(".remove-btn"), function (btn) {
    btn.addEventListener("click", function () {
      var id = btn.getAttribute("data-id");
      deleteDoc(doc(db, "juomat", id)).catch(function (e) {
        console.error("Poisto epäonnistui", e);
        alert("Poisto ei onnistunut. Yritä uudelleen.");
      });
    });
  });
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
        dokabiliteetti: data.dokabiliteetti
      };
    });
    render();
  },
  function (err) {
    console.error("Firestore-yhteysvirhe", err);
    yhteysVirhe = true;
    render();
  }
);

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

  lisaaBtn.disabled = true;

  addDoc(juomatCol, {
    nimi: nimi,
    hinta: hinta,
    koko: koko,
    prosentti: prosentti,
    dokabiliteetti: dokabiliteetti,
    luotu: serverTimestamp()
  }).then(function () {
    nimiEl.value = "";
    hintaEl.value = "";
    kokoEl.value = "";
    prosenttiEl.value = "";
    nimiEl.focus();
  }).catch(function (e) {
    console.error("Tallennus epäonnistui", e);
    errorEl.textContent = "Tallennus epäonnistui. Tarkista nettiyhteys ja yritä uudelleen.";
    errorEl.hidden = false;
  }).finally(function () {
    lisaaBtn.disabled = false;
  });
});

tyhjennaBtn.addEventListener("click", function () {
  if (juomat.length === 0) return;
  if (!confirm("Poistetaanko KAIKKI jaetun listan juomat kaikilta käyttäjiltä?")) return;
  Promise.all(juomat.map(function (j) {
    return deleteDoc(doc(db, "juomat", j.id));
  })).catch(function (e) {
    console.error("Tyhjennys epäonnistui osittain", e);
  });
});

render();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", function () {
    navigator.serviceWorker.register("sw.js").catch(function (err) {
      console.error("Service workerin rekisteröinti epäonnistui", err);
    });
  });
}
