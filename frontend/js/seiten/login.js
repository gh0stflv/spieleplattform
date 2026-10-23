import { api } from "../core/ApiClient.js";

const formular = document.querySelector("#formular");
const meldung = document.querySelector("#meldung");
const reiter = document.querySelectorAll("[data-modus]");
let modus = location.hash === "#registrieren" ? "registrieren" : "login";

function modusSetzen(neu) {
  modus = neu;
  reiter.forEach((r) => r.setAttribute("aria-selected", String(r.dataset.modus === modus)));
  formular.querySelectorAll(".nur-registrieren").forEach((el) => { el.hidden = modus !== "registrieren"; });
  formular.passwort.autocomplete = modus === "login" ? "current-password" : "new-password";
  formular.querySelector("button[type=submit]").textContent = modus === "login" ? "Einloggen" : "Konto anlegen";
  meldung.textContent = "";
}

reiter.forEach((r) => r.addEventListener("click", () => modusSetzen(r.dataset.modus)));
modusSetzen(modus);

formular.addEventListener("submit", async (e) => {
  e.preventDefault();
  meldung.textContent = "";
  const { name, passwort, passwort2, email } = formular;
  if (modus === "registrieren" && passwort.value !== passwort2.value) {
    meldung.textContent = "Die Passwörter stimmen nicht überein.";
    return;
  }
  try {
    if (modus === "login") await api.login(name.value, passwort.value);
    else await api.registrieren(name.value, passwort.value, email.value);
    location.href = "launcher.html";
  } catch (fehler) {
    meldung.textContent = fehler.message;
  }
});
