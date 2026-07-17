# Rebuild database from paused backup

Your old backend can't be restored, but the current Lovable Cloud database is empty (no `public` tables). I've read the uploaded backup and can rebuild the schema, security rules, and helper functions here. The app code already targets these table names, so once the schema is back and the exercise catalog is reseeded, the app should work end-to-end again.

## What the backup contains

Public tables + row counts in the dump:

- `users` (2), `programs` (6), `workouts` (32), `workout_exercises` (34), `sets` (51)
- `exercises` (100), `exercise_categories` (5), `ratings` (0)
- `conversation_sessions` (10), `performance_metrics` (70)
- Views: `v_progress`, `v_core_lifts`
- Functions: `get_user_history`, `get_user_progress`, `get_exercise_history`, `get_exercise_stats`, `get_exercise_1rm_data`, `get_core_lift_progression`, `get_current_core_lift_maxes`, `get_workout_frequency_stats`, `analyze_progress`, `update_updated_at_column`
- RLS policies for every user-scoped table (owner = `auth.uid()` on `users`/`programs`/`ratings`/`conversation_sessions`/`performance_metrics`; join-based ownership on `workouts`/`workout_exercises`/`sets`; authenticated read on `exercises` + `exercise_categories`)

## What I will restore vs skip

Restore:
- All 10 public tables (with primary keys, sequences, FKs, defaults, checks)
- The two views
- All `public.*` helper functions
- RLS + policies + explicit `GRANT`s for every table (required on Lovable Cloud)
- `updated_at` trigger on `conversation_sessions`
- Reseed `exercise_categories` (5 rows) and `exercises` (100 rows) from the backup — the catalog the app depends on

Skip (intentionally):
- `auth.*`, `storage.*`, `realtime.*`, `vault.*`, `supabase_migrations.*` — managed by Lovable Cloud, must not be touched
- The `vector(768)` column on `exercises` — requires the `pgvector` extension and isn't used by current app code; I'll drop that column from the restore. If you want semantic exercise search back later, we can enable pgvector separately.
- User-scoped historical rows (`users`, `programs`, `workouts`, `workout_exercises`, `sets`, `conversation_sessions`, `performance_metrics`, `ratings`) — these reference `auth.users` IDs (`kalujay2000@gmail.com` etc.) that don't exist in the new auth system. Importing them would create orphaned rows and RLS would hide them anyway. Fresh accounts start clean; see "Optional user-data recovery" below.

## Step-by-step

1. **Confirm backend is awake** — run `cloud_status`; abort if not `ACTIVE_HEALTHY`.
2. **Migration 1 – schema**: create the 10 tables in dependency order, sequences, PKs, FKs, checks, `GRANT`s to `authenticated`/`service_role` (plus `anon` SELECT on `exercises` + `exercise_categories` if you want the catalog visible pre-login — default: authenticated-only, matching the original).
3. **Migration 2 – RLS + policies** exactly as in the backup (own-row policies + join-based ownership for `workouts`/`workout_exercises`/`sets`), plus the `DELETE` policy on `workouts` that was added later.
4. **Migration 3 – functions, views, trigger** (`update_updated_at_column`, all `get_*` functions, `v_progress`, `v_core_lifts`, `conversation_sessions` updated_at trigger). All functions `SECURITY DEFINER` with `SET search_path = public, pg_temp` to satisfy the linter.
5. **Data seed** (via `insert` tool, not migration): reseed `exercise_categories` and `exercises` from the backup's COPY blocks.
6. **Regenerate types** happens automatically after migrations; then verify by loading the app, signing in, and generating a workout end-to-end.
7. **Run `supabase--linter`** and fix any flagged issues from the restored objects.

## Optional user-data recovery (ask if you want it)

If you want your old workouts/programs back under your new account, I can, in a follow-up:
- Ask you to sign in once so a new `auth.users` row exists
- Rewrite the old `user_id` in the backup's COPY blocks to your new UUID
- Insert `programs` → `workouts` → `workout_exercises` → `sets` in order

Say the word after the rebuild if you want that; otherwise we start fresh.

## Technical notes

- `public.users.id` default was `auth.uid()` in the backup — keeping that.
- `workouts.completed` default `false`, `sets.performed_at` default `now()`, `programs.created_at` default `now()` — all preserved.
- `ratings` PK is `(user_id, exercise_id)` — preserved.
- FKs: `sets.workout_exercise_id → workout_exercises.id`, `workout_exercises.workout_id → workouts.id`, `workout_exercises.exercise_id → exercises.id`, `workouts.program_id → programs.id`, `programs.user_id → auth.users.id`, `ratings.exercise_id → exercises.id`, `exercises.category_id → exercise_categories.id`. All get `ON DELETE` behaviors matching original where present.
- Grants pattern per table: `GRANT SELECT, INSERT, UPDATE, DELETE ... TO authenticated; GRANT ALL ... TO service_role;` — no `anon` grants on user-scoped tables.
