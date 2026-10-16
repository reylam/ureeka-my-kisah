import { OUTPUT_GLOSSARY } from '@/trace/data/demoResults';
import { Callout } from '@/trace/components/ui/Callout';

/**
 * Three things that get treated as the same thing and are not: what the
 * software computed, how sure it claims to be, and what is actually wrong with
 * a person. The callout underneath is the point of the section.
 */
export function OutputGlossary() {
  return (
    <div>
      <dl className="grid gap-4 lg:grid-cols-3">
        {OUTPUT_GLOSSARY.map((entry, index) => (
          <div key={entry.term} className="rounded-2xl border border-trace-line bg-trace-card p-6">
            <dt>
              <span className="trace-label text-trace-dim">
                {String(index + 1).padStart(2, '0')}
              </span>
              <span className="mt-2.5 block text-[17px] font-medium text-trace-text">
                {entry.term}
              </span>
            </dt>
            <dd className="mt-3 text-[14px] leading-6 text-trace-muted">{entry.body}</dd>
          </div>
        ))}
      </dl>

      <Callout label="Kenapa ketiganya tidak sama" className="mt-8 max-w-3xl">
        Ketiganya bukan tiga tingkat kekuatan dari hal yang sama. Yang pertama adalah angka yang
        dihitung dari sebuah gambar. Yang kedua adalah klaim software sendiri tentang angka itu.
        Yang ketiga adalah kesimpulan tentang seseorang, ditarik lewat tes yang tidak bisa diakses
        software, oleh pihak yang bertanggung jawab kalau salah. Menganggap yang pertama sama
        dengan yang ketiga adalah kekeliruan yang justru ingin dicegah oleh seluruh situs ini.
      </Callout>
    </div>
  );
}
