import { t } from "./i18n.js";

// Puolipiste erottimena, koska suomalainen Excel odottaa CSV:ssä puolipistettä
// (pilkku on jo desimaalierotin) — pilkulla erotettu tiedosto avautuisi väärin
// yhteen sarakkeeseen suoraan Excelissä ilman manuaalista tuontia.
var EROTIN = ";";

function csvSolu(arvo) {
  var s = String(arvo == null ? "" : arvo);
  if (s.indexOf(EROTIN) !== -1 || s.indexOf('"') !== -1 || s.indexOf("\n") !== -1) {
    s = '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

/**
 * @param {Array} rivit - vietävät objektit (esim. juomat-taulukko)
 * @param {Array} sarakkeet - [{ otsikko: string, arvo: function(rivi) }]
 * @param {string} tiedostonNimi
 */
export function vieCSV(rivit, sarakkeet, tiedostonNimi) {
  if (!rivit || rivit.length === 0) {
    alert(t("csv_ei_dataa"));
    return;
  }

  var otsikkorivi = sarakkeet.map(function (s) { return csvSolu(s.otsikko); }).join(EROTIN);
  var datarivit = rivit.map(function (rivi) {
    return sarakkeet.map(function (s) { return csvSolu(s.arvo(rivi)); }).join(EROTIN);
  });

  // \uFEFF (BOM) auttaa Exceliä tunnistamaan UTF-8:n automaattisesti,
  // muuten ääkköset voivat näkyä väärin suoraan avattaessa.
  var sisalto = "\uFEFF" + [otsikkorivi].concat(datarivit).join("\r\n");
  var blob = new Blob([sisalto], { type: "text/csv;charset=utf-8;" });
  var url = URL.createObjectURL(blob);

  var a = document.createElement("a");
  a.href = url;
  a.download = tiedostonNimi || "vienti.csv";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
}
