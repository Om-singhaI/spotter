\set ON_ERROR_STOP on
-- Spotter smoke test for supabase/migrations/20260928120000_init.sql. Seeds two users, then runs
-- the ghost row query, the record check and the squad leaderboard, each asserted by a DO block.
-- One transaction: a failed assertion stops psql before the commit, a pass keeps the rows.
begin;
insert into auth.users (id) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'), ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
insert into public.profiles (id, display_name, share_numbers) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Ana', false),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Ben', true);
-- two library exercises and one custom exercise owned by Ben
insert into public.exercises (id, owner_id, name, category) values
  ('Barbell_Bench_Press_-_Medium_Grip', null, 'Barbell Bench Press - Medium Grip', 'strength'),
  ('Barbell_Squat', null, 'Barbell Squat', 'strength'),
  ('cccccccc-0000-4000-8000-00000000000c', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Band Row', 'strength');
-- Ana trained 10 days and 1 day ago, Ben 40 days and 2 days ago; every workout is finished
insert into public.workouts (id, user_id, started_at, finished_at) values
  ('a1a1a1a1-0000-4000-8000-000000000001', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', now() - interval '10 days', now() - interval '10 days' + interval '1 hour'),
  ('a2a2a2a2-0000-4000-8000-000000000002', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', now() - interval '1 day',   now() - interval '1 day'   + interval '1 hour'),
  ('b1b1b1b1-0000-4000-8000-000000000001', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', now() - interval '40 days', now() - interval '40 days' + interval '1 hour'),
  ('b2b2b2b2-0000-4000-8000-000000000002', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', now() - interval '2 days',  now() - interval '2 days'  + interval '1 hour');
-- Ana's first bench day has a flagged warmup at the working weight with more reps than her new
-- set, so a record check that ignores is_warmup fails below. Ben's bench e1rm goes from 96 to
-- 108, exactly 12.5 percent; his band row has no history from a month ago and must not count.
insert into public.workout_sets (id, workout_id, user_id, exercise_id, weight_kg, reps, rpe, is_warmup, performed_at) values
  ('dddddddd-0000-4000-8000-000000000001', 'a1a1a1a1-0000-4000-8000-000000000001', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Barbell_Bench_Press_-_Medium_Grip',    100, 8,  null, true,  now() - interval '10 days' + interval '1 min'),
  ('dddddddd-0000-4000-8000-000000000002', 'a1a1a1a1-0000-4000-8000-000000000001', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Barbell_Bench_Press_-_Medium_Grip',    100, 5,  8,    false, now() - interval '10 days' + interval '5 min'),
  ('dddddddd-0000-4000-8000-000000000003', 'a1a1a1a1-0000-4000-8000-000000000001', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Barbell_Bench_Press_-_Medium_Grip',    105, 1,  9.5,  false, now() - interval '10 days' + interval '10 min'),
  ('dddddddd-0000-4000-8000-000000000004', 'a1a1a1a1-0000-4000-8000-000000000001', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Barbell_Squat',                        140, 5,  null, false, now() - interval '10 days' + interval '20 min'),
  ('dddddddd-0000-4000-8000-000000000005', 'a2a2a2a2-0000-4000-8000-000000000002', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Barbell_Bench_Press_-_Medium_Grip',    100, 7,  9,    false, now() - interval '1 day'   + interval '5 min'),
  ('dddddddd-0000-4000-8000-000000000011', 'b1b1b1b1-0000-4000-8000-000000000001', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Barbell_Bench_Press_-_Medium_Grip',    80,  6,  null, false, now() - interval '40 days' + interval '5 min'),
  ('dddddddd-0000-4000-8000-000000000012', 'b2b2b2b2-0000-4000-8000-000000000002', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Barbell_Bench_Press_-_Medium_Grip',    90,  6,  null, false, now() - interval '2 days'  + interval '5 min'),
  ('dddddddd-0000-4000-8000-000000000013', 'b2b2b2b2-0000-4000-8000-000000000002', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'cccccccc-0000-4000-8000-00000000000c', 20,  12, null, false, now() - interval '2 days'  + interval '10 min');
-- records the API would already hold: each first work set is a record of all three kinds and
-- Ana's 105 x 1 only beat max_weight. Her newest set is checked below, not seeded.
insert into public.personal_records (user_id, exercise_id, set_id, kind, achieved_at)
select s.user_id, s.exercise_id, s.id, k.kind, s.performed_at
from public.workout_sets s, unnest(array['max_weight', 'max_reps_at_weight', 'max_e1rm']) as k(kind)
where s.id in ('dddddddd-0000-4000-8000-000000000002', 'dddddddd-0000-4000-8000-000000000004', 'dddddddd-0000-4000-8000-000000000011', 'dddddddd-0000-4000-8000-000000000012')
   or (s.id = 'dddddddd-0000-4000-8000-000000000003' and k.kind = 'max_weight');
insert into public.squads (id, name, join_code, created_by) values
  ('eeeeeeee-0000-4000-8000-00000000000e', 'Purdue Iron', 'SPOT42', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
insert into public.squad_members (squad_id, user_id) values
  ('eeeeeeee-0000-4000-8000-00000000000e', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
  ('eeeeeeee-0000-4000-8000-00000000000e', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');

-- 1. Ghost row: Ana opens bench inside her current workout a2a2. Expected: the three bench sets
--    of a1a1 in order, warmup included, nothing from the squat and nothing from Ben.
create temp table ghost as
select s.workout_id, s.weight_kg, s.reps, s.rpe, s.is_warmup, s.performed_at
from public.workout_sets s
where s.exercise_id = 'Barbell_Bench_Press_-_Medium_Grip'
  and s.workout_id = (
    select g.workout_id from public.workout_sets g
    where g.user_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
      and g.exercise_id = 'Barbell_Bench_Press_-_Medium_Grip'
      and g.workout_id <> 'a2a2a2a2-0000-4000-8000-000000000002'
    order by g.performed_at desc limit 1)
order by s.performed_at, s.id;
select * from ghost;
do $$ declare got text; begin
  select string_agg(weight_kg || 'x' || reps || case when is_warmup then '*' else '' end, ' ' order by performed_at)
    into got from ghost;
  if got is distinct from '100.000x8* 100.000x5 105.000x1' then
    raise exception 'ghost row: expected 100.000x8* 100.000x5 105.000x1, got %', coalesce(got, 'nothing');
  end if;
  if (select count(distinct workout_id) from ghost) <> 1
     or (select min(workout_id::text) from ghost) <> 'a1a1a1a1-0000-4000-8000-000000000001' then
    raise exception 'ghost row: sets came from the wrong workout';
  end if;
end $$;

-- 2. Record check for Ana's new set, 100 kg x 7 in a2a2, against her earlier non warmup bench sets,
--    the way the API does it: 105 x 1 blocks max_weight, 100 x 5 loses on reps at that weight and
--    e1rm 123.333 beats 116.667. Expected: max_e1rm and max_reps_at_weight.
create temp table record_check as
with n as (select * from public.workout_sets where id = 'dddddddd-0000-4000-8000-000000000005'),
prior as (
  select p.weight_kg, p.reps, p.e1rm_kg
  from public.workout_sets p join n on p.user_id = n.user_id and p.exercise_id = n.exercise_id
  where p.performed_at < n.performed_at and not p.is_warmup)
select 'max_weight' as kind from n
where not exists (select 1 from prior where prior.weight_kg >= n.weight_kg)
union all
select 'max_reps_at_weight' from n
where not exists (select 1 from prior where prior.weight_kg = n.weight_kg and prior.reps >= n.reps)
union all
select 'max_e1rm' from n
where not exists (select 1 from prior where prior.e1rm_kg >= n.e1rm_kg);
select * from record_check;
do $$ declare got text; begin
  select string_agg(kind, ',' order by kind) into got from record_check;
  if got is distinct from 'max_e1rm,max_reps_at_weight' then
    raise exception 'record check: expected max_e1rm,max_reps_at_weight, got %', coalesce(got, 'nothing');
  end if;
end $$;
-- write them as the API would; the composite foreign key pins each row to its set
insert into public.personal_records (user_id, exercise_id, set_id, kind, achieved_at)
select n.user_id, n.exercise_id, n.id, r.kind, n.performed_at
from record_check r, public.workout_sets n where n.id = 'dddddddd-0000-4000-8000-000000000005'
on conflict (set_id, kind) do nothing;

-- 3. Leaderboard: sessions are finished workouts in the last 4 weeks. Improvement is the percent
--    change of best e1rm now versus best e1rm as of one month ago, per exercise and averaged over
--    the exercises that have both, never an absolute weight. Expected: Ana 2 sessions and no
--    improvement yet, Ben 1 session and 12.5 percent, so each of them tops one ranking.
create temp table leaderboard as
with sessions as (
  select m.user_id, count(w.id) as sessions
  from public.squad_members m
  left join public.workouts w on w.user_id = m.user_id
    and w.finished_at is not null and w.started_at >= now() - interval '4 weeks'
  where m.squad_id = 'eeeeeeee-0000-4000-8000-00000000000e'
  group by m.user_id),
best as (
  select s.user_id, s.exercise_id, max(s.e1rm_kg) as now_best,
         max(s.e1rm_kg) filter (where s.performed_at < now() - interval '1 month') as then_best
  from public.workout_sets s
  join public.squad_members m on m.user_id = s.user_id
  where m.squad_id = 'eeeeeeee-0000-4000-8000-00000000000e' and not s.is_warmup
  group by s.user_id, s.exercise_id),
improvement as (
  select user_id, avg((now_best - then_best) * 100 / then_best) as pct
  from best where then_best > 0 group by user_id)
select p.id as user_id, p.display_name, se.sessions, round(i.pct, 1) as improvement_pct,
       rank() over (order by se.sessions desc) as consistency_rank,
       rank() over (order by i.pct desc nulls last) as improvement_rank
from sessions se
join public.profiles p on p.id = se.user_id
left join improvement i on i.user_id = se.user_id
order by consistency_rank, improvement_rank;
select * from leaderboard;
do $$ declare ana record; ben record; begin
  select * into strict ana from leaderboard where display_name = 'Ana';
  select * into strict ben from leaderboard where display_name = 'Ben';
  if (select count(*) from leaderboard) <> 2
     or ana.sessions is distinct from 2 or ana.consistency_rank is distinct from 1
     or ben.sessions is distinct from 1 or ben.consistency_rank is distinct from 2 then
    raise exception 'leaderboard consistency wrong: Ana %, Ben %', ana, ben;
  end if;
  if ana.improvement_pct is not null or ana.improvement_rank is distinct from 2
     or ben.improvement_pct is distinct from 12.5 or ben.improvement_rank is distinct from 1 then
    raise exception 'leaderboard improvement wrong: Ana %, Ben %', ana, ben;
  end if;
end $$;
commit;

-- =============================================================================
-- Row level security: the same data seen through a user JWT and through anon.
-- The Express API connects as postgres, which owns the tables and bypasses RLS,
-- so this is the only place the policies get exercised until the web app talks
-- to Postgres directly.
-- =============================================================================

begin;

-- remember Ben's real set count while still bypassing RLS
select set_config('smoke.ben_sets', (select count(*)::text from public.workout_sets where user_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'), true);

-- become Ben. Newer Supabase versions read the json claims, older local images read
-- request.jwt.claim.sub, so set both.
select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', true);
set local role authenticated;

do $$
declare
  seen_total int;
  seen_ana   int;
  seen_profiles int;
begin
  select count(*) into seen_total from public.workout_sets;
  select count(*) into seen_ana from public.workout_sets where user_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  select count(*) into seen_profiles from public.profiles;
  if seen_total <> current_setting('smoke.ben_sets')::int then
    raise exception 'RLS: Ben sees % sets but owns %', seen_total, current_setting('smoke.ben_sets');
  end if;
  if seen_ana <> 0 then
    raise exception 'RLS: Ben can see % of Ana''s sets', seen_ana;
  end if;
  if seen_profiles <> 2 then
    raise exception 'RLS: Ben should see his own profile and his squad mate, saw %', seen_profiles;
  end if;
end $$;

reset role;

-- become anon: no table access at all
set local role anon;

do $$
begin
  perform count(*) from public.workout_sets;
  raise exception 'RLS: anon can read workout_sets';
exception
  when insufficient_privilege then
    null;
end $$;

reset role;
rollback;
