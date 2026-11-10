/**
 * Builds the country game's data from Natural Earth (public domain):
 *
 *   countries.json  server only: each country's silhouette and centre point
 *   names.json      sent to the browser: names for the guess box, nothing else
 *
 * Run with `npm run build:countries`. The source files are downloaded once
 * into .cache/. The output is committed, so this only needs running again to
 * change the rules below.
 */
import fs from "node:fs";
import path from "node:path";
import { geoArea, geoAzimuthalEqualArea, geoCentroid, geoPath } from "d3-geo";
import type { Feature, FeatureCollection, MultiPolygon, Polygon, Position } from "geojson";

const SOURCE = "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/v5.1.2/geojson";
const CACHE = ".cache/natural-earth";
const OUT_DIR = "games/country/data";

/** Silhouettes are drawn in a square of this many units. */
const BOX = 1000;
const MARGIN = 40;
/** Countries with fewer outline points than this at 1:50m use the detailed 1:10m data. */
const MIN_POINTS = 150;
/** Islands smaller than this (in square units of the box) are left out. */
const MIN_ISLAND_AREA = 6;
/** Points closer together than this are merged. */
const MIN_STEP = 1.6;

/** Places Natural Earth lists as countries that are left out of the game. */
const EXCLUDE = new Set(["CYN", "SOL"]); // Northern Cyprus, Somaliland
/** Places it does not list as plain sovereign countries that are included. */
const INCLUDE = new Set(["ISR", "KOS", "PSX"]);

/** Display names where Natural Earth's is long or unusual. */
const NAMES: Record<string, string> = {
  USA: "United States",
  TZA: "Tanzania",
  SRB: "Serbia",
  SWZ: "Eswatini",
  VAT: "Vatican City",
  BHS: "Bahamas",
  FSM: "Micronesia",
  COD: "DR Congo",
  COG: "Republic of the Congo",
  CIV: "Ivory Coast",
  TLS: "Timor-Leste",
  STP: "São Tomé and Príncipe",
  CPV: "Cape Verde",
  TUR: "Turkey",
  MKD: "North Macedonia",
};

/** Extra names people type, beyond those Natural Earth provides. */
const ALSO: Record<string, string[]> = {
  USA: ["USA", "US", "America", "United States of America", "De forente stater"],
  GBR: ["UK", "Great Britain", "Britain", "England", "Storbritannia"],
  ARE: ["UAE", "Emirates", "De forente arabiske emirater"],
  COD: ["DRC", "Democratic Republic of the Congo", "Congo-Kinshasa", "Zaire", "Den demokratiske republikken Kongo"],
  COG: ["Congo", "Congo-Brazzaville", "Kongo"],
  CIV: ["Côte d'Ivoire", "Cote d'Ivoire", "Elfenbenskysten"],
  TLS: ["East Timor", "Øst-Timor"],
  CZE: ["Czech Republic", "Tsjekkia"],
  SWZ: ["Swaziland"],
  MMR: ["Burma"],
  NLD: ["Holland", "Nederland"],
  TUR: ["Türkiye", "Turkiye", "Tyrkia"],
  CPV: ["Cabo Verde", "Kapp Verde"],
  MKD: ["Macedonia", "Nord-Makedonia"],
  KOR: ["Korea", "Republic of Korea", "Sør-Korea"],
  PRK: ["DPRK", "Nord-Korea"],
  RUS: ["Russian Federation", "Russland"],
  VAT: ["Holy See", "Vatican", "Vatikanstaten"],
  BIH: ["Bosnia", "Bosnia-Herzegovina", "Bosnia-Hercegovina"],
  PSX: ["State of Palestine", "West Bank", "Gaza"],
  FSM: ["Federated States of Micronesia", "Mikronesiaføderasjonen"],
  BRN: ["Brunei Darussalam"],
  LAO: ["Lao PDR"],
  SYR: ["Syrian Arab Republic"],
  IRN: ["Persia"],
  LKA: ["Ceylon"],
  THA: ["Siam"],
  BLR: ["Hviterussland", "Belorussia"],
  VCT: ["St Vincent", "Saint Vincent"],
  KNA: ["St Kitts", "Saint Kitts", "St Kitts and Nevis"],
  LCA: ["St Lucia"],
  ATG: ["Antigua"],
  TTO: ["Trinidad", "Tobago"],
  STP: ["Sao Tome"],
  DEU: ["Tyskland"],
  FRA: ["Frankrike"],
  ESP: ["Spania"],
  ITA: ["Italia"],
  AUT: ["Østerrike"],
  CHE: ["Sveits"],
  GRC: ["Hellas"],
  BEL: ["Belgia"],
  POL: ["Polen"],
  HUN: ["Ungarn"],
  HRV: ["Kroatia"],
  CYP: ["Kypros"],
  IRL: ["Irland", "Eire"],
  ISL: ["Island"],
  EST: ["Estland"],
  LTU: ["Litauen"],
  UKR: ["Ukraina"],
  NOR: ["Norge", "Noreg"],
  SWE: ["Sverige"],
  DNK: ["Danmark"],
  FIN: ["Suomi"],
  CHN: ["Kina", "PRC"],
  ZAF: ["Sør-Afrika", "RSA"],
  MAR: ["Marokko"],
  DZA: ["Algerie"],
  ETH: ["Etiopia"],
  SAU: ["Saudi-Arabia", "KSA"],
  BRA: ["Brasil"],
  NZL: ["Ny-Zealand", "Aotearoa"],
  PHL: ["Filippinene"],
  KHM: ["Kambodsja", "Kampuchea"],
  KAZ: ["Kasakhstan"],
  UZB: ["Usbekistan"],
  AZE: ["Aserbajdsjan"],
  LBN: ["Libanon"],
  IRQ: ["Irak"],
  YEM: ["Jemen"],
  TCD: ["Tsjad"],
  GNQ: ["Ekvatorial-Guinea"],
  CAF: ["CAR", "Den sentralafrikanske republikk"],
  DOM: ["Den dominikanske republikk"],
  PNG: ["Papua Ny-Guinea"],
  SLB: ["Salomonøyene"],
  MHL: ["Marshalløyene"],
  KEN: ["Kenia"],
  HTI: ["Hayti"],
  SSD: ["Sør-Sudan"],
  CUB: ["Kuba"],
  EGY: ["Egypten"],
};

/**
 * Countries with far-away territories that would shrink the homeland to a
 * speck. Only land inside the box [west, south, east, north] is drawn.
 */
const KEEP: Record<string, [number, number, number, number]> = {
  FRA: [-6, 41, 10, 52], // without French Guiana and the overseas departments
  ESP: [-10, 35.5, 5, 44.5], // without the Canary Islands
  PRT: [-10, 36, -6, 43], // without the Azores and Madeira
  NOR: [4, 57, 32, 72], // without Svalbard and Jan Mayen
  CHL: [-76, -57, -66, -17], // without Easter Island
  ECU: [-82, -6, -74, 2.5], // without the Galápagos
  CRI: [-86.5, 8, -82, 11.5], // without Cocos Island
  GNQ: [5, 0.5, 12, 4.5], // without Annobón
  ZAF: [16, -35.5, 33.5, -22], // without the Prince Edward Islands
  MUS: [57, -20.8, 58, -19.8], // main island only
  NZL: [165, -48, 179.9, -34], // without the Chatham and subantarctic islands
  AUS: [112, -44.5, 154.5, -9.5], // without Macquarie and Lord Howe
  USA: [-180, 18, -66, 72], // without the Aleutians beyond the date line
  PLW: [134, 6.8, 135, 8.3], // without the far south-west islands
};

const TRANSLATIONS = ["NAME_DE", "NAME_ES", "NAME_FR", "NAME_IT", "NAME_NL", "NAME_PT", "NAME_SV", "NAME_PL"];

type Props = Record<string, string | number>;
type Country = Feature<Polygon | MultiPolygon, Props>;

async function load(scale: "50m" | "10m"): Promise<Country[]> {
  const file = path.join(CACHE, `ne_${scale}_admin_0_countries.geojson`);
  if (!fs.existsSync(file)) {
    console.log(`Downloading Natural Earth ${scale} countries`);
    const response = await fetch(`${SOURCE}/ne_${scale}_admin_0_countries.geojson`);
    if (!response.ok) throw new Error(`Download failed: ${response.status}`);
    fs.mkdirSync(CACHE, { recursive: true });
    fs.writeFileSync(file, Buffer.from(await response.arrayBuffer()));
  }
  return (JSON.parse(fs.readFileSync(file, "utf8")) as FeatureCollection<Polygon | MultiPolygon, Props>).features;
}

function isCountry(p: Props): boolean {
  const id = String(p.ADM0_A3);
  if (EXCLUDE.has(id)) return false;
  if (INCLUDE.has(id)) return true;
  if (p.TYPE === "Sovereign country" || p.TYPE === "Sovereignty") return true;
  return p.TYPE === "Country" && p.ADMIN === p.SOVEREIGNT; // the home part of a kingdom or union
}

function polygonsOf(feature: Country): Position[][][] {
  const polygons = feature.geometry.type === "Polygon" ? [feature.geometry.coordinates] : feature.geometry.coordinates;
  // d3 reads ring direction the opposite way to the GeoJSON standard; a ring
  // the wrong way round means "everything except this", so turn those over.
  return polygons.map((rings) => {
    const area = geoArea({ type: "Polygon", coordinates: rings });
    return area > 2 * Math.PI ? rings.map((ring) => [...ring].reverse()) : rings;
  });
}

const pointCount = (polygons: Position[][][]) => polygons.reduce((n, rings) => n + rings.reduce((m, ring) => m + ring.length, 0), 0);

function ringArea(ring: [number, number][]): number {
  let sum = 0;
  for (let i = 0; i < ring.length; i++) {
    const [x1, y1] = ring[i];
    const [x2, y2] = ring[(i + 1) % ring.length];
    sum += x1 * y2 - x2 * y1;
  }
  return Math.abs(sum) / 2;
}

/**
 * Turns a country's land into an SVG path that fills the box, plus its centre
 * point and how boldly to outline it.
 */
function draw(polygons: Position[][][]) {
  let kept = polygons;
  // Two rounds: fit everything, drop islands too small to see, then fit again.
  for (let round = 0; ; round++) {
    const shape: MultiPolygon = { type: "MultiPolygon", coordinates: kept };
    const [lon, lat] = geoCentroid(shape);
    const projection = geoAzimuthalEqualArea()
      .rotate([-lon, -lat])
      .fitExtent([[MARGIN, MARGIN], [BOX - MARGIN, BOX - MARGIN]], shape);
    const outline = geoPath(projection);

    const drawn = kept.map((rings) =>
      (outline({ type: "Polygon", coordinates: rings }) ?? "")
        .split(/(?=M)/)
        .map((part) => part.replace(/[MZ]/g, "").split("L").map((pair) => pair.split(",").map(Number) as [number, number]))
        .filter((ring) => ring.length >= 3),
    );
    const areas = drawn.map((rings) => (rings[0] ? ringArea(rings[0]) : 0));
    const largest = Math.max(...areas);

    if (round === 0) {
      // An island goes only if it is both tiny on screen and tiny next to the
      // country's main landmass, so nations made of small islands keep them all.
      const visible = kept.filter((_, i) => areas[i] >= MIN_ISLAND_AREA || areas[i] >= largest * 0.005);
      if (visible.length < kept.length) {
        kept = visible;
        continue;
      }
    }

    const pieces: string[] = [];
    for (const ring of drawn.flat()) {
      let points: [number, number][] = [];
      for (const [x, y] of ring) {
        const last = points[points.length - 1];
        if (!last || Math.hypot(x - last[0], y - last[1]) >= MIN_STEP) points.push([Math.round(x), Math.round(y)]);
      }
      points = points.filter(([x, y], i) => i === 0 || x !== points[i - 1][0] || y !== points[i - 1][1]);
      if (points.length >= 3) pieces.push("M" + points.map(([x, y]) => `${x},${y}`).join("L") + "Z");
      // Too small to have a shape at this size: mark the spot so it still shows as a dot.
      else pieces.push(`M${Math.round(ring[0][0])},${Math.round(ring[0][1])}h1v1h-1Z`);
    }

    // Countries that are mostly open sea get a heavier outline so their islands show up.
    const ink = areas.reduce((sum, area) => sum + area, 0) / (BOX * BOX);
    const stroke = ink < 0.004 ? 16 : ink < 0.02 ? 10 : 3;
    return { path: pieces.join(""), lon, lat, stroke };
  }
}

async function main() {
  const coarse = await load("50m");
  const detailed = new Map((await load("10m")).map((f) => [String(f.properties.ADM0_A3), f]));

  const countries: { id: string; name: string; lat: number; lon: number; stroke: number; path: string }[] = [];
  const names: { id: string; name: string; also: string[] }[] = [];

  for (const feature of coarse.filter((f) => isCountry(f.properties))) {
    const p = feature.properties;
    const id = String(p.ADM0_A3);
    const name = NAMES[id] ?? String(p.ADMIN);

    let polygons = polygonsOf(feature);
    if (pointCount(polygons) < MIN_POINTS && detailed.has(id)) polygons = polygonsOf(detailed.get(id)!);
    const box = KEEP[id];
    if (box) {
      polygons = polygons.filter((rings) => {
        const [lon, lat] = geoCentroid({ type: "Polygon", coordinates: rings });
        return lon >= box[0] && lon <= box[2] && lat >= box[1] && lat <= box[3];
      });
      if (polygons.length === 0) throw new Error(`KEEP box for ${id} removes the whole country`);
    }

    const { path: outline, lon, lat, stroke } = draw(polygons);
    countries.push({ id, name, lat: Number(lat.toFixed(3)), lon: Number(lon.toFixed(3)), stroke, path: outline });

    const key = (text: string) => text.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase();
    const seen = new Set([key(name)]);
    const also: string[] = [];
    const candidates = [p.ADMIN, p.NAME_LONG, p.NAME_EN, p.FORMAL_EN, ...(ALSO[id] ?? []), ...TRANSLATIONS.map((field) => p[field])];
    for (const candidate of candidates) {
      const text = String(candidate ?? "").trim();
      if (!text || text === "-99" || seen.has(key(text))) continue;
      seen.add(key(text));
      also.push(text);
    }
    names.push({ id, name, also });
  }

  countries.sort((a, b) => a.name.localeCompare(b.name, "en"));
  names.sort((a, b) => a.name.localeCompare(b.name, "en"));

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(OUT_DIR, "countries.json"), JSON.stringify(countries));
  fs.writeFileSync(path.join(OUT_DIR, "names.json"), JSON.stringify(names));
  const size = (file: string) => `${Math.round(fs.statSync(path.join(OUT_DIR, file)).size / 1024)} KB`;
  console.log(`${countries.length} countries: countries.json ${size("countries.json")}, names.json ${size("names.json")}`);
}

main();
