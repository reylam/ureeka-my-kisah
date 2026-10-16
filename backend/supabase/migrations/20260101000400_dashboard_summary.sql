-- Dashboard figures, computed in the database.
--
-- Definitions mirror `buildDashboardSummary` in
-- frontend/src/stores/selectors.ts so the numbers on the professional
-- dashboard mean the same thing whether they come from here or are recomputed
-- in the browser after an edit.
--
-- SECURITY INVOKER on purpose: every table read below is subject to the
-- caller's Row Level Security, so a professional's totals cover exactly the
-- patients assigned to them and an administrator (who has no access to the
-- clinical tables) gets zeros for the clinical figures.
--
-- "Today" and the per-day buckets are calendar days in p_tz (an IANA zone name
-- such as 'Asia/Makassar', default UTC). The frontend passes the browser's zone,
-- so a record made at 23:30 local time lands on the day the person saw it.
-- An unknown zone name raises invalid_parameter_value (22023).

create or replace function public.dashboard_summary(p_days integer default 21, p_tz text default 'UTC')
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  with params as (
    select greatest(1, least(coalesce(p_days, 21), 90)) as days
  ),
  shots as (
    select
      s.id,
      s.status,
      (s.performed_at at time zone p_tz)::date as day,
      r.analysis ->> 'outcome' as outcome
    from public.screenings s
    left join public.screening_reports r on r.screening_id = s.id
  ),
  followups as (
    select
      case
        when status = 'completed' then 'completed'
        when status = 'unresolved' then 'unresolved'
        when due_date < (now() at time zone p_tz)::date then 'overdue'
        when due_date = (now() at time zone p_tz)::date then 'due-today'
        else 'upcoming'
      end as bucket
    from public.follow_up_records
  ),
  days as (
    select d::date as day
    from params,
         generate_series(
           (now() at time zone p_tz)::date - (params.days - 1),
           (now() at time zone p_tz)::date,
           interval '1 day'
         ) as d
  )
  select jsonb_build_object(
    'totalScreenings', (select count(*) from shots),
    'screeningsThisWeek', (select count(*) from shots where day >= (now() at time zone p_tz)::date - 6),
    'awaitingReview', (select count(*) from shots where status = 'awaiting-review'),
    'pendingReferrals', (
      select count(*) from public.referrals
      where status in ('draft', 'pending', 'referred', 'appointment-scheduled', 'followup-required')
    ),
    'overdueFollowUps', (select count(*) from followups where bucket = 'overdue'),
    'dueTodayFollowUps', (select count(*) from followups where bucket = 'due-today'),
    'upcomingFollowUps', (select count(*) from followups where bucket = 'upcoming'),
    'flaggedAwaitingReview', (
      select count(*) from shots where status = 'awaiting-review' and outcome = 'flagged-for-review'
    ),
    'inconclusiveOpen', (
      select count(*) from shots
      where outcome = 'inconclusive' and status not in ('closed', 'referred')
    ),
    'draftRecords', (select count(*) from shots where status = 'draft'),
    'activity', (
      select coalesce(jsonb_agg(
        jsonb_build_object(
          'date', to_char(d.day, 'YYYY-MM-DD'),
          'total', (select count(*) from shots s where s.day = d.day),
          'flagged', (select count(*) from shots s where s.day = d.day and s.outcome = 'flagged-for-review')
        ) order by d.day
      ), '[]'::jsonb)
      from days d
    ),
    'outcomeBreakdown', jsonb_build_array(
      jsonb_build_object('outcome', 'flagged-for-review', 'count', (select count(*) from shots where outcome = 'flagged-for-review')),
      jsonb_build_object('outcome', 'no-alert', 'count', (select count(*) from shots where outcome = 'no-alert')),
      jsonb_build_object('outcome', 'inconclusive', 'count', (select count(*) from shots where outcome = 'inconclusive'))
    )
  )
$$;

revoke execute on function public.dashboard_summary(integer, text) from public, anon;
grant execute on function public.dashboard_summary(integer, text) to authenticated;
