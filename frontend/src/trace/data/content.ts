/**
 * Site copy.
 *
 * Written for a general reader, not for a reviewer. The deep version of all of
 * this, with the research questions, the dataset record, the evaluation
 * framework and the reference list, lives in `docs/research-notes.txt` and is
 * deliberately not on the site.
 *
 * Two rules still apply to everything here. Facts about tuberculosis carry a
 * source. Facts about this prototype say plainly that no model is connected.
 */

export const PROJECT = {
  name: 'PARUPINTAS',
  tagline: 'Skrining TB Berbantuan AI',
  subtitle:
    'Percepatan Skrining Tuberkulosis Berbantuan AI untuk Mengatasi Antrean Pembacaan Citra Rontgen',
  version: '0.1.0',
  updated: 'Oktober 2026',
} as const;

/* ───────────────────────────── why it matters ───────────────────────────── */

export const BURDEN_FACTS: {
  figure: string;
  unit: string;
  body: string;
  sourceId: string;
}[] = [
  {
    figure: '10.7',
    unit: 'juta orang',
    body: 'jatuh sakit karena tuberkulosis (TB) pada 2024. TB termasuk penyakit menular paling mematikan di dunia, padahal bisa disembuhkan.',
    sourceId: 'whoGtb2025',
  },
  {
    figure: '2.4',
    unit: 'juta tidak terdeteksi',
    body: 'di antaranya tidak pernah didiagnosis. Sekitar satu dari lima orang dengan TB tidak pernah ditemukan oleh layanan kesehatan sama sekali.',
    sourceId: 'whoGtb2025',
  },
  {
    figure: '1 dari',
    unit: 'tempat pertama TB terlihat',
    body: 'adalah chest X-ray. Murah, cepat, dan mudah dijangkau, makanya dipakai untuk menentukan siapa yang perlu menjalani tes lab.',
    sourceId: 'whoScreening2021',
  },
];

export const WHY_POINTS: { title: string; body: string; sourceId?: string }[] = [
  {
    title: 'Menemukan penderita adalah bagian tersulitnya',
    body: 'Tuberkulosis bisa diobati. Mereka yang meninggal karenanya sebagian besar adalah orang yang tidak sempat didiagnosis tepat waktu. Jadi hambatannya bukan di pengobatan, melainkan di menemukan siapa yang perlu dites.',
    sourceId: 'whoGtb2025',
  },
  {
    title: 'X-ray cocok sebagai filter awal',
    body: 'Chest X-ray itu cepat, murah, dan tersedia di tempat yang tidak punya laboratorium. World Health Organization memasukkannya ke dalam perangkat screening TB, dan sejak 2021 membolehkan software membacanya sebagai pengganti pembaca manusia untuk orang dewasa, di tempat yang memang sudah merekomendasikan screening.',
    sourceId: 'whoScreening2021',
  },
  {
    title: 'Tapi bayangan di paru-paru bukan diagnosis',
    body: 'Pneumonia, bekas luka lama, kanker, dan beberapa kondisi lain bisa tampak mirip di X-ray. Sebaliknya, ada juga orang yang jelas menderita TB tetapi X-ray-nya tampak normal. Gambar hanya mempersempit kemungkinan, bukan menyimpulkannya.',
    sourceId: 'whoCxr2016',
  },
];

/* ──────────────────────────── how it works ──────────────────────────── */

export const STEPS: {
  id: string;
  label: string;
  body: string;
  note: string;
}[] = [
  {
    id: 'image',
    label: 'Mulai dari chest X-ray',
    body: 'Satu chest X-ray tampak depan yang biasa, seperti yang diambil di klinik dalam beberapa menit.',
    note: 'Di prototipe ini, kamu memilih file dari perangkatmu sendiri.',
  },
  {
    id: 'check',
    label: 'Cek apakah gambarnya layak dipakai',
    body: 'Gambar yang buram, terpotong, atau salah eksposur menghasilkan jawaban yang tidak andal, jadi gambar diperiksa dulu sebelum proses lain berjalan.',
    note: 'Prototipe ini memeriksa tipe file, ukuran, dan dimensinya.',
  },
  {
    id: 'look',
    label: 'Mencari pola yang dikenali',
    body: 'Software yang dilatih dengan banyak X-ray berlabel membandingkan apa yang dilihatnya dengan pola yang sudah dipelajari, lalu menghasilkan score yang menunjukkan seberapa mirip keduanya.',
    note: 'Sudah dibuat. Model MobileNetV3-Small berjalan langsung di browser-mu. File modelnya (sekitar 6 MB) diunduh saat pertama kali dipakai.',
  },
  {
    id: 'result',
    label: 'Ubah score jadi langkah berikutnya',
    body: 'Dari score itu, gambar ditandai untuk dilihat lebih dekat, dinyatakan tidak ada yang menonjol, atau dinyatakan belum meyakinkan. Hasilnya adalah rekomendasi soal tes, bukan kesimpulan tentang orangnya.',
    note: 'Sudah dibuat. Hasilnya menampilkan tiga score kelas, satu risk point (0 sampai 100), dan peringatan yang menyertainya.',
  },
];

/* ───────────────────────── can and cannot ───────────────────────── */

export const CAN_DO: string[] = [
  'Menunjukkan X-ray yang perlu dilihat lebih teliti',
  'Memproses banyak gambar dengan cepat, secara berurutan',
  'Membantu di tempat yang hari itu tidak punya radiolog',
  'Memberi jawaban yang sama setiap kali untuk gambar yang sama',
];

export const CANNOT_DO: string[] = [
  'Memastikan seseorang menderita tuberkulosis',
  'Membuktikan seseorang tidak menderita TB',
  'Menggantikan tes lab, yang menjadi penentu sebenarnya untuk TB',
  'Menggantikan penilaian dokter yang sudah bertemu langsung dengan pasien',
];

/* ──────────────────────────── honest limits ──────────────────────────── */

export const LIMITS: { title: string; body: string }[] = [
  {
    title: 'Ada orang yang akan terlewat',
    body: 'Tuberkulosis tahap awal, dan TB pada orang dengan HIV, bisa sangat sulit terlihat di X-ray. Tools seperti ini akan meloloskan sebagian kasus nyata, makanya hasil negatif tidak pernah berarti aman.',
  },
  {
    title: 'Akan ada alarm palsu',
    body: 'Beberapa kondisi paru lain tampak mirip. Pada populasi umum, di mana TB jarang ditemukan, sebagian besar gambar yang ditandai tools seperti ini ternyata bukan TB. Itu biaya nyata bagi orang-orang tersebut: ongkos perjalanan, waktu, dan rasa cemas.',
  },
  {
    title: 'Kualitas gambar memengaruhi jawaban',
    body: 'Mesin yang berbeda, eksposur yang berbeda, pasien berdiri sedikit miring. Semuanya mengubah apa yang dilihat software, dan tidak satu pun terlihat di score yang dilaporkan.',
  },
  {
    title: 'Belum divalidasi di klinik sungguhan',
    body: 'Modelnya sudah ada dan benar-benar membaca gambarmu, tetapi belum diuji secara klinis. Tidak ada angka sensitivitas atau spesifisitas yang diukur atau diklaim di sini, dan risk point belum dikalibrasi terhadap populasi mana pun, jadi jangan anggap apa pun di sini sebagai bukti bahwa pendekatan ini berhasil.',
  },
];

/* ──────────────────────────── plain FAQ ──────────────────────────── */

export const FAQ: { question: string; answer: string; sourceId?: string }[] = [
  {
    question: 'Bisakah ini dipakai untuk mengetahui apakah saya menderita tuberkulosis?',
    answer:
      'Tidak. Ini prototipe, dan modelnya belum divalidasi secara klinis. Bahkan versi yang sudah diuji dengan benar pun hanya akan menyarankan bahwa seseorang perlu dites. Kalau kamu khawatir soal TB, temui tenaga kesehatan. Batuk terus-menerus lebih dari dua minggu, demam, keringat malam, dan berat badan turun tanpa sebab adalah alasan untuk periksa.',
  },
  {
    question: 'Sebenarnya score di demo itu artinya apa?',
    answer:
      'Model menghitung tiga score, satu untuk tiap kelas (sehat, sakit bukan TB, dan TB), langsung dari pikselmu gambar. File yang sama selalu menghasilkan angka yang sama. Risk point hanyalah score TB itu ditulis ulang pada skala 0 sampai 100. Itu ukuran seberapa mirip gambar dengan pola TB yang dipelajari model, bukan peluang seseorang menderita TB, dan belum dikalibrasi terhadap populasi mana pun.',
  },
  {
    question: 'Kenapa score tidak sama dengan persentase peluang?',
    answer:
      'Karena keduanya menjawab pertanyaan yang berbeda. Score menunjukkan seberapa yakin software membedakan satu kelompok gambar dari kelompok lain. Peluang seseorang menderita TB juga bergantung pada seberapa umum TB di tempat tinggalnya, gejalanya, dan riwayatnya. Score yang sama bisa berarti sangat berbeda di klinik TB dan di pemeriksaan kesehatan rutin di tempat kerja.',
  },
  {
    question: 'Apakah X-ray saya di-upload ke suatu tempat?',
    answer:
      'Tidak. Modelnya berjalan di browser-mu sendiri, jadi file yang kamu pilih dibaca dan dianalisis di perangkatmu dan tidak pernah dikirim ke server. Yang diunduh hanya file model (sekitar 6 MB) saat pertama kali dipakai. Tidak ada yang disimpan dan tidak ada yang keluar dari perangkatmu. Tetap saja, jangan pakai gambar yang memuat nama atau nomor pasien seseorang.',
  },
  {
    question: 'Lalu bagaimana tuberkulosis dikonfirmasi?',
    answer:
      'Dengan menguji keberadaan bakterinya, biasanya lewat tes molekuler cepat pada sampel dahak, kadang dengan kultur atau pemeriksaan sampel di bawah mikroskop. Dokter membaca hasilnya bersama gejala dan riwayat pasien. X-ray, entah dibaca manusia atau software, ada di tahap lebih awal dan hanya membantu menentukan siapa yang perlu dites.',
    sourceId: 'whoScreening2021',
  },
  {
    question: 'Kenapa hasilnya penuh peringatan, padahal modelnya sudah ada?',
    answer:
      'Karena cara hasil ditampilkan memengaruhi cara hasil itu dipakai. Tools screening yang hanya menampilkan angka mentah mengundang orang membacanya sebagai vonis. Modelnya sudah ada, tetapi belum divalidasi secara klinis dan tidak ada angka akurasi yang bisa diklaim, jadi setiap hasil membawa batasannya sendiri: risk point bukan peluang sakit, dan hasil negatif tidak pernah berarti aman.',
  },
];

/* ─────────────────────────── what exists today ─────────────────────────── */

export const BUILD_STATUS: { label: string; value: string; done: boolean }[] = [
  { label: 'Antarmuka screening', value: 'Sudah dibuat dan berfungsi', done: true },
  { label: 'Pengecekan dan preview gambar', value: 'Sudah dibuat dan berfungsi', done: true },
  { label: 'Format hasil dan peringatan', value: 'Sudah dibuat dan berfungsi', done: true },
  { label: 'Model terlatih', value: 'Sudah ada, berjalan di browser', done: true },
  { label: 'Risk point dan score per kelas', value: 'Sudah dibuat dan berfungsi', done: true },
  { label: 'Divalidasi secara klinis', value: 'Belum, dan tidak ada angka akurasi yang diklaim', done: false },
  { label: 'Diuji pada pasien sungguhan', value: 'Belum dilakukan', done: false },
  { label: 'Disetujui untuk penggunaan klinis', value: 'Belum, dan belum diajukan', done: false },
];
