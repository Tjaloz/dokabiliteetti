import {
  db, reseptitCol, reseptitQuery, deviceId, YKSIKKOKERROIN,
  pyorista, escapeHtml, kirjaaVirhe
} from "./core.js";
import { t, kielenVaihtuessa } from "./i18n.js";
import {
  doc,
  deleteDoc,
  onSnapshot,
  writeBatch,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { onAdmin } from "./admin.js";

var ainesosatEl = document.getElementById("ainesosat");
var lisaaAinesosaBtn = document.getElementById("lisaa-ainesosa-btn");
var booliTulosEl = document.getElementById("booli-tulos");
var reseptiNimiEl = document.getElementById("resepti-nimi");
var lisaaineetEl = document.getElementById("lisaaineet");
var tallennaReseptiBtn = document.getElementById("tallenna-resepti-btn");
var reseptiVirheEl = document.getElementById("resepti-virhe");
var reseptitEl = document.getElementById("reseptit");
var pohjatEl = document.getElementById("booli-pohjat");
var lisaajaEl = document.getElementById("lisaaja");

// ---- Valmiit pohjat ----
// Tilavuudet ja prosentit ovat kiinteitä lähtökohtia; hinta jätetään tyhjäksi,
// koska se vaihtelee kaupoittain eikä sitä voi tietää etukäteen.
var POHJAT = [
  {
    nimiAvain: "pohja_kesabooli",
    ainesosat: [
      { nimiAvain: "aines_valkoviini", tilavuus: 1, yksikko: "l", prosentti: 12 },
      { nimiAvain: "aines_siideri", tilavuus: 1, yksikko: "l", prosentti: 4.5 },
      { nimiAvain: "aines_appelsiinimehu", tilavuus: 0.5, yksikko: "l", prosentti: 0 }
    ]
  },
  {
    nimiAvain: "pohja_glogibooli",
    ainesosat: [
      { nimiAvain: "aines_glogi", tilavuus: 1, yksikko: "l", prosentti: 10 },
      { nimiAvain: "aines_punaviini", tilavuus: 0.5, yksikko: "l", prosentti: 13 },
      { nimiAvain: "aines_appelsiinimehu", tilavuus: 0.5, yksikko: "l", prosentti: 0 }
    ]
  },
  {
    nimiAvain: "pohja_perusbooli",
    ainesosat: [
      { nimiAvain: "aines_valkoviini", tilavuus: 1, yksikko: "l", prosentti: 12 },
      { nimiAvain: "aines_viina", tilavuus: 0.3, yksikko: "l", prosentti: 40 },
      { nimiAvain: "aines_limsa", tilavuus: 1, yksikko: "l", prosentti: 0 }
    ]
  }
];

var booliAinesosat = [
  { nimi: "", tilavuus: "", yksikko: "l", prosentti: "", hinta: "" },
  { nimi: "", tilavuus: "", yksikko: "l", prosentti: "", hinta: "" }
];

export var booliReseptit = [];

function renderaaPohjat() {
  if (!pohjatEl) return;
  pohjatEl.innerHTML = POHJAT.map(function (p, i) {
    return '<button type="button" class="ghost pohja-btn" data-idx="' + i + '">' + escapeHtml(t(p.nimiAvain)) + "</button>";
  }).join("");

  Array.prototype.forEach.call(pohjatEl.querySelectorAll(".pohja-btn"), function (btn) {
    btn.addEventListener("click", function () {
      var pohja = POHJAT[Number(btn.getAttribute("data-idx"))];
      booliAinesosat = pohja.ainesosat.map(function (a) {
        return { nimi: t(a.nimiAvain), tilavuus: String(a.tilavuus), yksikko: a.yksikko, prosentti: String(a.prosentti), hinta: "" };
      });
      renderaaAinesosat();
      laskeJaNaytaBooliTulos();
    });
  });
}

function renderaaAinesosat() {
  ainesosatEl.innerHTML = booliAinesosat.map(function (a, i) {
    var yksikko = a.yksikko || "l";
    return '<div class="ainesosa-rivi">' +
      '<input type="text" placeholder="' + escapeHtml(t("placeholder_nimi")) + '" value="' + escapeHtml(a.nimi) + '" data-idx="' + i + '" data-field="nimi" class="ainesosa-input" aria-label="' + escapeHtml(t("label_nimi")) + '">' +
      '<div class="ainesosa-grid">' +
        '<div class="tilavuus-wrap">' +
          '<input type="number" placeholder="' + escapeHtml(t("booli_maara")) + '" step="0.01" min="0" inputmode="decimal" value="' + escapeHtml(a.tilavuus) + '" data-idx="' + i + '" data-field="tilavuus" class="ainesosa-input" aria-label="' + escapeHtml(t("booli_maara")) + '">' +
          '<select data-idx="' + i + '" data-field="yksikko" class="ainesosa-input" aria-label="Yksikkö">' +
            '<option value="l"' + (yksikko === "l" ? " selected" : "") + '>l</option>' +
            '<option value="dl"' + (yksikko === "dl" ? " selected" : "") + '>dl</option>' +
            '<option value="cl"' + (yksikko === "cl" ? " selected" : "") + '>cl</option>' +
          "</select>" +
        "</div>" +
        '<input type="number" placeholder="' + escapeHtml(t("booli_alkoholi")) + '" step="0.1" min="0" inputmode="decimal" value="' + escapeHtml(a.prosentti) + '" data-idx="' + i + '" data-field="prosentti" class="ainesosa-input" aria-label="' + escapeHtml(t("booli_alkoholi")) + '">' +
        '<input type="number" placeholder="' + escapeHtml(t("booli_hinta_e")) + '" step="0.01" min="0" inputmode="decimal" value="' + escapeHtml(a.hinta) + '" data-idx="' + i + '" data-field="hinta" class="ainesosa-input" aria-label="' + escapeHtml(t("booli_hinta_e")) + '">' +
        '<button type="button" class="ainesosa-poista" data-idx="' + i + '" aria-label="Poista ainesosa">&times;</button>' +
      "</div>" +
    "</div>";
  }).join("");
}

function laskeJaNaytaBooliTulos() {
  var kelvolliset = booliAinesosat.filter(function (a) { return parseFloat(a.tilavuus) > 0; });

  if (kelvolliset.length === 0) {
    booliTulosEl.innerHTML = '<p class="empty-state">' + t("booli_ei_ainesosia") + "</p>";
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
    '<div class="booli-tulos-rivi"><span>' + t("booli_kokonaistilavuus") + "</span><strong>" + pyorista(kokonaistilavuus, 2) + " l</strong></div>" +
    '<div class="booli-tulos-rivi"><span>' + t("booli_lopullinen_vahvuus") + "</span><strong>" + pyorista(lopullinenProsentti, 1) + " %</strong></div>" +
    '<div class="booli-tulos-rivi"><span>' + t("booli_kokonaishinta") + "</span><strong>" + pyorista(kokonaishinta, 2).toFixed(2) + " €</strong></div>" +
    '<div class="booli-tulos-rivi"><span>' + t("booli_hinta_per_litra") + "</span><strong>" + pyorista(hintaPerLitra, 2).toFixed(2) + " €</strong></div>" +
    '<div class="booli-tulos-rivi"><span>' + t("booli_annoksia") + "</span><strong>~" + annoksia + " kpl</strong></div>" +
    '<div class="booli-tulos-rivi highlight"><span>' + t("booli_dokabiliteetti") + "</span><strong>" + pyorista(booliDoka, 2) + "</strong></div>";
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

// ---- Reseptien tallennus ja jako ----
export function renderaaReseptit() {
  if (booliReseptit.length === 0) {
    reseptitEl.innerHTML = '<p class="empty-state">' + t("resepti_ei_reseptit") + "</p>";
    return;
  }
  reseptitEl.innerHTML = booliReseptit.map(function (r) {
    var ainesLista = r.ainesosat.map(function (a) { return a.nimi || "Nimetön"; }).join(", ");
    var lisaaineRivi = (r.lisaaineet && r.lisaaineet.length)
      ? "<br>" + t("resepti_lisaaineet") + ": " + escapeHtml(r.lisaaineet.join(", "))
      : "";
    return '<div class="resepti-kortti">' +
      '<div class="resepti-kortti-top"><span class="resepti-nimi">' + escapeHtml(r.nimi) + "</span></div>" +
      '<div class="resepti-meta">' + pyorista(r.kokonaistilavuus, 2) + " l · " + pyorista(r.lopullinenProsentti, 1) + " % · " + pyorista(r.kokonaishinta, 2).toFixed(2) + " € · " + t("resepti_lisasi") + " " + escapeHtml(r.lisaaja) + "<br>" + escapeHtml(ainesLista) + lisaaineRivi + "</div>" +
      '<div class="resepti-actions">' +
        '<button type="button" class="ghost" data-action="lataa-resepti" data-id="' + r.id + '">' + t("resepti_kayta") + "</button>" +
        (onAdmin ? '<button type="button" class="ghost" data-action="poista-resepti" data-id="' + r.id + '">' + t("resepti_poista") + "</button>" : "") +
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
    lisaaineetEl.value = (resepti.lisaaineet || []).join(", ");
  } else if (action === "poista-resepti") {
    if (!onAdmin) return;
    deleteDoc(doc(db, "boolireseptit", id)).catch(function (e2) {
      console.error("Reseptin poisto epäonnistui", e2);
      kirjaaVirhe("poista-resepti", e2);
      alert(t("virhe_poisto"));
    });
  }
});

tallennaReseptiBtn.addEventListener("click", function () {
  reseptiVirheEl.hidden = true;

  var reseptinNimi = reseptiNimiEl.value.trim();
  if (!reseptinNimi) {
    reseptiVirheEl.textContent = t("resepti_nimi_puuttuu");
    reseptiVirheEl.hidden = false;
    return;
  }

  var kelvolliset = booliAinesosat.filter(function (a) { return parseFloat(a.tilavuus) > 0; });
  if (kelvolliset.length === 0) {
    reseptiVirheEl.textContent = t("booli_ei_ainesosia");
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
  var lisaaineet = lisaaineetEl.value.split(",").map(function (s) { return s.trim(); }).filter(Boolean).slice(0, 10).map(function (s) { return s.slice(0, 30); });

  tallennaReseptiBtn.disabled = true;

  var uusiReseptiRef = doc(reseptitCol);
  var rateRef = doc(db, "ratelimits", deviceId);
  var batch = writeBatch(db);

  batch.set(uusiReseptiRef, {
    nimi: reseptinNimi.slice(0, 60),
    ainesosat: ainesosatData,
    lisaaineet: lisaaineet,
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
    lisaaineetEl.value = "";
  }).catch(function (e) {
    console.error("Reseptin tallennus epäonnistui", e);
    kirjaaVirhe("tallenna-resepti", e);
    if (e && e.code === "permission-denied") {
      reseptiVirheEl.textContent = t("resepti_liian_nopea");
    } else {
      reseptiVirheEl.textContent = t("resepti_tallennus_epaonnistui");
    }
    reseptiVirheEl.hidden = false;
  }).finally(function () {
    tallennaReseptiBtn.disabled = false;
  });
});

onSnapshot(
  reseptitQuery,
  function (snapshot) {
    booliReseptit = snapshot.docs.map(function (d) {
      var data = d.data();
      return {
        id: d.id,
        nimi: data.nimi,
        ainesosat: data.ainesosat || [],
        lisaaineet: data.lisaaineet || [],
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
    kirjaaVirhe("boolireseptit-onSnapshot", err);
    reseptitEl.innerHTML = '<p class="empty-state">Reseptejä ei voitu hakea.</p>';
  }
);

kielenVaihtuessa(function () {
  renderaaPohjat();
  renderaaAinesosat();
  laskeJaNaytaBooliTulos();
  renderaaReseptit();
});

renderaaPohjat();
renderaaAinesosat();
laskeJaNaytaBooliTulos();
