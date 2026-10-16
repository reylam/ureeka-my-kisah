# PULMO Frontend

Antarmuka web PULMO: skrining TB berbantuan AI dari rontgen dada untuk layanan kesehatan di daerah
terpencil Indonesia. Satu aplikasi React melayani dua hal sekaligus:

- **Situs publik (PULMO-TRACE)** di `/`, `/how-it-works`, dan `/demo`. Bisa dibuka siapa saja tanpa akun.
- **Aplikasi klinis** di balik login, dengan ruang kerja berbeda untuk pasien, tenaga kesehatan, dan administrator.

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
| Data | Backend PULMO lewat satu HTTP client (`src/lib/apiClient.ts`) |
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

Setelah database lokal di-seed (`supabase db reset`), tersedia akun sampel untuk setiap peran. Daftar
lengkap dan kata sandinya ada di [`docs/accounts.md`](docs/accounts.md). Contoh:

| Peran | Email | Landing |
| --- | --- | --- |
| Pasien | `patient@pulmo.test` | `/me` |
| Tenaga kesehatan | `doctor@pulmo.test` | `/dashboard` |
| Administrator | `admin@pulmo.test` | `/admin` |

Pendaftaran lewat `/register` selalu menghasilkan **pasien**. Akun tenaga kesehatan dan admin dibuat
dengan mempromosikan akun yang ada dari halaman Akun admin, atau dengan `npm run provision` di
`backend/`. `/app` mengarahkan akun yang sedang masuk ke beranda sesuai perannya.

---

## Peta rute

| Kelompok | Rute |
| --- | --- |
| Publik (PULMO-TRACE) | `/`, `/how-it-works`, `/demo` |
| Publik (platform) | `/platform`, `/login`, `/register`, `/app` |
| Onboarding pasien | `/onboarding` |
| Pasien | `/me`, `/me/screenings`, `/me/followup`, `/me/learn`, `/me/facilities`, `/me/profile` |
| Tenaga kesehatan | `/dashboard`, `/patients`, `/patients/:id`, `/screenings/new`, `/screenings/:id`, `/screenings/:id/report`, `/referrals`, `/followups`, `/facilities`, `/reports`, `/offline`, `/settings` |
| Administrator | `/admin`, `/admin/users`, `/admin/facilities`, `/admin/screenings`, `/admin/audit` |

Rute per peran dibungkus `RequireAuth` dan `RequireRole`. Itu hanya mengatur apa yang ditawarkan
antarmuka. Penegakan izin yang sebenarnya ada di backend dan RLS database.

---

## Struktur proyek

```
src/
├── components/   komponen UI bersama (ui, forms, layout, dashboard, patients, screening, ...)
├── data/         data referensi statis (geografi, edukasi, fasilitas, model)
├── hooks/        query, kontrol tabel, resolusi gambar
├── lib/          apiClient, env, supabase, permissions, risk, sessionReset
├── pages/        satu file per rute (juga pages/patient dan pages/admin)
├── routes/       tabel rute, RequireAuth, RouteError
├── services/     recordsApi, onboardingApi, referenceData, syncService, imageStore
├── stores/       Zustand: auth, data, facility, account, model, koneksi, toast
├── trace/        situs publik PULMO-TRACE (halaman, section, komponen, hook demo)
├── types/        model domain dan kontrak inferensi
└── utils/        tanggal, format, label, service worker
public/           manifest, service worker, ikon
docs/             accounts.md, api-contract.md, catatan frontend dan riset
```

---

## Alur data

- **Auth.** Daftar, masuk, dan keluar lewat Supabase Auth dari `stores/authStore.ts`. Token akses
  dikirim ke backend, yang menentukan peran dan hak akses dari database.
- **Data.** `stores/dataStore.ts` adalah cache dari rekam milik akun yang sedang masuk. Isinya diisi
  dari API setelah login, setiap tulis ke API dulu, dan respons menggantikan salinan lokal. Server
  menentukan apa yang diterima tiap peran: tenaga kesehatan menerima pasien di fasilitasnya, pasien
  hanya miliknya sendiri, admin hanya metadata.
- **HTTP.** Semua panggilan melewati `lib/apiClient.ts`. Respons backend berbentuk
  `{ success, data, meta? }`. Kontrak lengkapnya di [`docs/api-contract.md`](docs/api-contract.md).
- **Ganti akun.** `lib/sessionReset.ts` membersihkan store saat sesi berakhir, supaya data satu akun
  tidak bocor ke akun berikutnya di perangkat yang sama.

### Model dan hasil skrining

Frontend tidak menjalankan model dan tidak mengarang angka klinis.

- `stores/modelStore.ts` bertanya ke `GET /health` apakah model terhubung. Selama belum diketahui,
  dianggap **tidak terhubung**.
- **Demo publik** (`/demo`) mengirim gambar ke `POST /demo/analyze`. Gambar hanya ditahan di memori
  untuk satu permintaan dan tidak disimpan. Kalau model tidak terhubung, halaman memakai hasil contoh
  yang diberi label jelas sebagai contoh, tanpa mengirim apa pun ke server.
- **Skrining klinis** dianalisis lewat `POST /screenings/:id/analyze`. Tanpa model, backend menjawab
  `503` dan frontend menyatakan bahwa langkah model belum berjalan.

### Mode offline

Aplikasi tetap bisa dipakai tanpa sinyal, dengan batas yang jelas:

1. Skrining yang direkam saat offline disimpan di **outbox** perangkat (rekam di penyimpanan lokal,
   rontgen di IndexedDB).
2. Saat koneksi kembali, `services/syncService.ts` mengirimnya sungguhan ke API: buat skrining,
   unggah rontgen, lalu hapus salinan di perangkat.
3. Draf tidak pernah dikirim. Item yang gagal tetap di perangkat bersama alasan dari server dan
   harus dicoba ulang satu per satu.
4. Menjalankan sinkronisasi saat offline ditolak, bukan berpura-pura berhasil.
5. Analisis model butuh koneksi, jadi rekaman offline menunggu.

Hanya skrining yang diantrekan. Tulis lainnya (rujukan, tindak lanjut, dan seterusnya) langsung ke
API. Service worker (`public/sw.js`) hanya menyimpan app shell: HTML, aset build Vite, ikon, dan
manifest. Data pasien dan rontgen sengaja tidak pernah masuk cache-nya. Service worker hanya
didaftarkan pada build produksi.

---

## Deploy ke Vercel

1. Impor repo dan set **Root Directory** ke `frontend`. Framework terdeteksi sebagai Vite
   (build `npm run build`, output `dist`).
2. Isi tiga variabel `VITE_*` di Settings → Environment Variables. `VITE_API_BASE_URL` harus
   mengarah ke backend yang sudah di-deploy, mis. `https://<backend>.vercel.app/api/v1`.
3. Pastikan ada rewrite SPA agar refresh di `/login` atau `/me` tidak 404. File `vercel.json` di
   folder ini sudah mengaturnya.
4. Tambahkan URL frontend ke `FRONTEND_ORIGIN` di backend (tanpa slash di akhir). Tanpa itu, browser
   memblokir panggilan API karena CORS.
5. Di Supabase, tambahkan URL frontend ke Authentication → URL Configuration.

Setelah mengubah env, deploy ulang. Kalau layar tampak usang setelah rilis baru, hapus service
worker lewat DevTools → Application, atau lewat halaman Settings di aplikasi.

---

## Mengatur ulang data lokal

Yang tersimpan di browser hanya outbox, rontgen yang menunggu terkirim, dan cache app shell. Untuk
membersihkannya, buka **Settings**: hapus radiograf tersimpan (juga melepas service worker). Cara
manual: hapus site data untuk origin tersebut di DevTools. Data di server tidak ikut terhapus.

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

- Peta fasilitas bersifat skematis (plot posisi relatif), bukan peta navigasi. Belum ada penyedia peta.
- Model tidak berjalan di frontend. Hasil analisis hanya ada kalau backend terhubung ke layanan
  inferensi (lihat `../inference`).
- Cek izin di `lib/permissions.ts` hanya mengatur tampilan. Penegakannya ada di server.
- Belum dirancang: reset kata sandi, undangan tenaga kesehatan, pesan, pengingat, dan manajemen
  konten edukasi.
