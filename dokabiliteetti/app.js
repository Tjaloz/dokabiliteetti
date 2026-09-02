(function () {
  "use strict";

  var STORAGE_KEY = "dokabiliteetti-juomat-v1";

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

  var juomat = lataa();

  function lataa() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      var parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      console.error("Tallennuksen lataus epäonnistui", e);
      return [];
    }
  }

  function tallenna() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(juomat));
    } catch (e) {
      console.error("Tallennus epäonnistui", e);
    }
  }

  function laskeDokabiliteetti(hinta, koko, prosentti) {
    var puhdasAlkoholiMl = koko * (prosentti / 100);
    return puhdasAlkoholiMl / hinta;
  }

  function pyorista(n, desimaalit) {
    var kerroin = Math.pow(10, desimaalit);
    return Math.round(n * kerroin) / kerroin;
  }

  function render() {
    if (juomat.length === 0) {
      toolbarEl.hidden = true;
      tuloksetEl.innerHTML = '<p class="empty-state">Lisää ensimmäinen juoma yllä olevalla lomakkeella.</p>';
      return;
    }

    toolbarEl.hidden = false;
    maaraTekstiEl.textContent = juomat.length + (juomat.length === 1 ? " juoma tallennettu" : " juomaa tallennettu");

    var jarjestetty = juomat.slice().sort(function (a, b) {
      return b.dokabiliteetti - a.dokabiliteetti;
    });
    var paras = jarjestetty[0].dokabiliteetti;

    var html = "";
    jarjestetty.forEach(function (j, i) {
      var suhde = paras > 0 ? (j.dokabiliteetti / paras) * 100 : 0;
      var onParas = i === 0;
      html += '' +
        '<div class="card' + (onParas ? " best" : "") + '">' +
          (onParas ? '<span class="badge">Paras diili</span>' : "") +
          '<div class="card-top">' +
            '<span class="card-name">' + escapeHtml(j.nimi) + '</span>' +
            '<button class="remove-btn" data-id="' + j.id + '" aria-label="Poista ' + escapeHtml(j.nimi) + '">&times;</button>' +
          '</div>' +
          '<div class="card-meta">' +
            '<span class="card-details">' + pyorista(j.hinta, 2).toFixed(2) + ' € · ' + j.koko + ' ml · ' + j.prosentti + '%</span>' +
            '<span class="card-score">' + pyorista(j.dokabiliteetti, 2) + '</span>' +
          '</div>' +
          '<div class="bar-track"><div class="bar-fill" style="width:' + suhde + '%"></div></div>' +
        '</div>';
    });
    tuloksetEl.innerHTML = html;

    Array.prototype.forEach.call(document.querySelectorAll(".remove-btn"), function (btn) {
      btn.addEventListener("click", function () {
        var id = Number(btn.getAttribute("data-id"));
        juomat = juomat.filter(function (j) { return j.id !== id; });
        tallenna();
        render();
      });
    });
  }

  function escapeHtml(str) {
    var div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  function seuraavaId() {
    return juomat.reduce(function (max, j) { return Math.max(max, j.id); }, 0) + 1;
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

    var nimi = nimiEl.value.trim() || ("Juoma " + seuraavaId());
    var dokabiliteetti = laskeDokabiliteetti(hinta, koko, prosentti);

    juomat.push({
      id: seuraavaId(),
      nimi: nimi,
      hinta: hinta,
      koko: koko,
      prosentti: prosentti,
      dokabiliteetti: dokabiliteetti
    });

    tallenna();

    nimiEl.value = "";
    hintaEl.value = "";
    kokoEl.value = "";
    prosenttiEl.value = "";
    nimiEl.focus();

    render();
  });

  tyhjennaBtn.addEventListener("click", function () {
    if (juomat.length === 0) return;
    if (confirm("Poistetaanko kaikki tallennetut juomat?")) {
      juomat = [];
      tallenna();
      render();
    }
  });

  render();

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", function () {
      navigator.serviceWorker.register("sw.js").catch(function (err) {
        console.error("Service workerin rekisteröinti epäonnistui", err);
      });
    });
  }
})();
