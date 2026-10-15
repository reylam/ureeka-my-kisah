import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, CornerDownLeft, Search, Send, User } from 'lucide-react';
import { cn } from '@/utils/cn';
import { useDataStore } from '@/stores/dataStore';
import { facilities } from '@/data/facilities';
import { ageFromBirthDate } from '@/utils/date';
import { controlClasses } from '@/components/forms/Field';

/**
 * Global search.
 *
 * Searches patients (name / record number), referrals (code) and facilities,
 * because those are the three things a health worker actually looks up by name
 * mid-task. Results are keyboard-navigable; Enter opens the highlighted row.
 */

interface Result {
  id: string;
  kind: 'patient' | 'referral' | 'facility';
  title: string;
  subtitle: string;
  to: string;
}

const MAX_PER_GROUP = 4;

export function GlobalSearch({ className }: { className?: string }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const patients = useDataStore((state) => state.patients);
  const referrals = useDataStore((state) => state.referrals);

  const results = useMemo<Result[]>(() => {
    const term = query.trim().toLowerCase();
    if (term.length < 2) return [];

    const patientHits: Result[] = patients
      .filter(
        (patient) =>
          patient.name.toLowerCase().includes(term) || patient.mrn.toLowerCase().includes(term),
      )
      .slice(0, MAX_PER_GROUP)
      .map((patient) => ({
        id: patient.id,
        kind: 'patient',
        title: patient.name,
        subtitle: `${patient.mrn} · ${ageFromBirthDate(patient.birthDate)} yrs · ${patient.village}`,
        to: `/patients/${patient.id}`,
      }));

    const referralHits: Result[] = referrals
      .filter((referral) => referral.code.toLowerCase().includes(term))
      .slice(0, MAX_PER_GROUP)
      .map((referral) => {
        const patient = patients.find((p) => p.id === referral.patientId);
        return {
          id: referral.id,
          kind: 'referral',
          title: referral.code,
          subtitle: patient ? `${patient.name} · ${patient.mrn}` : 'Referral',
          to: `/referrals?focus=${referral.id}`,
        };
      });

    const facilityHits: Result[] = facilities
      .filter(
        (facility) =>
          facility.name.toLowerCase().includes(term) ||
          facility.region.toLowerCase().includes(term),
      )
      .slice(0, MAX_PER_GROUP)
      .map((facility) => ({
        id: facility.id,
        kind: 'facility',
        title: facility.name,
        subtitle: `${facility.region} · sample directory entry`,
        to: `/facilities?focus=${facility.id}`,
      }));

    return [...patientHits, ...referralHits, ...facilityHits];
  }, [query, patients, referrals]);

  // Close on outside click.
  useEffect(() => {
    if (!open) return undefined;
    const handler = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // "/" focuses search, matching the convention in most record systems.
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key !== '/' || event.metaKey || event.ctrlKey) return;
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target?.isContentEditable) {
        return;
      }
      event.preventDefault();
      inputRef.current?.focus();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  useEffect(() => {
    setHighlight(0);
  }, [query]);

  const go = (result: Result) => {
    navigate(result.to);
    setQuery('');
    setOpen(false);
    inputRef.current?.blur();
  };

  const showPanel = open && query.trim().length >= 2;

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <Search
        aria-hidden
        className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-obsidian-400"
      />
      <input
        ref={inputRef}
        type="text"
        role="combobox"
        aria-expanded={showPanel}
        aria-controls="global-search-results"
        aria-autocomplete="list"
        aria-label="Search patients, referrals and facilities"
        placeholder="Search patients, referrals, facilities"
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            setOpen(false);
            return;
          }
          if (!showPanel || results.length === 0) return;
          if (event.key === 'ArrowDown') {
            event.preventDefault();
            setHighlight((index) => (index + 1) % results.length);
          } else if (event.key === 'ArrowUp') {
            event.preventDefault();
            setHighlight((index) => (index - 1 + results.length) % results.length);
          } else if (event.key === 'Enter') {
            event.preventDefault();
            const target = results[highlight];
            if (target) go(target);
          }
        }}
        className={cn(controlClasses, 'h-8 pr-16 pl-9 text-[13px]')}
      />
      <kbd className="pointer-events-none absolute top-1/2 right-2.5 hidden -translate-y-1/2 rounded border border-obsidian-200 bg-obsidian-50 px-1.5 py-0.5 font-mono text-[10px] text-obsidian-400 lg:block">
        /
      </kbd>

      {showPanel ? (
        <div
          id="global-search-results"
          role="listbox"
          className="absolute top-full right-0 left-0 z-40 mt-1.5 max-h-96 min-w-80 overflow-y-auto rounded-lg border border-obsidian-200 bg-white py-1 shadow-overlay"
        >
          {results.length === 0 ? (
            <p className="px-3 py-6 text-center text-[13px] text-obsidian-500">
              Nothing matches &ldquo;{query.trim()}&rdquo;.
            </p>
          ) : (
            results.map((result, index) => (
              <button
                key={`${result.kind}-${result.id}`}
                type="button"
                role="option"
                aria-selected={index === highlight}
                onMouseEnter={() => setHighlight(index)}
                onClick={() => go(result)}
                className={cn(
                  'flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors',
                  index === highlight ? 'bg-ct-50' : 'hover:bg-obsidian-50',
                )}
              >
                <span
                  aria-hidden
                  className="flex size-7 shrink-0 items-center justify-center rounded bg-obsidian-100 text-obsidian-500 [&>svg]:size-3.5"
                >
                  {result.kind === 'patient' ? (
                    <User />
                  ) : result.kind === 'referral' ? (
                    <Send />
                  ) : (
                    <Building2 />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium text-obsidian-900">
                    {result.title}
                  </span>
                  <span className="block truncate text-xs text-obsidian-500">
                    {result.subtitle}
                  </span>
                </span>
                {index === highlight ? (
                  <CornerDownLeft aria-hidden className="size-3.5 shrink-0 text-obsidian-300" />
                ) : null}
              </button>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}
