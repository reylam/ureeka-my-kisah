import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ArrowLeft, BookOpen, Check, GraduationCap } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Notice } from '@/components/ui/Notice';
import { ProgressBar } from '@/components/ui/ProgressBar';
import {
  ARTICLES,
  STAGE_RECOMMENDATION,
  TOPIC_LABEL,
  articleById,
  type EducationTopic,
} from '@/data/education';
import { usePatientRecords } from '@/hooks/usePatientRecords';
import { useCurrentAccount } from '@/stores/authStore';
import { cn } from '@/utils/cn';

/**
 * TB learning centre.
 *
 * Reading progress is stored per account under its own key, not in the account
 * record, because it is not clinical information and has no business sitting
 * next to someone's symptoms.
 *
 * Progress is shown as a count of articles read and nothing more. No streaks,
 * no scores, no badges to chase: this is health information, and turning it
 * into a game would quietly pressure people into clicking through articles
 * rather than reading them.
 */

const STORAGE_KEY = 'pulmo.learning.v1';

function loadProgress(accountId: string): string[] {
  try {
    const raw = window.localStorage.getItem(`${STORAGE_KEY}.${accountId}`);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

export function PatientLearningPage() {
  const account = useCurrentAccount();
  const { stage } = usePatientRecords();
  const [params, setParams] = useSearchParams();
  const openId = params.get('article');

  const [read, setRead] = useState<string[]>(() => (account ? loadProgress(account.id) : []));

  useEffect(() => {
    if (!account) return;
    try {
      window.localStorage.setItem(`${STORAGE_KEY}.${account.id}`, JSON.stringify(read));
    } catch {
      // Storage can be full or blocked. Losing reading progress is not worth
      // interrupting anyone over.
    }
  }, [account, read]);

  const [topic, setTopic] = useState<EducationTopic | 'all'>('all');
  const recommendation = STAGE_RECOMMENDATION[stage];

  const visible = useMemo(
    () => (topic === 'all' ? ARTICLES : ARTICLES.filter((article) => article.topic === topic)),
    [topic],
  );

  const article = openId ? articleById(openId) : undefined;

  /* ── Reading view ── */
  if (article) {
    const isRead = read.includes(article.id);
    return (
      <div className="space-y-5">
        <Button
          variant="ghost"
          size="sm"
          leadingIcon={<ArrowLeft className="mr-1.5 size-3.5" />}
          onClick={() => setParams({}, { replace: true })}
        >
          All topics
        </Button>

        <Card as="article">
          <CardHeader
            title={article.title}
            description={`${TOPIC_LABEL[article.topic]} · ${article.minutes} min read`}
          />
          <CardBody className="space-y-4">
            {article.body.map((paragraph) => (
              <p
                key={paragraph.slice(0, 32)}
                className="max-w-prose text-[14px] leading-relaxed text-obsidian-700"
              >
                {paragraph}
              </p>
            ))}

            {article.keyPoints ? (
              <div className="rounded-card border border-ct-200 bg-ct-50 p-4">
                <p className="text-[13px] font-semibold text-ct-800">Worth remembering</p>
                <ul className="mt-2 space-y-1.5">
                  {article.keyPoints.map((point) => (
                    <li key={point} className="flex gap-2 text-[13px] leading-relaxed text-ct-800">
                      <Check aria-hidden className="mt-1 size-3.5 shrink-0" />
                      {point}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <Notice tone="attention" compact>
              This is general information, not advice about your own case. Do not start, stop or
              change any medicine based on what you read here. Talk to your clinician.
            </Notice>

            <Button
              variant={isRead ? 'outline' : 'primary'}
              leadingIcon={isRead ? <Check className="mr-1.5 size-4" /> : undefined}
              onClick={() =>
                setRead((current) =>
                  isRead ? current.filter((id) => id !== article.id) : [...current, article.id],
                )
              }
            >
              {isRead ? 'Marked as read' : 'Mark as read'}
            </Button>
          </CardBody>
        </Card>
      </div>
    );
  }

  /* ── Index view ── */
  return (
    <div className="space-y-5">
      <PageHeader
        title="Health learning"
        description="Short guides about tuberculosis, written for patients rather than for clinicians."
      />

      <Card>
        <CardHeader title="Your progress" icon={<GraduationCap />} />
        <CardBody className="space-y-3">
          <ProgressBar
            value={Math.round((read.length / ARTICLES.length) * 100)}
            label={`Articles read: ${read.length} of ${ARTICLES.length}`}
            tone={read.length === ARTICLES.length ? 'complete' : 'default'}
          />
          <p className="text-[12.5px] leading-relaxed text-obsidian-500">
            {read.length === 0
              ? 'Nothing read yet. There is no order you have to follow.'
              : `${read.length} of ${ARTICLES.length} read. Nothing expires and there is no test.`}
          </p>
        </CardBody>
      </Card>

      {/* Suggested, based on care stage rather than on any analysis output */}
      <Card>
        <CardHeader title={recommendation.heading} description={recommendation.reason} />
        <CardBody>
          <ul className="grid gap-3 sm:grid-cols-3">
            {recommendation.articleIds.map((id) => {
              const item = articleById(id);
              if (!item) return null;
              return (
                <li key={id}>
                  <ArticleCard
                    article={item}
                    read={read.includes(id)}
                    onOpen={() => setParams({ article: id })}
                  />
                </li>
              );
            })}
          </ul>
        </CardBody>
      </Card>

      {/* Full library */}
      <Card>
        <CardHeader
          title="All topics"
          icon={<BookOpen />}
          actions={
            <div className="flex flex-wrap gap-1.5">
              <TopicChip active={topic === 'all'} onClick={() => setTopic('all')}>
                All
              </TopicChip>
              {(Object.keys(TOPIC_LABEL) as EducationTopic[]).map((key) => (
                <TopicChip key={key} active={topic === key} onClick={() => setTopic(key)}>
                  {TOPIC_LABEL[key]}
                </TopicChip>
              ))}
            </div>
          }
        />
        <CardBody>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {visible.map((item) => (
              <li key={item.id}>
                <ArticleCard
                  article={item}
                  read={read.includes(item.id)}
                  onOpen={() => setParams({ article: item.id })}
                />
              </li>
            ))}
          </ul>
        </CardBody>
      </Card>
    </div>
  );
}

function ArticleCard({
  article,
  read,
  onOpen,
}: {
  article: (typeof ARTICLES)[number];
  read: boolean;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex h-full w-full flex-col rounded-card border border-obsidian-200 p-3.5 text-left transition-colors hover:border-ct-300 hover:bg-ct-50/40"
    >
      <span className="flex items-start justify-between gap-2">
        <span className="text-[13px] font-medium text-obsidian-900">{article.title}</span>
        {read ? (
          <Badge tone="complete" size="sm" icon={<Check />}>
            Read
          </Badge>
        ) : null}
      </span>
      <span className="mt-1.5 text-[12.5px] leading-relaxed text-obsidian-500">
        {article.summary}
      </span>
      <span className="mt-auto pt-3 text-[11.5px] text-obsidian-400">
        {TOPIC_LABEL[article.topic]} · {article.minutes} min
      </span>
    </button>
  );
}

function TopicChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'rounded-full px-2.5 py-1 text-[11.5px] transition-colors',
        active
          ? 'bg-obsidian-950 text-white'
          : 'bg-obsidian-100 text-obsidian-600 hover:bg-obsidian-200',
      )}
    >
      {children}
    </button>
  );
}
