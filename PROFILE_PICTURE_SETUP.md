# Profiilipiltide Seadistus

See juhend aitab seadistada profiilipiltide üleslaadimise ja salvestamise funktsionaalsust.

## Vajalikud sammud

### 1. Andmebaasi Seadistus

Käivita järgmised SQL skriptid oma Supabase andmebaasis:

```sql
-- Käivita see tabelite loomiseks
\i supabase/schema.sql

-- VÕI käivita ainult storage seadistus
\i scripts/setup-storage.sql
```

### 2. Keskkonna Muutujad

Veendu, et järgmised keskkonna muutujad on seadistatud:

#### Backend (.env fail backend/ kaustas):
```
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
PORT=3000
NODE_ENV=development
```

#### Frontend (.env fail projektijuurde):
```
EXPO_PUBLIC_SUPABASE_URL=your_supabase_url
EXPO_PUBLIC_SUPABAS_ANON_KEY=your_anon_key
EXPO_PUBLIC_BACKEND_URL=http://localhost:3000
```

### 3. Backend Käivitamine

```bash
cd backend
npm install
npm start
```

### 4. Testimine

1. Ava äpp
2. Mine profiili sektsiooni
3. Puuduta profiilipilti
4. Vali "Take Photo" või "Choose from Gallery"
5. Kontrolli, et pilt laadib üles ja kuvatakse õigesti

## Probleemide Lahendamine

### Storage Bucket Probleemid

Kui avatars bucket ei ole loodud, käivita Supabase konsoolis:

```sql
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) 
VALUES (
  'avatars', 
  'avatars', 
  true, 
  5242880, -- 5MB
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
);
```

### RLS Probleemid

Veendu, et storage policies on loodud. Käivita:

```sql
-- Enable RLS
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Avatar images are publicly accessible" ON storage.objects
FOR SELECT USING (bucket_id = 'avatars');

CREATE POLICY "Users can upload their own avatar" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'avatars' 
  AND auth.uid()::text = (string_to_array(name, '/'))[1]
);
```

### Backend Connection Probleemid

Kontrolli, et:
1. Backend server töötab pordil 3000
2. CORS on õigesti seadistatud
3. Autentimine töötab

### Pildi Upload Probleemid

Kui pildi üleslaadimise ajal tekib error:
1. Kontrolli faili suurust (max 5MB)  
2. Kontrolli faili tüüpi (JPEG, PNG, WebP)
3. Vaata browser/mobile konsooli error veateid
4. Kontrolli Supabase storage õigusi

## Logid

Backend logib kõik olulised sammud. Vaata console väljundit probleemide diagnoosimiseks. 