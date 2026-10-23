/** Registry: Spiel-ID (wie in der Datenbank) → Klasse. Neues Spiel = Klasse schreiben + hier eintragen. */
import { Blackjack } from "./blackjack/Blackjack.js";
import { Dame } from "./dame/Dame.js";
import { Hangman } from "./hangman/Hangman.js";
import { Memory } from "./memory/Memory.js";
import { Schach } from "./schach/Schach.js";
import { Snake } from "./snake/Snake.js";
import { SchiffeVersenken } from "./schiffe/SchiffeVersenken.js";
import { Spider } from "./spider/Spider.js";
import { SuperTicTacToe } from "./supertictactoe/SuperTicTacToe.js";
import { VierGewinnt } from "./viergewinnt/VierGewinnt.js";
import { Wort5 } from "./wort5/Wort5.js";

export const SPIELE = {
  snake: Snake,
  memory: Memory,
  viergewinnt: VierGewinnt,
  supertictactoe: SuperTicTacToe,
  dame: Dame,
  schach: Schach,
  schiffe: SchiffeVersenken,
  hangman: Hangman,
  wort5: Wort5,
  blackjack: Blackjack,
  spider: Spider,
};
