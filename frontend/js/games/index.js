/** Registry: Spiel-ID (wie in der Datenbank) → Klasse. Neues Spiel = Klasse schreiben + hier eintragen. */
import { Dame } from "./dame/Dame.js";
import { Memory } from "./memory/Memory.js";
import { Snake } from "./snake/Snake.js";
import { SchereSteinPapier } from "./ssp/SchereSteinPapier.js";
import { SuperTicTacToe } from "./supertictactoe/SuperTicTacToe.js";
import { VierGewinnt } from "./viergewinnt/VierGewinnt.js";

export const SPIELE = {
  snake: Snake,
  memory: Memory,
  viergewinnt: VierGewinnt,
  supertictactoe: SuperTicTacToe,
  ssp: SchereSteinPapier,
  dame: Dame,
};
