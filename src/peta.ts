import type { Feature, FeatureCollection, Geometry, MultiLineString } from "geojson";
import { geoDistance, geoGraticule, geoMercator, geoPath } from "d3-geo";
import { feature, mesh } from "topojson-client";
import type { GeometryCollection, Topology } from "topojson-specification";
import type { Daerah, HasilTebakan } from "./permainan";

type Prop = { id: string };
export type Peta = { fitur: Map<string, Feature<Geometry, Prop>>; semua: FeatureCollection<Geometry, Prop>; batas: MultiLineString };

export async function muatPeta(): Promise<Peta> {
  const r = await fetch(`${import.meta.env.BASE_URL}data/peta.json`);
  if (!r.ok) throw new Error(`Gagal memuat peta (${r.status})`);
  const topo = (await r.json()) as Topology<{ daerah: GeometryCollection<Prop> }>;
  const semua = feature(topo, topo.objects.daerah) as FeatureCollection<Geometry, Prop>;
  return {
    semua,
    fitur: new Map(semua.features.map((f) => [f.properties.id, f])),
    batas: mesh(topo, topo.objects.daerah) as MultiLineString,
  };
}

const cacheBentuk = new Map<string, Promise<Feature<Geometry, Prop>>>();

/** Bentuk rinci satu daerah (berkas terpisah, disederhanakan sesuai ukurannya sendiri). */
export function muatBentuk(id: string): Promise<Feature<Geometry, Prop>> {
  let p = cacheBentuk.get(id);
  if (!p) {
    p = fetch(`${import.meta.env.BASE_URL}bentuk/${id}.json`).then((r) => {
      if (!r.ok) throw new Error(`Gagal memuat bentuk ${id} (${r.status})`);
      return r.json() as Promise<Feature<Geometry, Prop>>;
    });
    p.catch(() => cacheBentuk.delete(id));
    cacheBentuk.set(id, p);
  }
  return p;
}

const R_BUMI_KM = 6371.0088;

/** Panjang batang skala yang "bulat": 1, 2, 5, 10, 20, 50, ... km. */
function skalaBulat(maksKm: number): number {
  const p = 10 ** Math.floor(Math.log10(maksKm));
  return [5, 2, 1].map((m) => m * p).find((v) => v <= maksKm) ?? p;
}

/**
 * Bentuk satu daerah, menghadap utara, diperbesar memenuhi bingkai. Tidak ada
 * garis pantai atau tetangga yang ikut tergambar, supaya tetap jadi teka-teki;
 * batang skala memberi gambaran ukurannya.
 */
export function gambarBentuk(wadah: HTMLElement, f: Feature<Geometry, Prop>): void {
  const w = 600;
  const h = 460;
  const pad = 36;
  const proyeksi = geoMercator().fitExtent(
    [
      [pad, pad],
      [w - pad, h - pad - 26],
    ],
    f,
  );
  const jalur = geoPath(proyeksi);
  const garisLintang = geoPath(proyeksi)(geoGraticule().step([0.25, 0.25])()) ?? "";

  // km per piksel di tengah bingkai: jarak bola antara dua titik berjarak 100 px.
  const [cx, cy] = [w / 2, h / 2];
  const a = proyeksi.invert!([cx - 50, cy])!;
  const b = proyeksi.invert!([cx + 50, cy])!;
  const kmPerPx = (geoDistance(a, b) * R_BUMI_KM) / 100;
  const km = skalaBulat(kmPerPx * 140);
  const px = km / kmPerPx;

  wadah.innerHTML = `
  <svg viewBox="0 0 ${w} ${h}" role="img" aria-label="Bentuk wilayah yang harus ditebak. Batang skala ${km} km.">
    <defs>
      <pattern id="arsir" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <rect width="7" height="7" fill="var(--darat)"/>
        <line x1="0" y1="0" x2="0" y2="7" stroke="var(--darat-garis)" stroke-width="2"/>
      </pattern>
    </defs>
    <path d="${garisLintang}" fill="none" stroke="var(--kisi)" stroke-width="1"/>
    <path d="${jalur(f) ?? ""}" fill="url(#arsir)" stroke="var(--tinta)" stroke-width="1.6" stroke-linejoin="round" class="bentuk"/>
    <g class="skala" transform="translate(${pad}, ${h - 22})">
      <rect width="${px / 2}" height="6" fill="var(--tinta)"/>
      <rect x="${px / 2}" width="${px / 2}" height="6" fill="none" stroke="var(--tinta)" stroke-width="1.2"/>
      <text x="0" y="-6">0</text>
      <text x="${px}" y="-6" text-anchor="end">${km.toLocaleString("id-ID")} km</text>
    </g>
    <g class="kompas" transform="translate(${w - 34}, ${h - 40})" aria-hidden="true">
      <circle r="18" fill="none" stroke="var(--tinta)" stroke-width="1"/>
      <path d="M0,-15 L5,0 L0,4 L-5,0 Z" fill="var(--tinta)"/>
      <path d="M0,15 L5,0 L0,4 L-5,0 Z" fill="none" stroke="var(--tinta)" stroke-width="1"/>
      <text y="-22" text-anchor="middle">U</text>
    </g>
  </svg>`;
}

/** Peta Indonesia setelah selesai: jawaban diwarnai, tebakan diberi nomor dan garis ke jawaban. */
export function gambarHasil(wadah: HTMLElement, peta: Peta, jawab: Daerah, hasil: HasilTebakan[]): void {
  const w = 960;
  const h = 380;
  const proyeksi = geoMercator().fitExtent(
    [
      [8, 8],
      [w - 8, h - 8],
    ],
    peta.semua,
  );
  const jalur = geoPath(proyeksi);
  const fJawab = peta.fitur.get(jawab.id)!;
  const titikJawab = proyeksi(jawab.titik as [number, number])!;
  const salah = hasil.filter((x) => !x.benar);

  wadah.innerHTML = `
  <svg viewBox="0 0 ${w} ${h}" role="img" aria-label="Peta letak jawaban dan tebakanmu">
    <path d="${jalur(peta.semua) ?? ""}" fill="var(--darat-muda)"/>
    <path d="${jalur(peta.batas) ?? ""}" fill="none" stroke="var(--kertas)" stroke-width="0.4"/>
    ${salah.map((x) => `<path d="${jalur(peta.fitur.get(x.daerah.id)!) ?? ""}" fill="var(--tebak)"/>`).join("")}
    <path d="${jalur(fJawab) ?? ""}" fill="var(--jawab)" stroke="var(--jawab)" stroke-width="1.5"/>
    ${salah
      .map((x, i) => {
        const [px, py] = proyeksi(x.daerah.titik as [number, number])!;
        return `<line x1="${px}" y1="${py}" x2="${titikJawab[0]}" y2="${titikJawab[1]}" stroke="var(--tinta-2)" stroke-width="1" stroke-dasharray="3 3"/>
        <circle cx="${px}" cy="${py}" r="9" fill="var(--kertas)" stroke="var(--tinta)" stroke-width="1.2"/>
        <text x="${px}" y="${py + 4}" text-anchor="middle" class="nomor">${i + 1}</text>`;
      })
      .join("")}
    <circle cx="${titikJawab[0]}" cy="${titikJawab[1]}" r="12" fill="none" stroke="var(--jawab)" stroke-width="2"/>
  </svg>`;
}

