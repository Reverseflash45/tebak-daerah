import "./gaya.css";
import { gambarBentuk, gambarHasil, muatBentuk, muatPeta, type Peta } from "./peta";
import {
  MAKS_TEBAKAN,
  PER_ID,
  PETUNJUK_PROVINSI_SETELAH,
  PULAU,
  cari,
  hariIniWIB,
  mataAngin,
  nilai,
  nomorHarian,
  soalBebas,
  soalHarian,
  teksBagikan,
  type Daerah,
  type HasilTebakan,
  type Pulau,
} from "./permainan";

/* ---------- penyimpanan (aman bila localStorage tidak tersedia) ---------- */
function baca<T>(kunci: string, cadangan: T): T {
  try {
    const t = localStorage.getItem(kunci);
    return t ? (JSON.parse(t) as T) : cadangan;
  } catch {
    return cadangan;
  }
}
function tulis(kunci: string, nilaiBaru: unknown) {
  try {
    localStorage.setItem(kunci, JSON.stringify(nilaiBaru));
  } catch {
    /* mode privat: permainan tetap jalan tanpa disimpan */
  }
}

type Rekaman = { jawab: string; tebakan: string[]; petunjuk: boolean; menyerah: boolean };
type Statistik = { main: number; menang: number; streak: number; streakMaks: number; sebaran: number[]; nomorTerakhir: number; nomorMenangTerakhir: number };
const STAT_KOSONG: Statistik = { main: 0, menang: 0, streak: 0, streakMaks: 0, sebaran: [0, 0, 0, 0, 0, 0], nomorTerakhir: 0, nomorMenangTerakhir: 0 };

/* ---------- keadaan ---------- */
type Mode = "harian" | "bebas";
const nomor = nomorHarian(hariIniWIB());
let mode: Mode = location.hash === "#bebas" ? "bebas" : "harian";
let pulau: Pulau | "Semua" = baca<Pulau | "Semua">("td:pulau", "Semua");
let r: Rekaman = muatRekaman();
let peta: Peta | null = null;

function muatRekaman(): Rekaman {
  if (mode === "harian") {
    const jawab = soalHarian(nomor).id;
    const lama = baca<Rekaman | null>(`td:harian:${nomor}`, null);
    return lama && lama.jawab === jawab ? lama : { jawab, tebakan: [], petunjuk: false, menyerah: false };
  }
  const lama = baca<Rekaman | null>("td:bebas", null);
  if (lama && PER_ID.has(lama.jawab) && !selesaiDari(lama)) return lama;
  return { jawab: soalBebas(pulau).id, tebakan: [], petunjuk: false, menyerah: false };
}
function simpan() {
  tulis(mode === "harian" ? `td:harian:${nomor}` : "td:bebas", r);
}

const jawaban = (): Daerah => PER_ID.get(r.jawab)!;
const hasil = (): HasilTebakan[] => r.tebakan.map((id) => nilai(PER_ID.get(id)!, jawaban()));
const menang = (rr: Rekaman = r) => rr.tebakan.includes(rr.jawab);
function selesaiDari(rr: Rekaman) {
  return menang(rr) || rr.menyerah || rr.tebakan.length >= MAKS_TEBAKAN;
}
const selesai = () => selesaiDari(r);

/* ---------- elemen ---------- */
const $ = <T extends Element = HTMLElement>(s: string) => document.querySelector<T>(s)!;
const $$ = <T extends Element = HTMLElement>(s: string) => [...document.querySelectorAll<T>(s)];
const masuk = $<HTMLInputElement>("#tebak");
const daftarSaran = $<HTMLUListElement>("#saran");
const pesan = $(".pesan");
const pilihPulau = $<HTMLSelectElement>("#pulau");

for (const p of ["Semua", ...PULAU]) pilihPulau.add(new Option(p === "Semua" ? "Semua pulau" : p, p));
pilihPulau.value = pulau;
$("[data-nomor-harian]").textContent = `#${nomor}`;

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
const km = (n: number) => (n < 10 ? `${n.toFixed(1).replace(".", ",")} km` : `${Math.round(n).toLocaleString("id-ID")} km`);
const warnaDekat = (d: number) => (d === 100 ? "var(--benar)" : d >= 80 ? "var(--benar)" : d >= 50 ? "var(--dekat)" : "var(--jauh)");

/* ---------- gambar ---------- */
function gambarSoal() {
  const id = r.jawab;
  muatBentuk(id)
    .then((f) => {
      if (r.jawab === id) gambarBentuk($("#bentuk"), f); // abaikan bila soal sudah berganti
    })
    .catch(() => {
      $("#bentuk").innerHTML = `<p class="memuat">Bentuk wilayah gagal dimuat. Muat ulang halaman.</p>`;
    });
}

function gambarTebakan() {
  const h = hasil();
  const baris: string[] = [];
  for (let i = 0; i < MAKS_TEBAKAN; i++) {
    const x = h[i];
    if (!x) {
      baris.push(`<li class="kosong" aria-hidden="true"></li>`);
      continue;
    }
    const arah = x.benar
      ? `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8" fill="none" stroke="var(--benar)" stroke-width="2"/><circle cx="12" cy="12" r="3" fill="var(--benar)"/></svg>`
      : `<svg viewBox="0 0 24 24" aria-hidden="true" style="transform:rotate(${x.arah}deg)"><path d="M12 3 L18 13 H14 V21 H10 V13 H6 Z" fill="var(--tinta)"/></svg>`;
    baris.push(`<li class="${x.benar ? "benar" : ""}">
      <span class="nama">${esc(x.daerah.nama)}${x.provinsiSama && !x.benar ? ` <span class="tanda-prov">provinsi sama</span>` : ""}<small>${esc(x.daerah.prov)}</small></span>
      <span class="jarak">${x.benar ? "—" : km(x.jarak)}</span>
      <span class="panah" title="${x.benar ? "tepat" : `ke arah ${mataAngin(x.arah)}`}">${arah}<span class="sr-only">${x.benar ? "tepat" : `ke arah ${mataAngin(x.arah)}`}</span></span>
      <span class="persen">${x.dekat}%<i><b style="width:${x.dekat}%;background:${warnaDekat(x.dekat)}"></b></i></span>
    </li>`);
  }
  $("[data-tebakan]").innerHTML = baris.join("");
}

function gambarPetunjuk() {
  const el = $("[data-petunjuk]");
  const tombol = $<HTMLButtonElement>("#buka-petunjuk");
  const sisa = Math.max(0, PETUNJUK_PROVINSI_SETELAH - r.tebakan.length);
  el.hidden = !r.petunjuk;
  if (r.petunjuk) el.innerHTML = `Petunjuk: daerah ini ada di <strong>${esc(jawaban().prov)}</strong>.`;
  tombol.disabled = r.petunjuk || sisa > 0 || selesai();
  $("[data-sisa-petunjuk]").textContent = r.petunjuk ? "· dibuka" : sisa > 0 ? `· ${sisa} tebakan lagi` : "";
  tombol.title = sisa > 0 && !r.petunjuk ? `Bisa dibuka setelah ${PETUNJUK_PROVINSI_SETELAH} tebakan` : "";
}

function gambarSelesai() {
  const panel = $("#selesai");
  const s = selesai();
  panel.hidden = !s;
  masuk.disabled = s;
  $<HTMLButtonElement>("#isian button[type=submit]").disabled = s;
  $<HTMLButtonElement>("#menyerah").disabled = s;
  if (!s) return;
  const j = jawaban();
  const n = r.tebakan.length;
  $("[data-hasil-label]").textContent = menang() ? `Ketemu di tebakan ke-${n} dari ${MAKS_TEBAKAN}` : r.menyerah ? "Menyerah" : "Belum ketemu";
  $("[data-jawaban]").textContent = j.nama;
  $("[data-fakta]").innerHTML =
    `${esc(j.prov)} · ${j.pulau} · luas sekitar <strong>${j.luas.toLocaleString("id-ID")} km²</strong>. ` +
    `Upah minimum 2026 di sini Rp${j.upah.toLocaleString("id-ID")} (${j.jenisUpah}). ` +
    `<a href="https://umr.raffstw.my.id" target="_blank" rel="noopener">Cukup nggak untuk hidup di sana? →</a>`;
  if (peta) gambarHasil($("#peta-hasil"), peta, j, hasil());
  $("#lagi").hidden = mode !== "bebas";
  perbaruiHitungMundur();
}

function gambarSemua() {
  $$<HTMLButtonElement>("[data-mode]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.mode === mode)));
  $<HTMLLabelElement>(".pilih-pulau").hidden = mode !== "bebas";
  gambarSoal();
  gambarTebakan();
  gambarPetunjuk();
  gambarSelesai();
}

/* ---------- hitung mundur ke soal harian berikutnya ---------- */
let pewaktu = 0;
function perbaruiHitungMundur() {
  clearInterval(pewaktu);
  const el = $("[data-hitung-mundur]");
  if (mode !== "harian") {
    el.textContent = "";
    return;
  }
  const tik = () => {
    // Tengah malam WIB = 17.00 UTC.
    const kini = Date.now();
    const besok = new Date(kini);
    besok.setUTCHours(17, 0, 0, 0);
    if (besok.getTime() <= kini) besok.setUTCDate(besok.getUTCDate() + 1);
    const s = Math.floor((besok.getTime() - kini) / 1000);
    const dua = (n: number) => String(n).padStart(2, "0");
    el.textContent = `Soal berikutnya dalam ${dua(Math.floor(s / 3600))}:${dua(Math.floor((s % 3600) / 60))}:${dua(s % 60)}`;
    if (s <= 0) location.reload();
  };
  tik();
  pewaktu = window.setInterval(tik, 1000);
}

/* ---------- statistik ---------- */
function catatStatistik() {
  if (mode !== "harian") return;
  const st = baca<Statistik>("td:statistik", STAT_KOSONG);
  if (st.nomorTerakhir === nomor) return; // satu soal dicatat sekali
  st.main++;
  st.nomorTerakhir = nomor;
  if (menang()) {
    st.menang++;
    st.sebaran[r.tebakan.length - 1]++;
    st.streak = st.nomorMenangTerakhir === nomor - 1 ? st.streak + 1 : 1;
    st.nomorMenangTerakhir = nomor;
    st.streakMaks = Math.max(st.streakMaks, st.streak);
  } else {
    st.streak = 0;
  }
  tulis("td:statistik", st);
}

function gambarStatistik() {
  const st = baca<Statistik>("td:statistik", STAT_KOSONG);
  const persenMenang = st.main ? Math.round((st.menang / st.main) * 100) : 0;
  $("[data-statistik]").innerHTML = [
    ["Main", st.main],
    ["Menang %", persenMenang],
    ["Streak", st.streak],
    ["Streak terbaik", st.streakMaks],
  ]
    .map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`)
    .join("");
  const maks = Math.max(1, ...st.sebaran);
  const iniHari = mode === "harian" && menang() ? r.tebakan.length : 0;
  $("[data-sebaran]").innerHTML = st.sebaran
    .map((n, i) => `<li><span>${i + 1}</span><span class="batang${iniHari === i + 1 ? " ini" : ""}" style="width:${Math.max(8, (n / maks) * 100)}%">${n}</span></li>`)
    .join("");
}

/* ---------- menebak ---------- */
function tebak(d: Daerah) {
  if (selesai()) return;
  if (r.tebakan.includes(d.id)) {
    pesan.textContent = `${d.nama} sudah ditebak.`;
    return;
  }
  r.tebakan.push(d.id);
  pesan.textContent = "";
  simpan();
  if (selesai()) catatStatistik();
  masuk.value = "";
  tutupSaran();
  gambarSemua();
  if (selesai()) $("#selesai").scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
}

/* ---------- combobox ---------- */
let saran: Daerah[] = [];
let aktif = -1;

function tutupSaran() {
  daftarSaran.hidden = true;
  masuk.setAttribute("aria-expanded", "false");
  masuk.removeAttribute("aria-activedescendant");
  saran = [];
  aktif = -1;
}

function gambarSaran() {
  saran = cari(masuk.value, 8, new Set(r.tebakan));
  aktif = saran.length ? 0 : -1;
  if (!saran.length) {
    daftarSaran.hidden = masuk.value.trim() === "";
    daftarSaran.innerHTML = masuk.value.trim() ? `<li aria-disabled="true">Tidak ada yang cocok</li>` : "";
    masuk.setAttribute("aria-expanded", String(!daftarSaran.hidden));
    return;
  }
  daftarSaran.innerHTML = saran
    .map((d, i) => `<li role="option" id="saran-${i}" aria-selected="${i === aktif}" data-i="${i}"><span>${esc(d.nama)}</span><small>${esc(d.prov)}</small></li>`)
    .join("");
  daftarSaran.hidden = false;
  masuk.setAttribute("aria-expanded", "true");
  sorotSaran();
}

function sorotSaran() {
  $$<HTMLLIElement>("#saran [role=option]").forEach((li, i) => li.setAttribute("aria-selected", String(i === aktif)));
  if (aktif >= 0) {
    masuk.setAttribute("aria-activedescendant", `saran-${aktif}`);
    document.getElementById(`saran-${aktif}`)?.scrollIntoView({ block: "nearest" });
  }
}

masuk.addEventListener("input", gambarSaran);
masuk.addEventListener("keydown", (e) => {
  if (daftarSaran.hidden || !saran.length) return;
  if (e.key === "ArrowDown") {
    aktif = (aktif + 1) % saran.length;
    sorotSaran();
    e.preventDefault();
  } else if (e.key === "ArrowUp") {
    aktif = (aktif - 1 + saran.length) % saran.length;
    sorotSaran();
    e.preventDefault();
  } else if (e.key === "Escape") {
    tutupSaran();
  }
});
masuk.addEventListener("blur", () => setTimeout(tutupSaran, 150));
daftarSaran.addEventListener("mousedown", (e) => {
  const li = (e.target as HTMLElement).closest<HTMLLIElement>("[data-i]");
  if (!li) return;
  e.preventDefault();
  tebak(saran[Number(li.dataset.i)]);
});
$("#isian").addEventListener("submit", (e) => {
  e.preventDefault();
  if (selesai()) return;
  // Enter memilih saran yang disorot; kalau ketikan persis satu nama, itu juga diterima.
  const pilihan = aktif >= 0 ? saran[aktif] : cari(masuk.value, 2, new Set(r.tebakan)).find((d, _, a) => a.length === 1 || d.nama.toLowerCase() === masuk.value.trim().toLowerCase());
  if (pilihan) tebak(pilihan);
  else pesan.textContent = masuk.value.trim() ? "Pilih nama dari daftar saran." : "Ketik nama kabupaten atau kota dulu.";
});

/* ---------- tombol lain ---------- */
$("#buka-petunjuk").addEventListener("click", () => {
  r.petunjuk = true;
  simpan();
  gambarPetunjuk();
});
$("#menyerah").addEventListener("click", () => {
  if (!confirm("Menyerah dan lihat jawabannya?")) return;
  r.menyerah = true;
  simpan();
  catatStatistik();
  gambarSemua();
});
$("#lagi").addEventListener("click", () => {
  r = { jawab: soalBebas(pulau, Math.random, r.jawab).id, tebakan: [], petunjuk: false, menyerah: false };
  simpan();
  pesan.textContent = "";
  gambarSemua();
  window.scrollTo({ top: 0, behavior: "smooth" });
  masuk.focus();
});
$$<HTMLButtonElement>("[data-mode]").forEach((b) =>
  b.addEventListener("click", () => {
    mode = b.dataset.mode as Mode;
    history.replaceState(null, "", mode === "bebas" ? "#bebas" : location.pathname);
    r = muatRekaman();
    pesan.textContent = "";
    gambarSemua();
  }),
);
pilihPulau.addEventListener("change", () => {
  pulau = pilihPulau.value as Pulau | "Semua";
  tulis("td:pulau", pulau);
  // Soal bebas yang belum dijawab diganti supaya sesuai pilihan pulau.
  if (!r.tebakan.length || selesai()) {
    r = { jawab: soalBebas(pulau).id, tebakan: [], petunjuk: false, menyerah: false };
    simpan();
    gambarSemua();
  }
});

$("#bagikan").addEventListener("click", async () => {
  const judul = mode === "harian" ? `Tebak Daerah #${nomor}` : `Tebak Daerah (bebas: ${jawaban().nama})`;
  const teks = teksBagikan(judul, hasil(), menang(), location.host, r.petunjuk);
  try {
    if (navigator.share && matchMedia("(pointer: coarse)").matches) await navigator.share({ text: teks });
    else {
      await navigator.clipboard.writeText(teks);
      pesan.textContent = "Hasil disalin. Tempel di chat!";
    }
  } catch {
    /* dibatalkan */
  }
});

$$<HTMLButtonElement>("[data-buka]").forEach((b) =>
  b.addEventListener("click", () => {
    if (b.dataset.buka === "statistik") gambarStatistik();
    $<HTMLDialogElement>(`#dialog-${b.dataset.buka}`).showModal();
  }),
);

/* ---------- mulai ---------- */
gambarSemua();
if (!baca("td:sudah-lihat-cara", false)) {
  tulis("td:sudah-lihat-cara", true);
  $<HTMLDialogElement>("#dialog-cara").showModal();
}
muatPeta()
  .then((p) => {
    peta = p;
    if (selesai()) gambarSelesai();
  })
  .catch(() => {
    /* peta hasil saja yang tidak tampil; permainan tetap jalan */
  });
