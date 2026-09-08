-- nexMonie Steps 1-5 hardening.
-- Canonical backend: Next.js server boundary -> Supabase/Postgres ledger.
-- Fiat deposits are manual bank-transfer requests; no payment-provider credit path.

-- ================================================================
-- 1/3/4: canonical admin registry and Data API exposure boundary
-- ================================================================

alter table public.admin_staff enable row level security;
revoke all on table public.admin_staff from anon, authenticated;
grant select on table public.admin_staff to service_role;

-- The runtime application must never authorize by email. These environment
-- variables are not used as authorization inputs and should not be provisioned.

-- ================================================================
-- 5: dedicated nexMonie fiat deposit request contract
-- ================================================================

alter table public.deposits enable row level security;
revoke insert, update, delete on table public.deposits from anon, authenticated;
revoke insert, update, delete on table public.deposits from service_role;
grant select on table public.deposits to authenticated;
grant select, insert, update, delete on table public.deposits to service_role;

drop policy if exists deposits_owner_select on public.deposits;
create policy deposits_owner_select on public.deposits
  for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists deposits_owner_insert on public.deposits;
create policy deposits_owner_insert on public.deposits
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

alter table public.deposits
  drop constraint if exists deposits_status_check;
alter table public.deposits
  add constraint deposits_status_check
  check (status in ('pending','processing','confirmed','failed','cancelled'));

create index if not exists deposits_reference_created_idx
  on public.deposits(reference, created_at desc);

-- Admin review evidence is immutable after review. The existing review action
-- table remains the authoritative history of who approved/rejected a deposit.
alter table public.admin_deposit_actions enable row level security;
revoke all on table public.admin_deposit_actions from anon, authenticated;
grant select, insert on table public.admin_deposit_actions to service_role;

-- Deposit settlement remains an admin/service-role-only financial mutation.
revoke all on function public.admin_review_deposit(uuid,uuid,text,text) from public, anon, authenticated;
grant execute on function public.admin_review_deposit(uuid,uuid,text,text) to service_role;
revoke all on function public.credit_fiat_deposit(uuid,numeric,text,text) from public, anon, authenticated;
grant execute on function public.credit_fiat_deposit(uuid,numeric,text,text) to service_role;

-- ================================================================
-- Provider-dependent fiat funding is explicitly legacy/non-authoritative.
-- No Paystack/Stripe/Flutterwave/Monnify route may credit a nexMonie wallet.
-- ================================================================

create table if not exists public.app_architecture_controls (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);
alter table public.app_architecture_controls enable row level security;
revoke all on table public.app_architecture_controls from anon, authenticated;
grant select, insert, update, delete on table public.app_architecture_controls to service_role;
insert into public.app_architecture_controls(key, value)
values ('fiat_deposit_authority', 'manual_bank_transfer_admin_review')
on conflict (key) do update set value=excluded.value, updated_at=now();
