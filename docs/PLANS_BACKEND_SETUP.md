# Plans Backend Setup Guide

## 🎯 Overview

This guide covers the complete setup and architecture of the production-ready Plans backend system for Free to Hang app. The system supports real-time plan creation, polls, voting, completion tracking, and attendance management.

## 🏗️ System Architecture

### Database Tables

1. **plan_polls** - Stores poll questions and metadata
2. **poll_options** - Individual options for each poll
3. **poll_votes** - User votes on poll options
4. **plan_completion_votes** - Votes for marking plans as completed
5. **plan_attendance** - Attendance tracking for completed plans
6. **plan_updates** - Real-time update notifications

### Key Features

- ✅ **Real-time Updates** - Instant notifications for all plan changes
- ✅ **Smart Poll Voting** - Dynamic winner determination algorithm
- ✅ **Plan Completion Logic** - Automatic completion based on voting thresholds
- ✅ **Attendance Tracking** - Post-completion attendance management
- ✅ **Security** - Row Level Security (RLS) policies
- ✅ **Performance** - Optimized indexes and queries
- ✅ **Scalability** - Designed for thousands of concurrent users

## 🚀 Setup Instructions

### Step 1: Database Schema Setup

1. **Run the setup script:**
   ```bash
   cd scripts
   node setup-plans-backend.js
   ```

2. **Or manually in Supabase SQL Editor:**
   - Go to your Supabase project → SQL Editor
   - Copy and paste the contents of `scripts/plans-backend-schema.sql`
   - Execute the SQL

### Step 2: Backend API Setup

The Express.js API is automatically configured when you start the backend:

```bash
cd backend
npm start
```

### Step 3: Verify Setup

Check that all tables exist:
- `plan_polls`
- `poll_options` 
- `poll_votes`
- `plan_completion_votes`
- `plan_attendance`
- `plan_updates`

## 📡 API Endpoints

### Plans Management

```
GET    /plans                    # Get user's plans
GET    /plans/:id               # Get specific plan details
POST   /plans                   # Create new plan
POST   /plans/:id/respond       # Respond to plan invitation
```

### Polls & Voting

```
POST   /plans/:id/polls              # Create poll for plan
POST   /plans/:id/polls/:pollId/vote # Vote on poll
```

### Plan Completion

```
POST   /plans/:id/complete-vote      # Vote for plan completion
```

### Attendance

```
POST   /plans/:id/attendance         # Update attendance (completed plans)
```

## 🧠 Business Logic

### Poll Winner Algorithm

The system uses a sophisticated algorithm to determine poll winners:

1. **Threshold Calculation:**
   - 40% of going participants OR
   - 70% of voters
   - Minimum 3 participants for validity

2. **Winner Selection:**
   - Option with most votes that meets threshold
   - Random selection if multiple options tie
   - No winner if threshold not met

### Plan Completion Logic

Plans are automatically completed when:
- 70% of "going" participants vote for completion
- Minimum 1 person going to the plan

### Real-time Updates

The system tracks and notifies these events:
- `poll_created` - New poll added
- `poll_voted` - Someone voted
- `poll_won` - Poll has a winner
- `participant_joined` - Someone joined/responded
- `participant_left` - Someone left
- `plan_completed` - Plan marked as completed
- `new_message` - Chat message (future)

## 🔒 Security Features

### Row Level Security (RLS)

All tables have comprehensive RLS policies:

- **Users can only see their own plans** or plans they participate in
- **Only accepted participants can vote** on polls
- **Only plan creators can update** plan details
- **Service role has full access** for backend operations

### Authentication

- JWT token-based authentication
- User context passed to all database operations
- Automatic user ID extraction from tokens

## ⚡ Performance Optimizations

### Database Indexes

- Plan-specific indexes for fast lookups
- User-specific indexes for permission checks
- Time-based indexes for real-time queries

### Caching Strategy

- Poll results cached in database functions
- Participant lists optimized with joins
- Update notifications batched for efficiency

### Query Optimization

- Single query for complete plan details
- Efficient vote counting algorithms
- Minimal database round trips

## 🎛️ Configuration

### Environment Variables

```bash
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
NODE_ENV=production
PORT=3000
```

### Rate Limiting

- 100 requests per 15 minutes per IP
- Configurable in `backend/index.js`

## 📊 Monitoring & Debugging

### Logging

The system provides comprehensive logging:
- All API requests and responses
- Database query errors
- Real-time update notifications
- Performance metrics

### Health Checks

```bash
GET /
```
Returns server status and configuration.

## 🔄 Real-time Integration

### Frontend Integration

The frontend should subscribe to real-time updates:

```javascript
// Subscribe to plan updates
const channel = supabase
  .channel(`plan-${planId}`)
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'plan_updates',
    filter: `plan_id=eq.${planId}`
  }, handlePlanUpdate)
  .subscribe();
```

### Update Types

Handle these update types in your frontend:
- `poll_created` → Refresh plan polls
- `poll_voted` → Update poll results
- `poll_won` → Show winner notification
- `participant_joined` → Update participant list
- `plan_completed` → Move to completed plans

## 🚀 Deployment

### Production Checklist

- [ ] Database schema applied
- [ ] RLS policies enabled
- [ ] Indexes created
- [ ] Environment variables set
- [ ] Rate limiting configured
- [ ] Logging enabled
- [ ] Health checks working

### Scaling Considerations

- **Database**: Use connection pooling
- **API**: Deploy multiple instances behind load balancer
- **Real-time**: Supabase handles real-time scaling automatically
- **Caching**: Add Redis for high-traffic scenarios

## 🐛 Troubleshooting

### Common Issues

1. **RLS Permission Denied**
   - Check user authentication
   - Verify user is participant in plan
   - Ensure service role key is correct

2. **Poll Votes Not Updating**
   - Check poll_votes table permissions
   - Verify option_id exists
   - Check user participation status

3. **Real-time Not Working**
   - Verify plan_updates table has data
   - Check subscription filters
   - Ensure user has access to plan

### Debug Commands

```bash
# Check database connection
node scripts/setup-plans-backend.js

# Verify API endpoints
curl http://localhost:3000/

# Check user authentication
curl -H "Authorization: Bearer YOUR_TOKEN" http://localhost:3000/plans
```

## 📈 Future Enhancements

### Planned Features

- [ ] Chat integration
- [ ] Push notifications
- [ ] Plan templates
- [ ] Recurring plans
- [ ] Location-based suggestions
- [ ] AI-powered plan recommendations

### Performance Improvements

- [ ] Database query optimization
- [ ] Caching layer (Redis)
- [ ] CDN for static assets
- [ ] Background job processing

## 🤝 Contributing

When adding new features:

1. Update database schema in `scripts/plans-backend-schema.sql`
2. Add API endpoints in `backend/routes/plans.js`
3. Update this documentation
4. Add tests for new functionality
5. Update frontend integration guides

## 📞 Support

For issues or questions:
- Check troubleshooting section above
- Review API logs for error details
- Verify database schema is up to date
- Test with minimal reproduction case 