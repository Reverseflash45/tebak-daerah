import { describe, expect, it } from "vitest";
import {
  DAERAH,
  PER_ID,
  acak,
  arahDerajat,
  cari,
  hariIniWIB,
  jarakKm,
  jarakMaks,
  kedekatan,
  kotak,
  mataAngin,
  nilai,
  nomorHarian,
  normal,
  soalBebas,
  soalHarian,
  teksBagikan,
} from "./permainan";

const d = (id: string) => {
  const x = PER_ID.get(id);
  if (!x) throw new Error(id);
  return x;
};

describe("data", () => {
  it("514 daerah dengan id unik dan titik di wilayah Indonesia", () => {
    expect(DAERAH).toHaveLength(514);
    expect(new Set(DAERAH.map((x) => x.id)).size).toBe(514);
    for (const x of DAERAH) {
      const [lon, lat] = x.titik;
      expect(lon).toBeGreaterThan(94);
      expect(lon).toBeLessThan(142);
      expect(lat).toBeGreaterThan(-12);
      expect(lat).toBeLessThan(7);
      expect(x.luas).toBeGreaterThan(0);
    }
  });
});

describe("jarak & arah", () => {
  it("Kota Kediri ke Kota Yogyakarta sekitar 180 km ke barat", () => {
    const j = jarakKm(d("kota-kediri"), d("kota-yogyakarta"));
    expect(j).toBeGreaterThan(160);
    expect(j).toBeLessThan(200);
    expect(mataAngin(arahDerajat(d("kota-kediri"), d("kota-yogyakarta")))).toBe("barat");
  });

  it("Jakarta ke Merauke arahnya timur, lebih dari 3.000 km", () => {
    const j = jarakKm(d("kota-jakarta-pusat"), d("kab-merauke"));
    expect(j).toBeGreaterThan(3000);
    expect(mataAngin(arahDerajat(d("kota-jakarta-pusat"), d("kab-merauke")))).toMatch(/timur/);
  });

  it("simetris dan nol untuk diri sendiri", () => {
    const a = d("kab-kediri");
    const b = d("kota-batam");
    expect(jarakKm(a, b)).toBeCloseTo(jarakKm(b, a), 6);
    expect(jarakKm(a, a)).toBe(0);
  });

  it("jarak terjauh sekitar Sabang–Merauke", () => {
    expect(jarakMaks()).toBeGreaterThan(4500);
    expect(jarakMaks()).toBeLessThan(5600);
  });
});

describe("kedekatan & nilai", () => {
  it("100 hanya untuk tebakan tepat, selain itu di bawah 100", () => {
    expect(kedekatan(d("kota-kediri"), d("kota-kediri"))).toBe(100);
    expect(kedekatan(d("kab-kediri"), d("kota-kediri"))).toBe(99);
    expect(kedekatan(d("kota-jakarta-pusat"), d("kab-merauke"))).toBeLessThan(50);
  });

  it("menandai provinsi yang sama", () => {
    const h = nilai(d("kota-blitar"), d("kota-kediri"));
    expect(h.benar).toBe(false);
    expect(h.provinsiSama).toBe(true);
  });
});

describe("soal harian", () => {
  it("nomor 1 di hari pertama, naik satu per hari", () => {
    expect(nomorHarian("2026-10-18")).toBe(1);
    expect(nomorHarian("2026-10-19")).toBe(2);
    expect(nomorHarian("2027-10-18")).toBe(366);
  });

  it("deterministik dan tidak berulang dalam 514 hari", () => {
    expect(soalHarian(5).id).toBe(soalHarian(5).id);
    const ids = new Set(Array.from({ length: 514 }, (_, i) => soalHarian(i + 1).id));
    expect(ids.size).toBe(514);
    expect(soalHarian(515).id).toBe(soalHarian(1).id);
  });

  it("tanggal WIB berganti pukul 00.00 WIB, bukan UTC", () => {
    expect(hariIniWIB(new Date("2026-10-18T16:59:00Z"))).toBe("2026-10-18");
    expect(hariIniWIB(new Date("2026-10-18T17:00:00Z"))).toBe("2026-10-19");
  });

  it("mode bebas menghormati filter pulau dan pengecualian", () => {
    const r = acak(1);
    for (let i = 0; i < 50; i++) {
      const s = soalBebas("Sulawesi", r, "kota-makassar");
      expect(s.pulau).toBe("Sulawesi");
      expect(s.id).not.toBe("kota-makassar");
    }
  });
});

describe("cari", () => {
  it("abaikan awalan Kab./Kota saat menormalkan", () => {
    expect(normal("Kab. Kediri")).toBe("kediri");
    expect(normal("Kota Kediri")).toBe("kediri");
  });

  it("menemukan kabupaten dan kota bernama sama", () => {
    const h = cari("kediri").map((x) => x.id);
    expect(h).toContain("kab-kediri");
    expect(h).toContain("kota-kediri");
  });

  it("awalan 'kota' hanya memberi kota", () => {
    expect(cari("kota kediri").map((x) => x.id)).toEqual(["kota-kediri"]);
  });

  it("melewati yang sudah ditebak", () => {
    expect(cari("kediri", 8, new Set(["kab-kediri"])).map((x) => x.id)).not.toContain("kab-kediri");
  });

  it("kata di tengah nama juga cocok", () => {
    expect(cari("barat").length).toBeGreaterThan(3);
  });
});

describe("bagikan", () => {
  it("kotak kedekatan selalu lima", () => {
    for (const n of [0, 9, 10, 55, 99, 100]) expect([...kotak(n)].length).toBe(5);
    expect(kotak(100)).toBe("🟩🟩🟩🟩🟩");
  });

  it("teks hasil", () => {
    const jawab = d("kota-kediri");
    const hasil = [nilai(d("kota-yogyakarta"), jawab), nilai(jawab, jawab)];
    const t = teksBagikan("Tebak Daerah #1", hasil, true, "tebak.raffstw.my.id", false);
    expect(t.split("\n")[0]).toBe("Tebak Daerah #1 2/6");
    expect(t).toContain("🎯");
    expect(t.endsWith("tebak.raffstw.my.id")).toBe(true);
  });
});
