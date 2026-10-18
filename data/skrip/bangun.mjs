// Bangun data permainan dari sumber di data/sumber/.
//
// Masukan:
//   adm2_id.geojson   batas 514 kabupaten/kota (geoBoundaries IDN ADM2, sumber BPS/WFP/OCHA
//                     ROAP, CC BY 3.0 IGO), sudah diberi id daerah oleh proyek UMR
//   daerah_umr.json   nama baku BPS, provinsi, kota/kabupaten, dan upah minimum 2026 (proyek UMR)
// Keluaran:
//   public/data/peta.json   TopoJSON bentuk wilayah (disederhanakan) untuk digambar
//   src/data/daerah.json    metadata: nama, provinsi, pulau, titik tengah, luas, upah
import { geoArea, geoCentroid } from "d3-geo";
import mapshaper from "mapshaper";
import { mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";

const R_BUMI_KM = 6371.0088;

const PULAU = {
  Sumatra: ["Aceh", "Sumatera Utara", "Sumatera Barat", "Riau", "Jambi", "Sumatera Selatan", "Bengkulu", "Lampung", "Kepulauan Bangka Belitung", "Kepulauan Riau"],
  "Jawa & Bali": ["DKI Jakarta", "Jawa Barat", "Jawa Tengah", "DI Yogyakarta", "Jawa Timur", "Banten", "Bali"],
  "Nusa Tenggara": ["Nusa Tenggara Barat", "Nusa Tenggara Timur"],
  Kalimantan: ["Kalimantan Barat", "Kalimantan Tengah", "Kalimantan Selatan", "Kalimantan Timur", "Kalimantan Utara"],
  Sulawesi: ["Sulawesi Utara", "Sulawesi Tengah", "Sulawesi Selatan", "Sulawesi Tenggara", "Gorontalo", "Sulawesi Barat"],
  "Maluku & Papua": ["Maluku", "Maluku Utara", "Papua Barat", "Papua Barat Daya", "Papua", "Papua Selatan", "Papua Tengah", "Papua Pegunungan"],
};
const pulauDari = new Map(Object.entries(PULAU).flatMap(([p, prov]) => prov.map((n) => [n, p])));

const geo = JSON.parse(readFileSync("data/sumber/adm2_id.geojson", "utf8"));
const umr = JSON.parse(readFileSync("data/sumber/daerah_umr.json", "utf8"));
const metaUmr = new Map(umr.daerah.map((d) => [d.id, d]));

const hilang = geo.features.filter((f) => !metaUmr.has(f.properties.id)).map((f) => f.properties.id);
if (hilang.length || geo.features.length !== umr.daerah.length) {
  throw new Error(`Geometri dan metadata tidak cocok: ${geo.features.length} vs ${umr.daerah.length}, ${hilang}`);
}

// GeoJSON memutar cincin luar berlawanan jarum jam, d3-geo (geometri bola) searah
// jarum jam. Poligon yang terbaca lebih besar dari setengah bola dibalik.
function putarUntukD3(f) {
  const poligon = f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates;
  for (const cincin of poligon) {
    if (geoArea({ type: "Polygon", coordinates: cincin }) > 2 * Math.PI) cincin.forEach((r) => r.reverse());
  }
  return f;
}

// Titik tengah dan luas dari geometri penuh (sebelum disederhanakan).
const daerah = geo.features
  .map(putarUntukD3)
  .map((f) => {
    const m = metaUmr.get(f.properties.id);
    const prov = umr.provinsi[m.prov].nama;
    const [lon, lat] = geoCentroid(f);
    const pulau = pulauDari.get(prov);
    if (!pulau) throw new Error(`Provinsi tanpa pulau: ${prov}`);
    return {
      id: m.id,
      nama: m.nama,
      prov,
      pulau,
      kota: m.kota,
      titik: [Number(lon.toFixed(4)), Number(lat.toFixed(4))],
      luas: Math.round(geoArea(f) * R_BUMI_KM ** 2),
      upah: m.upah,
      jenisUpah: m.jenisUpah,
    };
  })
  .sort((a, b) => a.id.localeCompare(b.id));

writeFileSync("src/data/daerah.json", JSON.stringify({ sumberUpah: umr.versi ?? null, daerah }) + "\n");
console.log(`src/data/daerah.json: ${daerah.length} daerah`);

// 1) Peta seluruh Indonesia untuk layar hasil: kasar saja, karena tiap daerah
//    hanya beberapa piksel di skala nasional.
const keluar = "public/data/peta.json";
await mapshaper.runCommands(
  [
    "-i data/sumber/adm2_id.geojson name=daerah",
    "-filter-islands min-area=2km2 remove-empty",
    "-simplify 6% weighted keep-shapes",
    "-clean",
    `-o format=topojson quantization=40000 ${keluar}`,
  ].join(" "),
);
console.log(`${keluar}: ${(statSync(keluar).size / 1024).toFixed(0)} KB`);

// 2) Bentuk soal: satu berkas per daerah, disederhanakan relatif terhadap
//    ukurannya sendiri. Penyederhanaan global membuat kota kecil seperti
//    Magelang tinggal segitiga, padahal bentuknya yang ditebak.
const MAKS_TITIK = 1600;
const hitungTitik = (g) => (g.type === "Polygon" ? [g.coordinates] : g.coordinates).flat().reduce((n, r) => n + r.length, 0);
mkdirSync("public/bentuk", { recursive: true });
let totalKb = 0;
for (const f of geo.features) {
  const titik = hitungTitik(f.geometry);
  const persen = Math.min(100, (MAKS_TITIK / titik) * 100);
  const perintah = `-i masuk.json ${persen < 100 ? `-simplify ${persen.toFixed(2)}% weighted keep-shapes` : ""} -o keluar.json format=geojson precision=0.00001`;
  const hasil = await mapshaper.applyCommands(perintah, { "masuk.json": { type: "FeatureCollection", features: [f] } });
  const fitur = putarUntukD3(JSON.parse(String(hasil["keluar.json"])).features[0]);
  const teks = JSON.stringify({ type: "Feature", properties: { id: f.properties.id }, geometry: fitur.geometry });
  writeFileSync(`public/bentuk/${f.properties.id}.json`, teks);
  totalKb += teks.length / 1024;
}
console.log(`public/bentuk/: ${geo.features.length} berkas, total ${totalKb.toFixed(0)} KB`);
