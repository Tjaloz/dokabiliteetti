import "./core.js";
import { t, kielenVaihtuessa, asetaKieli, nykyinenKieli, soveltaaStaattinenKaannos } from "./i18n.js";
import "./admin.js";
import "./juomat.js";
import "./booli.js";

// ---- Kielivalitsin ----
var kieliBtns = document.querySelectorAll(".kieli-btn");

function paivitaKieliBtnit() {
  Array.prototype.forEach.call(kieliBtns, function (btn) {
    btn.classList.toggle("active", btn.getAttribute("data-kieli") === nykyinenKieli);
  });
}

Array.prototype.forEach.call(kieliBtns, function (btn) {
  btn.addEventListener("click", function () {
    asetaKieli(btn.getAttribute("data-kieli"));
  });
});

soveltaaStaattinenKaannos();
paivitaKieliBtnit();

// ---- Välilehdet + hash-reititys ----
var tabBtns = document.querySelectorAll(".tab-btn");
var dokaNakymaEl = document.getElementById("doka-nakyma");
var booliNakymaEl = document.getElementById("booli-nakyma");
var hintaNakymaEl = document.getElementById("hinta-nakyma");

var TAB_AVAIMET = { doka: "tab_doka", booli: "tab_booli", hinta: "tab_hinta" };
var nykyinenValilehti = "doka";

function vaihdaValilehti(tab, paivitaHash) {
  if (!TAB_AVAIMET[tab]) tab = "doka";
  nykyinenValilehti = tab;

  Array.prototype.forEach.call(tabBtns, function (b) {
    var onAktiivinen = b.getAttribute("data-tab") === tab;
    b.classList.toggle("active", onAktiivinen);
    b.setAttribute("aria-selected", String(onAktiivinen));
  });
  dokaNakymaEl.hidden = tab !== "doka";
  booliNakymaEl.hidden = tab !== "booli";
  hintaNakymaEl.hidden = tab !== "hinta";

  document.title = tab === "doka"
    ? t("header_title") + " – " + t("header_subtitle")
    : t(TAB_AVAIMET[tab]) + " – " + t("header_title");

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

kielenVaihtuessa(function () {
  vaihdaValilehti(nykyinenValilehti, false);
});

// ---- Service worker ----
if ("serviceWorker" in navigator) {
  window.addEventListener("load", function () {
    navigator.serviceWorker.register("sw.js").catch(function (err) {
      console.error("Service workerin rekisteröinti epäonnistui", err);
    });
  });
}
