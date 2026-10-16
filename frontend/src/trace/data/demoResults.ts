/**
 * Stand-in results for the demo.
 *
 * No model runs in this build, so the demo cannot produce a real answer. What
 * it does instead is pick one of the outcomes below from a hash of the chosen
 * file's name, size and modification time. That makes the demo:
 *
 *   - repeatable: the same file always gives the same outcome, so a demo can
 *     be rehearsed and anyone can reproduce what they saw;
 *   - plainly not a prediction: the outcome depends on file details, which
 *     have nothing to do with the picture, and the result panel says so.
 *
 * The cut-off is 0.35 rather than 0.5, because a screening tool is normally
 * tuned to catch more cases at the cost of more false alarms.
 */

export const DEMO_THRESHOLD = 0.35;

export interface DemoScenario {
  id: string;
  /** Above or below DEMO_THRESHOLD. The category is worked out, never stored. */
  score: number;
  /** The line shown under the explanation for this particular outcome. */
  note: string;
}

/**
 * Note what a scenario does not carry: no boxes, no circles, no heatmap.
 * Drawing any of those on a visitor's own X-ray would read as a real finding
 * no matter what the caption underneath said, so the demo does not draw them.
 */
export const DEMO_SCENARIOS: DemoScenario[] = [
  {
    id: 'low',
    score: 0.08,
    note: 'Score rendah pun tidak berarti seseorang aman. Chest X-ray bisa melewatkan kasus, terutama tuberkulosis tahap awal dan TB pada orang dengan HIV.',
  },
  {
    id: 'low-mid',
    score: 0.24,
    note: 'Di bawah cut-off, tapi selisihnya tipis. Kalau cut-off diturunkan sedikit, gambar yang sama ini akan ditandai, makanya cut-off harus ditampilkan bersama jawabannya.',
  },
  {
    id: 'borderline',
    score: 0.37,
    note: 'Hanya sedikit di atas cut-off. Hasil sedekat ini dengan garis batas hampir tidak membawa informasi apa pun, dan score 0.37 tidak berarti "kemungkinan 37%".',
  },
  {
    id: 'mid',
    score: 0.58,
    note: 'Di atas cut-off. Pada populasi umum, di mana tuberkulosis jarang ditemukan, sebagian besar gambar yang ditandai seperti ini ternyata bukan TB sama sekali.',
  },
  {
    id: 'high',
    score: 0.86,
    note: 'Score tinggi. Ini tetap tidak berarti seseorang menderita tuberkulosis. Hal itu ditentukan lewat tes laboratorium, bukan lewat gambar.',
  },
];

/** Deterministic, order-independent 32-bit hash of a short string. */
export function hashString(input: string): number {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/** Pick the outcome for a file. Same file in, same outcome out. */
export function scenarioForKey(key: string): DemoScenario {
  const scenario = DEMO_SCENARIOS[hashString(key) % DEMO_SCENARIOS.length];
  // The modulo cannot exceed the array bounds, but the index signature does
  // not know that and the project compiles with strict checks on.
  return scenario ?? DEMO_SCENARIOS[0]!;
}

/* ─────────────────── fixed copy for the result panel ─────────────────── */

export const RESULT_DISCLOSURES = {
  panelLabel: 'Contoh hasil · bukan temuan medis',
  modelStatus: 'Belum ada model terlatih yang terhubung ke build ini.',
  scoreLabel: 'Contoh score',
  scoreCaution:
    'Ini angka placeholder pada skala 0 sampai 1. Angka ini bukan peluang seseorang menderita tuberkulosis. Mengubah score menjadi peluang sakit yang sebenarnya butuh model yang sudah diuji dan pengetahuan tentang seberapa umum TB di populasi tersebut, dan keduanya belum ada di sini.',
  interpretation:
    'Yang kamu lihat ini adalah gambaran bagaimana hasil screening akan ditampilkan. Ini respons placeholder terhadap file yang kamu pilih, dan tidak menunjukkan apa pun tentang ada atau tidaknya tuberkulosis.',
  limitations: [
    'Tools sungguhan akan melewatkan sebagian orang. Tuberkulosis tahap awal, dan TB pada orang dengan HIV, bisa sangat sulit terlihat di X-ray.',
    'Tools sungguhan akan memicu alarm palsu. Pneumonia, bekas luka lama, dan kondisi paru lain bisa tampak mirip.',
    'Kualitas gambar memengaruhi jawaban. Eksposur, posisi, dan mesin yang dipakai semuanya mengubah apa yang dilihat software.',
    'Score bukan risiko. Tanpa pengujian yang layak, score tidak bisa dibaca sebagai persentase peluang sakit.',
  ],
  nextStep:
    'Kalau tuberkulosis memang jadi kekhawatiran nyata bagi seseorang, langkah berikutnya adalah menemui tenaga kesehatan. Diagnosis berasal dari penilaian klinis bersama tes laboratorium pada sampel dahak, tidak pernah dari gambar semata.',
} as const;

/* ───────────────────────── output glossary copy ───────────────────────── */

export const OUTPUT_GLOSSARY: { term: string; body: string }[] = [
  {
    term: 'Yang dihitung software',
    body: 'Sebuah angka yang dihitung dari piksel, beserta kategori tempat angka itu jatuh setelah cut-off diterapkan. Ini menggambarkan software, bukan orangnya. Geser cut-off dan kategorinya berubah, sementara gambarnya tidak.',
  },
  {
    term: 'Seberapa yakin klaimnya',
    body: 'Angka tinggi tidak sama dengan benar. Software bisa yakin tapi salah, dan sebuah angka baru jadi ukuran keyakinan yang bisa dipercaya setelah diuji pada kasus yang jawaban sebenarnya sudah diketahui.',
  },
  {
    term: 'Apa yang sebenarnya terjadi',
    body: 'Kesimpulan tentang satu orang pada satu waktu, yang ditarik dokter dari gejala, riwayat, imaging, dan tes laboratorium. Kesimpulan ini membawa keputusan pengobatan dan ada pihak yang bertanggung jawab atasnya. Tidak ada software yang menghasilkan hal seperti ini.',
  },
];
