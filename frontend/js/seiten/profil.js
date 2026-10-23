import { api } from "../core/ApiClient.js";
import { escapeHtml, kopfzeileAufbauen } from "./kopfzeile.js";

const benutzer = await kopfzeileAufbauen();
if (!benutzer) location.href = "login.html";

const [profil, spiele] = await Promise.all([api.holeProfil(), api.holeSpiele()]);
const namen = Object.fromEntries(spiele.map((s) => [s.id, s.name]));
const { statistik, erfolge } = profil;

document.querySelector("#profil-name").textContent = profil.benutzer.name;
document.querySelector("#seit").textContent =
  new Date(`${profil.benutzer.erstellt_am.replace(" ", "T")}Z`).toLocaleDateString("de-DE");

const minuten = Math.round(statistik.spielzeit_s / 60);
document.querySelector("#statistik").innerHTML = `
  <div class="kennzahl"><strong>${statistik.spiele_gesamt}</strong><span>Runden gespielt</span></div>
  <div class="kennzahl"><strong>${minuten}</strong><span>Minuten Spielzeit</span></div>
  ${spiele.map((s) => `
    <div class="kennzahl"><strong>${statistik.bestwerte[s.id] ?? "–"}</strong>
    <span>Bestwert ${escapeHtml(namen[s.id])}</span></div>`).join("")}`;

const erreicht = erfolge.filter((e) => e.erreicht).length;
document.querySelector("#erfolge-zaehler").textContent = `${erreicht} / ${erfolge.length}`;
document.querySelector("#erfolge").innerHTML = erfolge.map((e) => `
  <li class="${e.erreicht ? "erreicht" : ""}">
    <span class="symbol">${e.erreicht ? "🏆" : "🔒"}</span>
    <div><strong>${escapeHtml(e.name)}</strong><small>${escapeHtml(e.beschreibung)}</small></div>
  </li>`).join("");

const dialog = document.querySelector("#loeschen-dialog");
document.querySelector("#loeschen").addEventListener("click", () => dialog.showModal());
dialog.addEventListener("close", async () => {
  if (dialog.returnValue !== "ja") return;
  await api.kontoLoeschen();
  location.href = "launcher.html";
});
