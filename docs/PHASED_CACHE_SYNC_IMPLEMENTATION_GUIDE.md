# Phased Cache + Sync Implementation Guide

**Target:** Free to Hang app  
**Goal:** Show cached data immediately on app open, sync in priority order in background, keep realtime updates active.  
**Estimated effort:** 7–10 days (single developer)

---

## Table of Contents

1. [Overview](#1-overview)
2. [Architecture Summary](#2-architecture-summary)
3. [Current State Analysis](#3-current-state-analysis)
4. [Implementation Phases](#4-implementation-phases)
5. [Detailed Implementation Steps](#5-detailed-implementation-steps)
6. [Configuration & Constants](#6-configuration--constants)
7. [Edge Cases & Considerations](#7-edge-cases--considerations)
8. [Checklist – Implementation Verification](#8-checklist--implementation-verification)
9. [Testing Scenarios](#9-testing-scenarios)

---

## 1. Overview

### User Experience Flow

1. User opens app → sees **cached data** from last session (or empty if first time).
2. Background sync starts in **priority order** (see below).
3. UI updates as each priority level completes.
4. Realtime subscriptions run in parallel; changes appear immediately.
5. All fresh data is written back to cache for next session.

### Priority Order (Fetch Queue)

| Priority | Data | Purpose | Blocks UI? |
|----------|------|---------|------------|
| 1 | Free to hang (friend statuses) | Hang tab, main value prop | No |
| 2 | Plans list (titles, descriptions, participants) | Plans tab list view | No |
| 3 | Plan polls | Control Panel content | No |
| 4 | Chat messages | Chat tab (per-plan, on-demand) | No |
| 5 | Friend list changes | Friends list, invitations | No |
| 6 | Friend profile updates (names, avatars) | Everywhere avatars/names shown | No |

---

## 2. Architecture Summary

### New Components

- **`DataSyncManager`** (`utils/dataSyncManager.ts`) – Orchestrates prioritized fetch queue.
- **Persist middleware** – Added to plansStore, friendsStore, chatStore, unseenStore (hangStore already has it).
- **Cache versioning** – Optional `cachedAt` / `schemaVersion` for migrations.

### Data Flow

```
App Open
    │
    ├─► Hydrate stores from AsyncStorage (Zustand persist)
    │
    ├─► Render UI with cached data (or empty)
    │
    ├─► Start realtime subscriptions (immediately)
    │
    └─► DataSyncManager.runPriorityQueue(userId)
            │
            ├─► Phase 1: loadFriends (hangStore)
            ├─► Phase 2: loadPlans (plansStore) – without polls
            ├─► Phase 3: loadPlan polls for visible plans (or prefetch N plans)
            ├─► Phase 4: prefetch chat for open/recent plans (optional)
            ├─► Phase 5: friendsStore.loadFriends / loadAllRelationships
            └─► Phase 6: refresh avatars / profile data
```

---

## 3. Current State Analysis

### Stores & Persistence

| Store | File | Has Persist? | Storage Key | Notes |
|-------|------|--------------|-------------|-------|
| hangStore | `store/hangStore.ts` | ✅ Yes | `hang-storage` | Reference implementation |
| plansStore | `store/plansStore.ts` | ❌ No | — | Complex: `plans`, `currentUserId`, computed arrays |
| friendsStore | `store/friendsStore.ts` | ❌ No | — | friends, incoming/outgoing requests |
| chatStore | `store/chatStore.ts` | ❌ No | — | messages, readReceipts – can be large |
| unseenStore | `store/unseenStore.ts` | ❌ No | — | Small, simple |
| notificationsStore | `store/notificationsStore.ts` | ❌ No | — | Optional to persist |

### Initialization Points

- **`app/(tabs)/_layout.tsx`** – `initializeRealtimeManager(user.id)` on user mount.
- **`utils/realtimeManager.ts`** – `startAllSubscriptions()` calls all `startRealTimeUpdates` + `loadPlans`, `loadFriends`, etc.
- **`app/(tabs)/index.tsx`** – Hang tab: `loadUserData()`, `loadFriends()` on mount.
- **`app/(tabs)/plans.tsx`** – Plans tab: `loadPlans(user.id)` on focus.

### Key Services

- `lib/plans-service.ts` – `getPlansDirect()` (no polls), `getPlanDirect()` (with polls).
- `lib/friends-direct-service.ts` – Friends, relationships.
- `lib/relationship-service.ts` – Friend requests, status.

---

## 4. Implementation Phases

### Phase A: Persistence (2–3 days)

1. Add persist to plansStore.
2. Add persist to friendsStore.
3. Add persist to unseenStore.
4. Add persist to chatStore (with limits).
5. Ensure `stopRealtimeManager` clears or invalidates cache on logout.

### Phase B: DataSyncManager (2–3 days)

1. Create `DataSyncManager` with priority queue.
2. Replace current "load everything at once" with phased loading.
3. Integrate with `initializeRealtimeManager` or call from `_layout.tsx` after hydration.

### Phase C: Merge & Hydration (1–2 days)

1. Hydrate from cache before first render where possible.
2. Implement simple merge: server overwrites cache when fetch completes.
3. Handle "no network" – show cache, optionally show offline banner.

### Phase D: Polish & Edge Cases (1–2 days)

1. Loading indicators (optional).
2. Cache invalidation on logout.
3. Schema versioning for future migrations.
4. Testing and tuning.

---

## 5. Detailed Implementation Steps

### 5.1 plansStore Persistence

**File:** `store/plansStore.ts`

**Persist:**
- `plans` (Record<string, Plan>)
- `currentUserId`
- `isLoading` – typically exclude (ephemeral)

**Exclude (do not persist):**
- `subscriptionStatus` (channels, connection state)
- Any refs or channel handles

**Zustand persist config:**
```typescript
import { persist, createJSONStorage } from 'zustand/middleware';

// Wrap create with persist
const usePlansStore = create<PlansState>()(
  persist(
    (set, get) => ({ /* ... */ }),
    {
      name: 'plans-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        plans: state.plans,
        currentUserId: state.currentUserId,
        // Exclude: isLoading, subscriptionStatus, etc.
      }),
    }
  )
);
```

**Considerations:**
- `recalculatePlanArrays()` must run after hydration to rebuild `invitations`, `activePlans`, `completedPlans`.
- Use `onRehydrateStorage` callback to call `recalculatePlanArrays()` when hydration completes.
- plansStore uses `plans` as source of truth; computed arrays are derived – persist only `plans`.

**Checklist:**
- [ ] `partialize` excludes non-serializable state (channels, functions).
- [ ] `onRehydrateStorage` triggers `recalculatePlanArrays()`.
- [ ] Logout clears or skips plans cache (user-specific data).

---

### 5.2 friendsStore Persistence

**File:** `store/friendsStore.ts`

**Persist:**
- `friends`
- `incomingRequests`
- `outgoingRequests`

**Exclude:**
- `searchResults` (ephemeral)
- `isSearching`, `isLoading`, `isLoadingRequests`, `isLoadingFriends`

**Checklist:**
- [ ] `partialize` excludes loading flags and search results.
- [ ] Cache is user-scoped (clear on logout).

---

### 5.3 chatStore Persistence

**File:** `store/chatStore.ts`

**Persist:**
- `messages` – with limits (see [Configuration](#6-configuration--constants))
- `readReceipts` – optional, can be smaller

**Exclude:**
- `subscriptions` (RealtimeChannel – not serializable)
- `loading`, `isSyncing`
- `replyingTo` (ephemeral UI state)

**Critical: Chat cache limits**

| Setting | Recommended | Rationale |
|---------|------------|-----------|
| Max plans to cache | 10–20 | Most users have few active plans |
| Max messages per plan | 50–100 | Balance between UX and storage |
| Max total cache size | ~2 MB | AsyncStorage ~6 MB limit, leave room |
| **Cache TTL (how long to keep)** | **7 days** | Older chats less relevant; after 7 days treat as stale, refetch on open |
| Eviction | LRU (least recently used) | When limit hit, drop oldest plan's messages |

**Kui kaua chati cache'ida?**
- **Soovitus:** 7 päeva. Pärast seda võib cache olla liiga vana (uued sõnumid puuduvad).
- **Alternatiivid:** 3 päeva (agressiivne), 14 päeva (rohkem offline lugemist).
- **Eviction:** Kui cache täitub, eemalda kõige vanemad sõnumid või kõige vanema plaani chat.

**Implementation approach:**
- Option A: Persist full `messages` with `partialize` that truncates per plan (e.g. last 50).
- Option B: Separate `chatCache` utility that manages truncation before persist.
- Option C: Use `version` in persist config; on rehydrate, run eviction/truncation.

**Checklist:**
- [ ] Message count limit per plan enforced.
- [ ] Total plans limit enforced (e.g. keep only N most recent by last message).
- [ ] `cachedAt` stored for TTL/eviction logic.
- [ ] Voice/image URLs – consider if they expire; may need to re-fetch.

---

### 5.4 unseenStore Persistence

**File:** `store/unseenStore.ts`

**Persist:**
- `plans` (Record<string, PlanUnseenCounts>)
- `totalPlanUnseen`
- `invitationUnreadCount`
- `friendRequestCount`
- `newFriendsCount`

**Exclude:**
- `loading`, `pendingRefetch`

**Checklist:**
- [ ] Small payload – safe to persist fully.
- [ ] Clear on logout.

---

### 5.5 DataSyncManager

**File:** `utils/dataSyncManager.ts` (new)

**Responsibilities:**
1. Run fetch phases in order (or with controlled parallelism).
2. Abort previous run if app closes / user logs out.
3. Emit events or callbacks for optional UI (e.g. "Syncing...").
4. Integrate with existing load functions (no duplication of fetch logic).

**Interface:**
```typescript
interface DataSyncManager {
  run(userId: string): Promise<void>;
  cancel(): void;
  getStatus(): { phase: number; phaseName: string; isComplete: boolean };
}
```

**Phase implementation:**
```typescript
async function runPhases(userId: string, signal: AbortSignal) {
  const phases = [
    { name: 'free_to_hang', fn: () => useHangStore.getState().loadFriends() },
    { name: 'plans_list', fn: () => usePlansStore.getState().loadPlans(userId) },
    { name: 'plan_polls', fn: () => prefetchPollsForVisiblePlans(userId) },
    { name: 'chats', fn: () => prefetchRecentChats(userId) },
    { name: 'friend_list', fn: () => useFriendsStore.getState().loadAllRelationships() },
    { name: 'profiles', fn: () => refreshFriendProfiles(userId) },
  ];

  for (const phase of phases) {
    if (signal.aborted) return;
    try {
      await phase.fn();
    } catch (e) {
      console.warn(`Phase ${phase.name} failed:`, e);
      // Continue to next phase
    }
  }
}
```

**Integration:**
- Call `DataSyncManager.run(userId)` from `initializeRealtimeManager` **after** `startAllSubscriptions`.
- Or: call from `_layout.tsx` in a `useEffect` when `user?.id` is set, after a short delay to let hydration complete.

**Checklist:**
- [ ] Phases run sequentially (or Phase 1–2 parallel, then 3–6 sequential).
- [ ] `AbortController` used to cancel on unmount/logout.
- [ ] Errors in one phase don't block later phases (try/catch per phase).
- [ ] Realtime subscriptions start immediately, not after sync.

---

### 5.6 plans-service: Include Polls in getPlansDirect (Optional but Recommended)

**File:** `lib/plans-service.ts`

**Current:** `getPlansDirect` returns `polls: []`.

**Change:** Add nested select for `plan_polls` with `plan_poll_options` and `plan_poll_votes` so Phase 2 already includes polls. Then Phase 3 can be a no-op or light refresh.

**Supabase nested select example:**
```sql
-- In getPlansDirect, extend the select:
polls:plan_polls(
  id,
  title,
  poll_type,
  ends_at,
  created_at,
  created_by,
  creator:created_by(id, name, username, avatar_url),
  options:plan_poll_options(
    id,
    option_text,
    option_order,
    votes:plan_poll_votes(user_id, voter:user_id(id, name, avatar_url))
  )
)
```

**Checklist:**
- [ ] Nested structure matches existing `Plan.polls` format.
- [ ] Transform DB response to match `Poll` interface (question vs title, etc.).
- [ ] Performance acceptable with typical plan count (e.g. &lt; 20 plans).

---

### 5.7 Logout & Cache Invalidation

**When:** User signs out.

**Actions:**
1. `stopRealtimeManager()` – already exists.
2. Clear persisted stores:
   - Either: use `usePlansStore.persist.clearStorage()` etc.
   - Or: set store state to initial empty values and let persist overwrite.
3. Ensure no stale user data is shown on next login (different user).

**Checklist:**
- [ ] All persisted stores cleared or reset on logout.
- [ ] `AuthContext` or signOut flow triggers cache clear.
- [ ] AsyncStorage keys are user-scoped OR cleared on logout (e.g. `plans-storage` cleared).

---

## 6. Configuration & Constants

Create `constants/cacheConfig.ts`:

```typescript
export const CACHE_CONFIG = {
  // Chat
  CHAT_MAX_PLANS_CACHED: 15,
  CHAT_MAX_MESSAGES_PER_PLAN: 75,
  CHAT_CACHE_TTL_DAYS: 7,
  CHAT_MAX_TOTAL_SIZE_BYTES: 2 * 1024 * 1024, // 2 MB

  // Plans
  PLANS_MAX_CACHED: 50,
  PLANS_PREFETCH_POLLS_FOR: 5, // Prefetch polls for N most recent plans

  // General
  PERSIST_DEBOUNCE_MS: 1000,
  HYDRATION_TIMEOUT_MS: 3000,
};
```

**Checklist:**
- [ ] All magic numbers moved to config.
- [ ] Values tuned for typical usage (e.g. 10–30 plans, 5–15 chats).

---

## 7. Edge Cases & Considerations

### 7.1 AsyncStorage Limits

- **Limit:** ~6 MB on many devices (can be less on older Android).
- **Mitigation:** Enforce chat limits, avoid persisting large blobs (e.g. base64 images).
- **Monitor:** Log approximate cache size in dev; consider `expo-file-system` for larger cache if needed.

### 7.2 Offline / No Network

- Show cached data.
- Optional: small banner "You're offline" or "Syncing when online."
- Don't block UI; let sync retry when network returns.
- Consider `@react-native-community/netinfo` for connectivity.

### 7.3 Stale Data

- **Strategy:** Server always overwrites cache on successful fetch.
- **Realtime:** Keeps data fresh once connected.
- **Stale indicator:** Optional – e.g. "Last updated 5 min ago" for power users.

### 7.4 Multi-Device / Same User

- Cache is per-device. No cross-device sync of cache.
- Each device fetches from server; realtime keeps them in sync when both online.

### 7.5 Schema / Model Changes

- Add `version` to persist config: `version: 1`.
- On upgrade, use `migrate` to transform old structure or clear.
- Document schema changes in this guide.

### 7.6 Avatar / Profile Images

- `avatarCache` (FileSystem) already caches images.
- Profile name/avatar URL changes come from `loadFriends` / `loadUserData`.
- Ensure Phase 6 refreshes these so avatars stay correct.

### 7.7 Anonymous Plans

- plansStore already handles anonymous vs normal.
- Ensure cache doesn't leak anonymous plan data across users (clear on logout).

### 7.8 Chat: Voice & Image URLs

- Supabase signed URLs may expire.
- Options: (a) persist URLs and accept possible expiry, (b) don't persist media URLs, refetch when opening chat, (c) use long-lived URLs if available.

### 7.9 Hydration Timing

- Zustand persist is async. First render may see empty state.
- Use `persist.onRehydrateStorage` or store's `persist.hasHydrated` to know when ready.
- Optional: show minimal loading/skeleton until hydration + Phase 1 complete.

---

## 8. Checklist – Implementation Verification

### Phase A: Persistence

- [ ] **plansStore**
  - [ ] `persist` middleware added with `partialize`
  - [ ] `onRehydrateStorage` calls `recalculatePlanArrays()`
  - [ ] Excluded: `subscriptionStatus`, channel refs, `isLoading`
  - [ ] Storage key: `plans-storage`
- [ ] **friendsStore**
  - [ ] `persist` added, `partialize` excludes search + loading
  - [ ] Storage key: `friends-storage`
- [ ] **chatStore**
  - [ ] `persist` added with message/plan limits
  - [ ] Truncation logic (max N messages per plan, max M plans)
  - [ ] Excluded: `subscriptions`, `loading`, `isSyncing`, `replyingTo`
  - [ ] Storage key: `chat-storage`
- [ ] **unseenStore**
  - [ ] `persist` added
  - [ ] Storage key: `unseen-storage`
- [ ] **Logout**
  - [ ] All persist storages cleared on sign out

### Phase B: DataSyncManager

- [ ] `utils/dataSyncManager.ts` created
- [ ] Phases 1–6 implemented
- [ ] `AbortController` for cancellation
- [ ] Error handling per phase (no cascade failure)
- [ ] Integrated into app startup (after hydration)
- [ ] Realtime starts before or in parallel with sync (not after)

### Phase C: Merge & Hydration

- [ ] Server data overwrites cache on fetch success
- [ ] No duplicate requests (e.g. loadPlans not called twice unnecessarily)
- [ ] `recalculatePlanArrays` after plans hydration

### Phase D: Polish

- [ ] `constants/cacheConfig.ts` created and used
- [ ] Optional: "Syncing..." or subtle indicator
- [ ] Optional: offline banner when no network
- [ ] Schema `version` set for future migrations

### Considerations Checklist

- [ ] Chat: `CHAT_MAX_MESSAGES_PER_PLAN` decided and documented (recommend: 75)
- [ ] Chat: `CHAT_CACHE_TTL_DAYS` decided and documented (recommend: 7)
- [ ] Chat: `CHAT_MAX_PLANS_CACHED` decided and documented
- [ ] Chat: TTL or eviction strategy documented
- [ ] AsyncStorage size: no single store &gt; ~2 MB
- [ ] Avatar URLs: refresh in Phase 6
- [ ] Anonymous plans: cache cleared on logout
- [ ] Voice/image URLs: strategy documented (persist or refetch)

---

## 9. Testing Scenarios

### Manual Tests

1. **Cold start (cached)**
   - Use app, close fully, reopen.
   - Expect: Data visible within ~1 s, then updates as sync completes.
2. **Cold start (no cache)**
   - Fresh install or cleared data.
   - Expect: Empty/loading, then data appears as phases complete.
3. **Offline**
   - Turn off network, open app.
   - Expect: Cached data shown, no crash.
4. **Logout**
   - Sign out.
   - Expect: No data from previous user on next login.
5. **Plans with polls**
   - Open plan with polls.
   - Expect: Polls visible immediately if cached, or after Phase 2/3.
6. **Chat**
   - Open chat, send messages, close app, reopen.
   - Expect: Last N messages visible from cache.

### Automated (Optional)

- Unit tests for `DataSyncManager` phases (mock stores).
- Unit tests for chat truncation logic.
- Integration test: hydrate → sync → verify store state.

---

## Appendix A: File Change Summary

| File | Changes |
|------|---------|
| `store/plansStore.ts` | Add persist, partialize, onRehydrateStorage |
| `store/friendsStore.ts` | Add persist, partialize |
| `store/chatStore.ts` | Add persist, truncation, partialize |
| `store/unseenStore.ts` | Add persist |
| `utils/dataSyncManager.ts` | **New** – priority queue |
| `utils/realtimeManager.ts` | Integrate DataSyncManager or call from _layout |
| `app/(tabs)/_layout.tsx` | Optional: trigger DataSyncManager after init |
| `contexts/AuthContext.tsx` | Clear persist storages on signOut |
| `constants/cacheConfig.ts` | **New** – config values |
| `lib/plans-service.ts` | Optional: add polls to getPlansDirect |

---

## Appendix B: References

- Zustand persist: https://github.com/pmndrs/zustand/blob/main/docs/integrations/persisting-store-data.md
- AsyncStorage limits: ~6 MB (platform-dependent)
- hangStore persist: `store/hangStore.ts` lines 85–596 (reference)
- Realtime init: `utils/realtimeManager.ts` – `startAllSubscriptions`

---

*Document version: 1.0*  
*Last updated: 2026-03-08*
