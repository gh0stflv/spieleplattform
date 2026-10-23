import { Launcher } from "../Launcher.js";

const launcher = new Launcher(document.body);
launcher.laden().catch((e) => {
  document.querySelector("#kacheln").innerHTML =
    `<p class="fehler">Spiele konnten nicht geladen werden. Läuft der Server? (${e.message})</p>`;
});
