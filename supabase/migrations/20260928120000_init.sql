-- Spotter init migration
-- File: supabase/migrations/20260928120000_init.sql
--
-- Runs on a fresh Supabase project (Postgres 17, auth schema present) with
--   psql -v ON_ERROR_STOP=1 -f supabase/migrations/20260928120000_init.sql
-- (add -1 to run it as one transaction; the Supabase CLI already does that).
-- Seven tables, one trigger function, two RLS helper functions, no views.
--
-- Rules of the schema:
--   1. Every weight is stored in kilograms as numeric(7,3). profiles.weight_unit is
--      only the display preference; the Express API converts at its boundary.
--   2. workout_sets carries user_id, copied from the workout and kept honest by a
--      composite foreign key, so the ghost row, charts and record checks read one
--      index and never join to find the owner. personal_records copies user_id and
--      exercise_id from the set and is pinned to it the same way.
--   3. personal_records is an event log with no numbers. A row means "this set was a
--      record of this kind". Weight and reps stay on the set, which only the owner can
--      read, so squad mates see that a record happened and nothing else unless the
--      owner opted in (profiles.share_numbers) and the API joins the numbers in.
--   4. The Express API connects to Postgres with the project connection string
--      (pooled, transaction mode) as the postgres role, which owns every table and
--      so bypasses row level security. Policies are written for the day the web app
--      talks to Postgres with the supabase js client and a user JWT (role
--      authenticated). anon gets nothing.
--   5. Only profiles references auth.users. Deleting the auth user cascades through
--      profiles and removes everything the person owned. A set may only reference a
--      library exercise or a custom one its own user owns, so that cascade never
--      meets another user's sets.

-- =============================================================================
-- updated_at helper: the only trigger function in the schema
-- =============================================================================

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- =============================================================================
-- profiles: one row per auth user. The API upserts it on the first authenticated
-- request (insert ... on conflict (id) do nothing), so there is no auth trigger.
-- =============================================================================

create table public.profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  display_name  text not null check (length(display_name) between 1 and 40),
  -- display preference only; every stored weight is kilograms
  weight_unit   text not null default 'lb' check (weight_unit in ('kg', 'lb')),
  -- IANA zone name, set by the API from the browser. Cuts weeks at local midnight
  -- for streaks. The check raises "time zone not recognized" on a bad name, so a
  -- typo is rejected on write instead of breaking the streak query later.
  timezone      text not null default 'America/New_York'
                check ((now() at time zone timezone) is not null),
  -- privacy opt in: false means squad mates see that a record happened, never the numbers
  share_numbers boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- =============================================================================
-- exercises: the seeded library (owner_id null) plus user owned custom rows
-- (owner_id set). Library ids are the free exercise db slugs; custom rows default
-- to a uuid string, which can never collide with a slug, so no second table.
-- =============================================================================

create table public.exercises (
  id                text primary key default gen_random_uuid()::text
                    check (length(id) between 1 and 120),
  owner_id          uuid references public.profiles (id) on delete cascade,
  name              text not null check (length(name) between 1 and 120),
  force             text check (force in ('push', 'pull', 'static')),
  level             text check (level in ('beginner', 'intermediate', 'expert')),
  mechanic          text check (mechanic in ('compound', 'isolation')),
  equipment         text,
  primary_muscles   text[] not null default '{}',
  secondary_muscles text[] not null default '{}',
  instructions      text[] not null default '{}',
  -- strength, stretching, cardio, ...; unchecked until the seed shows the real value set
  category          text not null,
  -- relative paths inside the dataset, for example Barbell_Bench_Press_-_Medium_Grip/0.jpg
  images            text[] not null default '{}',
  created_at        timestamptz not null default now()
);

-- a user's custom exercises, and the cascade from profiles; partial so the library is not in it
create index exercises_owner_idx on public.exercises (owner_id) where owner_id is not null;

-- =============================================================================
-- workouts: one session. finished_at null means in progress; a finished workout
-- is what streaks and the leaderboard count as a session.
-- =============================================================================

create table public.workouts (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  started_at  timestamptz not null default now(),
  finished_at timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint workouts_finished_after_started check (finished_at >= started_at),
  -- target for the composite foreign key on workout_sets
  constraint workouts_id_user_id_key unique (id, user_id)
);

create trigger workouts_set_updated_at
  before update on public.workouts
  for each row execute function public.set_updated_at();

-- history page, streaks, leaderboard consistency, volume per workout
create index workouts_user_started_idx on public.workouts (user_id, started_at desc);

-- =============================================================================
-- workout_sets: the hot table, one row per logged set. No set_number and no
-- workout_exercises table: sets order by performed_at (id breaks ties) and an
-- exercise is "in" a workout when it has a set there.
-- =============================================================================

create table public.workout_sets (
  id           uuid primary key default gen_random_uuid(),
  workout_id   uuid not null,
  -- copied from the workout; the composite foreign key below guarantees it matches
  user_id      uuid not null,
  -- no cascade: an exercise with history cannot be deleted. Deferred so that deleting
  -- an account can cascade through the user's custom exercises and their sets in one
  -- statement; the check runs at commit, when both are gone.
  exercise_id  text not null references public.exercises (id) deferrable initially deferred,
  -- kilograms; 0 is allowed for pure bodyweight sets
  weight_kg    numeric(7,3) not null check (weight_kg >= 0),
  reps         integer not null check (reps between 1 and 1000),
  rpe          numeric(3,1) check (rpe between 1 and 10),
  -- warmup sets show in the ghost row but never count for records, charts or volume
  is_warmup    boolean not null default false,
  -- Epley estimated one rep max, computed by Postgres so every query agrees on the formula
  e1rm_kg      numeric(9,3) generated always as (round(weight_kg * (1 + reps / 30.0), 3)) stored,
  -- when the set happened (an offline client sends its own value); created_at is server
  -- time. clock_timestamp() rather than now() so rows written in one statement still get
  -- distinct, ordered values; the API sends performed_at itself whenever it writes more
  -- than one set in a statement.
  performed_at timestamptz not null default clock_timestamp(),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint workout_sets_workout_id_user_id_fkey
    foreign key (workout_id, user_id) references public.workouts (id, user_id) on delete cascade,
  -- target for the composite foreign key on personal_records. One more index on the
  -- hot table; the price of a record that can never name the wrong user or exercise.
  constraint workout_sets_id_user_id_exercise_id_key unique (id, user_id, exercise_id)
);

create trigger workout_sets_set_updated_at
  before update on public.workout_sets
  for each row execute function public.set_updated_at();

-- Ghost row, per exercise history for charts, record check, leaderboard improvement:
-- everything "this user, this exercise, newest first". The ghost row's inner query is
--   select workout_id from workout_sets
--   where user_id = $1 and exercise_id = $2 and workout_id <> $3
--   order by performed_at desc limit 1
-- and stops at the first row from another workout.
create index workout_sets_user_exercise_performed_idx
  on public.workout_sets (user_id, exercise_id, performed_at desc);

-- load one workout, the ghost workout's sets for one exercise, the cascade from workouts
create index workout_sets_workout_exercise_idx
  on public.workout_sets (workout_id, exercise_id, performed_at);

-- =============================================================================
-- personal_records: an append only log of record events. No numbers live here;
-- the set holds them. kind is what was beaten:
--   max_weight          heaviest weight for the exercise
--   max_reps_at_weight  most reps at this set's exact weight_kg
--   max_e1rm            best Epley estimate
-- The API decides a record by comparing the new set with the user's earlier non
-- warmup sets (same index as the ghost row), never with old record rows, so a
-- stale row can never hide a real record. Recompute is delete then replay.
-- =============================================================================

create table public.personal_records (
  id          uuid primary key default gen_random_uuid(),
  -- both copied from the set; the composite foreign key below guarantees they match
  user_id     uuid not null references public.profiles (id) on delete cascade,
  exercise_id text not null references public.exercises (id) deferrable initially deferred,
  set_id      uuid not null,
  kind        text not null check (kind in ('max_weight', 'max_reps_at_weight', 'max_e1rm')),
  -- copy of the set's performed_at so listings and the feed sort without a join
  achieved_at timestamptz not null,
  created_at  timestamptz not null default now(),
  -- one record of each kind per set; makes the API's insert idempotent on retry
  constraint personal_records_set_id_kind_key unique (set_id, kind),
  constraint personal_records_set_fkey
    foreign key (set_id, user_id, exercise_id)
    references public.workout_sets (id, user_id, exercise_id) on delete cascade
);

-- record lookup per user and exercise; the latest of each kind is a direct probe
create index personal_records_user_exercise_kind_idx
  on public.personal_records (user_id, exercise_id, kind, achieved_at desc);

-- records per user newest first, and the squad feed per member
create index personal_records_user_achieved_idx
  on public.personal_records (user_id, achieved_at desc);

-- =============================================================================
-- squads and squad_members. The creator is the owner. join_code is what friends
-- type in: six characters, unique. The API generates it from the alphabet
-- ABCDEFGHJKLMNPQRSTUVWXYZ23456789 (no O, 0, I or 1 confusion) and retries the
-- insert on the rare collision; the uuid default is only a fallback. Clients never
-- write it (see the column grants at the end).
-- =============================================================================

create table public.squads (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (length(name) between 1 and 60),
  join_code  text not null default upper(left(gen_random_uuid()::text, 6))
             check (join_code ~ '^[A-Z0-9]{6}$'),
  -- null once the creator's account is gone; the squad survives and the API can reassign it
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint squads_join_code_key unique (join_code)
);

create trigger squads_set_updated_at
  before update on public.squads
  for each row execute function public.set_updated_at();

create table public.squad_members (
  squad_id  uuid not null references public.squads (id) on delete cascade,
  user_id   uuid not null references public.profiles (id) on delete cascade,
  joined_at timestamptz not null default now(),
  -- members of a squad
  primary key (squad_id, user_id)
);

-- squads of a user; the primary key covers the roster direction
create index squad_members_user_idx on public.squad_members (user_id);

-- =============================================================================
-- RLS helpers. Both are security definer so a policy on squad_members can ask
-- "am I in this squad" without reading squad_members through its own policy,
-- which Postgres rejects as infinite recursion. They only reveal the caller's
-- own membership. search_path is pinned and every name is qualified.
-- =============================================================================

create function public.is_squad_member(target_squad uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.squad_members m
    where m.squad_id = target_squad
      and m.user_id = (select auth.uid())
  );
$$;

create function public.is_squad_mate(other_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.squad_members mine
    join public.squad_members theirs on theirs.squad_id = mine.squad_id
    where mine.user_id = (select auth.uid())
      and theirs.user_id = other_user
  );
$$;

-- =============================================================================
-- Row level security. Enabled on every table. The API's postgres connection
-- bypasses it (rule 4), so today these policies are dormant and the API scopes
-- every query by the user id from the verified JWT. They become the real gate if
-- the web app ever uses the supabase js client with the anon key. auth.uid() is
-- wrapped in (select ...) so Postgres evaluates it once per query instead of once
-- per row.
-- =============================================================================

alter table public.profiles         enable row level security;
alter table public.exercises        enable row level security;
alter table public.workouts         enable row level security;
alter table public.workout_sets     enable row level security;
alter table public.personal_records enable row level security;
alter table public.squads           enable row level security;
alter table public.squad_members    enable row level security;

-- profiles: read yourself and your squad mates (the leaderboard needs their names);
-- create and edit only yourself. No delete: accounts are deleted through auth.users.
create policy profiles_select on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or public.is_squad_mate(id));

create policy profiles_insert on public.profiles
  for insert to authenticated
  with check (id = (select auth.uid()));

create policy profiles_update on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- exercises: everyone reads the library; a custom row is visible only to its owner
-- (when a feed entry names a custom exercise, the API resolves the name, not this
-- policy); only the owner writes. The library is seeded with the service role.
create policy exercises_select on public.exercises
  for select to authenticated
  using (owner_id is null or owner_id = (select auth.uid()));

create policy exercises_insert on public.exercises
  for insert to authenticated
  with check (owner_id = (select auth.uid()));

create policy exercises_update on public.exercises
  for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

create policy exercises_delete on public.exercises
  for delete to authenticated
  using (owner_id = (select auth.uid()));

-- workouts and workout_sets: owner only, every command. Squad wide reads
-- (leaderboard, feed) are the API's job because only it can hide numbers per
-- share_numbers; a future direct client gets them as security definer functions.
create policy workouts_owner on public.workouts
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- A set may reference a library exercise or a custom one the same user owns, nothing
-- else; otherwise deleting the exercise owner's account would fail on the foreign key.
-- The API applies the same rule before it inserts a set.
create policy workout_sets_owner on public.workout_sets
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.exercises e
      where e.id = workout_sets.exercise_id
        and (e.owner_id is null or e.owner_id = (select auth.uid()))
    )
  );

-- personal_records: the owner and their squad mates read (the row holds no numbers).
-- No write policy on purpose: records are derived by the API, and a client that
-- could insert them could fake the feed. Record detection becomes a security
-- definer function if the browser ever talks to Postgres directly.
create policy personal_records_select on public.personal_records
  for select to authenticated
  using (user_id = (select auth.uid()) or public.is_squad_mate(user_id));

-- squads: members and the creator read; only the creator creates, renames and
-- deletes. A non member cannot look a squad up by code through RLS on purpose:
-- joining goes through the API today and a join_squad(code) function later. The
-- column grants at the end keep join_code out of insert and update, so a client
-- cannot probe for codes by writing one and reading the unique violation.
create policy squads_select on public.squads
  for select to authenticated
  using (public.is_squad_member(id) or created_by = (select auth.uid()));

create policy squads_insert on public.squads
  for insert to authenticated
  with check (created_by = (select auth.uid()));

create policy squads_update on public.squads
  for update to authenticated
  using (created_by = (select auth.uid()))
  with check (created_by = (select auth.uid()));

create policy squads_delete on public.squads
  for delete to authenticated
  using (created_by = (select auth.uid()));

-- squad_members: members see the roster. The creator may add themselves (squad
-- creation); everyone else joins by code through the API. Leaving is deleting
-- your own row; the creator may remove anyone.
create policy squad_members_select on public.squad_members
  for select to authenticated
  using (public.is_squad_member(squad_id));

create policy squad_members_insert on public.squad_members
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.squads s
      where s.id = squad_members.squad_id
        and s.created_by = (select auth.uid())
    )
  );

create policy squad_members_delete on public.squad_members
  for delete to authenticated
  using (
    user_id = (select auth.uid())
    or exists (
      select 1 from public.squads s
      where s.id = squad_members.squad_id
        and s.created_by = (select auth.uid())
    )
  );

-- =============================================================================
-- Grants. Supabase's default privileges hand anon, authenticated and service_role
-- full access to every new table and function in public. Spotter has no logged
-- out reads, so anon loses everything, now and for anything a later migration
-- adds (those tables still need RLS enabled and their own policies). authenticated
-- keeps table privileges and is narrowed by the policies above, except that it can
-- never write squads.join_code. service_role keeps everything, as Supabase expects;
-- the Express API does not use it (rule 4).
-- =============================================================================

revoke all on all tables in schema public from anon;
revoke all on function public.is_squad_member(uuid), public.is_squad_mate(uuid) from public, anon;

-- tables, functions and sequences created by later migrations start with no anon access
alter default privileges for role postgres in schema public revoke all on tables from anon;
alter default privileges for role postgres in schema public revoke all on functions from anon;
alter default privileges for role postgres in schema public revoke all on sequences from anon;

grant select, insert, update, delete on all tables in schema public to authenticated, service_role;
grant execute on function public.is_squad_member(uuid), public.is_squad_mate(uuid) to authenticated, service_role;

-- join_code is set by the API only: authenticated may create a squad with a name and
-- creator and rename it, nothing more. Columns left out of an insert take their default.
revoke insert, update on public.squads from authenticated;
grant insert (name, created_by), update (name) on public.squads to authenticated;
