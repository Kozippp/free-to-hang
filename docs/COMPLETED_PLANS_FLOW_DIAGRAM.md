# Completed Plans Recreation - Data Flow Diagram

## Current Flow (WITH BUGS 🐛)

```
┌─────────────────────────────────────────────────────────────┐
│                    COMPLETED PLANS TAB                       │
│                                                              │
│  ┌────────────────────────────────────────────────┐         │
│  │  Completed Plan Card                           │         │
│  │  - Title: "Movie Night"                        │         │
│  │  - Participants: [Alice, Bob, Charlie, You]    │         │
│  └────────────────────────────────────────────────┘         │
│                          │                                   │
│                          │ User clicks card                  │
│                          ▼                                   │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│             CompletedPlanDetailView.tsx                     │
│                                                              │
│  ┌────────────────────────────────────────────────┐         │
│  │  Plan Details                                   │         │
│  │  - Title: "Movie Night"                         │         │
│  │  - Description: "Let's watch a movie"           │         │
│  │  - Participants: [Alice, Bob, Charlie, You]     │         │
│  └────────────────────────────────────────────────┘         │
│                                                              │
│  ┌────────────────────────────────────────────────┐         │
│  │  Want to do this again?                         │         │
│  │  [Create Plan]  [Anonymous Plan]                │         │
│  └────────────────────────────────────────────────┘         │
│                          │                                   │
│                          │ User clicks "Create Plan"         │
│                          ▼                                   │
│                                                              │
│  getSelectedFriendsData() is called:                        │
│  ┌────────────────────────────────────────────────┐         │
│  │ Returns: [                                      │         │
│  │   {id: "uuid-alice", name: "Alice", ...},       │         │
│  │   {id: "uuid-bob", name: "Bob", ...},           │         │
│  │   {id: "uuid-charlie", name: "Charlie", ...}    │         │
│  │ ]                                                │         │
│  └────────────────────────────────────────────────┘         │
│                          │                                   │
│                          │ Passed as selectedFriends prop    │
│                          ▼                                   │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│              PlanSuggestionSheet.tsx                        │
│                                                              │
│  Props received:                                            │
│  - selectedFriends: [Alice, Bob, Charlie]  ✅               │
│  - isAnonymous: false                                       │
│  - prefilledTitle: "Movie Night"                            │
│  - prefilledDescription: "Let's watch a movie"              │
│                                                              │
│  ┌────────────────────────────────────────────────┐         │
│  │  useEffect (lines 111-130)                      │         │
│  │  🐛 PROBLEM: This might be resetting state!    │         │
│  │                                                  │         │
│  │  if (!visible) {                                 │         │
│  │    setTimeout(() => resetStates(), 0);           │         │
│  │  }                                               │         │
│  └────────────────────────────────────────────────┘         │
│                          │                                   │
│                          │ User fills in details             │
│                          ▼                                   │
│                                                              │
│  ┌────────────────────────────────────────────────┐         │
│  │  handleSubmit() called (line 144)               │         │
│  │                                                  │         │
│  │  const planData = {                              │         │
│  │    title: planTitle,                             │         │
│  │    description: description,                     │         │
│  │    isAnonymous: isAnonymous,                     │         │
│  │    invitedFriends: selectedFriends.map(...)      │         │
│  │  };                                              │         │
│  │                                                  │         │
│  │  🐛 BUG #1: selectedFriends might be empty!    │         │
│  │  Expected: [uuid-alice, uuid-bob, uuid-charlie] │         │
│  │  Actual: []                                      │         │
│  └────────────────────────────────────────────────┘         │
│                          │                                   │
│                          │ API call with invitedFriends: []  │
│                          ▼                                   │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                     Backend API                              │
│              POST /plans (backend/routes/plans.js)          │
│                                                              │
│  Receives:                                                  │
│  {                                                          │
│    title: "Movie Night",                                    │
│    description: "Let's watch a movie",                      │
│    isAnonymous: false,                                      │
│    invitedFriends: []  🐛 EMPTY!                           │
│  }                                                          │
│                                                              │
│  Processing:                                                │
│  1. Create plan in database                      ✅         │
│  2. Add creator with status 'going'              ✅         │
│  3. Add invited friends with status 'pending'    ❌ NONE!   │
│                                                              │
│  Result: Plan created with only creator as participant      │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│              PlanSuggestionSheet.tsx                        │
│                                                              │
│  ┌────────────────────────────────────────────────┐         │
│  │  After API success (line 174)                   │         │
│  │                                                  │         │
│  │  router.push('/plans?newPlan=true');            │         │
│  │                                                  │         │
│  │  🐛 BUG #2: Always goes to /plans               │         │
│  │  - For normal plans: Should go to "Plan" tab    │         │
│  │  - For anonymous: Should go to "Invitations"    │         │
│  │                                                  │         │
│  │  Currently: No tab specified, defaults to       │         │
│  │  whatever tab user was on before                │         │
│  └────────────────────────────────────────────────┘         │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                    PLANS TAB (app/(tabs)/plans.tsx)         │
│                                                              │
│  User sees new plan, but:                                   │
│  🐛 Problem 1: Only creator in participants list            │
│  🐛 Problem 2: Might be on wrong tab                        │
└─────────────────────────────────────────────────────────────┘
```

## Fixed Flow (TARGET ✅)

```
┌─────────────────────────────────────────────────────────────┐
│             CompletedPlanDetailView.tsx                     │
│                                                              │
│  getSelectedFriendsData() returns:                          │
│  [                                                          │
│    {id: "uuid-alice", name: "Alice", ...},                  │
│    {id: "uuid-bob", name: "Bob", ...},                      │
│    {id: "uuid-charlie", name: "Charlie", ...}               │
│  ]                                                          │
│                          │                                   │
│                          │ Pass to PlanSuggestionSheet       │
│                          ▼                                   │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│              PlanSuggestionSheet.tsx (FIXED)                │
│                                                              │
│  ✅ FIX #1: Add local state to preserve friends             │
│                                                              │
│  const [currentSelectedFriends, setCurrentSelectedFriends]  │
│        = useState<Friend[]>([]);                            │
│                                                              │
│  useEffect(() => {                                          │
│    if (visible) {                                           │
│      // Preserve selected friends when modal opens          │
│      setCurrentSelectedFriends(selectedFriends); ✅         │
│      setPlanTitle(prefilledTitle || '');                    │
│      setDescription(prefilledDescription || '');            │
│    }                                                        │
│  }, [visible, selectedFriends, ...]);                       │
│                                                              │
│  handleSubmit() now uses currentSelectedFriends:            │
│  const planData = {                                         │
│    ...                                                      │
│    invitedFriends: currentSelectedFriends.map(f => f.id)    │
│    // ✅ Now has: [uuid-alice, uuid-bob, uuid-charlie]      │
│  };                                                         │
│                          │                                   │
│                          │ API call with correct IDs         │
│                          ▼                                   │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                     Backend API                              │
│              POST /plans (backend/routes/plans.js)          │
│                                                              │
│  Receives:                                                  │
│  {                                                          │
│    title: "Movie Night",                                    │
│    description: "Let's watch a movie",                      │
│    isAnonymous: false,                                      │
│    invitedFriends: [                                        │
│      "uuid-alice",                                          │
│      "uuid-bob",                                            │
│      "uuid-charlie"                                         │
│    ]  ✅ ALL FRIENDS INCLUDED!                             │
│  }                                                          │
│                                                              │
│  Processing:                                                │
│  1. Create plan                                  ✅         │
│  2. Add creator with status 'going'              ✅         │
│  3. Add Alice with status 'pending'              ✅         │
│  4. Add Bob with status 'pending'                ✅         │
│  5. Add Charlie with status 'pending'            ✅         │
│                                                              │
│  Result: Plan created with all participants! 🎉             │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│              PlanSuggestionSheet.tsx (FIXED)                │
│                                                              │
│  ✅ FIX #2: Conditional navigation based on plan type       │
│                                                              │
│  handleSubmit() after API success:                          │
│                                                              │
│  // Navigate to appropriate tab                             │
│  if (isAnonymous) {                                         │
│    router.push('/plans?tab=invitations&newPlan=true');      │
│  } else {                                                   │
│    router.push('/plans?tab=plan&newPlan=true');             │
│  }                                                          │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│             app/(tabs)/plans.tsx (ENHANCED)                 │
│                                                              │
│  ✅ FIX #2: Handle tab query parameter                      │
│                                                              │
│  useEffect(() => {                                          │
│    if (params.tab) {                                        │
│      const tabMap = {                                       │
│        'invitations': 'Invitations',                        │
│        'plan': 'Plan',                                      │
│        'completed': 'Completed'                             │
│      };                                                     │
│      const targetTab = tabMap[params.tab];                  │
│      if (targetTab) {                                       │
│        setActiveTab(targetTab); ✅                          │
│      }                                                      │
│    }                                                        │
│  }, [params.tab]);                                          │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                    FINAL RESULT ✅                          │
│                                                              │
│  Creator sees:                                              │
│  - New plan in correct tab ("Plan" or "Invitations")        │
│  - All friends invited as participants                      │
│                                                              │
│  Invited friends see:                                       │
│  - New plan in their "Invitations" tab                      │
│  - Can accept/decline the invitation                        │
│                                                              │
│  Everything works as expected! 🎉                           │
└─────────────────────────────────────────────────────────────┘
```

## Data Structure Reference

### Friend Interface (PlanSuggestionSheet.tsx)
```typescript
interface Friend {
  id: string;           // User UUID: "550e8400-e29b-41d4-a716-446655440000"
  name: string;         // "Alice"
  username?: string;    // "alice_wonderland"
  avatar: string;       // URL to avatar image
  status: 'available' | 'offline' | 'pinged';
  activity?: string;
  lastActive?: string;
  lastSeen?: string;
}
```

### Plan Participant (store/plansStore.ts)
```typescript
interface Participant {
  id: string;           // User UUID (or 'current' for UI display)
  name: string;
  avatar: string;
  status: 'pending' | 'going' | 'maybe' | 'declined' | 'conditional';
  conditionalFriends?: string[];
}
```

### API Request Body (POST /plans)
```typescript
{
  title: string;              // "Movie Night"
  description: string;        // "Let's watch a movie"
  location: string;           // "To be determined"
  date: string;               // "Today, 7:00 PM"
  isAnonymous: boolean;       // true/false
  maxParticipants?: number;   // null or number
  invitedFriends: string[];   // ["uuid-1", "uuid-2", "uuid-3"]
}
```

## Key Debugging Points

### Debug Point 1: Check selectedFriends in PlanSuggestionSheet
```typescript
// In PlanSuggestionSheet.tsx, add to useEffect:
useEffect(() => {
  if (visible) {
    console.log('🔍 Modal opened with selectedFriends:', selectedFriends);
    console.log('🔍 Number of friends:', selectedFriends.length);
    console.log('🔍 Friend IDs:', selectedFriends.map(f => f.id));
  }
}, [visible, selectedFriends]);
```

### Debug Point 2: Check invitedFriends before API call
```typescript
// In handleSubmit, before createPlan:
console.log('🔍 About to create plan with invitedFriends:', 
  planData.invitedFriends);
console.log('🔍 Number of invited friends:', 
  planData.invitedFriends.length);
```

### Debug Point 3: Check backend receives correct data
```typescript
// Backend: routes/plans.js, in POST /plans handler:
console.log('🔍 Received invitedFriends:', invitedFriends);
console.log('🔍 Number of friends to invite:', invitedFriends.length);
```

## Summary of Changes Needed

| File | Change | Lines | Priority |
|------|--------|-------|----------|
| PlanSuggestionSheet.tsx | Add currentSelectedFriends state | ~63 | HIGH |
| PlanSuggestionSheet.tsx | Update useEffect to preserve friends | 111-130 | HIGH |
| PlanSuggestionSheet.tsx | Use currentSelectedFriends in handleSubmit | 144-184 | HIGH |
| PlanSuggestionSheet.tsx | Conditional navigation | 174-178 | HIGH |
| CompletedPlanDetailView.tsx | Filter by UUID, not 'current' | 166-178 | MEDIUM |
| app/(tabs)/plans.tsx | Add tab parameter handler | New useEffect | MEDIUM |

---

**This diagram shows exactly what's broken and how to fix it. Share this with GPT 5.1 Codex for visual reference.**

