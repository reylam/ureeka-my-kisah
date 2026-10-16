import { Container, SectionBand } from '@/trace/components/ui/Container';
import { SectionHeading } from '@/trace/components/ui/SectionHeading';
import { SourceCitation } from '@/trace/components/ui/SourceCitation';
import { Callout } from '@/trace/components/ui/Callout';
import { BURDEN_FACTS, WHY_POINTS } from '@/trace/data/content';

/**
 * Why any of this matters, in plain terms.
 *
 * Three figures, then three short paragraphs, each with its WHO source
 * underneath. Nothing here is our own measurement, and the citations are what
 * make that visible without a paragraph of hedging.
 */
export function WhyItMatters() {
  return (
    <SectionBand id="why" tone="raised" labelledBy="why-heading">
      <Container>
        <SectionHeading
          id="why-heading"
          index="01"
          eyebrow="Masalahnya"
          title="Penyakit yang bisa disembuhkan tapi tetap mematikan, terutama karena tidak ditemukan"
          standfirst="Tuberkulosis bisa diobati. Alasan ia tetap menjadi salah satu infeksi paling mematikan di dunia adalah jutaan penderitanya tidak pernah didiagnosis."
        />

        {/* Three figures */}
        <dl className="mt-11 grid gap-px overflow-hidden rounded-2xl border border-trace-line bg-trace-line sm:grid-cols-3">
          {BURDEN_FACTS.map((fact) => (
            <div key={fact.figure} className="bg-trace-card p-6">
              <dt>
                <span className="block text-[34px] leading-none font-semibold tracking-[-0.03em] text-trace-accent-soft">
                  {fact.figure}
                </span>
                <span className="trace-label mt-2.5 block text-trace-dim">{fact.unit}</span>
              </dt>
              <dd className="mt-4 text-[13.5px] leading-6 text-trace-muted">{fact.body}</dd>
            </div>
          ))}
        </dl>

        <p className="mt-4 text-xs text-trace-dim">
          Angka untuk 2024, dari World Health Organization. Daftar sumber lengkap ada di bagian
          bawah halaman ini.
        </p>

        {/* Three paragraphs */}
        <div className="mt-14 grid gap-10 lg:grid-cols-[1fr_1fr] lg:gap-16">
          <ol className="space-y-9">
            {WHY_POINTS.map((point, index) => (
              <li key={point.title} className="border-l border-trace-line pl-5 sm:pl-6">
                <p className="trace-label text-trace-dim">
                  {String(index + 1).padStart(2, '0')}
                </p>
                <h3 className="mt-2.5 text-[18px] leading-snug font-medium tracking-[-0.01em] text-trace-text">
                  {point.title}
                </h3>
                <p className="mt-2.5 text-[14.5px] leading-7 text-trace-muted">{point.body}</p>
                {point.sourceId ? (
                  <SourceCitation sourceId={point.sourceId} className="mt-3" />
                ) : null}
              </li>
            ))}
          </ol>

          <div className="lg:pt-4">
            <Callout label="Pembedaan yang mendasari semuanya">
              <strong>Screening</strong> memilah orang menjadi “layak dites” dan “untuk saat ini
              kemungkinan tidak”. <strong>Diagnosis</strong> menentukan apa yang sebenarnya terjadi
              pada satu orang, disertai keputusan pengobatan dan pihak yang bertanggung jawab
              atasnya. Software yang membaca gambar bisa membantu yang pertama. Ia tidak bisa
              melakukan yang kedua.
            </Callout>

            <Callout label="Jadi, untuk apa tools ini?" tone="quiet" className="mt-8">
              Tools seperti ini akan berada di paling depan antrean, membantu menentukan X-ray siapa
              yang perlu dilihat dokter lebih dulu dan siapa yang perlu dikirim untuk tes lab yang
              benar-benar mengonfirmasi tuberkulosis. Ia tidak akan pernah menjadi keputusan akhir
              untuk siapa pun.
            </Callout>
          </div>
        </div>
      </Container>
    </SectionBand>
  );
}
