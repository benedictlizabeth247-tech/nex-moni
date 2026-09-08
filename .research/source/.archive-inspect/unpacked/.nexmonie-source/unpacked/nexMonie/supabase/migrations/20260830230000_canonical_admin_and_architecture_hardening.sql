-- Canonical architecture + administrator identity hardening.
-- Runtime authorization uses public.admin_staff; email addresses are only used
-- here to provision the three explicitly designated staff identities.

create or replace function public.sync_designated_admin_staff()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_email text := lower(trim(coalesce(new.email, '')));
begin
  if normalized_email in (
    'www.atuchukwuarinze@gmail.com',
    'stevearinze594@gmail.com',
    'fxchristopher96@gmail.com'
  ) then
    insert into public.admin_staff(user_id, email, active)
    values (new.id, normalized_email, true)
    on conflict (user_id) do update
      set email = excluded.email,
          active = true;
  else
    update public.admin_staff
      set active = false,
          email = normalized_email
    where user_id = new.id;
  end if;

  return new;
end;
$$;

revoke all on function public.sync_designated_admin_staff() from public, anon, authenticated;

drop trigger if exists trg_sync_designated_admin_staff on auth.users;
create trigger trg_sync_designated_admin_staff
after insert or update of email on auth.users
for each row execute function public.sync_designated_admin_staff();

-- Ensure the three existing designated accounts are represented when they exist.
insert into public.admin_staff(user_id, email, active)
select id, lower(email), true
from auth.users
where lower(email) in (
  'www.atuchukwuarinze@gmail.com',
  'stevearinze594@gmail.com',
  'fxchristopher96@gmail.com'
)
on conflict (user_id) do update
  set email = excluded.email,
      active = true;

-- The admin registry is server-only. Users must never be able to enumerate it.
revoke all on public.admin_staff from anon, authenticated;
