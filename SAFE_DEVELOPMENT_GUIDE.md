# Safe Development Guide 🛡️

## Turvaline Arendamine (Safe Development)

### 🚀 Kuidas turvaliselt arendada

#### 1. Alati kasuta arendusharusid (Development Branches)
```bash
# Loo uus haru igaks uueks funktsiooniks
git checkout -b feature/new-feature-name

# Või eksperimenteerimiseks
git checkout -b experiment/trying-something-new
```

#### 2. Regulaarsed commitid ja pushid
```bash
# Commit'i sageli (iga 30-60 minuti järel)
git add .
git commit -m "Add: describe what you added"

# Push'i remote'i (varundamiseks)
git push origin your-branch-name
```

#### 3. Kuidas tagasi minna kui midagi läheb valesti

##### Viimase commit'i tagasivõtmine:
```bash
git reset --soft HEAD~1  # Säilitab muudatused
git reset --hard HEAD~1  # Kustutab muudatused (ETTEVAATUST!)
```

##### Tagasiminek kindlasse commit'i:
```bash
git log --oneline  # Vaata commit'ide ajalugu
git checkout COMMIT_HASH  # Mine kindlasse commit'i
git checkout -b recovery-branch  # Loo uus haru sellest punktist
```

##### Täielik tagasiminek töötavasse versiooni:
```bash
git checkout realtime-ehitamine  # Mine tagasi töötavasse harusse
git pull origin realtime-ehitamine  # Uuenda
```

### 💰 Kulutuste Vähendamine

#### 1. Tasuta Alternatiivid Claude'ile

##### **GitHub Copilot** (Soovitatud)
- $10/kuus tudengitele tasuta
- Integreerub otse VS Code'i
- Väga hea koodi automaatne täiendamine

##### **Cursor IDE** (Tasuta versioon)
- 2000 tasuta completions kuus
- Integreeritud AI abistaja
- Hea alternatiiv

##### **Codeium** (Tasuta)
- Täiesti tasuta AI kodeerimisabistaja
- VS Code extension
- Unlimited autocompletions

##### **Tabnine** (Tasuta versioon)
- Tasuta basic AI completions
- Töötab offline'is

#### 2. Lokaalne Arendamine (Vähendab pilve kulusid)

##### Expo Go rakendus (Tasuta testimiseks):
```bash
# Käivita lokaalselt
npx expo start
```

##### Supabase Local Development:
```bash
# Käivita Supabase lokaalselt (tasuta)
npx supabase start
```

#### 3. Tasuta Ressursid Õppimiseks

- **YouTube tutorials** - tasuta
- **React Native dokumentatsioon** - tasuta
- **Expo dokumentatsioon** - tasuta
- **Stack Overflow** - tasuta küsimused/vastused
- **GitHub Issues** - vaata teiste probleeme ja lahendusi

### 🔧 Soovitatud Workflow

1. **Alusta väikesest**
   ```bash
   git checkout -b small-improvement
   # Tee väike muudatus
   git commit -m "Small improvement"
   git push origin small-improvement
   ```

2. **Testi lokaalselt**
   ```bash
   npx expo start
   # Testi telefonis Expo Go rakendusega
   ```

3. **Kui kõik töötab, merge'i**
   ```bash
   git checkout realtime-ehitamine
   git merge small-improvement
   git push origin realtime-ehitamine
   ```

4. **Kustuta kasutatud haru**
   ```bash
   git branch -d small-improvement
   ```

### 🆘 Hädaolukorra Plaan

Kui midagi läheb täiesti valesti:

1. **ÄRA PANIKITSE!** 
2. **Kontrolli git status'e**: `git status`
3. **Mine tagasi töötavasse harusse**: `git checkout realtime-ehitamine`
4. **Uuenda**: `git pull origin realtime-ehitamine`
5. **Loo uus haru**: `git checkout -b recovery-attempt`

### 📱 Lokaalne Testimine

```bash
# Käivita rakendus
npx expo start

# Skaneeri QR kood Expo Go rakendusega
# Või käivita simulaatoris
npx expo start --ios     # iOS simulator
npx expo start --android # Android emulator
```

### 💡 Nõuanded Kulutuste Vähendamiseks

1. **Kasuta tasuta AI tööriistu päevaseks kodeerimiseks**
2. **Kasuta Claude'i ainult keeruliste probleemide jaoks**
3. **Testi alati lokaalselt enne deploy'imist**
4. **Kasuta Expo Go tasuta testimiseks**
5. **Õpi dokumentatsioonist ja YouTube'ist**

---

**Meeldetuletus**: Sa oled nüüd `safe-development-branch` harus. Kõik sinu muudatused on eraldatud ja turvalised!
