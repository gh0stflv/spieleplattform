/** Registry: Spiel-ID (wie in der Datenbank) → Klasse. Neues Spiel = Klasse schreiben + hier eintragen. */
import { Memory } from "./memory/Memory.js";
import { Snake } from "./snake/Snake.js";

export const SPIELE = {
  snake: Snake,
  memory: Memory,
};
