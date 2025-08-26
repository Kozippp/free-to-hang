### Supabase project switching

This app can switch between multiple Supabase projects without code changes using environment variables.

- Frontend (Expo): controlled by `EXPO_PUBLIC_SUPABASE_ACTIVE_PROJECT`.
- Backend (Railway): controlled by `SUPABASE_ACTIVE_PROJECT`.

#### Frontend (Expo) env

Set both project credentials and pick the active one:

- `EXPO_PUBLIC_SUPABASE_ACTIVE_PROJECT` → `KOZIPPP` or `EBPW`
- `EXPO_PUBLIC_SUPABASE_URL_KOZIPPP`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY_KOZIPPP`
- `EXPO_PUBLIC_SUPABASE_URL_EBPW`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY_EBPW`

Example (EBPW active):

```env
EXPO_PUBLIC_SUPABASE_ACTIVE_PROJECT=EBPW
EXPO_PUBLIC_SUPABASE_URL_KOZIPPP=https://nfzbvuyntzgszqdlsusl.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY_KOZIPPP=...redacted...
EXPO_PUBLIC_SUPABASE_URL_EBPW=https://eofjyuhygmuevxooeyid.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY_EBPW=...redacted...
```

#### Backend (Railway) env

Provide per-project variables and choose the active one:

- `SUPABASE_ACTIVE_PROJECT` → `KOZIPPP` or `EBPW`
- `SUPABASE_URL_KOZIPPP`, `SUPABASE_SERVICE_ROLE_KEY_KOZIPPP`, `SUPABASE_ANON_KEY_KOZIPPP`
- `SUPABASE_URL_EBPW`, `SUPABASE_SERVICE_ROLE_KEY_EBPW`, `SUPABASE_ANON_KEY_EBPW`

The backend will resolve variables by appending `_<ACTIVE>` first, falling back to base names if present.

#### Storage policies (avatars bucket)

If not created automatically, run this SQL in the target project's SQL editor:

```sql
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars','avatars', true, 5242880, array['image/jpeg','image/jpg','image/png','image/webp'])
on conflict (id) do nothing;

alter table storage.objects enable row level security;

drop policy if exists "Avatar images are publicly accessible" on storage.objects;
create policy "Avatar images are publicly accessible" on storage.objects
for select using (bucket_id = 'avatars');

drop policy if exists "Users can upload their own avatar" on storage.objects;
create policy "Users can upload their own avatar" on storage.objects
for insert with check (
  bucket_id = 'avatars' and auth.uid()::text = (string_to_array(name, '/'))[1]
);

drop policy if exists "Users can update their own avatar" on storage.objects;
create policy "Users can update their own avatar" on storage.objects
for update using (
  bucket_id = 'avatars' and auth.uid()::text = (string_to_array(name, '/'))[1]
);

drop policy if exists "Users can delete their own avatar" on storage.objects;
create policy "Users can delete their own avatar" on storage.objects
for delete using (
  bucket_id = 'avatars' and auth.uid()::text = (string_to_array(name, '/'))[1]
);
```

#### Notes
- Frontend switch is implemented in `lib/supabase.ts` via `EXPO_PUBLIC_SUPABASE_ACTIVE_PROJECT`.
- Backend switch is implemented in `backend/index.js` and used in `backend/routes/plans.js` for JWT validation client.
- Keep both projects in sync by applying the same migrations. When ready, migrate changes from EBPW to KOZIPPP.
