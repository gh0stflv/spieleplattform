import { Launcher } from "../Launcher.js";
import { kopfzeileAufbauen } from "./kopfzeile.js";

const benutzer = await kopfzeileAufbauen();
const launcher = new Launcher(document.body, benutzer);
launcher.laden().catch((e) => {
  document.querySelector("#kacheln").innerHTML =
    `<p class="fehler">Spiele konnten nicht geladen werden. Läuft der Server? (${e.message})</p>`;
});
