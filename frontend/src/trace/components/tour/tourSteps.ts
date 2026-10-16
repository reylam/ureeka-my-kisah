/**
 * The patient walkthrough, step by step.
 *
 * It follows the patient's path through the public site: what the menu holds,
 * why there is no account, the request form, the status page, and then the
 * screening demo run end to end on a sample image. The visitor only presses
 * "Lanjut"; where a step needs a click on the page (load a sample, run the
 * model), the tour makes that click itself.
 *
 * `target` and `clickOnNext` name a `data-tour` attribute on the page. A
 * target that is missing or hidden (the desktop menu on a phone) falls back to
 * a centred card, so no step can strand the visitor.
 */

export interface TourStep {
  id: string;
  route: string;
  /** The `data-tour` value to spotlight. Omit for a centred card. */
  target?: string;
  title: string;
  body: string;
  /** How long to wait for the target to mount before giving up, in ms. */
  wait?: number;
  /** Shown on the card while waiting for the target. */
  waitingLabel?: string;
  /** Spotlighted while the target has not appeared yet. */
  waitSpot?: string;
  /** Clicked on the page when the visitor presses the forward button. */
  clickOnNext?: string;
  /** Label of the forward button, when it does more than move on. */
  nextLabel?: string;
  /** The closing step, which offers the visitor's own upload. */
  final?: boolean;
}

export const TOUR_STEPS: TourStep[] = [
  {
    id: 'welcome',
    route: '/',
    title: 'Panduan pasien PARUPINTAS',
    body: 'Panduan singkat ini menunjukkan alur pasien, dari mendaftar sampai mencoba demo screening chest X-ray. Kamu cukup menekan Lanjut, sisanya kami jalankan. Pasien tidak perlu membuat akun, login, atau register.',
  },
  {
    id: 'menu',
    route: '/',
    target: 'nav',
    title: 'Menu utama',
    body: 'Semua yang dibutuhkan pasien ada di sini. Cara kerja menjelaskan konsepnya, Demo untuk mencoba screening, Daftar untuk mendaftar periksa, dan Cek Hasil untuk melihat status pemeriksaanmu.',
  },
  {
    id: 'staff',
    route: '/',
    target: 'staff-login',
    title: 'Yang ini khusus petugas',
    body: 'Masuk petugas dipakai admin klinik dan dokter radiologi. Sebagai pasien kamu tidak perlu login atau register, jadi bagian ini boleh dilewati.',
  },
  {
    id: 'request',
    route: '/daftar',
    target: 'request-form',
    title: 'Langkah 1 · Daftar periksa',
    body: 'Isi data diri dan keluhanmu di formulir ini. Setelah dikirim, kamu menerima kode akses berformat XXXX-XXXX. Simpan kode itu: itulah tiket untuk melihat hasilmu.',
  },
  {
    id: 'status',
    route: '/hasil',
    target: 'status-form',
    title: 'Langkah 2 · Cek hasil',
    body: 'Masukkan kode akses di sini untuk melihat status pemeriksaan, hasil awal dari dokter radiologi, dan nomor antreanmu. Tetap tanpa akun.',
  },
  {
    id: 'demo',
    route: '/demo',
    target: 'demo-disclaimers',
    title: 'Langkah 3 · Coba demo screening',
    body: 'Sebelum mencoba, perhatikan dua catatan ini: hasil demo bukan diagnosis, dan gambar dibaca langsung di browser-mu tanpa di-upload ke server.',
  },
  {
    id: 'sample',
    route: '/demo',
    target: 'demo-sample',
    title: 'Tidak punya X-ray? Pakai contoh',
    body: 'Kita mulai dengan contoh chest X-ray yang disertakan di situs ini. Tekan tombol di bawah dan kami pilihkan satu gambar secara acak.',
    clickOnNext: 'demo-sample',
    nextLabel: 'Pakai contoh gambar',
  },
  {
    id: 'preview',
    route: '/demo',
    target: 'demo-preview',
    title: 'Gambar sudah dimuat',
    body: 'Contoh gambar sudah lolos pengecekan format dan ukuran, persis seperti file milikmu nanti. Berikutnya, model membaca gambar ini langsung di perangkatmu.',
    wait: 15_000,
    waitingLabel: 'Memuat contoh gambar…',
    clickOnNext: 'demo-run',
    nextLabel: 'Periksa X-ray ini',
  },
  {
    id: 'result',
    route: '/demo',
    target: 'demo-result',
    title: 'Ini hasil screening-nya',
    body: 'Panel ini menunjukkan score, risk point, dan area yang diperhatikan model. Ingat: ini penanda untuk ditinjau tenaga kesehatan, bukan diagnosis.',
    wait: 120_000,
    waitSpot: 'demo-status',
    waitingLabel: 'Model sedang membaca gambar…',
  },
  {
    id: 'glossary',
    route: '/demo',
    target: 'demo-glossary',
    title: 'Cara membaca output',
    body: 'Score bukan peluang dalam persen. Bagian ini menjelaskan arti tiap istilah supaya hasilnya tidak disalahpahami.',
  },
  {
    id: 'upload',
    route: '/demo',
    target: 'demo-upload',
    title: 'Sekarang coba X-ray milikmu',
    body: 'Punya file chest X-ray tampak depan (JPG atau PNG)? Upload di sini untuk dibaca dengan cara yang sama. Kalau ingin diperiksa dokter radiologi, lanjutkan dengan Daftar periksa.',
    final: true,
  },
];
