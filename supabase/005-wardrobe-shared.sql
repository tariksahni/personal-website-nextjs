-- Wardrobe sharing: let extra accounts (e.g. a work login) use the SAME wardrobe as the owner.
-- Run AFTER 004-wardrobe.sql. Idempotent: safe to re-run in the Supabase SQL editor.
--
-- public.wardrobe_members maps a member account -> the owner account whose wardrobe it uses.
-- public.wardrobe_owner() returns the owner id for the caller (or the caller's own id when not a
-- member). Every wardrobe RLS policy, column default and storage policy below uses it, so a linked
-- member reads/writes the owner's rows and the owner's "<owner_id>/..." storage folder.
-- Members are managed only here in the SQL editor (no insert/update/delete policies).

-- ---------------------------------------------------------------- members

create table if not exists public.wardrobe_members (
  member_id uuid primary key references auth.users on delete cascade,
  owner_id uuid not null references auth.users on delete cascade
);

alter table public.wardrobe_members enable row level security;

drop policy if exists "wardrobe_members_select_own" on public.wardrobe_members;
create policy "wardrobe_members_select_own" on public.wardrobe_members
  for select to authenticated
  using (member_id = auth.uid());

-- ---------------------------------------------------------------- owner resolver

create or replace function public.wardrobe_owner()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select owner_id from public.wardrobe_members where member_id = auth.uid()),
    auth.uid()
  )
$$;

revoke all on function public.wardrobe_owner() from public;
revoke all on function public.wardrobe_owner() from anon;
grant execute on function public.wardrobe_owner() to authenticated;

-- ---------------------------------------------------------------- table defaults + RLS

alter table public.wardrobe_items alter column user_id set default public.wardrobe_owner();
alter table public.wardrobe_profile alter column user_id set default public.wardrobe_owner();
alter table public.wardrobe_wear_log alter column user_id set default public.wardrobe_owner();
alter table public.wardrobe_suggestions alter column user_id set default public.wardrobe_owner();

-- Same policy names as 004, so the old auth.uid()-only policies are replaced (none left behind).
do $$
declare
  t text;
begin
  foreach t in array array['wardrobe_items','wardrobe_profile','wardrobe_wear_log','wardrobe_suggestions'] loop
    execute format('drop policy if exists "%1$s_select_own" on public.%1$I', t);
    execute format('drop policy if exists "%1$s_insert_own" on public.%1$I', t);
    execute format('drop policy if exists "%1$s_update_own" on public.%1$I', t);
    execute format('drop policy if exists "%1$s_delete_own" on public.%1$I', t);

    execute format('create policy "%1$s_select_own" on public.%1$I for select to authenticated using (user_id = public.wardrobe_owner())', t);
    execute format('create policy "%1$s_insert_own" on public.%1$I for insert to authenticated with check (user_id = public.wardrobe_owner())', t);
    execute format('create policy "%1$s_update_own" on public.%1$I for update to authenticated using (user_id = public.wardrobe_owner()) with check (user_id = public.wardrobe_owner())', t);
    execute format('create policy "%1$s_delete_own" on public.%1$I for delete to authenticated using (user_id = public.wardrobe_owner())', t);
  end loop;
end $$;

-- ---------------------------------------------------------------- storage (bucket "wardrobe")

drop policy if exists "wardrobe_objects_select_own" on storage.objects;
drop policy if exists "wardrobe_objects_insert_own" on storage.objects;
drop policy if exists "wardrobe_objects_update_own" on storage.objects;
drop policy if exists "wardrobe_objects_delete_own" on storage.objects;

create policy "wardrobe_objects_select_own" on storage.objects
  for select to authenticated
  using (bucket_id = 'wardrobe' and (storage.foldername(name))[1] = public.wardrobe_owner()::text);

create policy "wardrobe_objects_insert_own" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'wardrobe' and (storage.foldername(name))[1] = public.wardrobe_owner()::text);

create policy "wardrobe_objects_update_own" on storage.objects
  for update to authenticated
  using (bucket_id = 'wardrobe' and (storage.foldername(name))[1] = public.wardrobe_owner()::text)
  with check (bucket_id = 'wardrobe' and (storage.foldername(name))[1] = public.wardrobe_owner()::text);

create policy "wardrobe_objects_delete_own" on storage.objects
  for delete to authenticated
  using (bucket_id = 'wardrobe' and (storage.foldername(name))[1] = public.wardrobe_owner()::text);

-- ---------------------------------------------------------------- linking a member (run manually)
-- Replace the placeholders with real emails in the SQL editor; never commit real emails.
-- Both accounts must have signed in at least once (so they exist in auth.users).
-- Also add the member's email to WARDROBE_OWNER_EMAIL in Netlify (comma-separated).
--
-- insert into public.wardrobe_members (member_id, owner_id)
-- select m.id, o.id from auth.users m, auth.users o
-- where m.email = 'SECOND_EMAIL' and o.email = 'MAIN_EMAIL'
-- on conflict (member_id) do update set owner_id = excluded.owner_id;
--
-- Unlink: delete from public.wardrobe_members where member_id = (select id from auth.users where email = 'SECOND_EMAIL');
