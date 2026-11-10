/**
 * Builds the word game's two lists from openly licensed sources:
 *
 *   answers.json   common five-letter words (SCOWL sizes 10-35), used as daily answers
 *   guesses.json   every five-letter word a player may enter (SCOWL up to size 70 in
 *                  all its English dialects, plus the public-domain ENABLE list)
 *
 * Run with `npm run build:words`. The output is committed, so this only needs
 * running again to change the rules below.
 */
import fs from "node:fs";
import path from "node:path";

const SCOWL_DIR = "node_modules/wordlist-english";
const ENABLE_URL = "https://raw.githubusercontent.com/dolph/dictionary/master/enable1.txt";
const ENABLE_CACHE = ".cache/words/enable1.txt";
const OUT_DIR = "games/word/data";

const SIZES = [10, 20, 35, 40, 50, 55, 60, 70];
const DIALECTS = ["english", "american", "british", "canadian", "australian"];
const COMMON_SIZES = [10, 20, 35];

/** Real words, but not ones anybody wants as the answer of the day. */
const NOT_ANSWERS = new Set(
  `bitch whore slut sluts dildo penis pussy cocks dicks boobs booby horny shits fucks nazis negro rapes raped porno
   kinky bimbo queer spics kikes dykes homos sperm semen feces enema pubic pubes fanny turds boner prick sissy gypsy
   lynch slave squaw chink jihad nazi pimps tramp hussy floozy bosom titty butts asses arses farts farty poops pissy
   pissed urine vomit puked pukes crack opium heroin drunk druggy bongs rapey abuse abort wench hymen vulva groin
   anals erect fetus hooch nudes naked nudie panty thong sexed sexes welsh spook coons darky dagos wops gooks japs
   krauts limey paddy pansy fairy bitchy bloody damns damn hells crapy crappy screw suck sucks sucky moron idiot
   cripple gimps lepers leper dwarf midget obese fatso fatty skank hobos junky junkie killer kills death deaths
   corps corpse morgue grope groped`.split(/\s+/),
);

function scowl(dialect: string, size: number): string[] {
  const file = path.join(SCOWL_DIR, `${dialect}-words-${size}.json`);
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : [];
}

async function enable(): Promise<string[]> {
  if (!fs.existsSync(ENABLE_CACHE)) {
    console.log(`Downloading ${ENABLE_URL}`);
    const response = await fetch(ENABLE_URL);
    if (!response.ok) throw new Error(`ENABLE download failed: ${response.status}`);
    fs.mkdirSync(path.dirname(ENABLE_CACHE), { recursive: true });
    fs.writeFileSync(ENABLE_CACHE, await response.text());
  }
  return fs.readFileSync(ENABLE_CACHE, "utf8").split(/\r?\n/);
}

const plain = (word: string) => /^[a-z]+$/.test(word);

async function main() {
  const everything = new Set<string>();
  for (const dialect of DIALECTS) for (const size of SIZES) for (const word of scowl(dialect, size)) if (plain(word)) everything.add(word);
  for (const word of await enable()) if (plain(word)) everything.add(word);

  const guesses = [...everything].filter((word) => word.length === 5).sort();

  // Answers: common words only, in the spelling shared by every dialect, and
  // not a plain plural or past tense of a shorter word ("books", "asked").
  const isInflection = (word: string) =>
    (word.endsWith("s") && !word.endsWith("ss") && everything.has(word.slice(0, -1))) ||
    (word.endsWith("es") && everything.has(word.slice(0, -2))) ||
    (word.endsWith("ed") && (everything.has(word.slice(0, -2)) || everything.has(word.slice(0, -1)))) ||
    (word.endsWith("ied") && everything.has(word.slice(0, -3) + "y")) ||
    (word.endsWith("ies") && everything.has(word.slice(0, -3) + "y"));

  const answers = [...new Set(COMMON_SIZES.flatMap((size) => scowl("english", size)))]
    .filter((word) => word.length === 5 && plain(word))
    .filter((word) => !isInflection(word) && !NOT_ANSWERS.has(word))
    .sort();

  const missing = answers.filter((word) => !guesses.includes(word));
  if (missing.length) throw new Error(`Answers missing from the guess list: ${missing.join(", ")}`);

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(OUT_DIR, "answers.json"), JSON.stringify(answers));
  fs.writeFileSync(path.join(OUT_DIR, "guesses.json"), JSON.stringify(guesses));
  fs.copyFileSync(path.join(SCOWL_DIR, "Copyright"), path.join(OUT_DIR, "SCOWL-LICENSE.txt"));
  console.log(`${answers.length} answers, ${guesses.length} valid guesses written to ${OUT_DIR}`);
}

main();
