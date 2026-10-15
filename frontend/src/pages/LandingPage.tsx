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
  { href: '#features', label: 'Features' },
  { href: '#workflow', label: 'Workflow' },
  { href: '#scope', label: 'Scope' },
  { href: '#stack', label: 'Stack' },
];

const FEATURES = [
  {
    icon: ScanLine,
    title: 'Chest X-ray screening record',
    body: 'Capture an encounter in grouped steps: patient, vitals, symptoms, radiograph. The image is held on the device and previewed locally, never uploaded.',
  },
  {
    icon: Stethoscope,
    title: 'Output routed to a human',
    body: 'Screening output is treated as a prompt to look, not an answer. Every record lands in a review queue and needs a nurse or physician to record a decision before it moves on.',
  },
  {
    icon: FileSearch,
    title: 'Explainable report',
    body: 'Compare the original radiograph against an illustrative region overlay, with the model’s class scores, its limitations, the reviewer’s note and a print layout.',
  },
  {
    icon: Building2,
    title: 'Referral to the right facility',
    body: 'A sample facility directory with services, travel estimates and how stale each entry is. Destinations are filtered to places that actually offer the test being requested.',
  },
  {
    icon: CalendarClock,
    title: 'Follow-up tracker',
    body: 'Overdue, due today and upcoming queues computed from real dates. Log contact attempts, reschedule, complete, or record why a patient could not be reached.',
  },
  {
    icon: CloudOff,
    title: 'Offline-first behaviour',
    body: 'Forms, drafts and record edits keep working without a connection. A queue shows what is pending, what failed and what conflicts, with the limits stated plainly.',
  },
];

const WORKFLOW = [
  {
    title: 'Screen',
    body: 'A community health worker records symptoms and vitals and attaches the radiograph. If there is no connection the record is saved as a local draft.',
  },
  {
    title: 'Analyse',
    body: 'The record enters the analysis queue. Output is a class distribution plus any marked regions, always labelled as simulated in this build.',
  },
  {
    title: 'Review',
    body: 'A clinician opens the image in a dark viewer, compares it against the overlay, and records whether they agree and what should happen next.',
  },
  {
    title: 'Refer',
    body: 'If testing is needed, a referral is raised against a facility that offers it, with priority, appointment date and an assigned worker.',
  },
  {
    title: 'Follow up',
    body: 'A follow-up task tracks whether the patient actually attended, with contact attempts logged against the patient record.',
  },
];

const IN_SCOPE = [
  'Complete frontend workflow across all screens, backed by one relational demo dataset',
  'Local radiograph upload with type, size and dimension validation',
  'Referral and follow-up state that stays consistent across every page',
  'Offline drafts, a synchronisation queue and conflict review',
  'Printable screening report',
  'Keyboard navigation, visible focus, and status colour paired with icon and text',
];

const OUT_OF_SCOPE = [
  'No trained model runs in this build. Screening output comes from a labelled simulator',
  'No backend, database server or authentication server. Sign-in is checked on the device',
  'No real patient data. Every person, facility, contact detail and result is invented',
  'No verified facility information. Distances, hours and phone numbers are illustrative',
  'No messages, reminders or notifications are sent to anyone',
  'No accuracy, sensitivity or specificity figures, because nothing has been evaluated',
];

export function LandingPage() {
  const signedIn = useAuthStore((state) => Boolean(state.userId));
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="min-h-dvh bg-cloud">
      {/* ── Top bar ── */}
      <header className="sticky top-0 z-40 border-b border-white/5 bg-obsidian-950/95 backdrop-blur">
        <div className="on-dark mx-auto flex h-14 w-full max-w-6xl items-center gap-4 px-4 sm:px-6">
          {/* This overview now lives at /platform; the root is the PULMO-TRACE
              research site, so the wordmark links back here rather than away. */}
          <Link to="/platform" className="shrink-0">
            <Logo tone="light" />
          </Link>

          <nav aria-label="Page sections" className="ml-4 hidden items-center gap-1 md:flex">
            {NAV.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="rounded-md px-2.5 py-1.5 text-[13px] font-medium text-obsidian-300 transition-colors hover:bg-white/[0.06] hover:text-white"
              >
                {item.label}
              </a>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <Link
              to={signedIn ? '/dashboard' : '/login'}
              className="inline-flex h-8 items-center gap-2 rounded-md bg-ct-400 px-3 text-[13px] font-semibold text-obsidian-950 transition-colors hover:bg-ct-300"
            >
              {signedIn ? (
                <>
                  <LayoutDashboard aria-hidden className="size-4" />
                  Open dashboard
                </>
              ) : (
                <>
                  Sign in
                  <ArrowRight aria-hidden className="size-4" />
                </>
              )}
            </Link>
            <button
              type="button"
              onClick={() => setMenuOpen((value) => !value)}
              aria-expanded={menuOpen}
              aria-label={menuOpen ? 'Close section menu' : 'Open section menu'}
              className="inline-flex size-8 items-center justify-center rounded-md text-obsidian-300 transition-colors hover:bg-white/[0.06] hover:text-white md:hidden"
            >
              {menuOpen ? <X aria-hidden className="size-4" /> : <Menu aria-hidden className="size-4" />}
            </button>
          </div>
        </div>

        {menuOpen ? (
          <nav
            aria-label="Page sections"
            className="on-dark border-t border-white/5 px-4 py-2 md:hidden"
          >
            <ul>
              {NAV.map((item) => (
                <li key={item.href}>
                  <a
                    href={item.href}
                    onClick={() => setMenuOpen(false)}
                    className="block rounded-md px-2.5 py-2 text-[13px] font-medium text-obsidian-300 active:bg-white/[0.06]"
                  >
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        ) : null}
      </header>

      {/* ── Hero ── */}
      <section className="on-dark relative overflow-hidden bg-obsidian-950">
        <div className="mx-auto grid w-full max-w-6xl gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:items-center lg:py-20">
          <div>
            <h1 className="max-w-xl text-3xl leading-[1.15] font-semibold text-white sm:text-4xl">
              TB screening and healthcare access for remote community health teams
            </h1>
            <p className="mt-4 max-w-xl text-sm leading-relaxed text-obsidian-300 sm:text-[15px]">
              A working interface for the whole screening pathway: record a chest X-ray encounter,
              route the result to a clinician, refer the patient to a facility that can test them,
              and track whether they actually got there. Built to keep functioning when the
              connection does not.
            </p>

            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Link
                to={signedIn ? '/dashboard' : '/login'}
                className="inline-flex h-11 items-center gap-2 rounded-md bg-ct-400 px-5 text-sm font-semibold text-obsidian-950 transition-colors hover:bg-ct-300"
              >
                {signedIn ? 'Open dashboard' : 'Enter the application'}
                <ArrowRight aria-hidden className="size-4" />
              </Link>
              <a
                href="#scope"
                className="inline-flex h-11 items-center gap-2 rounded-md border border-white/15 px-5 text-sm font-medium text-obsidian-200 transition-colors hover:border-white/25 hover:text-white"
              >
                What this build does not do
              </a>
            </div>

            <p className="mt-6 max-w-lg text-xs leading-relaxed text-obsidian-500">
              Demonstration software. Not a medical device, not validated, and not for clinical use.
              The dataset describes a fictional facility in {PROVINCE}; every patient and result in
              it is synthetic.
            </p>
          </div>

          {/* Radiograph, framed as the product's subject matter */}
          <div className="relative">
            <div className="viewer-grid overflow-hidden rounded-card border border-white/10">
              <div className="flex items-center justify-between border-b border-white/8 px-3 py-2 font-mono text-[10px] tracking-wide text-obsidian-500">
                <span>PA · UPRIGHT</span>
                <span className="text-ct-400">SYNTHETIC SAMPLE</span>
              </div>
              <div className="aspect-square">
                <SampleRadiograph variant="sample-a" showWatermark={false} />
              </div>
              <div className="border-t border-white/8 px-3 py-2.5">
                <p className="text-[11px] leading-relaxed text-obsidian-400">
                  Sample radiographs in this prototype are drawn in SVG rather than taken from a
                  patient dataset.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Safety statement ── */}
      <section className="border-b border-obsidian-200 bg-white">
        <div className="mx-auto flex w-full max-w-6xl items-start gap-3 px-4 py-5 sm:px-6">
          <ShieldAlert aria-hidden className="mt-0.5 size-5 shrink-0 text-attention-700" />
          <div className="min-w-0">
            <h2 className="text-[13px] font-semibold text-obsidian-950">
              Screening, not diagnosis
            </h2>
            <p className="mt-1 max-w-3xl text-[13px] leading-relaxed text-obsidian-600">
              A screening tool narrows down who needs a confirmatory test. It cannot rule TB in or
              out, and no screen in this product is ever labelled positive or negative for a
              patient. Outputs are described by what they ask a clinician to do next, and the
              absence of an alert is never presented as a clean result.
            </p>
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section id="features" className="mx-auto w-full max-w-6xl scroll-mt-16 px-4 py-14 sm:px-6">
        <SectionHeading
          overline="Features"
          title="Five capabilities, one register"
          body="Each one exists because the pathway breaks somewhere specific: the image never gets read, the referral never gets made, or the patient is never found again."
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

      {/* ── Workflow ── */}
      <section id="workflow" className="scroll-mt-16 border-y border-obsidian-200 bg-white">
        <div className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6">
          <SectionHeading
            overline="Workflow"
            title="How a record moves"
            body="The same record carries through all five stages, so nothing is retyped and the patient timeline reads as one story."
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

      {/* ── Scope ── */}
      <section id="scope" className="mx-auto w-full max-w-6xl scroll-mt-16 px-4 py-14 sm:px-6">
        <SectionHeading
          overline="Scope"
          title="What is real here, and what is not"
          body="This is a frontend build. Being precise about the boundary is more useful than implying more than exists."
        />

        <div className="mt-8 grid gap-4 lg:grid-cols-2">
          <ScopeList
            tone="in"
            title="Implemented in this build"
            items={IN_SCOPE}
          />
          <ScopeList
            tone="out"
            title="Deliberately not included"
            items={OUT_OF_SCOPE}
          />
        </div>
      </section>

      {/* ── Stack ── */}
      <section id="stack" className="scroll-mt-16 border-t border-obsidian-200 bg-white">
        <div className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6">
          <SectionHeading
            overline="Stack"
            title="Built to be replaced from the seams"
            body="The data layer sits behind one async service module, and the screening call already returns the exact response shape a real inference service would send."
          />

          <div className="mt-8 grid gap-4 md:grid-cols-3">
            <StackCard
              title="Interface"
              items={['React + TypeScript', 'Vite', 'Tailwind CSS', 'React Router', 'Framer Motion']}
            />
            <StackCard
              title="State and storage"
              items={[
                'Zustand with local persistence',
                'IndexedDB for radiographs',
                'Service worker for the app shell',
                'One typed, relational demo dataset',
              ]}
            />
            <StackCard
              title="Integration points"
              items={[
                'Async mock service layer per entity',
                'Inference contract mirrored from the Python service',
                'Class labels and lesion boxes already modelled',
                'No fabricated endpoints',
              ]}
            />
          </div>

          <div className="mt-6 rounded-card border border-obsidian-200 bg-obsidian-50 p-5">
            <h3 className="text-[13px] font-semibold text-obsidian-950">
              Connecting a real model later
            </h3>
            <p className="mt-1.5 max-w-3xl text-[13px] leading-relaxed text-obsidian-600">
              The screening service returns a classification across three labels plus optional
              lesion boxes, matching the training project that accompanies this prototype. Pointing
              it at a real endpoint means replacing one transport function; the components, stores
              and report layout stay as they are.
            </p>
          </div>
        </div>
      </section>

      {/* ── Closing call to action ── */}
      <section className="on-dark bg-obsidian-950">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-start gap-5 px-4 py-12 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-white">Open the application</h2>
            <p className="mt-1.5 max-w-xl text-[13px] leading-relaxed text-obsidian-300">
              The dataset is seeded so there is work waiting: records needing review, referrals in
              progress, overdue follow-ups and a few drafts stuck offline.
            </p>
          </div>
          <Link
            to={signedIn ? '/dashboard' : '/login'}
            className="inline-flex h-11 shrink-0 items-center gap-2 rounded-md bg-ct-400 px-5 text-sm font-semibold text-obsidian-950 transition-colors hover:bg-ct-300"
          >
            {signedIn ? 'Open dashboard' : 'Sign in'}
            <ArrowRight aria-hidden className="size-4" />
          </Link>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-obsidian-200 bg-white">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-7 sm:px-6 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-3">
            <LogoMark className="size-7 shrink-0" />
            <div className="min-w-0">
              <p className="text-[13px] font-semibold text-obsidian-950">Sentra TB</p>
              <p className="mt-0.5 text-xs leading-relaxed text-obsidian-500">
                Screening and healthcare access prototype. Synthetic data only.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[13px]">
            <Link
              to="/login"
              className="text-obsidian-600 transition-colors hover:text-obsidian-950"
            >
              Sign in
            </Link>
            <a
              href="#features"
              className="text-obsidian-600 transition-colors hover:text-obsidian-950"
            >
              Features
            </a>
            <a href="#scope" className="text-obsidian-600 transition-colors hover:text-obsidian-950">
              Scope
            </a>
            <span className="inline-flex items-center gap-1.5 text-obsidian-400">
              <FlaskConical aria-hidden className="size-3.5" />
              Prototype build
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}

/* ── Local building blocks ─────────────────────────────────────────────────── */

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

function StackCard({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-card border border-obsidian-200 bg-white p-5">
      <h3 className="text-[11px] font-semibold tracking-wide text-obsidian-500 uppercase">
        {title}
      </h3>
      <ul className="mt-3 space-y-2">
        {items.map((item) => (
          <li
            key={item}
            className="flex items-start gap-2.5 text-[13px] leading-relaxed text-obsidian-700"
          >
            <span aria-hidden className="mt-1.5 size-1.5 shrink-0 rounded-full bg-ct-400" />
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
