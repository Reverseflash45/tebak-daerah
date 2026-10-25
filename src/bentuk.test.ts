import { readFileSync } from "node:fs";
import { geoArea } from "d3-geo";
import type { Feature } from "geojson";
import { describe, expect, it } from "vitest";
import { DAERAH } from "./permainan";

const R_BUMI_KM = 6371.0088;

describe("berkas bentuk per daerah", () => {
  it("ada untuk semua daerah, arah putarannya benar, dan luasnya cocok", () => {
    const meleset: string[] = [];
    for (const d of DAERAH) {
      const f = JSON.parse(readFileSync(`public/bentuk/${d.id}.json`, "utf8")) as Feature;
      expect(f.properties?.id).toBe(d.id);
      const luas = geoArea(f) * R_BUMI_KM ** 2;
      // Putaran terbalik membuat d3 membaca "seluruh bumi kecuali daerah ini".
      expect(luas).toBeLessThan(100_000);
      // Penyederhanaan boleh menggeser luas sedikit, tidak boleh merusak bentuk.
      if (Math.abs(luas - d.luas) / d.luas > 0.12) meleset.push(`${d.id}: ${Math.round(luas)} vs ${d.luas}`);
    }
    expect(meleset).toEqual([]);
  }, 30_000); // membaca 514 berkas; bisa lewat 5 detik di mesin yang sibuk
});
