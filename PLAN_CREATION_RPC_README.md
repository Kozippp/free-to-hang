# Plan Creation RPC Implementation

This document describes the new PostgreSQL RPC function `create_plan_with_participants` that replaces the previous backend API endpoint for creating plans.

## Overview

The new RPC function creates plans with participants in a single database transaction, providing better performance and data consistency compared to the previous multi-step API approach.

## RPC Function: create_plan_with_participants

### Parameters
- `p_title` (TEXT) - Plan title (required)
- `p_description` (TEXT) - Plan description (optional)
- `p_location` (TEXT) - Plan location (optional)
- `p_date` (TIMESTAMP WITH TIME ZONE) - Plan date (required)
- `p_invited_user_ids` (UUID[]) - Array of user IDs to invite (optional)
- `p_is_anonymous` (BOOLEAN) - Whether the plan is anonymous (default: false)
- `p_max_participants` (INTEGER) - Maximum number of participants (optional)

### Returns
A table row containing the created plan with all fields from the `plans` table.

### Features
- **Single Transaction**: All operations (plan creation, participant additions) happen atomically
- **Authentication Required**: Uses `auth.uid()` to identify the plan creator
- **Input Validation**: Validates required parameters
- **Error Handling**: Proper error messages and rollback on failure
- **Participant Management**: Automatically adds creator as participant and invited users

## Implementation Steps

### 1. Apply the RPC Function
Run the following command to apply the RPC function to your database:

```bash
npm run apply-create-plan-rpc
```

Or manually:
1. Go to your Supabase dashboard
2. Navigate to SQL Editor
3. Copy and paste the contents of `scripts/create-plan-with-participants-rpc.sql`
4. Run the script

### 2. Updated Client Code
The `plansService.createPlan()` method has been updated to use the RPC instead of the backend API. The change is minimal and maintains the same interface.

### 3. Benefits
- **Better Performance**: Single database round-trip instead of multiple API calls
- **Data Consistency**: All operations happen in a single transaction
- **Reduced Complexity**: No need for complex backend logic
- **Maintainability**: Database logic is centralized in the RPC function

## Feature Flag

The RPC implementation includes a feature flag `USE_PLAN_RPC` that can be controlled via environment variable:

```bash
# Enable RPC (default)
EXPO_PUBLIC_USE_PLAN_RPC=true

# Disable RPC (fallback to legacy API)
EXPO_PUBLIC_USE_PLAN_RPC=false
```

**To toggle USE_PLAN_RPC:**
1. Set the environment variable in your `.env` file or deployment environment
2. Restart the app
3. The plans service will automatically use the appropriate method

## Usage Example

```typescript
const planData = {
  title: "Team Lunch",
  description: "Weekly team lunch meeting",
  location: "Downtown Cafe",
  date: "2024-01-15T12:00:00Z",
  invitedFriends: ["user-id-1", "user-id-2"],
  isAnonymous: false
};

const createdPlan = await plansService.createPlan(planData);
```

## Fallback Behavior

The implementation includes automatic fallback logic:

1. **RPC Path**: Attempts to use the PostgreSQL RPC function
2. **Error Handling**: If RPC fails or returns no data, automatically falls back to legacy API
3. **Logging**: Logs diagnostic information for troubleshooting
4. **Zero Downtime**: No service interruption during fallback

### Error Scenarios Handled:
- RPC function not found
- RPC returns empty result set
- Database connection issues
- Authentication failures
- Invalid parameters

## Migration Notes

- The old backend API endpoint (`POST /plans`) can be deprecated after confirming the RPC works correctly
- The `plansService.createPlan()` method maintains backward compatibility
- All existing code using the plans service will continue to work without changes
- Feature flag allows instant rollback if issues arise

## Testing

To test the new implementation:

1. Apply the RPC function to your database
2. Create a plan using the existing UI
3. Verify that:
   - The plan is created successfully
   - The creator is added as a participant
   - Invited friends are added as participants with 'pending' status
   - All data is consistent

## Rollback

If needed, you can revert to the old API by:
1. Commenting out the RPC usage in `plansService.createPlan()`
2. Uncommenting the original API call implementation
3. Restarting the backend service
