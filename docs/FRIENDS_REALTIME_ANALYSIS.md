# Friends List Realtime Analysis

## Problem
When removing a friend in the profile view, the friend does not disappear immediately from the friends list, even though realtime updates are expected.

## Architecture Overview

### Data Flow for Profile Friends List

```
Profile allFriends state
        ↑
        │ useEffect([friends, offlineFriends, storeFriends])
        │
        ├── PRIORITY 1: hangStore (friends + offlineFriends)  ← used when length > 0
        │
        └── FALLBACK: friendsStore (storeFriends)              ← only when hangStore is empty
```

**Critical finding:** Profile uses **hangStore** for the friends list when it has any data. `storeFriends` from friendsStore is **ignored** in that case.

### Realtime Subscriptions

| Store | Subscribes to | When it updates |
|-------|---------------|-----------------|
| **friendsStore** | `friend_requests` (INSERT, UPDATE, DELETE) | Friend requests, accept/decline, **remove friend** |
| **hangStore** | `user_status` only | Friend goes online/offline |

**hangStore does NOT subscribe to `friend_requests`.** When a friend is removed (DELETE from friend_requests), hangStore receives no realtime event.

### removeFriend Flow

1. `friendsDirectService.removeFriend()` – deletes row from `friend_requests`
2. `friendsStore`: immediate local filter + fresh fetch
3. `void useHangStore.getState().loadFriends()` – explicit refresh of hangStore

Profile updates only when **hangStore** changes. The only way that happens on remove is via the explicit `loadFriends()` call in step 3.

### friendsStore Realtime (DELETE handler)

- Listens to `friend_requests` DELETE (no filter)
- On DELETE: `handleRealtimeChange` → force refresh friends, incoming, outgoing
- Updates `friendsStore.friends`
- **Profile ignores this** when hangStore has data

## Potential Root Causes

### 1. Profile lifecycle stops friends realtime

```tsx
// profile.tsx
useEffect(() => {
  if (authUser) {
    startRealTimeUpdates();   // friendsStore
    loadAllRelationships();
  }
  return () => {
    stopRealTimeUpdates();    // Kills friends realtime when leaving profile tab!
  };
}, [authUser]);
```

When the user leaves the profile tab, friends realtime is stopped. It only runs while the profile tab is mounted.

### 2. hangStore.loadFriends() is fire-and-forget

```ts
// friendsStore removeFriend
void useHangStore.getState().loadFriends();  // Not awaited
```

If `loadFriends()` fails or is slow, the profile may not update. No error handling or retry.

### 3. Supabase Realtime DELETE may not reach client

- Migration `20260308_enable_friend_requests_realtime.sql` adds `friend_requests` to the publication and sets `REPLICA IDENTITY FULL`
- If the migration was not applied, DELETE events might not be broadcast
- RLS policies must allow the client to "see" the delete for realtime to work

### 4. Data source priority

Profile prefers hangStore over friendsStore. So:

- friendsStore realtime updates do not affect the UI when hangStore has friends
- The only path to update the list on remove is `hangStore.loadFriends()` being called and completing successfully

## Fix applied (2024-03)

- **hangStore** now subscribes to `friend_requests` (INSERT, UPDATE, DELETE)
- When friend_requests changes (accept, remove, new request), hangStore calls `loadFriends()`
- Profile's friends list updates in realtime for both accept and remove
