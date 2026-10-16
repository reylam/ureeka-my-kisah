import { useEffect } from 'react';
import { ArrowRight, Phone, Play, Stethoscope } from 'lucide-react';
import { Container, SectionBand } from '@/trace/components/ui/Container';
import { Eyebrow, SectionHeading } from '@/trace/components/ui/SectionHeading';
import { TraceLinkButton } from '@/trace/components/ui/TraceButton';
import { Callout } from '@/trace/components/ui/Callout';
import { StepFlow } from '@/trace/components/ui/StepFlow';
import { DisclaimerBanner } from '@/trace/components/ui/DisclaimerBanner';
import { SourceList } from '@/trace/components/ui/SourceCitation';
import { Mascot } from '@/trace/components/visuals/Mascot';
import { FAQ, STEPS } from '@/trace/data/content';
import { SOURCE_LIST } from '@/trace/data/sources';

/**
 * How it works.
 *
 * The explaining page, still written for someone with no medical or machine
 * learning background. Analogies instead of terminology, and a question list
 * instead of a methods section. The depth that used to live on the site is in
 * `docs/research-notes.txt` now, where it belongs.
 */
export function TraceHowItWorks() {
  useEffect(() => {
    document.title = 'Cara kerja · PARUPINTAS';
  }, []);

  return (
    <>
      {/* Masthead */}
      <div className="relative overflow-hidden border-b border-trace-line">
        <div aria-hidden className="trace-grid trace-grid-mask absolute inset-0" />
        <Container className="relative py-14 sm:py-16">
          <Eyebrow>Cara kerja</Eyebrow>
          <h1 className="mt-5 max-w-3xl text-[32px] leading-[1.1] font-semibold tracking-[-0.03em] sm:text-[42px]">
            Apa yang sebenarnya terjadi di balik hasil screening
          </h1>
          <p className="mt-5 max-w-2xl text-[16px] leading-7 text-trace-muted">
            Tidak perlu latar belakang medis atau komputasi. Kalau kamu punya lima menit, halaman
            ini menjelaskan seluruh idenya, termasuk bagian yang belum dibuat dan bagian yang tidak
            akan pernah aman dipercaya begitu saja.
          </p>
        </Container>
      </div>

      {/* Pattern matching, in plain terms */}
      <SectionBand bordered={false} labelledBy="pattern-heading" className="pt-14">
        <Container>
          <div className="grid gap-10 lg:grid-cols-[1fr_1fr] lg:gap-16">
            <SectionHeading
              id="pattern-heading"
              index="01"
              eyebrow="Idenya"
              title="Software yang sudah melihat banyak X-ray"
            />

            <div className="space-y-5 text-[15px] leading-7 text-trace-muted">
              <p>
                Bayangkan seseorang yang selama dua puluh tahun kerjanya memilah foto. Tunjukkan
                foto baru, dan ia bisa langsung bilang foto itu masuk ke tumpukan yang mana. Ia
                tidak menalar jawabannya, ia mengenali sesuatu.
              </p>
              <p>
                Kurang lebih begitulah cara kerja software jenis ini. Ia diperlihatkan ribuan chest
                X-ray yang sudah diberi label oleh orang yang tahu jawabannya, lalu perlahan belajar
                susunan terang dan bayangan seperti apa yang cenderung berpasangan dengan label
                tertentu. Setelah itu, diberi X-ray baru, ia menghasilkan angka yang menunjukkan
                seberapa mirip gambar itu dengan yang berlabel tuberkulosis.
              </p>
              <p>
                Ada dua hal yang menyusul dari sini, dan keduanya lebih penting daripada hal lain
                di halaman ini. Software hanya tahu apa yang ada di tumpukan tempat ia belajar. Dan
                ia mengenali pola, yang tidak sama dengan memahami penyakit.
              </p>
            </div>
          </div>

          <Callout label="Kenapa poin kedua itu bukan soal teknis belaka" tone="caution" className="mt-12 max-w-3xl">
            Software seperti ini pernah beberapa kali ketahuan menangkap hal-hal yang tidak ada
            hubungannya dengan penyakit: penanda yang dipasang rumah sakit tertentu di sudut
            gambar, cara satu merek mesin memproses gambarnya, bahkan pinggiran gambar. Skornya
            bagus sekali saat diuji, lalu gagal total di tempat lain. Mengenali pola tidak sama
            dengan tahu apa arti pola itu.
          </Callout>
        </Container>
      </SectionBand>

      {/* The four steps again, with room to breathe */}
      <SectionBand tone="raised" labelledBy="steps-heading">
        <Container>
          <SectionHeading
            id="steps-heading"
            index="02"
            eyebrow="Alurnya"
            title="Dari X-ray ke langkah berikutnya"
            standfirst="Empat langkah yang sama seperti di beranda. Di sini layak dibaca pelan-pelan, karena catatan di bawahnya menjelaskan bagian mana yang sudah ada."
          />
          <div className="mt-11 rounded-2xl border border-trace-line bg-trace-card p-6 sm:p-8">
            <StepFlow steps={STEPS} />
          </div>

          <DisclaimerBanner
            tone="caution"
            title="Langkah tiga dan empat adalah celah yang kami akui di proyek ini."
            className="mt-6 max-w-3xl"
          >
            Langkah tiga butuh model terlatih, dan modelnya belum ada. Langkah empat menampilkan
            hasil placeholder agar formatnya bisa dinilai. Semua yang ditampilkan demo diberi label
            jelas sebagai placeholder, dan angka yang muncul berasal dari nama dan ukuran file,
            bukan dari gambarnya.
          </DisclaimerBanner>
        </Container>
      </SectionBand>

      {/* Score vs probability */}
      <SectionBand labelledBy="score-heading">
        <Container>
          <div className="grid gap-10 lg:grid-cols-[1fr_1fr] lg:gap-16">
            <SectionHeading
              id="score-heading"
              index="03"
              eyebrow="Angkanya"
              title="Kenapa score bukan “peluang terkena TB”"
            />

            <div className="space-y-5 text-[15px] leading-7 text-trace-muted">
              <p>
                Tools screening biasanya melaporkan angka antara 0 sampai 1. Memang menggoda untuk
                membaca 0.80 sebagai “peluang 80% orang ini menderita tuberkulosis”. Pembacaan itu
                salah, dan bedanya bukan sekadar teori.
              </p>
              <p>
                Score hanya menunjukkan seberapa kuat gambar ini menyerupai gambar yang dipelajari
                software untuk ditandai. Apakah seseorang benar-benar menderita TB juga bergantung
                pada seberapa umum TB di tempat tinggalnya, gejala yang dialaminya, dan riwayatnya.
                Angka 0.80 yang sama berarti sangat berbeda di klinik TB, di mana banyak pasien
                memang menderitanya, dan di pemeriksaan rutin di tempat kerja, di mana hampir tidak
                ada yang menderitanya.
              </p>
              <p>
                Itu sebabnya tools screening tidak bisa dirilis dengan satu cut-off tetap lalu
                dipakai di mana-mana. Cut-off adalah keputusan tentang kesalahan mana yang lebih
                rela kamu terima, dan keputusan itu milik pihak yang menjalankan klinik, bukan milik
                software.
              </p>
            </div>
          </div>

          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            <TradeoffCard
              title="Cut-off dibuat rendah"
              body="Hampir tidak ada penderita TB yang terlewat, tetapi banyak orang sehat ikut ditandai dan dikirim untuk tes yang sebenarnya tidak perlu."
            />
            <TradeoffCard
              title="Cut-off dibuat tinggi"
              body="Hampir semua yang ditandai memang perlu dites, tetapi lebih banyak penderita TB yang lolos tanpa terdeteksi."
            />
            <TradeoffCard
              title="Tidak ada pengaturan yang menghindari keduanya"
              body="Ke arah mana kamu condong bergantung pada seberapa mudah tes lanjutan dijangkau, dan seberapa besar akibat dari kasus yang terlewat di komunitas itu."
              tone="accent"
            />
          </div>
        </Container>
      </SectionBand>

      {/* Care pathway */}
      <SectionBand tone="raised" labelledBy="path-heading">
        <Container>
          <SectionHeading
            id="path-heading"
            index="04"
            eyebrow="Posisinya di mana"
            title="Screening, tes, pengobatan"
            standfirst="Tiga pekerjaan berbeda, dikerjakan orang yang berbeda, dalam urutan ini. Software hanya bisa membantu yang pertama."
          />

          <ol className="mt-11 grid gap-5 lg:grid-cols-3">
            {[
              {
                step: 'Pertama',
                title: 'Screening',
                body: 'Siapa yang perlu dites? Pertanyaan soal gejala dan chest X-ray. Cepat, murah, perkiraan kasar, dan satu-satunya tempat yang cocok untuk software jenis ini.',
                who: 'Tenaga kesehatan, atau software yang membantunya',
              },
              {
                step: 'Lalu',
                title: 'Tes',
                body: 'Apakah orang ini membawa bakterinya? Sampel dahak dibawa ke tes molekuler cepat, kultur, atau mikroskop. Inilah yang benar-benar mengonfirmasi tuberkulosis.',
                who: 'Laboratorium',
              },
              {
                step: 'Terakhir',
                title: 'Diagnosis dan pengobatan',
                body: 'Hasil tes dibaca bersama gejala dan riwayat, lalu dilanjutkan dengan pengobatan yang biasanya berlangsung berbulan-bulan dan harus dituntaskan.',
                who: 'Dokter, bersama pasien',
              },
            ].map((stage) => (
              <li
                key={stage.title}
                className="rounded-2xl border border-trace-line bg-trace-card p-6"
              >
                <p className="trace-label text-trace-dim">{stage.step}</p>
                <h3 className="mt-3 text-[19px] font-medium tracking-[-0.01em] text-trace-text">
                  {stage.title}
                </h3>
                <p className="mt-3 text-[14px] leading-6 text-trace-muted">{stage.body}</p>
                <p className="mt-4 flex items-center gap-2 border-t border-trace-line-soft pt-4 text-[12.5px] text-trace-dim">
                  <Stethoscope aria-hidden className="size-3.5 shrink-0" />
                  {stage.who}
                </p>
              </li>
            ))}
          </ol>
        </Container>
      </SectionBand>

      {/* FAQ */}
      <SectionBand labelledBy="faq-heading">
        <Container>
          <div className="flex flex-wrap items-end justify-between gap-6">
            <SectionHeading
              id="faq-heading"
              index="05"
              eyebrow="Pertanyaan"
              title="Hal-hal yang paling sering ditanyakan"
            />
            <Mascot size="md" className="hidden sm:flex" />
          </div>

          <dl className="mt-11 max-w-3xl divide-y divide-trace-line border-t border-trace-line">
            {FAQ.map((item) => (
              <div key={item.question} className="py-7">
                <dt className="text-[17px] leading-snug font-medium tracking-[-0.01em] text-trace-text">
                  {item.question}
                </dt>
                <dd className="mt-3 text-[14.5px] leading-7 text-trace-muted">{item.answer}</dd>
              </div>
            ))}
          </dl>
        </Container>
      </SectionBand>

      {/* If you are worried */}
      <SectionBand tone="raised" labelledBy="worried-heading">
        <Container width="narrow">
          <div className="rounded-2xl border border-trace-accent-edge bg-trace-accent-surface p-7 sm:p-9">
            <Phone aria-hidden className="size-5 text-trace-accent" />
            <h2
              id="worried-heading"
              className="mt-4 text-[22px] leading-snug font-medium tracking-[-0.015em]"
            >
              Kalau kamu khawatir soal tuberkulosis, jangan andalkan situs ini
            </h2>
            <p className="mt-4 text-[15px] leading-7 text-trace-muted">
              Temui tenaga kesehatan. Batuk yang berlangsung lebih dari dua minggu, demam, keringat
              malam, atau berat badan turun tanpa sebab adalah alasan untuk periksa. TB bisa
              disembuhkan, dan di banyak negara tes serta pengobatannya gratis. Tes sejak dini juga
              melindungi orang-orang di sekitarmu.
            </p>
            <p className="mt-4 text-[14px] leading-6 text-trace-dim">
              Tidak ada yang ada di situs ini yang bisa memberitahumu apakah kamu menderita
              tuberkulosis, dan situs ini memang tidak dimaksudkan untuk itu.
            </p>
          </div>

          <div className="mt-10 flex flex-wrap justify-center gap-3">
            <TraceLinkButton to="/demo">
              <Play aria-hidden className="size-4" />
              Buka demo screening
            </TraceLinkButton>
            <TraceLinkButton to="/" variant="secondary">
              Kembali ke ringkasan
              <ArrowRight aria-hidden className="size-4" />
            </TraceLinkButton>
          </div>
        </Container>
      </SectionBand>

      {/* Sources */}
      <SectionBand id="sources" labelledBy="sources-heading">
        <Container>
          <SectionHeading
            id="sources-heading"
            eyebrow="Sumber"
            title="Dari mana fakta-fakta di situs ini berasal"
            standfirst="Tiga dokumen World Health Organization. Tidak ada entri untuk studi tentang PARUPINTAS di sini, karena memang belum ada."
          />
          <SourceList sources={SOURCE_LIST} className="mt-10 max-w-3xl" />
        </Container>
      </SectionBand>
    </>
  );
}

function TradeoffCard({
  title,
  body,
  tone = 'plain',
}: {
  title: string;
  body: string;
  tone?: 'plain' | 'accent';
}) {
  return (
    <div
      className={
        tone === 'accent'
          ? 'rounded-2xl border border-trace-accent-edge bg-trace-accent-surface p-6'
          : 'rounded-2xl border border-trace-line bg-trace-card p-6'
      }
    >
      <h3 className="text-[15.5px] font-medium text-trace-text">{title}</h3>
      <p className="mt-2.5 text-[13.5px] leading-6 text-trace-muted">{body}</p>
    </div>
  );
}
