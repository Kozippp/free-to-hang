# 📋 Plans Süsteemi Funktsionaalsused - Täielik Ülevaade

## 🎯 Üldine Eesmärk
Plans süsteem võimaldab kasutajatel luua, hallata ja osaleda erinevatel sündmustel/plaanidel koos sõpradega.

---

## 1. **Plaanide reeglid**
**Create normal plan** - kasutaja saab tavalise plaani
    Loojale ilmub plaan plans -> plan alla
    Kutsututele ilmub plaan plans -> invintations alla
    Looja on set "going"
    Kutsutud on set "pending"

**Create anynomous plan** - kasutaja saab anonyymse plaani plaani
    Nii loojale kui ka kutsututele ilmub plaan plans -> invintations alla
    Nii looja kui ka kutsutud on set "pending"


- ✅ **Edit plans** - Plaanide pealkirja, teksti, polle, saab muuta
    Muuta saavad ainult kasutajad, kes on "Going"
    Need kes on "pending" või "maybe" või "conditional" saavad ainult näha

- ✅ **Delete plans** - kasutaja saab kustutada oma plaane
    Kasutaja saab määrata staatuseks "declined" mis ei seosta teda enam plaaniga ning ta ei näe enam plaani
    Teised kasutajad näevad, kes on "declined"

- ✅ **Plan details** - täielik info plaani kohta (title, description, location, date, privacy)
- ✅ **Plan status** -  active, completed
Plaan liigub "completed" staatusesse automaatselt 24h pärast

### 📝 Plan Fields:
- `title` - plaani pealkiri
- `description` - plaani kirjeldus
- `Time poll` - kasutajad saavad pakkuda kuni neli võimalust, plaani jaoks ning siis hääletada, milline neile sobib. enim hääletatud plaan võidab. kui on samapalju hääli, siis võitja valitakse automaatselt.
- `Location poll` - kasutajad saavad pakkuda kuni neli võimalust, plaani jaoks ning siis hääletada, milline neile sobib. enim hääletatud plaan võidab. kui on samapalju hääli, siis võitja valitakse automaatselt.
- `is_private` - kas tegemist on tavalise või anonüümse plaaniga
- `status` - olek
- `creator_id` - looja ID

---

## 2. **Participants (Osalejad)**
- ✅ **Invite friends** - kutsuda sõpru plaani
- ✅ **Accept/decline invitations** - vastu võtta/keelduda kutsest
- ✅ **Maybe response** - "võibolla" vastus
- ✅ **Conditional participation** - osalemine sõltub teistest 
- ✅ **Real-time updates** - kohe näha, kui keegi lõi plaani, kui keegi lõi või muutis polli, või hääletas polli või muutis oma staatust. kõik on realtime

### 👥 Participant Statuses:
- `pending` - ootab vastust
- `accepted` - vastu võttis
- `maybe` - võibolla
- `declined` - keeldus
- `conditional` - tinglik osalemine

---

## 3. **Polls (Hääletused)**
- ✅ **Create polls** - luua hääletusi (when, where, custom, invitation)
- ✅ **Vote on polls** - hääletada poll'idel
- ✅ **Multiple choice** - mitme valiku hääletused
- ✅ **Poll results** - näed tulemusi reaalajas (kes mida on valinud ning kas mõni valik on võitnud) 
- ✅ **Expiration** - poll'id võivad aeguda (näiteks invintation pollid kestavad 10 minutit)

### 🗳️ Poll Types:
- `when` - millal
- `where` - kus
- `custom` - kohandatud
- `invitation` - kutsete hääletus

### 📊 Poll Structure:
- `question` - küsimus
- `options` - valikud
- `votes` - hääled
- `expires_at` - aegub

---

## 4. **Real-time Features**
- ✅ **Instant notifications** - kohe teada, kui midagi juhtub
- ✅ **Live updates** - ei pea lehte värskendama
- ✅ **Real-time chat** - vestlused plaani kohta
- ✅ **Status changes** - kohe näha muudatusi

### 🔄 Real-time Updates:
- Plan creation
- Participant responses
- poll vote option creation/changs
- Poll votes
- Chat messages

---

## 5. **Notifications & Updates**
- ✅ **Plan updates** - teated plaani muudatuste kohta 
- ✅ **Participant responses** - teated vastuste kohta
- ✅ **Poll results** - teated hääletuste tulemuste kohta
- ✅ **Invitation reminders** - meeldetuletused

### 📱 Notification Types:
- Push notifications
- In-app notifications
- Real-time updates

---



### 🔒 Security Features:
- Row Level Security (RLS)
- User authentication

---

## 7. **Advanced Features**
- ✅ **Conditional logic** - "kui X tuleb, siis Y tuleb ka"
- ✅ **Auto-invite** - automaatne kutsed hääletuste põhjal
- ✅ **Plan completion** - plaani lõpetamise hääletus
- ✅ **Attendance tracking** - osalemise jälgimine

### 🧠 Conditional Logic:
- `conditional_friends` - sõbrad, kellele osalemine sõltub
- `conditional_mode` - "any" või "all"
- Auto-invite threshold

---

## 8. **User Experience**
- ✅ **Responsive design** - töötab kõikidel seadmetel
- ✅ **Push notifications** - teated telefoni

### 📱 UX Features:
- Mobile-first design
- Intuitive navigation
- Fast loading
- Smooth animations

