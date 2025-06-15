# Free to Hang - Setup Juhend

## 1. Environment Variables

Loo `.env` fail projekti juurkausta ja lisa järgmised muutujad:

```env
# Supabase Configuration
EXPO_PUBLIC_SUPABASE_URL=your_supabase_url_here
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key_here

# Backend Configuration (development)
EXPO_PUBLIC_API_URL=http://localhost:3000
```

## 2. Supabase Andmete Leidmine

1. Mine [Supabase Dashboard](https://supabase.com/dashboard)
2. Vali oma projekt
3. Mine **Settings → API**
4. Kopeeri:
   - **Project URL** → `EXPO_PUBLIC_SUPABASE_URL`
   - **anon public** key → `EXPO_PUBLIC_SUPABASE_ANON_KEY`

## 3. Backend Käivitamine

```bash
cd backend
npm install
npm start
```

## 4. Frontend Käivitamine

```bash
npm start
```

## 5. Testimine

1. **Registreerimine**: Ava äpp ja proovi uut kasutajat registreerida
2. **Sisselogimine**: Proovi olemasoleva kasutajaga sisse logida
3. **Backend Test**: Mine `http://localhost:3000` - peaks näitama "Free to Hang API töötab!"

## Probleemide Korral

- Kontrolli, et kõik environment variables on õigesti seadistatud
- Vaata browser console'i või terminal'i error'eid
- Kontrolli, et Supabase projekt on aktiivselt töötamas 