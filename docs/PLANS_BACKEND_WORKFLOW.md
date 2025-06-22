# Plans Backend Workflow Documentation

## Overview

This document outlines the proposed backend architecture for the plans system in the Free to Hang app. The system is designed to handle plan creation, invitations, responses, real-time updates, and completion tracking while integrating with the existing `users` and `friend_requests` tables.

## Current Available Resources

### Existing Database Tables
- **`users`**: Contains user profiles (id, name, username, avatar_url, bio, vibe)
- **`friend_requests`**: Manages friendships (sender_id, receiver_id, status: 'pending'/'accepted'/'declined')

### Frontend Requirements Analysis
Based on the frontend code analysis, the plans system needs to support:
- Plan creation (normal and anonymous)
- Participant management with various statuses
- Real-time polling and voting
- Chat messaging within plans
- Plan completion tracking
- Complex conditional participation logic

## Proposed Database Schema

### Core Tables

#### 1. `plans` Table
```sql
CREATE TABLE plans (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  creator_id UUID REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  type TEXT CHECK (type IN ('normal', 'anonymous')) DEFAULT 'normal',
  date_time TIMESTAMP WITH TIME ZONE,
  location TEXT,
  max_participants INTEGER,
  status TEXT CHECK (status IN ('active', 'completed', 'cancelled')) DEFAULT 'active',
  visibility TEXT CHECK (visibility IN ('public', 'friends_only', 'invite_only')) DEFAULT 'friends_only',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_activity_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Anonymous plan specific fields
  anonymous_creator_hash TEXT, -- For anonymous plans, store a hash to identify creator without revealing identity
  
  -- Completion tracking
  completion_threshold NUMERIC DEFAULT 0.5, -- Percentage of participants needed to mark as completed
  auto_complete_hours INTEGER DEFAULT 24, -- Hours after planned time to auto-complete
  
  -- Metadata
  is_read_by_creator BOOLEAN DEFAULT TRUE,
  has_unread_updates BOOLEAN DEFAULT FALSE
);
```

#### 2. `plan_participants` Table
```sql
CREATE TABLE plan_participants (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  plan_id UUID REFERENCES plans(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  status TEXT CHECK (status IN ('pending', 'accepted', 'maybe', 'conditional', 'declined')) DEFAULT 'pending',
  response_at TIMESTAMP WITH TIME ZONE,
  invited_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  invited_by UUID REFERENCES users(id), -- Who invited this participant
  
  -- Conditional participation
  conditional_friends JSONB, -- Array of user IDs this participant depends on
  conditional_mode TEXT CHECK (conditional_mode IN ('any', 'all')) DEFAULT 'any',
  
  -- Metadata
  is_read BOOLEAN DEFAULT FALSE,
  last_read_at TIMESTAMP WITH TIME ZONE,
  notification_preferences JSONB DEFAULT '{"push": true, "email": false}',
  
  UNIQUE(plan_id, user_id)
);
```

#### 3. `plan_polls` Table
```sql
CREATE TABLE plan_polls (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  plan_id UUID REFERENCES plans(id) ON DELETE CASCADE,
  creator_id UUID REFERENCES users(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  type TEXT CHECK (type IN ('when', 'where', 'custom', 'invitation')) DEFAULT 'custom',
  allow_multiple_votes BOOLEAN DEFAULT FALSE,
  expires_at TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Special fields for invitation polls
  invited_user_ids JSONB, -- For invitation polls - array of user IDs being voted on
  auto_invite_threshold INTEGER DEFAULT 1 -- Votes needed to auto-invite
);
```

#### 4. `plan_poll_options` Table
```sql
CREATE TABLE plan_poll_options (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  poll_id UUID REFERENCES plan_polls(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  order_index INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### 5. `plan_poll_votes` Table
```sql
CREATE TABLE plan_poll_votes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  poll_id UUID REFERENCES plan_polls(id) ON DELETE CASCADE,
  option_id UUID REFERENCES plan_poll_options(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(poll_id, option_id, user_id)
);
```

#### 6. `plan_messages` Table
```sql
CREATE TABLE plan_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  plan_id UUID REFERENCES plans(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  type TEXT CHECK (type IN ('text', 'image', 'voice', 'poll', 'system')) DEFAULT 'text',
  content TEXT,
  
  -- Media attachments
  image_url TEXT,
  voice_url TEXT,
  voice_duration INTEGER, -- seconds
  waveform_data JSONB, -- Audio waveform visualization data
  
  -- Poll message data
  poll_id UUID REFERENCES plan_polls(id),
  
  -- Reply functionality
  reply_to_message_id UUID REFERENCES plan_messages(id),
  
  -- Message state
  is_edited BOOLEAN DEFAULT FALSE,
  edited_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### 7. `plan_message_reactions` Table
```sql
CREATE TABLE plan_message_reactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  message_id UUID REFERENCES plan_messages(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  emoji TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(message_id, user_id) -- One reaction per user per message
);
```

#### 8. `plan_completion_votes` Table
```sql
CREATE TABLE plan_completion_votes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  plan_id UUID REFERENCES plans(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  vote_type TEXT CHECK (vote_type IN ('completed', 'not_completed')) DEFAULT 'completed',
  attended BOOLEAN, -- Did they actually attend (for completed votes)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(plan_id, user_id)
);
```

#### 9. `plan_activity_log` Table
```sql
CREATE TABLE plan_activity_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  plan_id UUID REFERENCES plans(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id), -- NULL for system activities
  activity_type TEXT NOT NULL, -- 'plan_created', 'user_joined', 'user_left', 'poll_created', 'poll_voted', 'message_sent', etc.
  activity_data JSONB, -- Flexible data for different activity types
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

## API Endpoints Design

### Plan Management
- `POST /api/plans` - Create new plan
- `GET /api/plans` - Get user's plans (invitations, active, completed)
- `GET /api/plans/:id` - Get specific plan details
- `PUT /api/plans/:id` - Update plan (creator only)
- `DELETE /api/plans/:id` - Cancel plan (creator only)

### Participation
- `POST /api/plans/:id/respond` - Respond to plan invitation
- `POST /api/plans/:id/invite` - Invite friends to plan
- `DELETE /api/plans/:id/participants/:userId` - Remove participant (creator only)

### Polling System
- `POST /api/plans/:id/polls` - Create poll
- `GET /api/plans/:id/polls` - Get plan polls
- `POST /api/polls/:id/vote` - Vote on poll
- `PUT /api/polls/:id` - Update poll (creator only)
- `DELETE /api/polls/:id` - Delete poll (creator only)

### Messaging
- `GET /api/plans/:id/messages` - Get plan messages
- `POST /api/plans/:id/messages` - Send message
- `PUT /api/messages/:id` - Edit message
- `DELETE /api/messages/:id` - Delete message
- `POST /api/messages/:id/reactions` - Add/remove reaction

### Completion
- `POST /api/plans/:id/completion-vote` - Vote for plan completion
- `POST /api/plans/:id/complete` - Mark plan as completed (when threshold reached)
- `POST /api/plans/:id/restart` - Restart completed plan

## Core Workflows

### 1. Plan Creation Workflow

1. **User creates plan**
   - Validates input (title, description, date, location)
   - Checks if user has permission to create plans
   
2. **Plan type handling**
   - **Normal plans**: Creator is visible and auto-accepted
   - **Anonymous plans**: Creator identity hidden, starts as pending participant
   
3. **Database operations**
   - Insert plan record into `plans` table
   - Add creator as participant in `plan_participants`
   - Add selected friends as pending participants
   
4. **Notifications**
   - Send push notifications to invited friends
   - Create activity log entry
   - Trigger real-time updates

### 2. Plan Response Workflow

1. **User responds to invitation**
   - Validates user is actually invited to the plan
   - Updates participant status in `plan_participants`
   
2. **Response type handling**
   - **Accepted**: Move plan to user's active list
   - **Maybe**: Keep in invitations but mark as maybe
   - **Conditional**: Store conditional friend dependencies
   - **Declined**: Remove from user's invitations
   
3. **Conditional dependency resolution**
   - Check if conditional participants should be auto-accepted
   - Update dependent participants if conditions are met
   
4. **Real-time updates**
   - Broadcast status change to all plan participants
   - Update plan activity timestamp
   - Log activity for audit trail

### 3. Conditional Participation Logic

When a user responds with "conditional" status:
- Store array of friend user IDs they depend on
- Store conditional mode ('any' or 'all')
- Monitor status changes of conditional friends
- Auto-accept when conditions are met

```javascript
// Pseudo-code for conditional dependency resolution
function resolveConditionalParticipants(planId) {
  const conditionalParticipants = getConditionalParticipants(planId);
  
  for (const participant of conditionalParticipants) {
    const { conditionalFriends, conditionalMode } = participant;
    const friendStatuses = getFriendStatuses(planId, conditionalFriends);
    
    let shouldAccept = false;
    
    if (conditionalMode === 'any') {
      shouldAccept = friendStatuses.some(status => status === 'accepted');
    } else if (conditionalMode === 'all') {
      shouldAccept = friendStatuses.every(status => status === 'accepted');
    }
    
    if (shouldAccept) {
      updateParticipantStatus(participant.id, 'accepted');
      sendNotification(participant.userId, 'conditional_acceptance');
    }
  }
}
```

### 4. Real-time Update System

#### Events to Broadcast:
- Plan created/updated/cancelled
- Participant joined/left/changed status
- Poll created/voted/completed
- Message sent/edited/deleted
- Message reaction added/removed
- Plan completion vote cast
- Plan marked as completed

#### Real-time Channels:
- `plan:{planId}` - All plan-specific updates
- `user:{userId}:plans` - User's plan notifications
- `user:{userId}:invitations` - New plan invitations

### 5. Plan Completion Workflow

1. **Completion vote casting**
   - Participant votes for plan completion
   - Check if completion threshold is met
   - Auto-complete if threshold reached
   
2. **Time-based completion**
   - Background job checks plans past their scheduled time
   - Auto-complete after `auto_complete_hours` have passed
   
3. **Completion processing**
   - Move plan to completed status
   - Archive active discussions
   - Send completion notifications
   - Record attendance data

## Integration with Existing System

### Friend System Integration
- Query `friend_requests` table with `status = 'accepted'` for friend lists
- Filter plan invitations to only include friends
- Respect privacy settings when showing plan participants

### User System Integration
- Use `users` table for participant display information
- Leverage existing avatar, name, username fields
- Integrate with user status/availability if implemented

## Security & Privacy Considerations

### Row Level Security (RLS) Policies

```sql
-- Plans table - users can only see plans they participate in
CREATE POLICY "Users can view plans they participate in" ON plans
  FOR SELECT USING (
    id IN (SELECT plan_id FROM plan_participants WHERE user_id = auth.uid())
  );

-- Plan participants - users can only see participants of their plans
CREATE POLICY "Users can view participants of their plans" ON plan_participants
  FOR SELECT USING (
    plan_id IN (SELECT plan_id FROM plan_participants WHERE user_id = auth.uid())
  );

-- Plan messages - users can only see messages from their plans
CREATE POLICY "Users can view messages from their plans" ON plan_messages
  FOR SELECT USING (
    plan_id IN (SELECT plan_id FROM plan_participants WHERE user_id = auth.uid())
  );
```

### Anonymous Plan Privacy
- Use `anonymous_creator_hash` instead of `creator_id` for anonymous plans
- Hide creator information in API responses for anonymous plans
- Special frontend handling to mask creator identity

### Data Validation
- Validate friend relationships before allowing invitations
- Prevent self-invitations and duplicate participants
- Sanitize all user inputs, especially messages and poll options
- Rate limiting on plan creation and message sending

## Performance Optimizations

### Database Indexes
```sql
-- Plan lookup optimization
CREATE INDEX idx_plans_creator_status ON plans(creator_id, status);
CREATE INDEX idx_plans_status_updated ON plans(status, updated_at);

-- Participant lookup optimization
CREATE INDEX idx_plan_participants_user_status ON plan_participants(user_id, status);
CREATE INDEX idx_plan_participants_plan_status ON plan_participants(plan_id, status);

-- Message history optimization
CREATE INDEX idx_plan_messages_plan_created ON plan_messages(plan_id, created_at);
CREATE INDEX idx_plan_messages_user ON plan_messages(user_id);

-- Poll system optimization
CREATE INDEX idx_plan_polls_plan_active ON plan_polls(plan_id, is_active);
CREATE INDEX idx_plan_poll_votes_poll_user ON plan_poll_votes(poll_id, user_id);
```

### Caching Strategy
- Cache friend lists for invitation filtering
- Cache plan participant lists and basic info
- Use Redis for real-time event queuing
- Implement pagination for message history

### Background Jobs
- Hourly: Check for plans to auto-complete
- Daily: Cleanup old cancelled plans
- Weekly: Archive old completed plans
- Real-time: Process conditional participant updates

## Implementation Phases

### Phase 1: Core Functionality (MVP)
1. Create core tables (`plans`, `plan_participants`)
2. Implement basic plan CRUD operations
3. Add invitation and response system
4. Set up basic RLS policies

### Phase 2: Enhanced Features
1. Add polling system (`plan_polls`, `plan_poll_options`, `plan_poll_votes`)
2. Implement messaging functionality
3. Add real-time WebSocket updates
4. Implement conditional participation logic

### Phase 3: Advanced Features
1. Add completion voting system
2. Implement activity logging
3. Add background job processing
4. Optimize performance with caching

### Phase 4: Polish & Scale
1. Advanced notification system
2. Analytics and reporting
3. Plan templates and suggestions
4. Mobile app optimizations

## Monitoring & Health Checks

### Key Metrics
- Plan creation and completion rates
- Average response time to invitations
- User engagement in plan chats
- Poll participation rates
- System performance metrics

### Health Monitoring
- Database query performance
- WebSocket connection stability
- Background job processing status
- API response times and error rates

This architecture provides a robust foundation for the plans system while maintaining flexibility for future enhancements and ensuring seamless integration with the existing friend and user systems. 