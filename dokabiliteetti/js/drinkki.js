import {
  db, drinkkireseptitCol, drinkkireseptitQuery, deviceId, YKSIKKOKERROIN,
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

var ainesosatEl = document.getElementById("drinkki-ainesosat");
var lisaaAinesosaBtn = document.getElementById("drinkki-lisaa-ainesosa-btn");
var tulosEl = document.getElementById("drinkki-tulos");
var reseptiNimiEl = document.getElementById("drinkki-resepti-nimi");
var lisaaineetEl = document.getElementById("drinkki-lisaaineet");
var tallennaReseptiBtn = document.getElementById("drinkki-tallenna-resepti-btn");
var reseptiVirheEl = document.getElementById("drinkki-resepti-virhe");
var reseptitEl = document.getElementById("drinkki-reseptit");
var pohjatEl = document.getElementById("drinkki-pohjat");
var lisaajaEl = document.getElementById("lisaaja");

// ---- Valmiit pohjat (senttilitroina, koska yhden annoksen mitat ovat pieniä) ----
var POHJAT = [
  {
    nimiAvain: "pohja_gintonic",
    ainesosat: [
      { nimiAvain: "aines_gini", tilavuus: 4, yksikko: "cl", prosentti: 40 },
      { nimiAvain: "aines_tonic", tilavuus: 12, yksikko: "cl", prosentti: 0 }
    ]
  },
  {
    nimiAvain: "pohja_mojito",
    ainesosat: [
      { nimiAvain: "aines_valkorommi", tilavuus: 4, yksikko: "cl", prosentti: 40 },
      { nimiAvain: "aines_limetti", tilavuus: 2, yksikko: "cl", prosentti: 0 },
      { nimiAvain: "aines_soodavesi", tilavuus: 8, yksikko: "cl", prosentti: 0 }
    ]
  },
  {
    nimiAvain: "pohja_cubalibre",
    ainesosat: [
      { nimiAvain: "aines_tummarommi", tilavuus: 4, yksikko: "cl", prosentti: 40 },
      { nimiAvain: "aines_kola", tilavuus: 12, yksikko: "cl", prosentti: 0 }
    ]
  },
  {
    nimiAvain: "pohja_vodkaredbull",
    ainesosat: [
      { nimiAvain: "aines_vodka", tilavuus: 4, yksikko: "cl", prosentti: 40 },
      { nimiAvain: "aines_energiajuoma", tilavuus: 25, yksikko: "cl", prosentti: 0 }
    ]
  }
];

var drinkkiAinesosat = [
  { nimi: "", tilavuus: "", yksikko: "cl", prosentti: "", hinta: "" },
  { nimi: "", tilavuus: "", yksikko: "cl", prosentti: "", hinta: "" }
];

export var drinkkiReseptit = [];

function renderaaPohjat() {
  if (!pohjatEl) return;
  pohjatEl.innerHTML = POHJAT.map(function (p, i) {
    return '<button type="button" class="ghost pohja-btn" data-idx="' + i + '">' + escapeHtml(t(p.nimiAvain)) + "</button>";
  }).join("");

  Array.prototype.forEach.call(pohjatEl.querySelectorAll(".pohja-btn"), function (btn) {
    btn.addEventListener("click", function () {
      var pohja = POHJAT[Number(btn.getAttribute("data-idx"))];
      drinkkiAinesosat = pohja.ainesosat.map(function (a) {
        return { nimi: t(a.nimiAvain), tilavuus: String(a.tilavuus), yksikko: a.yksikko, prosentti: String(a.prosentti), hinta: "" };
      });
      renderaaAinesosat();
      laskeJaNaytaTulos();
    });
  });
}

function renderaaAinesosat() {
  ainesosatEl.innerHTML = drinkkiAinesosat.map(function (a, i) {
    var yksikko = a.yksikko || "cl";
    return '<div class="ainesosa-rivi">' +
      '<input type="text" placeholder="' + escapeHtml(t("placeholder_nimi")) + '" value="' + escapeHtml(a.nimi) + '" data-idx="' + i + '" data-field="nimi" class="ainesosa-input" aria-label="' + escapeHtml(t("label_nimi")) + '">' +
      '<div class="ainesosa-grid">' +
        '<div class="tilavuus-wrap">' +
          '<input type="number" placeholder="' + escapeHtml(t("booli_maara")) + '" step="0.1" min="0" inputmode="decimal" value="' + escapeHtml(a.tilavuus) + '" data-idx="' + i + '" data-field="tilavuus" class="ainesosa-input" aria-label="' + escapeHtml(t("booli_maara")) + '">' +
          '<select data-idx="' + i + '" data-field="yksikko" class="ainesosa-input" aria-label="Yksikkö">' +
            '<option value="cl"' + (yksikko === "cl" ? " selected" : "") + '>cl</option>' +
            '<option value="dl"' + (yksikko === "dl" ? " selected" : "") + '>dl</option>' +
            '<option value="l"' + (yksikko === "l" ? " selected" : "") + '>l</option>' +
          "</select>" +
        "</div>" +
        '<input type="number" placeholder="' + escapeHtml(t("booli_alkoholi")) + '" step="0.1" min="0" inputmode="decimal" value="' + escapeHtml(a.prosentti) + '" data-idx="' + i + '" data-field="prosentti" class="ainesosa-input" aria-label="' + escapeHtml(t("booli_alkoholi")) + '">' +
        '<input type="number" placeholder="' + escapeHtml(t("booli_hinta_e")) + '" step="0.01" min="0" inputmode="decimal" value="' + escapeHtml(a.hinta) + '" data-idx="' + i + '" data-field="hinta" class="ainesosa-input" aria-label="' + escapeHtml(t("booli_hinta_e")) + '">' +
        '<button type="button" class="ainesosa-poista" data-idx="' + i + '" aria-label="Poista ainesosa">&times;</button>' +
      "</div>" +
    "</div>";
  }).join("");
}

function laskeJaNaytaTulos() {
  var kelvolliset = drinkkiAinesosat.filter(function (a) { return parseFloat(a.tilavuus) > 0; });

  if (kelvolliset.length === 0) {
    tulosEl.innerHTML = '<p class="empty-state">' + t("booli_ei_ainesosia") + "</p>";
    return;
  }

  var kokonaistilavuusL = 0;
  var kokonaisAlkoholiLitroina = 0;
  var kokonaishinta = 0;

  kelvolliset.forEach(function (a) {
    var kerroin = YKSIKKOKERROIN[a.yksikko] || 0.01;
    var l = (parseFloat(a.tilavuus) || 0) * kerroin;
    var p = parseFloat(a.prosentti) || 0;
    var h = parseFloat(a.hinta) || 0;
    kokonaistilavuusL += l;
    kokonaisAlkoholiLitroina += l * (p / 100);
    kokonaishinta += h;
  });

  var kokonaistilavuusCl = kokonaistilavuusL * 100;
  var lopullinenProsentti = kokonaistilavuusL > 0 ? (kokonaisAlkoholiLitroina / kokonaistilavuusL) * 100 : 0;
  var drinkinDoka = kokonaishinta > 0 ? (kokonaisAlkoholiLitroina * 1000) / kokonaishinta : 0;

  tulosEl.innerHTML =
    '<div class="booli-tulos-rivi"><span>' + t("drinkki_koko") + "</span><strong>" + pyorista(kokonaistilavuusCl, 1) + " cl</strong></div>" +
    '<div class="booli-tulos-rivi"><span>' + t("booli_lopullinen_vahvuus") + "</span><strong>" + pyorista(lopullinenProsentti, 1) + " %</strong></div>" +
    '<div class="booli-tulos-rivi"><span>' + t("booli_kokonaishinta") + "</span><strong>" + pyorista(kokonaishinta, 2).toFixed(2) + " €</strong></div>" +
    '<div class="booli-tulos-rivi highlight"><span>' + t("booli_dokabiliteetti") + "</span><strong>" + pyorista(drinkinDoka, 2) + "</strong></div>";
}

ainesosatEl.addEventListener("input", function (e) {
  var el = e.target;
  if (!el.classList.contains("ainesosa-input")) return;
  var idx = Number(el.getAttribute("data-idx"));
  var field = el.getAttribute("data-field");
  drinkkiAinesosat[idx][field] = el.value;
  laskeJaNaytaTulos();
});

ainesosatEl.addEventListener("click", function (e) {
  var btn = e.target.closest(".ainesosa-poista");
  if (!btn) return;
  var idx = Number(btn.getAttribute("data-idx"));
  drinkkiAinesosat.splice(idx, 1);
  renderaaAinesosat();
  laskeJaNaytaTulos();
});

lisaaAinesosaBtn.addEventListener("click", function () {
  drinkkiAinesosat.push({ nimi: "", tilavuus: "", yksikko: "cl", prosentti: "", hinta: "" });
  renderaaAinesosat();
});

// ---- Drinkkireseptien tallennus ja jako ----
export function renderaaReseptit() {
  if (drinkkiReseptit.length === 0) {
    reseptitEl.innerHTML = '<p class="empty-state">' + t("resepti_ei_reseptit") + "</p>";
    return;
  }
  reseptitEl.innerHTML = drinkkiReseptit.map(function (r) {
    var ainesLista = r.ainesosat.map(function (a) { return a.nimi || "Nimetön"; }).join(", ");
    var lisaaineRivi = (r.lisaaineet && r.lisaaineet.length)
      ? "<br>" + t("resepti_lisaaineet") + ": " + escapeHtml(r.lisaaineet.join(", "))
      : "";
    return '<div class="resepti-kortti">' +
      '<div class="resepti-kortti-top"><span class="resepti-nimi">' + escapeHtml(r.nimi) + "</span></div>" +
      '<div class="resepti-meta">' + pyorista(r.kokonaistilavuusCl, 1) + " cl · " + pyorista(r.lopullinenProsentti, 1) + " % · " + pyorista(r.kokonaishinta, 2).toFixed(2) + " € · " + t("resepti_lisasi") + " " + escapeHtml(r.lisaaja) + "<br>" + escapeHtml(ainesLista) + lisaaineRivi + "</div>" +
      '<div class="resepti-actions">' +
        '<button type="button" class="ghost" data-action="lataa-drinkki" data-id="' + r.id + '">' + t("resepti_kayta") + "</button>" +
        (onAdmin ? '<button type="button" class="ghost" data-action="poista-drinkki" data-id="' + r.id + '">' + t("resepti_poista") + "</button>" : "") +
      "</div>" +
    "</div>";
  }).join("");
}

reseptitEl.addEventListener("click", function (e) {
  var btn = e.target.closest("button[data-action]");
  if (!btn) return;
  var action = btn.getAttribute("data-action");
  var id = btn.getAttribute("data-id");
  var resepti = drinkkiReseptit.find(function (r) { return r.id === id; });
  if (!resepti) return;

  if (action === "lataa-drinkki") {
    drinkkiAinesosat = resepti.ainesosat.map(function (a) {
      return { nimi: a.nimi || "", tilavuus: a.tilavuus != null ? String(a.tilavuus) : "", yksikko: "cl", prosentti: a.prosentti != null ? String(a.prosentti) : "", hinta: a.hinta != null ? String(a.hinta) : "" };
    });
    if (drinkkiAinesosat.length === 0) drinkkiAinesosat = [{ nimi: "", tilavuus: "", yksikko: "cl", prosentti: "", hinta: "" }];
    renderaaAinesosat();
    laskeJaNaytaTulos();
    reseptiNimiEl.value = resepti.nimi;
    lisaaineetEl.value = (resepti.lisaaineet || []).join(", ");
  } else if (action === "poista-drinkki") {
    if (!onAdmin) return;
    deleteDoc(doc(db, "drinkkireseptit", id)).catch(function (e2) {
      console.error("Drinkin poisto epäonnistui", e2);
      kirjaaVirhe("poista-drinkki", e2);
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

  var kelvolliset = drinkkiAinesosat.filter(function (a) { return parseFloat(a.tilavuus) > 0; });
  if (kelvolliset.length === 0) {
    reseptiVirheEl.textContent = t("booli_ei_ainesosia");
    reseptiVirheEl.hidden = false;
    return;
  }

  var kokonaistilavuusL = 0;
  var kokonaisAlkoholiLitroina = 0;
  var kokonaishinta = 0;
  var ainesosatData = kelvolliset.map(function (a) {
    var kerroin = YKSIKKOKERROIN[a.yksikko] || 0.01;
    var l = (parseFloat(a.tilavuus) || 0) * kerroin;
    var p = parseFloat(a.prosentti) || 0;
    var h = parseFloat(a.hinta) || 0;
    kokonaistilavuusL += l;
    kokonaisAlkoholiLitroina += l * (p / 100);
    kokonaishinta += h;
    return { nimi: (a.nimi || "Nimetön").trim().slice(0, 40), tilavuus: l, prosentti: p, hinta: h };
  });
  var lopullinenProsentti = kokonaistilavuusL > 0 ? (kokonaisAlkoholiLitroina / kokonaistilavuusL) * 100 : 0;
  var lisaaja = lisaajaEl.value.trim().slice(0, 40) || "Nimetön";
  var lisaaineet = lisaaineetEl.value.split(",").map(function (s) { return s.trim(); }).filter(Boolean).slice(0, 10).map(function (s) { return s.slice(0, 30); });

  tallennaReseptiBtn.disabled = true;

  var uusiReseptiRef = doc(drinkkireseptitCol);
  var rateRef = doc(db, "ratelimits", deviceId);
  var batch = writeBatch(db);

  batch.set(uusiReseptiRef, {
    nimi: reseptinNimi.slice(0, 60),
    ainesosat: ainesosatData,
    lisaaineet: lisaaineet,
    kokonaistilavuusCl: kokonaistilavuusL * 100,
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
    console.error("Drinkin tallennus epäonnistui", e);
    kirjaaVirhe("tallenna-drinkki", e);
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
  drinkkireseptitQuery,
  function (snapshot) {
    drinkkiReseptit = snapshot.docs.map(function (d) {
      var data = d.data();
      return {
        id: d.id,
        nimi: data.nimi,
        ainesosat: data.ainesosat || [],
        lisaaineet: data.lisaaineet || [],
        kokonaistilavuusCl: data.kokonaistilavuusCl || 0,
        lopullinenProsentti: data.lopullinenProsentti || 0,
        kokonaishinta: data.kokonaishinta || 0,
        lisaaja: data.lisaaja || "Nimetön"
      };
    });
    renderaaReseptit();
  },
  function (err) {
    console.error("Drinkkireseptien haku epäonnistui", err);
    kirjaaVirhe("drinkkireseptit-onSnapshot", err);
    reseptitEl.innerHTML = '<p class="empty-state">Drinkkejä ei voitu hakea.</p>';
  }
);

kielenVaihtuessa(function () {
  renderaaPohjat();
  renderaaAinesosat();
  laskeJaNaytaTulos();
  renderaaReseptit();
});

renderaaPohjat();
renderaaAinesosat();
laskeJaNaytaTulos();
