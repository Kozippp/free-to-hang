# Chat System Design and Implementation Plan

## Overview
This document outlines the architecture, functionality, and implementation plan for the Free to Hang chat system. The chat is plan-centric - each plan has its own chat where participants can communicate in real-time.

## Current State (Frontend)

### ✅ Completed Components
1. **ChatView.tsx** - Main chat container with message list
2. **ChatMessage.tsx** - Individual message component with reactions, replies
3. **ChatInput.tsx** - Input field with camera/gallery support
4. **chatStore.ts** - Zustand store for local state management

### 🎨 Frontend Features (Already Implemented)
- [x] Real-time message display with auto-scroll
- [x] User avatars and message grouping
- [x] Date/time separators
- [x] Long-press message actions modal
- [x] Emoji reactions (6 quick reactions)
- [x] Reply to messages
- [x] Unsend messages (delete with animation)
- [x] Copy message content
- [x] Image messages with preview
- [x] Voice message placeholders (disabled)
- [x] Message editing
- [x] Read receipts tracking
- [x] Beautiful animations and transitions

## Required Functionality

### Core Features
1. **Send Messages** - Text, images (voice planned)
2. **Real-time Updates** - Messages appear instantly for all participants
3. **Emoji Reactions** - Long-press message to add emoji reactions
4. **Message Actions** - Unsend, Copy, Reply (long-press menu)
5. **Read Receipts** - Track which messages have been read
6. **Image Sharing** - Camera and gallery support
7. **Message History** - Persist all messages in database

### Technical Requirements
- Real-time synchronization using Supabase Realtime
- Efficient database queries (pagination, indexing)
- Proper authentication and authorization
- RLS (Row Level Security) policies
- Optimistic UI updates for better UX
- Offline support with sync when online

## System Architecture

### Database Schema

```sql
-- Chat messages table
CREATE TABLE chat_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  plan_id UUID REFERENCES plans(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  type TEXT CHECK (type IN ('text', 'image', 'voice', 'poll')) DEFAULT 'text',
  content TEXT,
  image_url TEXT,
  voice_url TEXT,
  voice_duration INTEGER,
  -- Reply functionality
  reply_to_message_id UUID REFERENCES chat_messages(id) ON DELETE SET NULL,
  -- Metadata
  edited BOOLEAN DEFAULT FALSE,
  deleted BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Indexes for performance
  INDEX idx_chat_messages_plan_id (plan_id),
  INDEX idx_chat_messages_user_id (user_id),
  INDEX idx_chat_messages_created_at (created_at),
  INDEX idx_chat_messages_reply_to (reply_to_message_id)
);

-- Message reactions table
CREATE TABLE chat_reactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  message_id UUID REFERENCES chat_messages(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  emoji TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- One reaction per user per message
  UNIQUE(message_id, user_id),
  
  -- Indexes
  INDEX idx_chat_reactions_message_id (message_id),
  INDEX idx_chat_reactions_user_id (user_id)
);

-- Read receipts table
CREATE TABLE chat_read_receipts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  plan_id UUID REFERENCES plans(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  last_read_message_id UUID REFERENCES chat_messages(id) ON DELETE SET NULL,
  last_read_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- One receipt per user per plan
  UNIQUE(plan_id, user_id),
  
  -- Indexes
  INDEX idx_chat_read_receipts_plan_id (plan_id),
  INDEX idx_chat_read_receipts_user_id (user_id)
);
```

### RLS Policies

```sql
-- Messages: Only plan participants can view/create
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Plan participants can view messages"
ON chat_messages FOR SELECT
USING (
  plan_id IN (
    SELECT plan_id FROM plan_participants WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Plan participants can create messages"
ON chat_messages FOR INSERT
WITH CHECK (
  user_id = auth.uid() AND
  plan_id IN (
    SELECT plan_id FROM plan_participants WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can update their own messages"
ON chat_messages FOR UPDATE
USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own messages"
ON chat_messages FOR DELETE
USING (user_id = auth.uid());

-- Reactions: Plan participants can view/manage
ALTER TABLE chat_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Plan participants can view reactions"
ON chat_reactions FOR SELECT
USING (
  message_id IN (
    SELECT id FROM chat_messages WHERE plan_id IN (
      SELECT plan_id FROM plan_participants WHERE user_id = auth.uid()
    )
  )
);

CREATE POLICY "Users can manage their reactions"
ON chat_reactions FOR ALL
USING (user_id = auth.uid());

-- Read receipts: Users can manage their own
ALTER TABLE chat_read_receipts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view read receipts in their plans"
ON chat_read_receipts FOR SELECT
USING (
  plan_id IN (
    SELECT plan_id FROM plan_participants WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can manage their own read receipts"
ON chat_read_receipts FOR ALL
USING (user_id = auth.uid());
```

### Backend API Endpoints

**Base URL:** `/api/chat`

1. **GET /api/chat/:planId/messages**
   - Get paginated messages for a plan
   - Query params: `limit`, `before` (cursor-based pagination)
   - Returns: Array of messages with reactions and user info

2. **POST /api/chat/:planId/messages**
   - Send a new message
   - Body: `{ type, content, imageUrl?, voiceUrl?, replyToMessageId? }`
   - Returns: Created message object

3. **PUT /api/chat/messages/:messageId**
   - Edit a message (text only)
   - Body: `{ content }`
   - Returns: Updated message

4. **DELETE /api/chat/messages/:messageId**
   - Delete/unsend a message
   - Marks as deleted or removes completely
   - Returns: Success status

5. **POST /api/chat/messages/:messageId/reactions**
   - Add or update reaction
   - Body: `{ emoji }`
   - Returns: Updated reactions

6. **DELETE /api/chat/messages/:messageId/reactions**
   - Remove user's reaction
   - Returns: Success status

7. **POST /api/chat/:planId/read**
   - Mark messages as read up to a certain timestamp
   - Body: `{ lastReadMessageId }`
   - Returns: Updated read receipt

### Frontend Integration

#### chatStore.ts Updates

```typescript
// Add Supabase integration
import { supabase } from '@/lib/supabase';

// Real-time subscription
const subscribeToChat = (planId: string) => {
  const channel = supabase
    .channel(`chat:${planId}`)
    .on('postgres_changes', 
      { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `plan_id=eq.${planId}` },
      (payload) => {
        // Add new message to store
      }
    )
    .on('postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'chat_messages', filter: `plan_id=eq.${planId}` },
      (payload) => {
        // Update existing message
      }
    )
    .on('postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'chat_reactions' },
      (payload) => {
        // Update reactions
      }
    )
    .subscribe();
    
  return channel;
};

// API methods
const sendMessage = async (planId: string, messageData: MessageInput) => {
  // 1. Optimistically add to local state
  const tempId = `temp-${Date.now()}`;
  addMessageOptimistic(planId, { ...messageData, id: tempId });
  
  // 2. Send to backend
  const response = await fetch(`${API_URL}/api/chat/${planId}/messages`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${session.access_token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(messageData)
  });
  
  const result = await response.json();
  
  // 3. Replace temp message with real one
  replaceMessage(planId, tempId, result.data);
};
```

## Implementation Plan

### Phase 1: Database Setup (1-2 hours)
- [x] Create database schema SQL files
- [ ] Add chat tables to Supabase
- [ ] Set up RLS policies
- [ ] Create database indexes
- [ ] Test policies with different user scenarios

### Phase 2: Backend API (3-4 hours)
- [ ] Create `/backend/routes/chat.js`
- [ ] Implement authentication middleware
- [ ] Implement CRUD endpoints for messages
- [ ] Implement reaction endpoints
- [ ] Implement read receipt endpoints
- [ ] Add error handling and validation
- [ ] Test all endpoints with Postman/Thunder Client

### Phase 3: Frontend Integration (4-5 hours)
- [ ] Update `chatStore.ts` with Supabase integration
- [ ] Implement real-time subscriptions
- [ ] Add optimistic updates
- [ ] Implement pagination/infinite scroll
- [ ] Update components to use new store methods
- [ ] Handle offline scenarios
- [ ] Add loading states and error handling

### Phase 4: Image Upload (2-3 hours)
- [ ] Create storage bucket for chat images
- [ ] Implement image upload to Supabase Storage
- [ ] Add image compression on frontend
- [ ] Update message sending to handle images
- [ ] Test image sending and viewing

### Phase 5: Testing & Polish (2-3 hours)
- [ ] Test with multiple users simultaneously
- [ ] Test real-time updates across devices
- [ ] Test edge cases (offline, slow network)
- [ ] Performance optimization (lazy loading, caching)
- [ ] Fix any UI/UX issues
- [ ] Add error boundaries

### Phase 6: Documentation & Deployment (1 hour)
- [ ] Update API documentation
- [ ] Add code comments
- [ ] Deploy backend changes
- [ ] Deploy frontend changes
- [ ] Test production environment

## Performance Considerations

### Database Optimization
- Use indexes on frequently queried columns (plan_id, created_at)
- Implement cursor-based pagination for message history
- Limit initial message fetch (e.g., last 50 messages)
- Use database triggers for updated_at fields

### Frontend Optimization
- Lazy load older messages (pagination)
- Virtual list for very long message histories
- Optimistic updates for instant feedback
- Cache messages locally (AsyncStorage)
- Debounce typing indicators (future feature)

### Real-time Optimization
- Use separate channels per plan
- Unsubscribe when leaving chat
- Batch updates when possible
- Use presence for online status (future)

## Security Considerations

### Authentication
- Verify JWT tokens on all API endpoints
- Use RLS to enforce access control
- Validate user is plan participant

### Authorization
- Users can only send messages in plans they're part of
- Users can only edit/delete their own messages
- Validate plan_id matches user's plans

### Data Validation
- Sanitize message content (XSS prevention)
- Limit message length (e.g., 1000 characters)
- Validate image URLs
- Rate limiting on message sending

### Privacy
- Only plan participants can view messages
- Deleted messages are truly removed or marked as deleted
- Consider encryption for sensitive plans (future)

## Future Enhancements

### Phase 2 Features
- [ ] Voice messages (with waveform visualization)
- [ ] Typing indicators
- [ ] Message search
- [ ] @mentions with notifications
- [ ] Push notifications for new messages
- [ ] Message forwarding
- [ ] File attachments (PDFs, etc.)
- [ ] Polls in chat (already has schema)
- [ ] Gif support
- [ ] Link previews

### Advanced Features
- [ ] End-to-end encryption
- [ ] Message pinning
- [ ] Chat export (PDF, JSON)
- [ ] Admin controls (mute users)
- [ ] Message translation
- [ ] Voice/video calls
- [ ] Screen sharing

## Testing Checklist

### Functional Tests
- [ ] Send text message
- [ ] Send image message
- [ ] Reply to message
- [ ] Add reaction to message
- [ ] Remove reaction
- [ ] Edit message
- [ ] Delete message
- [ ] View message history
- [ ] Scroll to replied message
- [ ] Mark messages as read
- [ ] Multiple users in same chat
- [ ] Real-time updates work

### Edge Cases
- [ ] Send message while offline
- [ ] Receive message while offline
- [ ] Very long messages
- [ ] Many reactions on one message
- [ ] Rapid message sending
- [ ] Large images
- [ ] Deleted user's messages
- [ ] Leaving/rejoining plan
- [ ] App backgrounding/foregrounding

### Performance Tests
- [ ] Load 100+ messages
- [ ] Scroll through long chat history
- [ ] Multiple simultaneous chats
- [ ] Image loading performance
- [ ] Memory usage with many messages

## Success Metrics

### Technical Metrics
- Message delivery latency < 500ms
- UI response time < 100ms (optimistic updates)
- Support 50+ users per chat
- 99.9% message delivery success
- Support 1000+ messages per chat without performance issues

### User Experience Metrics
- Intuitive message actions (long-press)
- Smooth scrolling
- Fast image loading
- No message duplication
- Proper error handling with user feedback

## Notes

- Frontend UI is already polished and feature-complete
- Focus on backend reliability and real-time performance
- Follow existing code patterns from `plansStore` and `routes/plans.js`
- Use optimistic updates for best UX
- Consider implementing read receipts similar to WhatsApp (seen by X users)
- Voice messages are implemented in UI but disabled - revisit in Phase 2

## Glossary

- **Plan-centric**: Each chat belongs to a specific plan, not a general chat
- **Optimistic update**: Update UI immediately, sync with server afterward
- **RLS**: Row Level Security - database-level access control
- **Cursor pagination**: Use last item ID instead of page numbers
- **Realtime**: Supabase real-time subscriptions for live updates

