import { Check, X } from 'lucide-react';
import { Container, SectionBand } from '@/trace/components/ui/Container';
import { SectionHeading } from '@/trace/components/ui/SectionHeading';
import { Callout } from '@/trace/components/ui/Callout';
import { CANNOT_DO, CAN_DO } from '@/trace/data/content';
import { cn } from '@/utils/cn';

/**
 * What a result like this can and cannot tell you.
 *
 * The most important section on the site for a general reader, so it is the
 * plainest: two lists, side by side, no hedging. The ticks and crosses are
 * paired with an icon as well as a colour, and neither colour is green or red,
 * because a screening output is not a verdict of healthy or sick.
 */
export function CanAndCannot() {
  return (
    <SectionBand id="meaning" tone="raised" labelledBy="meaning-heading">
      <Container>
        <SectionHeading
          id="meaning-heading"
          index="03"
          eyebrow="Arti sebuah hasil"
          title="Apa yang bisa dan tidak bisa dikatakan tools seperti ini"
          standfirst="Layak dibaca sebelum mencoba demo, karena jarak antara dua daftar ini adalah titik di mana tools screening sering disalahgunakan."
        />

        <div className="mt-11 grid gap-5 lg:grid-cols-2">
          <List
            tone="can"
            title="Yang bisa dilakukan"
            items={CAN_DO}
            footnote="Ini hal-hal yang memang dikuasai tools screening yang dibangun dengan baik."
          />
          <List
            tone="cannot"
            title="Yang tidak bisa dilakukan"
            items={CANNOT_DO}
            footnote="Setinggi apa pun akurasinya, tidak ada item dari daftar kanan yang bisa pindah ke daftar kiri."
          />
        </div>

        <Callout label="Singkatnya" className="mt-11 max-w-3xl">
          Tanda berarti <strong>“perlu ada yang memeriksa ini dan menjalankan tes”</strong>. Tanpa
          tanda berarti <strong>“tidak ada yang menonjol di gambar ini”</strong>. Keduanya tidak
          berarti seseorang menderita, atau tidak menderita, tuberkulosis. Hanya tes lab dan dokter
          yang bisa sampai ke kesimpulan itu.
        </Callout>
      </Container>
    </SectionBand>
  );
}

function List({
  tone,
  title,
  items,
  footnote,
}: {
  tone: 'can' | 'cannot';
  title: string;
  items: string[];
  footnote: string;
}) {
  const can = tone === 'can';
  const Icon = can ? Check : X;

  return (
    <div
      className={cn(
        'flex flex-col rounded-2xl border p-6 sm:p-7',
        can
          ? 'border-trace-accent-edge bg-trace-accent-surface'
          : 'border-trace-flag-edge bg-trace-flag-surface',
      )}
    >
      <h3
        className={cn(
          'text-[18px] font-medium tracking-[-0.01em]',
          can ? 'text-trace-accent-soft' : 'text-trace-flag-soft',
        )}
      >
        {title}
      </h3>

      <ul className="mt-5 space-y-3.5">
        {items.map((item) => (
          <li key={item} className="flex gap-3 text-[15px] leading-6 text-trace-text">
            <Icon
              aria-hidden
              strokeWidth={2.5}
              className={cn(
                'mt-0.5 size-4 shrink-0',
                can ? 'text-trace-accent' : 'text-trace-flag',
              )}
            />
            {item}
          </li>
        ))}
      </ul>

      <p className="mt-auto pt-6 text-[12.5px] leading-5 text-trace-dim">{footnote}</p>
    </div>
  );
}
