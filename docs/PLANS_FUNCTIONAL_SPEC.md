## Plans – funktsionaalne spetsifikatsioon

See dokument kirjeldab terviklikult, kuidas „Plans” funktsionaalsus töötab: plaanide tüübid, staatused ja õigused, nähtavus erinevates vaadetes, reaalajas uuendused, küsitlused (pollid) ja plaani elutsükkel.

Dokument on kirjutatud elluviimise jaoks: sisaldab nõudeid (Acceptance Criteria), reegleid, reaalaja käitumist ja avatud küsimusi, mis tuleb enne arendust kinnitada.

### Sõnastus
- **Plan**: üritus/plaan kasutajate grupiga.
- **Participant**: plaani osaline.
- **Invitation**: plaani kutse/ooteolek plaaniga liitumiseks.
- **Poll**: küsitlus plaani sees (When/Where, Custom, Invitation poll).
- **Realtime**: UI uuendused ilma manuaalse refreshita (nt Supabase Realtime / websockets).

---

## 1) Plaani tüübid

- **Tavaline plaan (normal)**
  - Looja näeb plaani kohe vaates `Plans → Plan` (aktiivsed plaanid).
  - Kõik teised kutsutud kasutajad näevad alguses plaani vaates `Plans → Invitations` (kutsed/ooteolek).
  - Looja staatus on automaatselt `going`.
  - Kõigi teiste algstaatus on `pending`.

- **Anonymous plaan**
  - Plaan ilmub kõigile (sh loojale) vaates `Plans → Invitations`.
  - Kõik osalejad, sh looja, alustavad staatusega `pending`.

Acceptance Criteria
- Tavalise plaani loomisel: looja näeb plaani kohe `Plans → Plan`, kutsutud näevad `Plans → Invitations`.
- Anonymous plaani loomisel: kõik (sh looja) näevad plaani `Plans → Invitations`.
- Kõik vaated uuenevad reaalajas ilma manuaalse refreshita.

---

## 2) Osaleja staatused ja õigused

Staatuse loetelu:
1. `pending`
2. `going`
3. `maybe`
4. `conditional`
5. `declined`

Õigused rollide kaupa

- `pending`
  - Näeb plaani detaile.
  - Ei saa detaile muuta.
  - Ei saa luua ega muuta polle.
  - Ei saa hääletada.
  - Ei saa chattida.

  Kui kasutaja läheb `pending` -> ,`going`,`maybe`, `conditional`, siis liigub plaan plans->plan alla
  Kui kasutaja valib `declined`, siiskustub plaan tema vaatest üldse ära

- `going`
  - Võib muuta plaani detaile (pealkiri, kirjeldus jne – täpsustada allpool UI/Fields).
  - Võib luua polle, muuta polle ja hääletada.
  - Võib chattida.
  - Võib teha invitation poll’e (soovitada uusi inimesi).

- `maybe`
  - Sama nähtavus kui `pending`.
  - Võib chattida.
  - Ei saa polle luua, muuta ega hääletada.

- `conditional`
  - Õigused nagu `maybe` staatusel
  - Kui tingimus(ed) täituvad, staatus muutub automaatselt `going`.

- `declined`
  - Teised osalejad näevad, et kasutaja on keeldunud.
  - Keeldunud kasutajal kaob plaan aktiivsete vaadete alt (ei osale enam; completed vaatesse ei liigu).

Acceptance Criteria
- Staatuste vahetus peegeldub kõigil osapooltel reaalajas.
- Õiguste piirangud on enforce’itud nii backendis (RLS/poliitikad) kui ka UI-s.

---

## 3) Conditional loogika

- Kasutaja võib valida staatuse `conditional` koos tingimustega, nt „A tuleb, kui B tuleb”.
- Reegel: kui kõik antud kasutaja tingimuslikud seosed on täidetud, muutub tema staatus automaatselt `going`.
- Toetada võib ka aheltingimusi (nt A→B, B→C, C→A). Kui ahel sulgub selliselt, et kõik tingimused on täidetud, muutuvad nad kõik `going`.
- Hindamine toimub igal staatuse muutusel (nt kui keegi läheb `going`, reevaluate’ime conditionalid ja teavitame reaalajas).

Acceptance Criteria
- Conditional staatusest muututakse `going`, kui kõik seotud tingimused on täidetud.
- Aheltingimused on toetatud; keerdjuhul teeme deterministliku korduva hindamise kuni stabiilsuseni.


---

## 4) Reaalajas uuendused (Realtime)

Järgmised sündmused peavad levima kõigile asjaosalistele ilma manuaalse refreshita:
- Plaani loomine ja esmane nähtavus vastavates vaadetes.
- Osaleja staatuse muutus (`pending` → `going`/`maybe`/`conditional`/`declined`).
- Plaani detailide muutmine (pealkiri, kirjeldus, when/where kinnitused).
- Pollide loomine, küsimuse/valikute muutmine, hääletused, võitja muutus.
- Invitation poll’i loomine, hääled, taimeri lõpp ja tulemuse rakendamine (uue inimese lisamine plaani `pending` staatuses).
- Chat-sõnumid.

Acceptance Criteria
- Kõik ülaltoodud sündmused on nähtavad < 1s latentsusega (praktikas 1–3s on ok).
- Klient ei vaja käsitsi refreshi; kanalite liitumine on automaatne vastavalt plaani/vaate kontekstile.

---

## 5) Pollid

Pollide tüübid:
1) „When/Where” – eeldefineeritud küsimused (aja/locationi valik)
2) „Custom poll” – vaba küsimus kuni 4 valikuga
3) „Invitation poll” – hääletus, kas kutsuda konkreetne inimene

Üldreeglid
- Igal pollil on kuni 4 valikut.
- Hääletus ja muudatused peegelduvad reaalajas.
- Võitja määramine toimub reeglite põhjal (vt allpool). Kui võitja muutub, uuendub plaani „aktiivne väärtus” (nt valitud aeg/koht) ja levib reaalajas.

### 5.1 When/Where poll
- Võib lisada kuni 4 valikut.
- Valikuid võib muuta, välja arvatud kaks populaarseimat valikut, mis on lukus algoritmi alusel.
- Hääletada saavad rollid vastavalt õigustele (eeldus: ainult `going`).
- Võitja määramine: enim hääli kogunud valik; viigi korral kasutatakse tie-breaker algoritmi (täpsustada).

Kahe populaarseima lukustamise algoritm (kehtib When/Where küsitlustele)
- Lukustamist hinnatakse iga muudatuse järel reaalajas (valiku lisamine/muutmine, hääl).
- Kui osalusmäär < 45% (osalejate ligikaudne hinnang: max(totalVoters*2, 4)), ei lukustata midagi.
- Sorteeri valikud häälte järgi kahanevalt.
- Kui valikuid on ≥ 3:
  - Lukusta TOP2, kui nii 1. kui 2. kohal on rohkem hääli kui 3. kohal.
  - Muidu, kui 1. koht juhib selgelt (rohkem kui 2. ja 3. kohal), lukusta ainult 1. koht.
- Kui valikuid on täpselt 2: lukusta 1. koht, kui sellel on rohkem hääli kui 2. kohal.
- Muidu ei lukustata.
- Lukus valikuid ei saa muuta ega eemaldada.

### 5.2 Custom poll
- Sama loogika mis When/Where, kuid küsimus on muudetav.
- Kuni 4 valikut.
- Õigused: küsimust ja valikuid võib muuta ainult `going`.

### 5.3 Invitation poll
- Eesmärk: teha grupihääletus, kas kutsuda konkreetne inimene plaani.
- Taimer: 10 minutit alates polli loomisest.
- Hääletus: Jah / Ei.
- Otsus: kui 10 minuti lõpus on „Jah” häälteenamus, lisatakse valitud kasutaja plaani osalejaks staatusega `pending`.
- Reaalajas sündmused: polli loomine, hääletused, taimeri lõpp, kasutaja lisamine plaani.

Avatud detailidhääletanutest”
- Häälteenamuse definitsioon: „rohkem kui 50% antud häältest”; viigi korral „Ei”.
- Hääleõigus: kas ainult `going`
- Mis juhtub, kui sihtkasutaja on juba plaanis - keelata invitation poll selle kasutaja kohta (seda kasutajat pole seal isegi näha nende seas keda kutsuda)

Acceptance Criteria
- Polli taimer töötab usaldusväärselt serveri-autoriteediga.
- Enamuse korral lisatakse kasutaja plaani `pending` staatuses, ning sellele kasutajale tuleb plaan plans->invintations tabi

---

## 6) Nähtavus vaadetes

Vaated:
- `Plans → Plan` (aktiivsed plaanid, kus kasutaja on `going`, `maybe`, `conditional`)
- `Plans → Invitations` (kutsed : `pending`)
- `Plans → Completed` (lõpetatud plaanid, 24h peale plaani loomist)

Reeglid
- Tavaline plaan: Looja on `going` → näeb kohe „Plan”; kutsutud on `pending` → näevad „Invitations”.
- Anonymous plaan: Kõik on `pending` (sh looja) → näevad „Invitations”.
- Kui kasutaja vajutab `decline`, eemaldub plaan tema aktiivsetest vaadetest; teised näevad, et ta keeldus.
- Kui plaan muutub „completed”, liigub see osalejatel vaatesse „Completed”.

Acceptance Criteria
- Staatuse muutus nihutab plaani õigesse vaatesse reaalajas.

---

## 7) Plaani elutsükkel ja lõpetamine

- Loomise aeg: T+0.
- Automaatne lõpetamine: T+24h pärast plaani loomist muutub plaan staatuseks „completed”.
- Completed plaan kolitakse vaatesse `Plans → Completed`.
- 24h algab loomise hetkest

Acceptance Criteria
- Plaan lõpetatakse automaatselt 24h järel isegi siis, kui kliendid on offline (server/DB autoriteet). Reaalajas teavitus aktiivsetele klientidele.



---

## 8) Notifikatsioonid (soovituslik)

- Kutse saamine (`pending`): push teavitus.
- „Going” kinnitus: grupile teavitus.
- Uus poll / hääletus / võitja muutus: teavitus osalistele.
- Invitation poll start/finish: teavitus osalistele.
- Chat sõnumid: reaalajas badge + valikuline push.

NB: Notifikatsioonide täpne maht ja throttling tuleb kooskõlastada, et vältida ületeavitamist.

---

## 9) Andmemudel (kõrgtaseme visand)

Märkus: täpne skeem tuleb joondada olemasoleva Supabase/DB skeemiga. Alljärgnev on funktsionaalsete nõuete peegeldamiseks.

- `plans`
  - id, creator_id, title, description, created_at, is_anonymous, completed_at, ...
- `plan_participants`
  - plan_id, user_id, status (pending|going|maybe|conditional|declined), conditional_target_ids[], updated_at
- `polls`
  - id, plan_id, type (when|where|custom|invitation), question, created_by, created_at, closes_at (invitation puhul)
- `poll_options`
  - id, poll_id, label, is_locked (When/Where top2 lukustamiseks), position
- `poll_votes`
  - poll_id, option_id, user_id, created_at
- `chat_messages`
  - id, plan_id, user_id, content, created_at

Reaalajas kanalid
- Per-plan kanal: sündmused plaani kohta (detailid, staatused, chat, pollid).
- Per-list kanalid: vaadete uuendused (uued kutsed/plaanid/komplekteerimised).

Autoriõigused
- Õigused enforce’itakse RLS/poliitikatega vastavalt staatusele.

---

## 10) API / tegevused (näited)

Kliendi peamised tegevused
- Loo plaan (normal/anonymous) → server tagastab plaani ja esmane jaotus vaadetesse toimub reaalajas.
- Muuda oma staatust: `pending → going/maybe/conditional/declined`.
- Loo poll (when/where/custom/invitation), lisa/muuda valikuid, hääleta.
- Saada chat-sõnum.

Serveri/DB autoriteet
- 24h auto-complete job.
- Invitation poll 10-min taimeri käsitlus ja tulemus.
- Conditional reevaluation igal staatuse muutusel.

---

## 11) Acceptance testid (katvuse näited)

1. Normal plan – nähtavus
   - Looja näeb `Plan`; kutsutud näevad `Invitations`; reaalajas.

2. Anonymous plan – nähtavus
   - Kõik näevad `Invitations`; reaalajas.

3. Rolliõigused
   - `pending` ei saa chat’ida ega hääletada.
   - `maybe` saab chat’ida, kuid ei saa hääletada ega muuta.
   - `going` saab muuta detaile, teha/hääletada polle, chat’ida.

4. Conditional ahel
   - A→B, B→C, C→A; kui üks läheb `going`, reevaluate kuni kõik `going`.

5. When/Where poll
   - 4 valiku piirang, top2 lukustus, hääletused, võitja reaalajas.

6. Custom poll
   - Küsimuse muutmine, 4 valikut, hääletused, reaalajas.

7. Invitation poll
   - 10-min taimer, häälteenamus „Jah” → kasutaja lisatakse `pending`-ina; reaalajas.

8. Decline
   - Decline eemaldab plaani selle kasutaja aktiivsetest vaadetest, teised näevad „declined by X”.

9. Auto-complete 24h
   - 24h järel plaan liigub „Completed”; reaalajas kõigile.

---

## 12) Avatud küsimused (kinnitada)

- Who-can-vote:
VASTUS:
  - When/Where ja Custom: ainult `going`
  - Invitation poll: ainult `going` 

- Tie-breaker reeglid viigi korral (When/Where, Custom):
  - VASTUS: deterministlik ja läbipaistev reegel „kõige varem lisatud valik võidab viigi”

- Top2 lukustamise algoritm (When/Where):
  - Lukustamine toimub reaalajas igal muudatusel; lukus valikuid ei saa muuta ega eemaldada; vaata 5.1 jaotise täpset loogikat.

- Kas looja võib hiljem `decline` teha? Kui jah, kas plaan jääb alles, kui teisi `going` osalejaid on? (soovitus: plaan jääb alles, kui vähemalt 1 `going` osaleja on.) 
VASTUS: loojal ei ole eriõigusi, tema on täpselt need õigused, mis tal staatusega kaasa tulevad ning kui ta declineb, siis on see samamoodi nagu kui iga teine osaleja declainiks.

- Kas `conditional` staatuses kasutaja saab chattida? VASTUS: jah saab, samamoodi nagu maybe

Lisa reegel: conditional väärtus näeb teistele välja nagu maybe. ehk seda conditional väärtust näeb ainult kasutaja ise, et ta on conditional, teistele on ta maybe ja õigused samamoodi nagu maybe. See on nagu triggeriga maybe, ehk kui mingid asjad juhtuvad, siis kasutaja automaatselt muutub maybe-st going staatusesse.

---

## 13) Implementatsiooni märkused (joondus olemasolevaga)

- Realtime: kasutada olemasolevat Realtime lahendust (Supabase Realtime/Channels). Ühtne sündmuste skeem, et UI saaks diff’e minimaalse payloadiga.
- RLS/poliitikad: rangelt jõustada rollipõhiseid õigusi, eriti `pending`/`maybe` piirangud.
- Idempotentsed endpointid operatsioonidele, mis võivad saabuda duplikaatselt (nt reaalajas reconnect’ide korral).
- Server-autoriteet taimeritele: invitation poll 10 min + 24h auto-complete.
- Kliendi caching: optimistic UI ainult ohutute muutuste korral; muidu oodata serveri kinnitust.

---

Kui kinnitad ülaltoodud reeglid/avatud punktid, saan kohe alustada elluviimisega ja kaardistada need olemasoleva koodi/DB skeemiga.

