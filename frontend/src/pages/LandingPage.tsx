import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Building2,
  CalendarClock,
  Check,
  CloudOff,
  FileSearch,
  FlaskConical,
  LayoutDashboard,
  Menu,
  ScanLine,
  ShieldAlert,
  Stethoscope,
  X,
} from 'lucide-react';
import { Logo, LogoMark } from '@/components/ui/Logo';
import { SampleRadiograph } from '@/components/screening/SampleRadiograph';
import { useAuthStore } from '@/stores/authStore';
import { cn } from '@/utils/cn';
import { PROVINCE } from '@/data/geography';

/**
 * Public overview page.
 *
 * Reachable at `/` without signing in, so a reviewer can understand what the
 * project is, what it deliberately does not do, and how the pieces fit together
 * before entering the application itself.
 *
 * Nothing here cites a statistic or a performance figure. The product has not
 * been evaluated against a real population, so there is nothing truthful to
 * quote, and inventing numbers for a landing page would undermine the rest.
 */

const NAV = [
  { href: '#features', label: 'Fitur' },
  { href: '#workflow', label: 'Alur kerja' },
  { href: '#scope', label: 'Cakupan' },
];

const FEATURES = [
  {
    icon: ScanLine,
    title: 'Record screening X-ray dada',
    body: 'Catat satu kunjungan lewat beberapa langkah terkelompok: pasien, tanda vital, gejala, radiograf. Gambar disimpan di perangkat dan dipreview secara lokal, tidak pernah di-upload.',
  },
  {
    icon: Stethoscope,
    title: 'Output diteruskan ke manusia',
    body: 'Output screening dianggap sebagai petunjuk untuk memeriksa lebih lanjut, bukan jawaban akhir. Setiap record masuk ke review queue dan perlu keputusan dari perawat atau dokter sebelum lanjut ke tahap berikutnya.',
  },
  {
    icon: FileSearch,
    title: 'Report yang bisa dijelaskan',
    body: 'Bandingkan radiograf asli dengan overlay area ilustratif, lengkap dengan score kelas dari model, keterbatasannya, catatan reviewer, dan layout siap cetak.',
  },
  {
    icon: Building2,
    title: 'Referral ke fasilitas yang tepat',
    body: 'Direktori fasilitas lengkap dengan layanan, estimasi perjalanan, dan seberapa lama data tiap entri tidak diperbarui. Tujuan difilter hanya ke tempat yang benar-benar menyediakan pemeriksaan yang diminta.',
  },
  {
    icon: CalendarClock,
    title: 'Tracker follow-up',
    body: 'Queue terlambat, jatuh tempo hari ini, dan mendatang dihitung dari tanggal sebenarnya. Catat percobaan kontak, jadwalkan ulang, selesaikan, atau tulis alasan pasien tidak berhasil dihubungi.',
  },
  {
    icon: CloudOff,
    title: 'Dirancang offline-first',
    body: 'Form, draf, dan perubahan record tetap jalan tanpa koneksi. Queue menunjukkan apa yang menunggu, apa yang gagal, dan apa yang konflik, dengan batasannya dijelaskan apa adanya.',
  },
];

const WORKFLOW = [
  {
    title: 'Screening',
    body: 'Kader atau petugas kesehatan komunitas mencatat gejala dan tanda vital, lalu melampirkan radiograf. Kalau tidak ada koneksi, record disimpan sebagai draf lokal.',
  },
  {
    title: 'Analisis',
    body: 'Record masuk ke analysis queue. Output berupa distribusi kelas plus area yang ditandai, dan diberi label jelas kalau belum ada model yang terhubung.',
  },
  {
    title: 'Review',
    body: 'Tenaga medis membuka gambar di viewer gelap, membandingkannya dengan overlay, lalu mencatat setuju atau tidak dan langkah selanjutnya.',
  },
  {
    title: 'Referral',
    body: 'Jika perlu pemeriksaan, referral dibuat ke fasilitas yang menyediakannya, lengkap dengan prioritas, tanggal janji temu, dan petugas yang ditugaskan.',
  },
  {
    title: 'Follow-up',
    body: 'Task follow-up memantau apakah pasien benar-benar datang, dengan percobaan kontak yang dicatat di record pasien.',
  },
];

const IN_SCOPE = [
  'Alur kerja lengkap di semua halaman, didukung API terautentikasi dan database Supabase',
  'Upload radiograf lokal dengan validasi tipe, ukuran, dan dimensi',
  'Status referral dan follow-up yang konsisten di setiap halaman',
  'Draf offline, sync queue, dan review konflik',
  'Report screening yang bisa dicetak',
  'Navigasi keyboard, fokus yang terlihat, dan warna status yang dipasangkan dengan ikon dan teks',
];

const OUT_OF_SCOPE = [
  'Belum ada model terlatih yang berjalan di build ini. Output screening berasal dari simulator yang diberi label',
  'Tidak ada backend, database server, atau authentication server. Proses masuk dicek di perangkat',
  'Tidak ada data pasien asli. Semua orang, fasilitas, kontak, dan hasil adalah rekaan',
  'Tidak ada informasi fasilitas yang terverifikasi. Jarak, jam buka, dan nomor telepon hanya ilustrasi',
  'Tidak ada pesan, pengingat, atau notifikasi yang dikirim ke siapa pun',
  'Tidak ada angka akurasi, sensitivitas, atau spesifisitas, karena belum ada evaluasi',
];

export function LandingPage() {
  const signedIn = useAuthStore((state) => Boolean(state.accountId));
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="min-h-dvh bg-cloud">
      {/* â”€â”€ Top bar â”€â”€ */}
      <header className="sticky top-0 z-40 border-b border-obsidian-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-4 px-4 sm:px-6">
          {/* This overview now lives at /platform; the root is the PULMO-TRACE
              research site, so the wordmark links back here rather than away. */}
          <Link to="/platform" className="shrink-0">
            <Logo tone="dark" />
          </Link>

          <nav aria-label="Bagian halaman" className="ml-4 hidden items-center gap-1 md:flex">
            {NAV.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="rounded-md px-2.5 py-1.5 text-[13px] font-medium text-obsidian-600 transition-colors hover:bg-obsidian-100 hover:text-obsidian-950"
              >
                {item.label}
              </a>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <Link
              to={signedIn ? '/dashboard' : '/login'}
              className="inline-flex h-8 items-center gap-2 rounded-md bg-obsidian-950 px-3 text-[13px] font-semibold text-white transition-colors hover:bg-obsidian-800"
            >
              {signedIn ? (
                <>
                  <LayoutDashboard aria-hidden className="size-4" />
                  Buka dashboard
                </>
              ) : (
                <>
                  Masuk
                  <ArrowRight aria-hidden className="size-4" />
                </>
              )}
            </Link>
            <button
              type="button"
              onClick={() => setMenuOpen((value) => !value)}
              aria-expanded={menuOpen}
              aria-label={menuOpen ? 'Tutup menu bagian' : 'Buka menu bagian'}
              className="inline-flex size-8 items-center justify-center rounded-md text-obsidian-600 transition-colors hover:bg-obsidian-100 hover:text-obsidian-950 md:hidden"
            >
              {menuOpen ? <X aria-hidden className="size-4" /> : <Menu aria-hidden className="size-4" />}
            </button>
          </div>
        </div>

        {menuOpen ? (
          <nav
            aria-label="Bagian halaman"
            className="border-t border-obsidian-200 px-4 py-2 md:hidden"
          >
            <ul>
              {NAV.map((item) => (
                <li key={item.href}>
                  <a
                    href={item.href}
                    onClick={() => setMenuOpen(false)}
                    className="block rounded-md px-2.5 py-2 text-[13px] font-medium text-obsidian-600 active:bg-obsidian-100"
                  >
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        ) : null}
      </header>

      {/* â”€â”€ Hero â”€â”€ */}
      <section className="relative overflow-hidden border-b border-obsidian-200 bg-ct-50">
        <div className="mx-auto grid w-full max-w-6xl gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:items-center lg:py-20">
          <div>
            <h1 className="max-w-xl text-3xl leading-[1.15] font-semibold text-obsidian-950 sm:text-4xl">
              Screening TB dan akses layanan kesehatan untuk tim kesehatan komunitas di daerah
              terpencil
            </h1>
            <p className="mt-4 max-w-xl text-sm leading-relaxed text-obsidian-600 sm:text-[15px]">
              Antarmuka kerja untuk seluruh alur screening: catat kunjungan X-ray dada, teruskan
              hasilnya ke tenaga medis, rujuk pasien ke fasilitas yang bisa memeriksanya, lalu
              pantau apakah pasien benar-benar sampai di sana. Dibuat supaya tetap jalan saat
              koneksi tidak ada.
            </p>

            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Link
                to={signedIn ? '/dashboard' : '/login'}
                className="inline-flex h-11 items-center gap-2 rounded-md bg-obsidian-950 px-5 text-sm font-semibold text-white transition-colors hover:bg-obsidian-800"
              >
                {signedIn ? 'Buka dashboard' : 'Masuk ke aplikasi'}
                <ArrowRight aria-hidden className="size-4" />
              </Link>
              <a
                href="#scope"
                className="inline-flex h-11 items-center gap-2 rounded-md border border-obsidian-300 px-5 text-sm font-medium text-obsidian-700 transition-colors hover:border-obsidian-400 hover:text-obsidian-950"
              >
                Apa yang belum ada di build ini
              </a>
            </div>

            <p className="mt-6 max-w-lg text-xs leading-relaxed text-obsidian-500">
              Software demonstrasi. Bukan alat medis, belum tervalidasi, dan tidak untuk penggunaan
              klinis. Dataset menggambarkan fasilitas fiktif di {PROVINCE}; semua pasien dan hasil
              di dalamnya adalah data sintetis.
            </p>
          </div>

          {/* Radiograph, framed as the product's subject matter */}
          <div className="relative">
            <div className="viewer-grid overflow-hidden rounded-card border border-obsidian-300">
              <div className="flex items-center justify-between border-b border-white/8 px-3 py-2 font-mono text-[10px] tracking-wide text-obsidian-500">
                <span>PA · UPRIGHT</span>
                <span className="text-ct-400">SAMPEL SINTETIS</span>
              </div>
              <div className="aspect-square">
                <SampleRadiograph variant="sample-a" showWatermark={false} />
              </div>
              <div className="border-t border-white/8 px-3 py-2.5">
                <p className="text-[11px] leading-relaxed text-obsidian-400">
                  Sampel radiograf di prototype ini digambar dengan SVG, bukan diambil dari dataset
                  pasien.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* â”€â”€ Safety statement â”€â”€ */}
      <section className="border-b border-obsidian-200 bg-white">
        <div className="mx-auto flex w-full max-w-6xl items-start gap-3 px-4 py-5 sm:px-6">
          <ShieldAlert aria-hidden className="mt-0.5 size-5 shrink-0 text-attention-700" />
          <div className="min-w-0">
            <h2 className="text-[13px] font-semibold text-obsidian-950">
              Screening, bukan diagnosis
            </h2>
            <p className="mt-1 max-w-3xl text-[13px] leading-relaxed text-obsidian-600">
              Alat screening membantu menyaring siapa yang perlu tes konfirmasi. Alat ini tidak
              bisa memastikan ada atau tidaknya TB, dan tidak ada hasil screening di produk ini yang
              pernah diberi label positif atau negatif untuk pasien. Output dijelaskan lewat
              tindakan yang diminta dari tenaga medis selanjutnya, dan tidak adanya peringatan tidak
              pernah ditampilkan sebagai hasil yang aman.
            </p>
          </div>
        </div>
      </section>

      {/* â”€â”€ Features â”€â”€ */}
      <section id="features" className="mx-auto w-full max-w-6xl scroll-mt-16 px-4 py-14 sm:px-6">
        <SectionHeading
          overline="Fitur"
          title="Lima kemampuan, satu register"
          body="Masing-masing ada karena alurnya putus di titik tertentu: gambar tidak pernah dibaca, referral tidak pernah dibuat, atau pasien tidak pernah ditemukan lagi."
        />

        <ul className="mt-8 grid gap-px overflow-hidden rounded-card border border-obsidian-200 bg-obsidian-200 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature) => {
            const Icon = feature.icon;
            return (
              <li key={feature.title} className="bg-white p-5">
                <span
                  aria-hidden
                  className="inline-flex size-9 items-center justify-center rounded-md bg-ct-100 text-ct-700"
                >
                  <Icon className="size-4" />
                </span>
                <h3 className="mt-3.5 text-sm font-semibold text-obsidian-950">{feature.title}</h3>
                <p className="mt-1.5 text-[13px] leading-relaxed text-obsidian-600">
                  {feature.body}
                </p>
              </li>
            );
          })}
        </ul>
      </section>

      {/* â”€â”€ Workflow â”€â”€ */}
      <section id="workflow" className="scroll-mt-16 border-y border-obsidian-200 bg-white">
        <div className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6">
          <SectionHeading
            overline="Alur kerja"
            title="Perjalanan sebuah record"
            body="Record yang sama terbawa lewat kelima tahap, jadi tidak ada yang diketik ulang dan timeline pasien terbaca sebagai satu cerita."
          />

          <ol className="mt-8 grid gap-6 md:grid-cols-5">
            {WORKFLOW.map((step, index) => (
              <li key={step.title} className="relative">
                <div className="flex items-center gap-2.5">
                  <span
                    aria-hidden
                    className="flex size-6 shrink-0 items-center justify-center rounded-full bg-obsidian-950 text-[11px] font-semibold text-white tabular"
                  >
                    {index + 1}
                  </span>
                  <h3 className="text-sm font-semibold text-obsidian-950">{step.title}</h3>
                </div>
                <p className="mt-2 text-[13px] leading-relaxed text-obsidian-600 md:pl-0">
                  {step.body}
                </p>
                {index < WORKFLOW.length - 1 ? (
                  <span
                    aria-hidden
                    className="absolute top-3 -right-3 hidden h-px w-6 bg-obsidian-200 md:block"
                  />
                ) : null}
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* â”€â”€ Scope â”€â”€ */}
      <section id="scope" className="mx-auto w-full max-w-6xl scroll-mt-16 px-4 py-14 sm:px-6">
        <SectionHeading
          overline="Cakupan"
          title="Mana yang nyata, mana yang bukan"
          body="Ini adalah build frontend. Menjelaskan batasnya dengan tepat lebih berguna daripada memberi kesan lebih dari yang sebenarnya ada."
        />

        <div className="mt-8 grid gap-4 lg:grid-cols-2">
          <ScopeList
            tone="in"
            title="Sudah ada di build ini"
            items={IN_SCOPE}
          />
          <ScopeList
            tone="out"
            title="Sengaja tidak disertakan"
            items={OUT_OF_SCOPE}
          />
        </div>
      </section>

      {/* â”€â”€ Closing call to action â”€â”€ */}
      <section className="border-t border-obsidian-200 bg-ct-50">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-start gap-5 px-4 py-12 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-obsidian-950">Buka aplikasi</h2>
            <p className="mt-1.5 max-w-xl text-[13px] leading-relaxed text-obsidian-600">
              Masuk untuk melihat record, referral, dan follow-up sesuai peranmu.
            </p>
          </div>
          <Link
            to={signedIn ? '/dashboard' : '/login'}
            className="inline-flex h-11 shrink-0 items-center gap-2 rounded-md bg-obsidian-950 px-5 text-sm font-semibold text-white transition-colors hover:bg-obsidian-800"
          >
            {signedIn ? 'Buka dashboard' : 'Masuk'}
            <ArrowRight aria-hidden className="size-4" />
          </Link>
        </div>
      </section>

      {/* â”€â”€ Footer â”€â”€ */}
      <footer className="border-t border-obsidian-200 bg-white">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-7 sm:px-6 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-3">
            <LogoMark className="size-7 shrink-0" />
            <div className="min-w-0">
              <p className="font-mono text-[12.5px] font-medium tracking-[0.11em] text-obsidian-950">
                PULMO-TRACE
              </p>
              <p className="mt-1 text-xs leading-relaxed text-obsidian-500">
                Alur screening dan referral untuk tim kesehatan komunitas.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[13px]">
            <Link
              to="/login"
              className="text-obsidian-600 transition-colors hover:text-obsidian-950"
            >
              Masuk
            </Link>
            <a
              href="#features"
              className="text-obsidian-600 transition-colors hover:text-obsidian-950"
            >
              Fitur
            </a>
            <a href="#scope" className="text-obsidian-600 transition-colors hover:text-obsidian-950">
              Cakupan
            </a>
            <span className="inline-flex items-center gap-1.5 text-obsidian-400">
              <FlaskConical aria-hidden className="size-3.5" />
              Build prototype
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}

/* â”€â”€ Local building blocks â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

function SectionHeading({
  overline,
  title,
  body,
}: {
  overline: string;
  title: string;
  body: string;
}) {
  return (
    <div className="max-w-2xl">
      <p className="text-[11px] font-semibold tracking-[0.08em] text-ct-700 uppercase">
        {overline}
      </p>
      <h2 className="mt-2 text-xl font-semibold text-obsidian-950 sm:text-2xl">{title}</h2>
      <p className="mt-3 text-[13px] leading-relaxed text-obsidian-600 sm:text-sm">{body}</p>
    </div>
  );
}

function ScopeList({
  tone,
  title,
  items,
}: {
  tone: 'in' | 'out';
  title: string;
  items: string[];
}) {
  return (
    <div
      className={cn(
        'rounded-card border bg-white p-5',
        tone === 'in' ? 'border-complete-300/70' : 'border-obsidian-200',
      )}
    >
      <h3 className="flex items-center gap-2 text-sm font-semibold text-obsidian-950">
        <span
          aria-hidden
          className={cn(
            'flex size-5 items-center justify-center rounded-full',
            tone === 'in'
              ? 'bg-complete-100 text-complete-800'
              : 'bg-obsidian-100 text-obsidian-500',
          )}
        >
          {tone === 'in' ? (
            <Check className="size-3" strokeWidth={3} />
          ) : (
            <X className="size-3" strokeWidth={3} />
          )}
        </span>
        {title}
      </h3>
      <ul className="mt-3.5 space-y-2.5">
        {items.map((item) => (
          <li key={item} className="flex items-start gap-2.5 text-[13px] leading-relaxed">
            <span
              aria-hidden
              className={cn(
                'mt-1.5 size-1.5 shrink-0 rounded-full',
                tone === 'in' ? 'bg-complete-500' : 'bg-obsidian-300',
              )}
            />
            <span className="text-obsidian-600">{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}


