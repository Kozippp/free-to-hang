# 🚀 Plans Süsteemi Rakendamise Plaan

## 🎯 Eesmärk
Teha plans süsteem täielikult töökindlaks etapiviisiliselt, alustades kõige kriitilisematest funktsioonidest.

---

## 📋 Etappide Ülevaade

### ✅ **Mis juba töötab:**
- Plaanide loomine (pole real-time)
- Staatuse määramine (pole real-time)
- Pealkirja/kirjelduse muutmine (ainult "going" kasutajad)

### ❌ **Mis ei tööta:**
- Poll'ide loomine ja hääletamine
- Real-time updates
- Backend API endpoint'id
- Anonüümsed plaanid

---

## 🏗️ **ETAPP 1: Backend API Parandamine** ⚠️ KRIITILINE
**Eesmärk:** Kõik API endpoint'id peavad töötama

### 1.1 Backend Route'ide Parandamine
- [ ] **Probleem:** Kõik endpoint'id annavad 404
- [ ] **Lahendus:** Paranda backend/index.js route registreerimine
- [ ] **Test:** `curl http://localhost:3000/api/plans` peaks töötama

### 1.2 Plans API Endpoint'ide Testimine
- [ ] `GET /api/plans` - kõik kasutaja plaanid
- [ ] `POST /api/plans` - uue plaani loomine  
- [ ] `GET /api/plans/:id` - konkreetse plaani andmed
- [ ] `PUT /api/plans/:id` - plaani muutmine
- [ ] `POST /api/plans/:id/respond` - plaanile vastamine

### 1.3 Polls API Endpoint'ide Testimine
- [ ] `POST /api/plans/:id/polls` - poll'i loomine
- [ ] `POST /api/plans/:id/polls/:pollId/vote` - hääletamine

**📊 Edukriteeriumid:**
- ✅ Kõik API endpoint'id tagastavad 200/201 staatuse
- ✅ Backend logib päringuid korrektselt
- ✅ Andmebaas salvestab andmeid õigesti

---

## 🏗️ **ETAPP 2: Poll'ide Süsteemi Parandamine** ⚠️ KRIITILINE
**Eesmärk:** Poll'ide loomine ja hääletamine töötab

### 2.1 Database Sünkroniseerimine
- [ ] **Kontrolli tabelid:** `poll_options`, `poll_votes`, `plan_polls`
- [ ] **Kontrolli väljad:** `question`, `expires_at`, `updated_at`
- [ ] **Kontrolli RPC funktsioonid:** `poll_vote_rpc`, `create_poll_rpc`

### 2.2 Poll Loomine
- [ ] **Frontend:** PollCreator komponent töötab
- [ ] **Backend:** `/api/plans/:id/polls` endpoint töötab
- [ ] **Database:** Poll ja options salvestatakse õigesti

### 2.3 Poll Hääletamine
- [ ] **Frontend:** PollVoting komponent töötab
- [ ] **Serverless:** `poll_vote_rpc` funktsioon töötab
- [ ] **Database:** Hääled salvestatakse õigesti

**📊 Edukriteeriumid:**
- ✅ Saab luua poll'i 4 valikuga
- ✅ Saab hääletada poll'il
- ✅ Näeb tulemusi kohe peale hääletamist

---

## 🏗️ **ETAPP 3: Real-time Updates** 🔄 OLULINE
**Eesmärk:** Kõik muudatused nähtavad kohe ilma refreshimata

### 3.1 Supabase Real-time Seadistamine
- [ ] **Tabelid:** `plans`, `plan_participants`, `plan_polls`, `poll_votes`
- [ ] **Subscriptions:** Kuula muudatusi kõigil tabelitel
- [ ] **Permissions:** RLS poliitikad lubavad real-time

### 3.2 Frontend Real-time Integration
- [ ] **PlansStore:** Kuula plaanide muudatusi
- [ ] **Plan Detail:** Kuula poll'ide ja vastuste muudatusi
- [ ] **Invitations:** Kuula uusi kutseid

### 3.3 Real-time Events
- [ ] **Plan Creation:** Uus plaan ilmub kohe invitations'isse
- [ ] **Status Change:** Staatuse muudatus nähtav kohe
- [ ] **Poll Creation:** Uus poll nähtav kohe
- [ ] **Poll Vote:** Hääletuse tulemus nähtav kohe
- [ ] **Plan Edit:** Pealkirja/kirjelduse muudatus nähtav kohe

**📊 Edukriteeriumid:**
- ✅ Uus plaan ilmub 2 sekundi jooksul
- ✅ Staatuse muudatus nähtav 2 sekundi jooksul
- ✅ Poll'i hääletuse tulemus nähtav kohe

---

## 🏗️ **ETAPP 4: Anonüümsed Plaanid** 👻 OLULINE
**Eesmärk:** Anonymous plaanide loomine ja haldamine

### 4.1 Database Schema Update
- [ ] **is_private field:** Määrab kas plaan on anonüümne
- [ ] **Creator Logic:** Anonüümse plaani looja on ka "pending"

### 4.2 Frontend Anonymous Logic
- [ ] **Plan Creation:** Checkbox "Make Anonymous"
- [ ] **Plan Display:** Anonüümse plaani looja ei ole nähtav
- [ ] **Permissions:** Anonüümses plaanis kõik "pending" kasutajad võivad muuta

### 4.3 Anonymous Plan Behavior
- [ ] **Creator Status:** Looja on "pending" (mitte "going")
- [ ] **Invitations Tab:** Nii looja kui kutsutud näevad invitations all
- [ ] **Edit Permissions:** Ainult "going" kasutajad saavad muuta

**📊 Edukriteeriumid:**
- ✅ Saab luua anonüümse plaani
- ✅ Looja ei ole nähtav teistele
- ✅ Looja näeb plaani invitations all

---

## 🏗️ **ETAPP 5: Time & Location Polls** 📍⏰ OLULINE
**Eesmärk:** Spetsiaalsed poll'id aja ja koha jaoks

### 5.1 Time Poll System
- [ ] **Poll Type:** "when" poll'id
- [ ] **Options:** Kuni 4 kuupäeva/kellaaega
- [ ] **Auto-resolve:** Enim hääletatud aeg võidab
- [ ] **Tie-breaking:** Võrdse häälte arvu korral esimene võidab

### 5.2 Location Poll System
- [ ] **Poll Type:** "where" poll'id
- [ ] **Options:** Kuni 4 asukohta
- [ ] **Auto-resolve:** Enim hääletatud koht võidab
- [ ] **Tie-breaking:** Võrdse häälte arvu korral esimene võidab

### 5.3 Poll Resolution Logic
- [ ] **Backend Logic:** Kontrollib häälte arvu
- [ ] **Auto-update:** Uuendab plaani time/location välja
- [ ] **Notifications:** Teadistab kasutajaid tulemusest

**📊 Edukriteeriumid:**
- ✅ Saab luua time poll'i 4 valikuga
- ✅ Saab luua location poll'i 4 valikuga
- ✅ Poll'i võitja määratakse automaatselt

---

## 🏗️ **ETAPP 6: Conditional Logic** 🧠 TÄIENDAV
**Eesmärk:** "Kui X tuleb, siis Y tuleb ka" loogika

### 6.1 Conditional Participation
- [ ] **UI Component:** Conditional friends selector
- [ ] **Database:** `conditional_friends`, `conditional_mode` väljad
- [ ] **Logic:** "any" või "all" mode

### 6.2 Auto-invite System
- [ ] **Threshold Logic:** Kui piisavalt inimesi on "going"
- [ ] **Auto-invite:** Kutsu conditional friends automaatselt
- [ ] **Notifications:** Teadista auto-invite'st

**📊 Edukriteeriumid:**
- ✅ Saab seada conditional participation
- ✅ Auto-invite töötab õigesti

---

## 🏗️ **ETAPP 7: Plan Lifecycle** ♻️ TÄIENDAV
**Eesmärk:** Plaanide automaatne lifecycle management

### 7.1 Auto-completion
- [ ] **Cron Job:** Kontrollib plaane 24h järel
- [ ] **Status Update:** Muudab staatuse "completed"
- [ ] **Notifications:** Teadistab kasutajaid

### 7.2 Attendance Tracking
- [ ] **UI Component:** "Mark as attended" completed plaanide jaoks
- [ ] **Database:** `plan_attendance` tabel
- [ ] **Statistics:** Näita attendance statistikat

**📊 Edukriteeriumid:**
- ✅ Plaanid muutuvad automaatselt "completed"
- ✅ Saab märkida attendance

---

## 🏗️ **ETAPP 8: Performance & UX** ⚡ TÄIENDAV
**Eesmärk:** Rakenduse optimiseerimine ja kasutajakogemuse parandamine

### 8.1 Performance Optimization
- [ ] **Caching:** Cache plaanide andmeid
- [ ] **Lazy Loading:** Laadi plaane vajadusel
- [ ] **Optimistic Updates:** Näita muudatusi kohe

### 8.2 Error Handling
- [ ] **Network Errors:** Graceful error handling
- [ ] **Retry Logic:** Automaatne retry ebaõnnestunud päringute korral
- [ ] **User Feedback:** Selged error message'id

### 8.3 Push Notifications
- [ ] **Setup:** Expo push notifications
- [ ] **Triggers:** Uus plaan, poll, vastus
- [ ] **Permissions:** Küsi kasutajalt luba

**📊 Edukriteeriumid:**
- ✅ Rakendus laadib kiiresti
- ✅ Vigade korral näidatakse selgeid teateid
- ✅ Push notifications töötavad

---

## 🏗️ **ETAPP 9: Production Deployment** 🚀 PRODUCTION
**Eesmärk:** Rakenduse viimine production'i Railway'ga

### 9.1 Railway Setup
- [ ] **Railway Account:** Loo Railway konto
- [ ] **Project Setup:** Loo uus Railway projekt
- [ ] **Environment Variables:** Seadista production env vars

### 9.2 Backend Deployment
- [ ] **Railway Config:** railway.toml ja nixpacks.toml
- [ ] **Auto-deploy:** Seadista Git integration
- [ ] **Health Check:** Railway health check endpoint

### 9.3 Environment Configuration
- [ ] **Production Database:** Supabase production instance
- [ ] **API URLs:** Uuenda frontend production API URL'id
- [ ] **CORS:** Seadista production domains

### 9.4 Monitoring & Logging
- [ ] **Railway Logs:** Monitor backend logid
- [ ] **Error Tracking:** Sentry või sarnane
- [ ] **Performance:** Monitor response times

**📊 Edukriteeriumid:**
- ✅ Backend töötab Railway'l
- ✅ Frontend suhtleb Railway backend'iga
- ✅ Production database ühendus töötab
- ✅ Monitoring ja logging töötab

---

## 📊 **Prioriteedid & Ajakava**

### 🔴 **KRIITILINE (1-2 nädalat)**
1. **ETAPP 1:** Backend API Parandamine
2. **ETAPP 2:** Poll'ide Süsteemi Parandamine

### 🟡 **OLULINE (2-4 nädalat)**
3. **ETAPP 3:** Real-time Updates
4. **ETAPP 4:** Anonüümsed Plaanid
5. **ETAPP 5:** Time & Location Polls

### 🟢 **TÄIENDAV (1-3 kuud)**
6. **ETAPP 6:** Conditional Logic
7. **ETAPP 7:** Plan Lifecycle
8. **ETAPP 8:** Performance & UX

### 🚀 **PRODUCTION (pärast MVP')**
9. **ETAPP 9:** Railway Deployment

---

## 🧪 **Testimise Strateegia**

### Iga Etapi Järel:
1. **Unit Tests:** Kontrolli funktsionaalsust
2. **Integration Tests:** Kontrolli API'de koostööd
3. **Manual Testing:** Testi kasutajaliidest käsitsi
4. **Real Device Testing:** Testi telefonis

### Lõplik Test:
- [ ] **Loo plaan** → peaks ilmuma invitations'is
- [ ] **Vasta plaanile** → staatus peaks muutuma real-time
- [ ] **Loo poll** → peaks ilmuma kohe kõigile
- [ ] **Hääleta** → tulemused peaksid uuenema kohe
- [ ] **Muuda pealkirja** → peaks uuenema real-time

---

## 📝 **Märkused**

### 🚀 Deployment Strategy:
- **Development:** Local backend (localhost:3000) + local database
- **Production:** Railway deployment + Supabase production database
- **Benefits:** Kiire arendus lokaalse serveri, scalable production Railway'ga

### 🏗️ Development Setup:
- **Local Backend:** Express server port 3000
- **Local Testing:** Saab kiiresti testida API endpoint'e
- **Hot Reload:** Backend muudatused kohe nähtavad
- **Debug Mode:** Täielik juurdepääs logidele

### 🌐 Production Setup (Railway):
- **Auto-deploy:** Git push → automaatne deployment
- **Environment Variables:** Production config Railway'st
- **Scaling:** Railway skaleerib automaatselt
- **Monitoring:** Built-in logging ja metrics

### Serverless vs Backend:
- **Serverless (Supabase):** Hääletamine, real-time updates
- **Backend (Express):** Keerulisem loogika, notifications, lifecycle
- **Hybrid Approach:** Parim mõlemast maailmast

### Database Strategy:
- **Development:** Supabase development instance
- **Production:** Supabase production instance
- **RLS Policies:** Kõik tabelid peavad olema kaitstud
- **Indexes:** Optimiseeri päringuid
- **Migrations:** Versioonihaldus schema muudatustele

### Real-time Strategy:
- **Supabase Subscriptions:** Kõige kiirem lahendus
- **Fallback:** Polling kui real-time ei tööta
- **Bandwidth:** Optimeeri suurte andmete jaoks

---

*Iga etapp on testitud ja töötab enne järgmisele üleminekut!*
