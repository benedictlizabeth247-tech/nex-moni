# Supabase migration baseline — explicit boundary

The current repository contains incremental migrations that reference foundational objects such as `public.profiles`, `public.wallets`, `public.wallet_transactions`, `public.orders`, and other legacy application tables that were created before the supplied migration history.

We will **not fabricate those definitions**. Doing so would risk changing financial column semantics, constraints, triggers, or existing production data.

## Required production action

Against the actual linked nexMonie Supabase project:

1. `supabase login`
2. `supabase link --project-ref <THE_REAL_NEXMONIE_PROJECT_REF>`
3. `supabase migration list`
4. `supabase db pull`
5. Inspect the generated remote-schema migration.
6. Re-run the repository migration verifier.
7. Only then use `supabase db push` for new migrations.

Supabase's migration guidance explicitly recommends capturing remote schema into migrations and keeping remote schema changes under version control rather than making direct remote changes. See the official documentation cited in the project review.

**Status:** dependency boundary documented and machine-checked; complete clean-database reconstruction remains blocked until the exact remote schema is pulled from the real Supabase project.
