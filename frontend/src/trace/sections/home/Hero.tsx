import { ArrowRight, Play } from 'lucide-react';
import { Container } from '@/trace/components/ui/Container';
import { Eyebrow } from '@/trace/components/ui/SectionHeading';
import { TraceLinkButton } from '@/trace/components/ui/TraceButton';
import { RadiographFigure } from '@/trace/components/visuals/RadiographFigure';

/**
 * Hero.
 *
 * Two columns: the claim on the left, an instrument on the right. The figure
 * is a drawn chest X-ray, and its overlay is labelled as a hand-drawn marking
 * because nothing has analysed it. That label is the difference between a
 * technical illustration and a fabricated detection.
 *
 * The one entrance animation is a CSS class, not a motion component. A single
 * fade is not worth putting an animation library in the first chunk the site
 * loads, and the reduced-motion rule in the base layer already switches CSS
 * animation off for anyone who asked for that.
 */
export function Hero() {
  return (
    <section className="relative overflow-hidden border-b border-trace-line">
      <div aria-hidden className="trace-grid trace-grid-mask absolute inset-0" />

      <Container className="relative py-16 sm:py-20 lg:py-28">
        <div className="grid items-center gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16">
          <div className="trace-rise">
            <Eyebrow>Screening TB berbantuan AI · Prototipe riset</Eyebrow>

            <h1 className="mt-5 max-w-xl text-[36px] leading-[1.06] font-semibold tracking-[-0.03em] sm:text-[46px] lg:text-[54px]">
              See beyond
              <br />
              the scan.
            </h1>

            <p className="mt-6 max-w-lg text-[16px] leading-7 text-trace-muted">
              Tuberculosis sering sudah terlihat di chest X-ray sebelum ada yang yakin soal itu.
              PULMO-TRACE mengeksplorasi bagaimana software bisa membantu menandai tanda-tanda
              tersebut lebih awal, dan dibuat untuk jujur soal apa arti dan bukan arti sebuah
              hasil.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <TraceLinkButton to="/demo">
                <Play aria-hidden className="size-4" />
                Coba demo screening
              </TraceLinkButton>
              <TraceLinkButton to="/how-it-works" variant="secondary">
                Cara kerja
                <ArrowRight aria-hidden className="size-4" />
              </TraceLinkButton>
            </div>

          </div>

          <RadiographFigure
            variant="sample-a"
            annotations={[
              { label: 'zona atas', x: 0.33, y: 0.3, r: 0.1 },
              { label: 'zona tengah', x: 0.63, y: 0.42, r: 0.08 },
            ]}
            annotationLabel="Digambar manual, bukan oleh model"
            metadata={[
              { label: 'Tampilan', value: 'Tampak depan' },
              { label: 'Gambar', value: 'Ilustrasi' },
              { label: 'Dianalisis', value: 'Tidak' },
            ]}
            caption="Chest X-ray yang digambar lewat kode, supaya tidak ada gambar pasien sungguhan yang dipakai sebagai hiasan. Lingkaran menandai area yang biasanya dijelaskan dokter. Tidak ada yang memeriksa gambar ini."
          />
        </div>
      </Container>
    </section>
  );
}
