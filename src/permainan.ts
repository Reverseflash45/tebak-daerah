import data from "./data/daerah.json";

export type Daerah = (typeof data.daerah)[number];
export const DAERAH: readonly Daerah[] = data.daerah;
export const PER_ID = new Map(DAERAH.map((d) => [d.id, d]));
export const PULAU = ["Jawa & Bali", "Sumatra", "Kalimantan", "Sulawesi", "Nusa Tenggara", "Maluku & Papua"] as const;
export type Pulau = (typeof PULAU)[number];

export const MAKS_TEBAKAN = 6;
/** Tebakan ke berapa petunjuk provinsi boleh dibuka. */
export const PETUNJUK_PROVINSI_SETELAH = 3;

const R_BUMI_KM = 6371.0088;
const rad = (d: number) => (d * Math.PI) / 180;

/** Jarak lingkaran besar antar titik tengah, dalam km. */
export function jarakKm(a: Daerah, b: Daerah): number {
  const [lon1, lat1] = a.titik.map(rad);
  const [lon2, lat2] = b.titik.map(rad);
  const h = Math.sin((lat2 - lat1) / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin((lon2 - lon1) / 2) ** 2;
  return 2 * R_BUMI_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Arah dari tebakan ke jawaban, derajat dari utara searah jarum jam (0–360). */
export function arahDerajat(dari: Daerah, ke: Daerah): number {
  const [lon1, lat1] = dari.titik.map(rad);
  const [lon2, lat2] = ke.titik.map(rad);
  const y = Math.sin(lon2 - lon1) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(lon2 - lon1);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

const MATA_ANGIN = ["utara", "timur laut", "timur", "tenggara", "selatan", "barat daya", "barat", "barat laut"];
const PANAH = ["⬆️", "↗️", "➡️", "↘️", "⬇️", "↙️", "⬅️", "↖️"];
const delapan = (derajat: number) => Math.round(derajat / 45) % 8;
export const mataAngin = (derajat: number) => MATA_ANGIN[delapan(derajat)];
export const panahEmoji = (derajat: number) => PANAH[delapan(derajat)];

let jarakTerjauh: number | null = null;
/** Jarak terjauh antar dua daerah di data (sekitar Sabang–Merauke), dihitung sekali. */
export function jarakMaks(): number {
  if (jarakTerjauh === null) {
    let m = 0;
    for (let i = 0; i < DAERAH.length; i++) for (let j = i + 1; j < DAERAH.length; j++) m = Math.max(m, jarakKm(DAERAH[i], DAERAH[j]));
    jarakTerjauh = m;
  }
  return jarakTerjauh;
}

/** 100% berarti tepat, 0% berarti sejauh-jauhnya di Indonesia. */
export const kedekatan = (tebak: Daerah, jawab: Daerah) =>
  tebak.id === jawab.id ? 100 : Math.max(0, Math.min(99, Math.floor((1 - jarakKm(tebak, jawab) / jarakMaks()) * 100)));

export type HasilTebakan = {
  daerah: Daerah;
  benar: boolean;
  jarak: number;
  arah: number;
  dekat: number;
  provinsiSama: boolean;
};

export function nilai(tebak: Daerah, jawab: Daerah): HasilTebakan {
  return {
    daerah: tebak,
    benar: tebak.id === jawab.id,
    jarak: jarakKm(tebak, jawab),
    arah: arahDerajat(tebak, jawab),
    dekat: kedekatan(tebak, jawab),
    provinsiSama: tebak.prov === jawab.prov,
  };
}

/* ---------- soal harian ---------- */

/** PRNG kecil yang deterministik (mulberry32). */
export function acak(benih: number): () => number {
  let a = benih >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Urutan soal harian: semua daerah diacak sekali dengan benih tetap, jadi tidak berulang sebelum habis. */
const URUTAN_HARIAN: readonly Daerah[] = (() => {
  const r = acak(20261018);
  const a = [...DAERAH];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
})();

export const HARI_PERTAMA = "2026-10-18";

/** Tanggal hari ini menurut WIB, "YYYY-MM-DD". */
export const hariIniWIB = (sekarang = new Date()) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(sekarang);

/** Nomor soal harian (mulai 1) untuk tanggal WIB tertentu. */
export function nomorHarian(tanggal: string): number {
  const hari = (t: string) => Date.UTC(+t.slice(0, 4), +t.slice(5, 7) - 1, +t.slice(8, 10)) / 86_400_000;
  return Math.max(1, hari(tanggal) - hari(HARI_PERTAMA) + 1);
}

export const soalHarian = (nomor: number): Daerah => URUTAN_HARIAN[(nomor - 1) % URUTAN_HARIAN.length];

export function soalBebas(pulau: Pulau | "Semua", rng: () => number = Math.random, kecuali?: string): Daerah {
  const calon = DAERAH.filter((d) => (pulau === "Semua" || d.pulau === pulau) && d.id !== kecuali);
  return calon[Math.floor(rng() * calon.length)];
}

/* ---------- pencarian nama ---------- */

/** "Kab. Kediri" → "kediri"; dipakai untuk mencocokkan ketikan. */
export const normal = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/^(kab\.?|kabupaten|kota)\s+/, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/** Daerah yang namanya cocok dengan ketikan: awalan dulu, lalu yang mengandung. */
export function cari(ketik: string, batas = 8, kecuali: ReadonlySet<string> = new Set()): Daerah[] {
  const q = normal(ketik);
  const mintaKota = /^kota\b/i.test(ketik.trim());
  const mintaKab = /^kab/i.test(ketik.trim());
  if (!q) return [];
  const skor = (d: Daerah) => {
    if (kecuali.has(d.id) || (mintaKota && !d.kota) || (mintaKab && d.kota)) return -1;
    const n = normal(d.nama);
    if (n === q) return 3;
    if (n.startsWith(q)) return 2;
    if (n.split(" ").some((k) => k.startsWith(q))) return 1.5;
    return n.includes(q) ? 1 : -1;
  };
  return DAERAH.map((d) => ({ d, s: skor(d) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s || a.d.nama.localeCompare(b.d.nama, "id"))
    .slice(0, batas)
    .map((x) => x.d);
}

/* ---------- berbagi ---------- */

export function kotak(dekat: number): string {
  const penuh = Math.floor(dekat / 20);
  const setengah = dekat % 20 >= 10 ? 1 : 0;
  return "🟩".repeat(penuh) + "🟨".repeat(setengah) + "⬜".repeat(5 - penuh - setengah);
}

export function teksBagikan(judul: string, hasil: HasilTebakan[], menang: boolean, alamat: string, petunjuk: boolean): string {
  const skor = menang ? `${hasil.length}/${MAKS_TEBAKAN}` : `X/${MAKS_TEBAKAN}`;
  const baris = hasil.map((h) => `${kotak(h.dekat)}${h.benar ? "🎯" : panahEmoji(h.arah)}`);
  return [`${judul} ${skor}${petunjuk ? " 💡" : ""}`, ...baris, alamat].join("\n");
}
