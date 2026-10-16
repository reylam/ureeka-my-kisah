# PARUPINTAS Frontend

Antarmuka web PARUPINTAS: skrining TB berbantuan AI dari rontgen dada untuk layanan kesehatan di daerah
terpencil Indonesia. Satu aplikasi React melayani dua hal sekaligus:

- **Situs publik** tanpa akun: penjelasan (`/`, `/how-it-works`), demo model (`/demo`), dan dua halaman
  pasien, yaitu formulir pendaftaran (`/daftar`) dan cek status dengan kode akses (`/hasil`).
- **Ruang kerja petugas** di balik login, untuk admin dan dokter Sp. Radiologi.

> **Skrining, bukan diagnosis.** Keluaran model hanyalah sinyal untuk tes lanjutan. Keputusan klinis
> tetap di tangan tenaga kesehatan. Aplikasi ini belum divalidasi sebagai alat medis.

Gambaran produk ada di [README utama](../README.md). Dokumen backend ada di
[`../backend/README.md`](../backend/README.md).

---

## Tech stack

| Bagian | Pilihan |
| --- | --- |
| Framework | React 19, TypeScript, Vite |
| Routing | React Router 7 (`createBrowserRouter`, halaman di-lazy-load) |
| Styling | Tailwind CSS 4, font Inter (self-hosted) |
| State | Zustand |
| Auth | Supabase Auth, dipanggil langsung dari browser |
| Data | Backend PARUPINTAS lewat satu HTTP client (`src/lib/apiClient.ts`) |
| Offline | Service worker untuk app shell, IndexedDB untuk outbox dan rontgen |

---

## Menjalankan secara lokal

Butuh Node.js 20 atau lebih baru.

```bash
npm install
cp .env.example .env     # Windows PowerShell: Copy-Item .env.example .env
npm run dev
```

Dev server berjalan di <http://localhost:5173>. Frontend butuh backend dan Supabase yang hidup untuk
login dan data. Cara menyalakannya ada di `../backend/README.md`.

| Script | Fungsi |
| --- | --- |
| `npm run dev` | Dev server Vite dengan hot reload |
| `npm run build` | Type-check dengan `tsc -b`, lalu build ke `dist/` |
| `npm run preview` | Menyajikan hasil build secara lokal |
| `npm run typecheck` | Type-check saja |

---

## Environment variable

Semua diawali `VITE_`, jadi **ikut ter-bundle dan terlihat oleh setiap pengunjung**. Jangan taruh
rahasia di sini, terutama service-role key Supabase.

| Variabel | Isi |
| --- | --- |
| `VITE_API_BASE_URL` | URL backend lengkap dengan prefix versi, mis. `http://localhost:4000/api/v1`. Kalau kosong, dipakai nilai itu sebagai default. |
| `VITE_SUPABASE_URL` | URL project Supabase. Untuk `supabase start`, lihat `supabase status`. |
| `VITE_SUPABASE_ANON_KEY` | Kunci **anon** (publik). Perlindungan data ada di RLS database dan pengecekan backend. |

Kalau dua variabel Supabase kosong, halaman login menyatakannya terus terang dan tidak bisa masuk.
Nilai `VITE_*` dibaca saat **build**, jadi setelah mengubahnya di hosting, deploy ulang.

---

## Akun contoh

Setelah database lokal di-seed, tersedia akun petugas berikut. Daftar lengkap ada di
[`docs/accounts.md`](docs/accounts.md).

| Peran | Email | Kata sandi |
| --- | --- | --- |
| Admin | `admin@parupintas.test` | `Admin123!` |
| Dokter Sp. Radiologi | `radiolog@parupintas.test` | `Radiolog123!` |

Pasien tidak punya akun. Seed juga berisi kode akses contoh untuk mencoba `/hasil`, misalnya
`BARU-2345` (menunggu) dan `ANTR-2345` (sudah di antrean).

---

## Peta rute

| Kelompok | Rute |
| --- | --- |
| Publik | `/`, `/how-it-works`, `/demo`, `/daftar`, `/hasil`, `/login` |
| Admin dan radiolog | `/requests` (pendaftaran), `/queue` (antrean), `/screenings/:id` |
| Radiolog | `/screenings/:id/examine` |
| Admin | `/patients`, `/patients/:id` (riwayat rontgen) |

`/app` mengarahkan petugas yang sedang masuk ke berandanya. Rute dibungkus `RequireAuth` dan
`RequireRole`, yang hanya mengatur tampilan; penegakan izin ada di backend dan RLS database.

---

## Alurnya

1. **Pasien** mengisi `/daftar` (nama, jenis kelamin, tanggal lahir, telepon, alamat, keluhan) dan
   langsung mendapat **kode akses** (voucher).
2. **Admin** membuka *Pendaftaran*, lalu menyimpan data pasien dari formulir: dicocokkan dengan pasien
   yang sudah tercatat, atau disimpan sebagai pasien baru. Pasien yang datang langsung didaftarkan dari
   halaman yang sama dan juga mendapat kode.
3. **Radiolog** membuka permintaan itu, melengkapi data, mengunggah rontgen. Model di browser membaca
   gambarnya dan menandai area yang dipakainya. Radiolog menentukan prioritas, lalu mengirim ke sistem;
   saat itulah nomor antrean dibuat.
4. **Pasien** membuka `/hasil` dengan kodenya. Halaman itu memeriksa ulang sendiri setiap 15 detik:
   *menunggu → sedang diperiksa → hasil awal + nomor antrean → sudah dipanggil*.
5. **Admin** memantau *Antrean* (urut prioritas) dan menekan **Panggil** saat pasien dipanggil.

---

## Struktur proyek

```
src/
├── components/   komponen bersama (ui, forms, layout, patients, screening)
├── hooks/        gambar rontgen (signed URL), nama petugas
├── lib/          apiClient, env, supabase, permissions, queue, risk, screeningAnalysis
├── pages/        satu file per rute
├── routes/       tabel rute, RequireAuth, RouteError
├── services/     recordsApi (semua panggilan API), localModel (model ONNX di browser)
├── stores/       Zustand: auth, toast
├── trace/        situs publik (halaman, section, komponen, hook demo)
├── types/        model domain dan akun
└── utils/        tanggal, format, label
public/           manifest, ikon, model ONNX, contoh rontgen (test/)
docs/             accounts.md, api-contract.md, catatan frontend dan riset
```

---

## Alur data

- **Auth.** Petugas masuk dan keluar lewat Supabase Auth (`stores/authStore.ts`). Token akses dikirim
  ke backend, yang menentukan peran dari database.
- **Data.** Tidak ada cache sisi klien. Setiap halaman meminta datanya saat dibuka, lewat
  `services/recordsApi.ts`. Pendaftaran, antrean, dan halaman status pasien memintanya ulang secara
  berkala.
- **HTTP.** Semua panggilan melewati `lib/apiClient.ts`. Respons backend berbentuk
  `{ success, data, meta? }`. Daftar endpoint ada di [`../backend/README.md`](../backend/README.md).

### Model dan hasil skrining

Model (`public/models/tb_student.onnx`) berjalan di browser lewat ONNX Runtime Web, jadi tidak perlu
server model. Ia memberi tiga score kelas. Karena model ini classifier tanpa kepala deteksi, kotak pada
rontgen dihitung dengan **uji oklusi**: tiap bagian gambar ditutup bergantian dan model dijalankan ulang;
area yang paling menurunkan score kelas teratas diberi kotak dan label kelasnya. Artinya kotak
menunjukkan area yang dipakai model, bukan lesi yang sudah dipastikan. Backend hanya menyimpan
probabilitas dan kotaknya, lalu menurunkan sendiri hasil, risk point, dan nama zona.

---

## Deploy ke Vercel

1. Impor repo dan set **Root Directory** ke `frontend`. Framework terdeteksi sebagai Vite
   (build `npm run build`, output `dist`).
2. Isi tiga variabel `VITE_*` di Settings → Environment Variables. `VITE_API_BASE_URL` harus
   mengarah ke backend yang sudah di-deploy, mis. `https://<backend>.vercel.app/api/v1`.
3. Pastikan ada rewrite SPA agar refresh di `/login` atau `/hasil` tidak 404. File `vercel.json` di
   folder ini sudah mengaturnya.
4. Tambahkan URL frontend ke `FRONTEND_ORIGIN` di backend (tanpa slash di akhir). Tanpa itu, browser
   memblokir panggilan API karena CORS.
5. Di Supabase, tambahkan URL frontend ke Authentication → URL Configuration.

Setelah mengubah env, deploy ulang. Mode offline sudah dihapus. `public/sw.js` sekarang hanya
membersihkan cache service worker lama di browser yang pernah memasangnya, lalu melepas dirinya sendiri.

---

## Catatan desain dan aksesibilitas

- Identitas visual: hitam obsidian dengan aksen biru CT-scan. Biru dicadangkan untuk navigasi aktif,
  fokus, tautan, dan visualisasi radiologi. Penampil rontgen sengaja gelap.
- Status klinis dan operasional tidak pernah hanya berupa warna. Setiap badge punya ikon dan teks.
  "Tidak ada peringatan skrining" sengaja tidak hijau, karena tidak adanya peringatan bukan jaminan sehat.
- Semantic HTML, fokus yang konsisten, tab yang bisa dinavigasi keyboard, dialog dengan focus trap,
  skip link, toast `aria-live`, dan dukungan reduced motion.
- Kepatuhan WCAG penuh butuh pengujian manual dengan teknologi bantu dan tinjauan ahli. Itu belum dilakukan.

---

## Batasan yang diketahui

- Model belum divalidasi secara klinis, dan tidak ada angka akurasi yang diklaim.
- Halaman status pasien memeriksa ulang dengan polling, bukan push. Pembaruannya bisa terlambat
  hingga 15 detik.
- Cek izin di `lib/permissions.ts` hanya mengatur tampilan. Penegakannya ada di server.
- Belum dirancang: reset kata sandi, pengelolaan akun petugas dari aplikasi (sekarang lewat
  `npm run provision` di `backend/`), dan notifikasi ke pasien.
