# PULMO — Skrining TB Berbantuan AI dari Rontgen Dada

> JOINTS 2026 UGM — Software Development

## Tentang PULMO

PULMO adalah aplikasi web yang membantu petugas kesehatan menapis (skrining) tuberkulosis paru dari citra rontgen dada. Sasarannya layanan kesehatan di daerah terpencil di Indonesia, tempat akses ke pembaca rontgen dan tenaga ahli sering terbatas.

> **PULMO melakukan skrining, bukan diagnosis.** Keluaran model hanyalah sinyal bahwa seorang pasien sebaiknya menjalani tes lanjutan, seperti tes dahak atau tes molekuler. Vonis dan keputusan klinis tetap ada di tangan tenaga kesehatan. Peran model adalah mempercepat penemuan kasus, bukan menggantikan penilaian manusia.

## Masalah yang diselesaikan

Sebagian besar kasus TB yang tidak tertangani justru kasus yang tidak pernah terdeteksi. Di daerah terpencil, keterbatasan tenaga pembaca rontgen membuat banyak pasien tidak sempat ditapis, dan sebagian yang sudah ditapis pun hilang jejak sebelum sampai ke pengobatan.

PULMO menjawab persoalan itu dengan mengangkat skrining sebagai langkah awal yang bisa dikerjakan lebih cepat, lalu merangkai seluruh perjalanan pasien, dari skrining, peninjauan klinis, rujukan, sampai tindak lanjut, dalam satu alur yang terpantau. Pasien pun punya akses sendiri ke riwayat, jadwal, dan materi edukasi TB. Karena jaringan di lapangan kerap tidak stabil, aplikasi tetap bisa dipakai saat offline dan menyinkronkan datanya begitu kembali online.

## Siapa yang memakai

| Peran | Yang dilakukan |
| --- | --- |
| **Pengunjung** (tanpa akun) | Membaca informasi umum TB, melihat cara kerja sistem, mencoba demo, dan menelusuri daftar fasilitas kesehatan. |
| **Pasien** | Melihat rekam skriningnya sendiri, jadwal tindak lanjut, profil kesehatan, dan pusat belajar TB. Setiap pendaftaran mandiri otomatis menjadi pasien. |
| **Tenaga kesehatan** (dokter, perawat, kader) | Mendata pasien di fasilitasnya, membuat skrining baru (gejala, tanda vital, unggah rontgen), meninjau hasil, membuat rujukan, dan menjadwalkan tindak lanjut. Kewenangan menandatangani hasil peninjauan dibedakan: dokter bisa, kader tidak. |
| **Administrator** | Mengelola akun, peran, dan direktori fasilitas, serta memantau metadata rekaman dan jejak audit. Sengaja bukan peran klinis, sehingga tidak bisa melihat isi medis pasien. |

## Yang bisa dilakukan di aplikasi

Inti aplikasi adalah satu alur skrining yang utuh:

1. **Skrining** — petugas memasukkan gejala dan tanda vital, mengunggah rontgen, lalu memperoleh hasil penapisan untuk ditinjau.
2. **Peninjauan klinis** — tenaga kesehatan meninjau temuan, menyetujui atau menolaknya, dan menentukan langkah berikutnya.
3. **Rujukan** — bila perlu, pasien dirujuk ke fasilitas yang tepat lengkap dengan riwayat statusnya.
4. **Tindak lanjut** — menjadwalkan dan mencatat setiap upaya menghubungi pasien.

Di luar alur itu, aplikasi menyediakan:

- Direktori fasilitas kesehatan beserta layanannya.
- Materi edukasi TB untuk pasien lengkap dengan progres membacanya.
- Mode offline yang menyimpan data saat tanpa sinyal untuk dikirim kemudian.

## Prinsip yang dipegang

- **Skrining, bukan diagnosis.** Hasil model selalu diposisikan sebagai pemicu tes lanjutan.
- **Tidak mengarang angka klinis.** Bila model belum terhubung, hal itu dinyatakan terus terang alih-alih menampilkan hasil palsu.
- **Privasi dijaga ketat.** Pasien hanya melihat datanya sendiri, tenaga kesehatan hanya pasien di fasilitasnya, dan administrator tidak dapat menembus isi medis.

---

Catatan teknis, mulai dari cara menjalankan, konfigurasi, hingga pengembangan, ada di [`backend/README.md`](backend/README.md) dan [`frontend/docs/`](frontend/docs/).
