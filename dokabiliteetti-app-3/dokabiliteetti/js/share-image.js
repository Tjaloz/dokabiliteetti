import { pyorista } from "./core.js";
import { t } from "./i18n.js";

function rivita(ctx, teksti, x, y, maxLeveys, riviKorkeus, maxRivit) {
  var sanat = String(teksti).split(" ");
  var rivi = "";
  var rivit = [];
  sanat.forEach(function (sana) {
    var testi = rivi + sana + " ";
    if (ctx.measureText(testi).width > maxLeveys && rivi !== "") {
      rivit.push(rivi.trim());
      rivi = sana + " ";
    } else {
      rivi = testi;
    }
  });
  rivit.push(rivi.trim());
  rivit.slice(0, maxRivit).forEach(function (r, i) {
    ctx.fillText(r, x, y + i * riviKorkeus);
  });
  return Math.min(rivit.length, maxRivit);
}

function slugify(str) {
  return String(str)
    .toLowerCase()
    .replace(/[^a-z0-9äöå]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 40) || "juoma";
}

function piirraKuva(juoma) {
  var koko = 1080;
  var canvas = document.createElement("canvas");
  canvas.width = koko;
  canvas.height = koko;
  var ctx = canvas.getContext("2d");

  var gradientti = ctx.createLinearGradient(0, 0, koko, koko);
  gradientti.addColorStop(0, "#0F6E56");
  gradientti.addColorStop(1, "#083D30");
  ctx.fillStyle = gradientti;
  ctx.fillRect(0, 0, koko, koko);

  ctx.fillStyle = "#ffffff";
  ctx.textBaseline = "alphabetic";

  ctx.font = "600 44px -apple-system, BlinkMacSystemFont, sans-serif";
  ctx.globalAlpha = 0.85;
  ctx.fillText("Dokabiliteetti", 64, 110);
  ctx.globalAlpha = 1;

  ctx.font = "700 72px -apple-system, BlinkMacSystemFont, sans-serif";
  var nimirivit = rivita(ctx, juoma.nimi, 64, 230, koko - 128, 82, 2);

  ctx.font = "400 36px -apple-system, BlinkMacSystemFont, sans-serif";
  ctx.globalAlpha = 0.85;
  ctx.fillText(
    (juoma.kauppa || "") + " · " + juoma.koko + " ml · " + juoma.prosentti + "%",
    64,
    230 + nimirivit * 82 + 50
  );
  ctx.globalAlpha = 1;

  var pisteY = 640;
  ctx.font = "800 220px -apple-system, BlinkMacSystemFont, sans-serif";
  ctx.fillText(String(pyorista(juoma.dokabiliteetti, 1)), 64, pisteY);

  ctx.font = "400 38px -apple-system, BlinkMacSystemFont, sans-serif";
  ctx.globalAlpha = 0.85;
  ctx.fillText(t("jaa_pistetta"), 64, pisteY + 60);
  ctx.globalAlpha = 1;

  ctx.font = "600 50px -apple-system, BlinkMacSystemFont, sans-serif";
  ctx.fillText(pyorista(juoma.hinta, 2).toFixed(2) + " €", 64, pisteY + 150);

  ctx.font = "400 28px -apple-system, BlinkMacSystemFont, sans-serif";
  ctx.globalAlpha = 0.65;
  ctx.fillText("dokabiliteetti.site", 64, koko - 56);
  ctx.globalAlpha = 1;

  return canvas;
}

/**
 * Luo ja jakaa (tai lataa) kuvan juoman tiedoista.
 * HUOM: navigator.share() vaatii tuoreen käyttäjäeleen joillain selaimilla
 * (erityisesti Safari) — koska canvas.toBlob on asynkroninen, jaa saattaa
 * epäonnistua hiljaisesti tietyillä selaimilla vaikka canShare() palauttaisi
 * true:n etukäteen. Lataus-fallback toimii kuitenkin aina.
 */
export function jaaJuoma(juoma) {
  var canvas = piirraKuva(juoma);

  canvas.toBlob(function (blob) {
    if (!blob) return;
    var tiedostonNimi = "dokabiliteetti-" + slugify(juoma.nimi) + ".png";

    var voikoJakaa = false;
    try {
      var testitiedosto = new File([blob], tiedostonNimi, { type: "image/png" });
      voikoJakaa = !!(navigator.share && navigator.canShare && navigator.canShare({ files: [testitiedosto] }));
    } catch (e) {
      voikoJakaa = false;
    }

    if (voikoJakaa) {
      var tiedosto = new File([blob], tiedostonNimi, { type: "image/png" });
      navigator.share({
        files: [tiedosto],
        title: "Dokabiliteetti",
        text: juoma.nimi + " – " + pyorista(juoma.dokabiliteetti, 1)
      }).catch(function () {
        // Käyttäjä perui jakamisen — ei virhe, ei tarvitse tehdä mitään.
      });
      return;
    }

    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = tiedostonNimi;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }, "image/png");
}
