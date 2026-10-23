import { api } from "../core/ApiClient.js";

/** Füllt die Kopfzeile (Login-Status) und gibt den aktuellen Benutzer zurück (oder null). */
export async function kopfzeileAufbauen() {
  const bereich = document.querySelector("#benutzer-bereich");
  let benutzer = null;
  try {
    benutzer = await api.ich();
  } catch {
    /* Server nicht erreichbar → als Gast weiter */
  }
  if (benutzer) {
    bereich.innerHTML = `
      <a href="profil.html" class="name"></a>
      <button type="button" class="knopf leise" id="logout">Logout</button>`;
    bereich.querySelector(".name").textContent = `👤 ${benutzer.name}`;
    bereich.querySelector("#logout").addEventListener("click", async () => {
      await api.logout();
      location.href = "launcher.html";
    });
  } else {
    bereich.innerHTML = `<span class="gast">Gast</span> <a class="knopf" href="login.html">Einloggen</a>`;
  }
  return benutzer;
}

export function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = String(text);
  return div.innerHTML;
}
