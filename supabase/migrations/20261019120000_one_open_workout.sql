-- One open workout per user. POST /workouts relies on this to stay atomic when two
-- requests race (a double tap on a phone): the second insert conflicts and the API
-- returns the workout that won.
create unique index workouts_one_open_per_user_idx
  on public.workouts (user_id)
  where finished_at is null;
