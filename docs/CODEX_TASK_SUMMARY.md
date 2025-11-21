# Task Summary for GPT 5.1 Codex

## Quick Overview
Fix the "Want to do this again?" functionality in Completed Plans tab. Two critical bugs need to be fixed.

## Context
- **App**: React Native (Expo) + TypeScript
- **Backend**: Node.js/Express + Supabase
- **State Management**: Zustand
- **User**: Can recreate completed plans with same participants

## The Problems

### 🐛 Bug #1: Invited Friends Not Added to New Plan
**Current behavior**: When recreating a plan, only the creator is added
**Expected behavior**: All previous participants should be invited

### 🐛 Bug #2: Wrong Tab After Plan Creation  
**Current behavior**: Always redirects to "Plan" tab
**Expected behavior**: 
- Normal plans → "Plan" tab
- Anonymous plans → "Invitations" tab

## Files to Modify

### Primary Files
1. **components/plans/PlanSuggestionSheet.tsx**
   - Fix: Preserve selectedFriends in local state
   - Fix: Navigate to correct tab based on plan type

2. **components/plans/CompletedPlanDetailView.tsx**  
   - Fix: Ensure getSelectedFriendsData() returns actual UUIDs
   - Fix: Filter current user by UUID, not by 'current' string

3. **app/(tabs)/plans.tsx**
   - Add: Handle tab query parameter for navigation

## Detailed Plan
**See**: `COMPLETED_PLANS_IMPROVEMENTS_PLAN.md` (comprehensive 200+ line plan with all details)

## Quick Implementation Checklist

### Step 1: Fix Bug #1 (Invited Friends)
- [ ] Add console.log to debug selectedFriends flow
- [ ] Add local state in PlanSuggestionSheet to preserve selectedFriends
- [ ] Update useEffect to initialize state when modal opens
- [ ] Verify invitedFriends array is sent to API
- [ ] Test with real data

### Step 2: Fix Bug #2 (Navigation)  
- [ ] Update PlanSuggestionSheet navigation logic
- [ ] Add conditional: `isAnonymous ? '/plans?tab=invitations' : '/plans?tab=plan'`
- [ ] Add tab parameter handler in plans.tsx
- [ ] Test both normal and anonymous plans

### Step 3: Testing
- [ ] Test normal plan recreation with multiple participants
- [ ] Test anonymous plan recreation
- [ ] Verify backend receives invitedFriends array
- [ ] Verify invited friends see plan in their Invitations tab

### Step 4: Cleanup
- [ ] Remove debug console.log statements
- [ ] Verify TypeScript types
- [ ] Test on both platforms (iOS/Android if possible, web at minimum)

## Key Code Locations

### Bug #1 - Key Code
```typescript
// components/plans/PlanSuggestionSheet.tsx Line 144
const handleSubmit = async () => {
  const planData = {
    // ...
    invitedFriends: selectedFriends.map(friend => friend.id) // ← This needs to work!
  };
  await createPlan(planData);
}

// components/plans/CompletedPlanDetailView.tsx Line 166
const getSelectedFriendsData = () => {
  return latestPlan.participants
    .filter(p => p.id !== 'current') // ← Might need UUID comparison
    .map(participant => ({ ... }));
};
```

### Bug #2 - Key Code  
```typescript
// components/plans/PlanSuggestionSheet.tsx Line 176
router.push('/plans?newPlan=true'); // ← Needs conditional logic
```

## Critical Information

### How Plans are Categorized (store/plansStore.ts)
```typescript
if (userStatus === 'going' || 'maybe' || 'conditional') {
  activePlans.push(plan);  // → "Plan" tab
} else if (userStatus === 'pending') {
  invitations.push(plan);  // → "Invitations" tab
}
```

### Backend API (POST /plans)
- Accepts: `invitedFriends: string[]` (array of UUIDs)
- Creator is automatically added with status `going`
- Invited friends are added with status `pending`
- Returns: Complete plan object with all participants

### Important Types
```typescript
interface Friend {
  id: string;  // User UUID
  name: string;
  avatar: string;
  status: 'available' | 'offline' | 'pinged';
  // ...
}

interface CreatePlanData {
  title: string;
  description: string;
  isAnonymous: boolean;
  invitedFriends?: string[];  // Array of user UUIDs
  // ...
}
```

## Testing Commands
```bash
# Start metro bundler
npm start

# Run on iOS simulator (if on Mac)
npm run ios

# Run on Android emulator
npm run android

# Run on web
npm run web
```

## Success Criteria
✅ Previous participants are invited when recreating plan
✅ Invited users receive plan in their Invitations tab  
✅ Normal plans → redirect to "Plan" tab
✅ Anonymous plans → redirect to "Invitations" tab
✅ No TypeScript errors
✅ Clean, production-ready code

## Need Help?
- **Full detailed plan**: See `COMPLETED_PLANS_IMPROVEMENTS_PLAN.md`
- **Backend API docs**: See `docs/PLANS_BACKEND_WORKFLOW.md`
- **Database schema**: See `supabase/schema.sql`

## Estimated Time
3-5 hours for both bugs including testing

---

**START HERE**: Read this file first, then refer to `COMPLETED_PLANS_IMPROVEMENTS_PLAN.md` for detailed implementation steps.

Good luck! 🚀

