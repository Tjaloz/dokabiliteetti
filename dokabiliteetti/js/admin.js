import { db, auth, adminUid, escapeHtml, pyorista, ilmoituksetQuery, virheetCol, virheetQuery } from "./core.js";
import { t, kielenVaihtuessa } from "./i18n.js";
import {
  doc,
  deleteDoc,
  updateDoc,
  arrayRemove,
  onSnapshot,
  writeBatch
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { juomat, render } from "./juomat.js";
import { booliReseptit, renderaaReseptit } from "./booli.js";

export var onAdmin = false;

var adminToggle = document.getElementById("admin-toggle");
var adminForm = document.getElementById("admin-form");
var adminEmail = document.getElementById("admin-email");
var adminSalasana = document.getElementById("admin-salasana");
var adminVirhe = document.getElementById("admin-virhe");
var adminLogout = document.getElementById("admin-logout");

var tilastotToggle = document.getElementById("tilastot-toggle");
var tilastotPaneeliEl = document.getElementById("tilastot-paneeli");

var ilmoituksetToggle = document.getElementById("ilmoitukset-toggle");
var ilmoituksetPaneeliEl = document.getElementById("ilmoitukset-paneeli");

var virhelokiToggle = document.getElementById("virheloki-toggle");
var virhelokiPaneeliEl = document.getElementById("virheloki-paneeli");

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
      adminVirhe.textContent = t("virhe_kirjautuminen");
      adminVirhe.hidden = false;
    });
});

adminLogout.addEventListener("click", function () {
  signOut(auth);
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
  html += '<div class="tilastot-rivi"><span>' + t("tilastot_juomia_yhteensa") + "</span><strong>" + juomat.length + "</strong></div>";
  html += '<div class="tilastot-rivi"><span>' + t("tilastot_viikko") + "</span><strong>" + uusiaViikossa + "</strong></div>";
  html += '<div class="tilastot-rivi"><span>' + t("tilastot_vahvistuksia") + "</span><strong>" + peukutYhteensa + "</strong></div>";
  html += '<div class="tilastot-rivi"><span>' + t("tilastot_kommentteja") + "</span><strong>" + kommenttejaYhteensa + "</strong></div>";
  html += '<div class="tilastot-rivi"><span>' + t("tilastot_reseptit") + "</span><strong>" + booliReseptit.length + "</strong></div>";

  html += '<div class="tilastot-otsikko">' + t("tilastot_lisaajat") + "</div>";
  if (topLisaajat.length === 0) {
    html += '<div class="tilastot-rivi"><span>' + t("tilastot_ei_dataa") + "</span></div>";
  } else {
    topLisaajat.forEach(function (nimi) {
      html += '<div class="tilastot-rivi"><span>' + escapeHtml(nimi) + "</span><strong>" + lisaajaLaskuri[nimi] + "</strong></div>";
    });
  }

  html += '<div class="tilastot-otsikko">' + t("tilastot_kaupat") + "</div>";
  if (topKaupat.length === 0) {
    html += '<div class="tilastot-rivi"><span>' + t("tilastot_ei_dataa") + "</span></div>";
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

// ---- Ylläpitäjän moderointijono ----
var ilmoitukset = [];
var unsubIlmoitukset = null;

function renderaaIlmoitukset() {
  if (ilmoitukset.length === 0) {
    ilmoituksetPaneeliEl.innerHTML = '<p class="empty-state">' + t("ilmoitus_ei_avoimia") + "</p>";
    return;
  }

  ilmoituksetPaneeliEl.innerHTML = ilmoitukset.map(function (ilm) {
    var kohdeKuvaus;
    if (ilm.tyyppi === "kommentti" && ilm.kommenttiObjekti) {
      kohdeKuvaus = t("ilmoitus_kommentti") + ': "' + escapeHtml(ilm.kommenttiObjekti.teksti) + '" (' + escapeHtml(ilm.kommenttiObjekti.nimi || "Nimetön") + ")";
    } else {
      var kohdeJuoma = juomat.find(function (j) { return j.id === ilm.kohdeId; });
      kohdeKuvaus = kohdeJuoma
        ? t("ilmoitus_juoma") + ": " + escapeHtml(kohdeJuoma.nimi) + " (" + pyorista(kohdeJuoma.hinta, 2).toFixed(2) + " €, " + escapeHtml(kohdeJuoma.kauppa) + ")"
        : t("ilmoitus_juoma_poistettu");
    }
    return '<div class="ilmoitus-kortti">' +
      '<div class="ilmoitus-kohde">' + kohdeKuvaus + "</div>" +
      '<div class="ilmoitus-syy">' + t("ilmoitus_syy") + ": " + escapeHtml(ilm.syy) + (ilm.lisatiedot ? " — " + escapeHtml(ilm.lisatiedot) : "") + "</div>" +
      '<div class="ilmoitus-actions">' +
        '<button type="button" data-action="poista-sisalto" data-id="' + ilm.id + '">' + t("ilmoitus_poista_sisalto") + "</button>" +
        '<button type="button" class="ghost" data-action="hylkaa-ilmoitus" data-id="' + ilm.id + '">' + t("ilmoitus_hylkaa") + "</button>" +
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
      alert(t("virhe_poisto"));
      btn.disabled = false;
    });
  }
});

// ---- Virheloki ----
var virheloki = [];
var unsubVirheloki = null;

function renderaaVirheloki() {
  if (virheloki.length === 0) {
    virhelokiPaneeliEl.innerHTML = '<p class="empty-state">' + t("virheloki_ei_virheita") + "</p>";
    return;
  }
  var html = virheloki.slice(0, 20).map(function (v) {
    return '<div class="ilmoitus-kortti">' +
      '<div class="ilmoitus-kohde">' + escapeHtml(v.konteksti) + "</div>" +
      '<div class="ilmoitus-syy">' + escapeHtml(v.viesti) + (v.koodi ? " (" + escapeHtml(v.koodi) + ")" : "") + "</div>" +
    "</div>";
  }).join("");
  html += '<button type="button" class="ghost" id="virheloki-tyhjenna-btn" style="width:100%; margin-top:6px;">' + t("virheloki_tyhjenna") + "</button>";
  virhelokiPaneeliEl.innerHTML = html;

  var tyhjennaBtn = document.getElementById("virheloki-tyhjenna-btn");
  if (tyhjennaBtn) {
    tyhjennaBtn.addEventListener("click", function () {
      if (!onAdmin) return;
      tyhjennaBtn.disabled = true;
      var batch = writeBatch(db);
      virheloki.forEach(function (v) {
        batch.delete(doc(db, "virheet", v.id));
      });
      batch.commit().catch(function (e) {
        console.error("Virhelokin tyhjennys epäonnistui", e);
      }).finally(function () {
        tyhjennaBtn.disabled = false;
      });
    });
  }
}

if (virhelokiToggle) {
  virhelokiToggle.addEventListener("click", function () {
    virhelokiPaneeliEl.hidden = !virhelokiPaneeliEl.hidden;
    if (!virhelokiPaneeliEl.hidden) renderaaVirheloki();
  });
}

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
      ilmoituksetToggle.textContent = t("btn_ilmoitukset_yksikko") + " (" + ilmoitukset.length + ")";
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

  if (virhelokiToggle) {
    virhelokiToggle.hidden = !onAdmin;
    if (onAdmin && !unsubVirheloki) {
      unsubVirheloki = onSnapshot(virheetQuery, function (snapshot) {
        virheloki = snapshot.docs.map(function (d) {
          var data = d.data();
          return { id: d.id, konteksti: data.konteksti || "", viesti: data.viesti || "", koodi: data.koodi || null };
        });
        virhelokiToggle.textContent = t("btn_virheloki") + " (" + virheloki.length + ")";
        if (!virhelokiPaneeliEl.hidden) renderaaVirheloki();
      }, function (err) {
        console.error("Virhelokin haku epäonnistui", err);
      });
    } else if (!onAdmin && unsubVirheloki) {
      unsubVirheloki();
      unsubVirheloki = null;
      virheloki = [];
      virhelokiPaneeliEl.hidden = true;
    }
  }

  render();
  renderaaReseptit();
});

kielenVaihtuessa(function () {
  if (!tilastotPaneeliEl.hidden) renderaaTilastot();
  if (!ilmoituksetPaneeliEl.hidden) renderaaIlmoitukset();
  if (virhelokiPaneeliEl && !virhelokiPaneeliEl.hidden) renderaaVirheloki();
});
