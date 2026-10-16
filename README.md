# PARUPINTAS — Skrining TB Berbantuan AI dari Rontgen Dada

> JOINTS 2026 UGM — Software Development

## Tentang PARUPINTAS

PARUPINTAS adalah aplikasi web untuk mempercepat skrining tuberkulosis paru dari citra rontgen dada di sebuah klinik. Pasien mendaftar tanpa akun, dokter Sp. Radiologi memeriksa rontgennya dengan bantuan model AI, dan pasien mengikuti status serta nomor antreannya sendiri lewat kode akses.

> **PARUPINTAS melakukan skrining, bukan diagnosis.** Keluaran model hanyalah sinyal bahwa seorang pasien sebaiknya dilihat lebih dekat dan menjalani tes lanjutan. Keputusan klinis tetap di tangan dokter.

## Siapa yang memakai

| Peran | Yang dilakukan |
| --- | --- |
| **Pasien** (tanpa akun) | Mengisi formulir pendaftaran dan langsung mendapat **kode akses** (voucher). Dengan kode itu pasien melihat status pemeriksaannya, yang diperbarui sendiri secara berkala sampai hasil skrining awal dan nomor antreannya keluar. |
| **Admin** | Menyimpan data pasien dari setiap pendaftaran (dicocokkan dengan pasien yang sudah tercatat, atau disimpan sebagai pasien baru), mendaftarkan pasien yang datang langsung, mengecek riwayat rontgen pasien, dan memantau prioritas antrean saat ini. |
| **Dokter Sp. Radiologi** | Memeriksa gambar rontgen sambil melengkapi data pasien, mengecek prioritas berdasarkan hasil skrining, lalu mengirimnya ke sistem. |

## Alurnya

1. **Daftar.** Pasien mengisi nama, jenis kelamin, tanggal lahir, telepon, alamat, dan keluhan, lalu menerima kode akses.
2. **Simpan data pasien.** Admin mencocokkan pendaftaran itu dengan rekam medis, supaya riwayat rontgen pasien tidak terpecah.
3. **Periksa.** Radiolog mengunggah rontgen. Model berjalan langsung di browser, memberi tiga score (Sehat, Sakit bukan TB, TB) dan menandai area yang paling memengaruhi hasilnya, lengkap dengan label kelasnya.
4. **Tentukan prioritas dan kirim.** Saran prioritas dari model hanya titik awal; keputusan akhir ada di dokter. Nomor antrean dibuat saat dikirim.
5. **Antrean.** Pasien diurutkan dari prioritas tertinggi. Halaman status pasien ikut berubah: *menunggu → sedang diperiksa → hasil keluar → dipanggil*.

## Prinsip yang dipegang

- **Skrining, bukan diagnosis.** Hasil model selalu diposisikan sebagai pemicu pemeriksaan lanjutan, dan kotak pada rontgen menandai area yang dipakai model, bukan lesi yang sudah dipastikan.
- **Tidak mengarang angka klinis.** Tidak ada hasil atau akurasi buatan, termasuk di data contoh.
- **Kode akses adalah satu-satunya kunci pasien.** Kode itu hanya membuka ringkasan sempit: status, nomor antrean, prioritas, dan hasil awal dalam kata-kata. Gambar dan data klinis hanya bisa dilihat petugas.

---

Catatan teknis, mulai dari cara menjalankan, konfigurasi, hingga pengujian, ada di [`backend/README.md`](backend/README.md) dan [`frontend/README.md`](frontend/README.md).
