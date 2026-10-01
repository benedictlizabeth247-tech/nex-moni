alter table public.deposits
  add column if not exists source_account_name text;

create index if not exists deposits_source_account_name_idx
  on public.deposits (user_id, created_at desc);
