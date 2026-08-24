-- ============================================================
-- uploaded_files: metadata for files stored in Supabase Storage
-- ============================================================
create table public.uploaded_files (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  bucket_id text not null default 'user-files',
  storage_path text not null,
  file_name text not null,
  mime_type text,
  size_bytes bigint,
  related_table text,
  related_id uuid,
  created_at timestamptz not null default now()
);

create index uploaded_files_user_id_idx on public.uploaded_files(user_id);

alter table public.uploaded_files enable row level security;
create policy "uploaded_files_all_own" on public.uploaded_files
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ============================================================
-- audit_logs: append-only trail of user actions (who/what/when)
-- ============================================================
create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  action text not null,
  table_name text,
  record_id uuid,
  changes jsonb,
  created_at timestamptz not null default now()
);

create index audit_logs_user_id_idx on public.audit_logs(user_id);
create index audit_logs_table_name_idx on public.audit_logs(table_name);

alter table public.audit_logs enable row level security;

-- Audit logs are append-only from the client: users can read their own
-- history but cannot update or delete it (writes happen via insert only).
create policy "audit_logs_select_own" on public.audit_logs
  for select using (auth.uid() = user_id);
create policy "audit_logs_insert_own" on public.audit_logs
  for insert with check (auth.uid() = user_id);

-- ============================================================
-- storage: private bucket for user-uploaded files (receipts, statements)
-- ============================================================
insert into storage.buckets (id, name, public)
values ('user-files', 'user-files', false)
on conflict (id) do nothing;

create policy "user_files_select_own"
  on storage.objects for select
  using (bucket_id = 'user-files' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "user_files_insert_own"
  on storage.objects for insert
  with check (bucket_id = 'user-files' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "user_files_delete_own"
  on storage.objects for delete
  using (bucket_id = 'user-files' and auth.uid()::text = (storage.foldername(name))[1]);
