-- Wardrobe assistant: closet items, style profile, wear log, cached suggestions.
-- Idempotent: safe to re-run in the Supabase SQL editor.
-- All tables are per-user via RLS (auth.uid() = user_id). Images live in the
-- private "wardrobe" storage bucket under "<auth.uid()>/<file>".

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------- tables

create table if not exists wardrobe_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  image_path text not null,
  category text check (category in ('top','bottom','shoes','outerwear','accessory')),
  subcategory text,
  colors text[] not null default '{}',
  pattern text,
  formality text check (formality in ('casual','smart_casual','formal')),
  seasons text[] not null default '{}',
  description text,
  created_at timestamptz not null default now()
);
create index if not exists wardrobe_items_user_idx on wardrobe_items (user_id, created_at desc);

create table if not exists wardrobe_profile (
  user_id uuid primary key default auth.uid() references auth.users on delete cascade,
  profile_text text,
  notes text,
  updated_at timestamptz not null default now()
);

create table if not exists wardrobe_wear_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  worn_on date not null,
  occasion text,
  item_ids uuid[] not null,
  outfit jsonb,
  created_at timestamptz not null default now(),
  unique (user_id, worn_on)
);
create index if not exists wardrobe_wear_log_user_date_idx on wardrobe_wear_log (user_id, worn_on desc);

create table if not exists wardrobe_suggestions (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  for_date date not null,
  occasion text not null check (occasion in ('office','casual','special')),
  payload jsonb not null,
  created_at timestamptz not null default now(),
  primary key (user_id, for_date, occasion)
);

-- ---------------------------------------------------------------- RLS

alter table wardrobe_items enable row level security;
alter table wardrobe_profile enable row level security;
alter table wardrobe_wear_log enable row level security;
alter table wardrobe_suggestions enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array['wardrobe_items','wardrobe_profile','wardrobe_wear_log','wardrobe_suggestions'] loop
    execute format('drop policy if exists "%1$s_select_own" on %1$I', t);
    execute format('drop policy if exists "%1$s_insert_own" on %1$I', t);
    execute format('drop policy if exists "%1$s_update_own" on %1$I', t);
    execute format('drop policy if exists "%1$s_delete_own" on %1$I', t);

    execute format('create policy "%1$s_select_own" on %1$I for select to authenticated using (auth.uid() = user_id)', t);
    execute format('create policy "%1$s_insert_own" on %1$I for insert to authenticated with check (auth.uid() = user_id)', t);
    execute format('create policy "%1$s_update_own" on %1$I for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id)', t);
    execute format('create policy "%1$s_delete_own" on %1$I for delete to authenticated using (auth.uid() = user_id)', t);
  end loop;
end $$;

-- ---------------------------------------------------------------- storage

insert into storage.buckets (id, name, public)
values ('wardrobe', 'wardrobe', false)
on conflict (id) do nothing;

drop policy if exists "wardrobe_objects_select_own" on storage.objects;
drop policy if exists "wardrobe_objects_insert_own" on storage.objects;
drop policy if exists "wardrobe_objects_update_own" on storage.objects;
drop policy if exists "wardrobe_objects_delete_own" on storage.objects;

create policy "wardrobe_objects_select_own" on storage.objects
  for select to authenticated
  using (bucket_id = 'wardrobe' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "wardrobe_objects_insert_own" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'wardrobe' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "wardrobe_objects_update_own" on storage.objects
  for update to authenticated
  using (bucket_id = 'wardrobe' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'wardrobe' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "wardrobe_objects_delete_own" on storage.objects
  for delete to authenticated
  using (bucket_id = 'wardrobe' and (storage.foldername(name))[1] = auth.uid()::text);
