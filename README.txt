================================================================================
PULMO — Skrining TB Berbantuan AI dari Rontgen Dada
JOINTS 2026 UGM — Software Development
================================================================================


TENTANG PULMO
--------------------------------------------------------------------------------
PULMO adalah aplikasi web yang membantu petugas kesehatan menapis (skrining)
tuberkulosis paru dari citra rontgen dada. Sasarannya layanan kesehatan di
daerah terpencil di Indonesia, tempat akses ke pembaca rontgen dan tenaga ahli
sering terbatas.

Satu hal yang perlu ditegaskan sejak awal: PULMO melakukan SKRINING, bukan
DIAGNOSIS. Keluaran model hanyalah sinyal bahwa seorang pasien sebaiknya
menjalani tes lanjutan, seperti tes dahak atau tes molekuler. Vonis dan
keputusan klinis tetap ada di tangan tenaga kesehatan. Peran model adalah
mempercepat penemuan kasus, bukan menggantikan penilaian manusia.


MASALAH YANG DISELESAIKAN
--------------------------------------------------------------------------------
Sebagian besar kasus TB yang tidak tertangani justru kasus yang tidak pernah
terdeteksi. Di daerah terpencil, keterbatasan tenaga pembaca rontgen membuat
banyak pasien tidak sempat ditapis, dan sebagian yang sudah ditapis pun hilang
jejak sebelum sampai ke pengobatan.

PULMO menjawab persoalan itu dengan mengangkat skrining sebagai langkah awal
yang bisa dikerjakan lebih cepat, lalu merangkai seluruh perjalanan pasien, dari
skrining, peninjauan klinis, rujukan, sampai tindak lanjut, dalam satu alur yang
terpantau. Pasien pun punya akses sendiri ke riwayat, jadwal, dan materi edukasi
TB. Karena jaringan di lapangan kerap tidak stabil, aplikasi tetap bisa dipakai
saat offline dan menyinkronkan datanya begitu kembali online.


SIAPA YANG MEMAKAI
--------------------------------------------------------------------------------
Pengunjung tanpa akun dapat membaca informasi umum TB, melihat cara kerja
sistem, mencoba demo, dan menelusuri daftar fasilitas kesehatan.

Pasien melihat rekam skriningnya sendiri, jadwal tindak lanjut, profil
kesehatan, dan pusat belajar TB. Setiap orang yang mendaftar sendiri otomatis
menjadi pasien.

Tenaga kesehatan, baik dokter, perawat, maupun kader, mendata pasien di
fasilitasnya, membuat skrining baru dengan mengisi gejala dan tanda vital serta
mengunggah rontgen, meninjau hasilnya, membuat rujukan, dan menjadwalkan tindak
lanjut. Kewenangan menandatangani hasil peninjauan dibedakan sesuai peran:
dokter dapat melakukannya, kader tidak.

Administrator mengelola akun, peran, dan direktori fasilitas, serta memantau
metadata rekaman dan jejak audit. Administrator sengaja dibuat bukan peran
klinis, sehingga tidak dapat melihat isi medis pasien seperti gejala, tanda
vital, gambar rontgen, maupun catatan peninjauan.


YANG BISA DILAKUKAN DI APLIKASI
--------------------------------------------------------------------------------
Inti aplikasi adalah satu alur skrining yang utuh. Petugas memasukkan gejala dan
tanda vital, mengunggah rontgen, lalu memperoleh hasil penapisan untuk ditinjau.
Tenaga kesehatan kemudian meninjau temuan itu, menyetujui atau menolaknya, dan
menentukan langkah berikutnya. Bila perlu, pasien dirujuk ke fasilitas yang
tepat lengkap dengan riwayat statusnya, lalu dijadwalkan tindak lanjut beserta
catatan setiap upaya menghubunginya.

Di luar alur itu, aplikasi menyediakan direktori fasilitas kesehatan beserta
layanannya, materi edukasi TB untuk pasien lengkap dengan progres membacanya,
dan mode offline yang menyimpan data saat tanpa sinyal untuk dikirim kemudian.


PRINSIP YANG DIPEGANG
--------------------------------------------------------------------------------
PULMO konsisten memperlakukan dirinya sebagai alat skrining, bukan diagnosis,
sehingga hasil model selalu diposisikan sebagai pemicu tes lanjutan. Aplikasi
juga tidak pernah mengarang angka klinis: bila model belum terhubung, hal itu
dinyatakan terus terang alih-alih menampilkan hasil palsu. Privasi dijaga ketat,
pasien hanya melihat datanya sendiri, tenaga kesehatan hanya pasien di
fasilitasnya, dan administrator tidak dapat menembus isi medis.


--------------------------------------------------------------------------------
Catatan teknis, mulai dari cara menjalankan, konfigurasi, hingga pengembangan,
ada di backend/README.md dan frontend/docs/.
================================================================================
