const express = require('express');
const router = express.Router();

// Use global supabase instance
const supabase = global.supabase;

// Helper function to get user from token
const getUserFromToken = async (req) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  console.log('🔑 Auth token received:', token ? 'Yes' : 'No');
  if (token) {
    console.log('🔑 Token preview:', token.substring(0, 20) + '...');
  }
  if (!token) return null;
  
  try {
    // For JWT validation, we need to use the anon key, not service role key
    const { createClient } = require('@supabase/supabase-js');
    
    // Try to get anon key from environment, fallback to service role for now
    const anonKey = process.env.SUPABASE_ANON_KEY || 
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5memJ2dXludHpnc3pxZGxzdXNsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzMxNjE5ODYsImV4cCI6MjA0ODczNzk4Nn0.ZNLQfEzBKZI5uxZQBbP5SIFEcDCdLuNEQGgJXCOWfTk';
    
    const clientSupabase = createClient(
      process.env.SUPABASE_URL,
      anonKey
    );
    
    const { data: { user }, error } = await clientSupabase.auth.getUser(token);
    console.log('🔑 Token validation result:', error ? 'Failed' : 'Success');
    if (error) {
      console.log('🔑 Token validation error:', error.message);
    }
    if (user) {
      console.log('🔑 User from token:', user.id, user.email);
    }
    return error ? null : user;
  } catch (error) {
    console.log('🔑 Token validation exception:', error.message);
    return null;
  }
};

// Middleware to require authentication
const requireAuth = async (req, res, next) => {
  const user = await getUserFromToken(req);
  if (!user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  req.user = user;
  next();
};

// Helper function to notify plan updates
const notifyPlanUpdate = async (planId, updateType, triggeredBy, metadata = {}) => {
  try {
    await supabase
      .from('plan_updates')
      .insert({
        plan_id: planId,
        update_type: updateType,
        triggered_by: triggeredBy,
        metadata
      });
  } catch (error) {
    console.error('Error creating plan update notification:', error);
  }
};

// Helper function to get plan with full details
const getPlanWithDetails = async (planId, userId = null) => {
  try {
    // Get basic plan info
    const { data: plan, error: planError } = await supabase
      .from('plans')
      .select('*')
      .eq('id', planId)
      .single();
      
    if (planError) throw planError;
    
    // Get creator info separately
    const { data: creator, error: creatorError } = await supabase
      .from('users')
      .select('id, name, username, avatar_url')
      .eq('id', plan.creator_id)
      .single();
      
    if (creatorError) {
      console.warn('Could not fetch creator info:', creatorError);
    }

    // Get participants (without user relationship)
    const { data: participants, error: participantsError } = await supabase
      .from('plan_participants')
      .select('*')
      .eq('plan_id', planId);

    if (participantsError) throw participantsError;

    // Get user info for participants separately
    const participantUserIds = participants.map(p => p.user_id);
    let participantUsers = [];
    if (participantUserIds.length > 0) {
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id, name, username, avatar_url')
        .in('id', participantUserIds);
      
      if (!userError) {
        participantUsers = userData || [];
      }
    }

    // Get polls (without relationships)
    const { data: polls, error: pollsError } = await supabase
      .from('plan_polls')
      .select('*')
      .eq('plan_id', planId)
      .order('created_at', { ascending: true });

    if (pollsError) throw pollsError;

    // Get poll options
    const pollIds = polls.map(p => p.id);
    let pollOptions = [];
    if (pollIds.length > 0) {
      const { data: optionsData, error: optionsError } = await supabase
        .from('plan_poll_options')
        .select('*')
        .in('poll_id', pollIds)
        .order('option_order', { ascending: true });
      
      if (!optionsError) {
        pollOptions = optionsData || [];
      }
    }

    // Get poll votes
    let pollVotes = [];
    const optionIds = pollOptions.map(o => o.id);
    if (optionIds.length > 0) {
      const { data: votesData, error: votesError } = await supabase
        .from('plan_poll_votes')
        .select('*')
        .in('option_id', optionIds);
      
      if (!votesError) {
        pollVotes = votesData || [];
      }
    }

    // Get user info for poll voters
    const voterIds = [...new Set(pollVotes.map(v => v.user_id))];
    let voterUsers = [];
    if (voterIds.length > 0) {
      const { data: voterData, error: voterError } = await supabase
        .from('users')
        .select('id, name, username, avatar_url')
        .in('id', voterIds);
      
      if (!voterError) {
        voterUsers = voterData || [];
      }
    }

    // Get poll creators
    const pollCreatorIds = [...new Set(polls.map(p => p.created_by))];
    let pollCreators = [];
    if (pollCreatorIds.length > 0) {
      const { data: creatorData, error: creatorError } = await supabase
        .from('users')
        .select('id, name, username, avatar_url')
        .in('id', pollCreatorIds);
      
      if (!creatorError) {
        pollCreators = creatorData || [];
      }
    }

    // Get completion votes
    const { data: completionVotes, error: completionError } = await supabase
      .from('plan_completion_votes')
      .select('user_id')
      .eq('plan_id', planId);

    if (completionError) throw completionError;

    // Get attendance if plan is completed
    let attendance = [];
    if (plan.status === 'completed') {
      const { data: attendanceData, error: attendanceError } = await supabase
        .from('plan_attendance')
        .select('*')
        .eq('plan_id', planId);

      if (!attendanceError && attendanceData) {
        const attendeeIds = attendanceData.map(a => a.user_id);
        let attendeeUsers = [];
        if (attendeeIds.length > 0) {
          const { data: attendeeUserData, error: attendeeUserError } = await supabase
            .from('users')
            .select('id, name, username, avatar_url')
            .in('id', attendeeIds);
          
          if (!attendeeUserError) {
            attendeeUsers = attendeeUserData || [];
          }
        }

        attendance = attendanceData.map(a => {
          const user = attendeeUsers.find(u => u.id === a.user_id);
          return {
            userId: a.user_id,
            name: user?.name || 'Unknown',
            avatar: user?.avatar_url,
            attended: a.attended
          };
        });
      }
    }

    // Transform polls to match frontend format
    const transformedPolls = polls.map(poll => {
      const pollCreator = pollCreators.find(c => c.id === poll.created_by);
      const pollOptionsForThisPoll = pollOptions.filter(o => o.poll_id === poll.id);
      
      return {
        id: poll.id,
        question: poll.title,
        type: poll.poll_type,
        expiresAt: poll.ends_at,
        createdBy: pollCreator,
        options: pollOptionsForThisPoll.map(option => {
          const votesForThisOption = pollVotes.filter(v => v.option_id === option.id);
          const voters = votesForThisOption.map(vote => {
            const voter = voterUsers.find(u => u.id === vote.user_id);
            return {
              id: vote.user_id,
              name: voter?.name || 'Unknown',
              avatar: voter?.avatar_url
            };
          });
          
          return {
            id: option.id,
            text: option.option_text,
            votes: votesForThisOption.map(v => v.user_id),
            voters: voters
          };
        })
      };
    });

    // Transform participants with user data
    const transformedParticipants = participants.map(p => {
      const user = participantUsers.find(u => u.id === p.user_id);
      return {
        id: p.user_id,
        name: user?.name || 'Unknown',
        avatar: user?.avatar_url,
        status: p.status,
        joinedAt: p.joined_at
      };
    });

    // Check if user has voted for completion
    const userCompletionVote = userId ? 
      completionVotes.some(vote => vote.user_id === userId) : false;

    return {
      ...plan,
      creator: creator,
      participants: transformedParticipants,
      polls: transformedPolls,
      completionVotes: completionVotes.map(v => v.user_id),
      userCompletionVote,
      attendance: attendance
    };
  } catch (error) {
    console.error('Error getting plan details:', error);
    throw error;
  }
};

// GET /plans - Get user's plans
router.get('/', requireAuth, async (req, res) => {
  try {
    const { status = 'all' } = req.query;
    const userId = req.user.id;

    // Get plans where user is creator or participant
    let query = supabase
      .from('plans')
      .select('*')
      .or(`creator_id.eq.${userId},id.in.(${
        // Subquery for plans user participates in
        `select plan_id from plan_participants where user_id = '${userId}'`
      })`)
      .order('created_at', { ascending: false });

    if (status !== 'all') {
      query = query.eq('status', status);
    }

    const { data: plans, error } = await query;

    if (error) {
      console.error('Error fetching plans:', error);
      return res.status(500).json({ error: 'Failed to fetch plans' });
    }

    if (!plans || plans.length === 0) {
      return res.json([]);
    }

    // Get participants for all plans
    const planIds = plans.map(p => p.id);
    const { data: allParticipants, error: participantsError } = await supabase
      .from('plan_participants')
      .select('*')
      .in('plan_id', planIds);

    if (participantsError) {
      console.error('Error fetching participants:', participantsError);
      return res.status(500).json({ error: 'Failed to fetch participants' });
    }

    // Get unique user IDs for participants
    const participantUserIds = [...new Set(allParticipants.map(p => p.user_id))];
    let participantUsers = [];
    if (participantUserIds.length > 0) {
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id, name, username, avatar_url')
        .in('id', participantUserIds);
      
      if (!userError) {
        participantUsers = userData || [];
      }
    }

    // Get unique creator IDs for non-private plans
    const creatorIds = [...new Set(plans.filter(p => !p.is_private).map(p => p.creator_id))];
    
    // Fetch creator information
    let creators = {};
    if (creatorIds.length > 0) {
      const { data: creatorData, error: creatorError } = await supabase
        .from('users')
        .select('id, name, username, avatar_url')
        .in('id', creatorIds);
        
      if (!creatorError && creatorData) {
        creators = creatorData.reduce((acc, creator) => {
          acc[creator.id] = creator;
          return acc;
        }, {});
      }
    }

    // Transform plans for frontend
    const transformedPlans = plans.map(plan => {
      const planParticipants = allParticipants.filter(p => p.plan_id === plan.id);
      const participantsWithUserData = planParticipants.map(p => {
        const user = participantUsers.find(u => u.id === p.user_id);
        return {
          id: p.user_id,
          name: user?.name || 'Unknown',
          avatar: user?.avatar_url,
          status: p.status,
          joinedAt: p.joined_at
        };
      });

      return {
        id: plan.id,
        title: plan.title,
        description: plan.description,
        location: plan.location,
        date: plan.date,
        isAnonymous: plan.is_private,
        status: plan.status,
        creator: plan.is_private ? null : creators[plan.creator_id],
        participants: participantsWithUserData,
        createdAt: plan.created_at,
        updatedAt: plan.updated_at
      };
    });

    res.json(transformedPlans);
  } catch (error) {
    console.error('Error in GET /plans:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /plans/:id - Get specific plan details
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const plan = await getPlanWithDetails(id, userId);
    res.json(plan);
  } catch (error) {
    console.error('Error in GET /plans/:id:', error);
    if (error.code === 'PGRST116') {
      return res.status(404).json({ error: 'Plan not found' });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /plans - Create new plan
router.post('/', requireAuth, async (req, res) => {
  try {
    const {
      title,
      description,
      location,
      date,
      isAnonymous = false,
      maxParticipants,
      invitedFriends = []
    } = req.body;

    const userId = req.user.id;

    // Validate required fields
    if (!title || !date) {
      return res.status(400).json({ error: 'Title and date are required' });
    }

    // Create plan
    const { data: plan, error: planError } = await supabase
      .from('plans')
      .insert({
        title,
        description,
        location,
        date,
        is_private: isAnonymous,
        creator_id: userId
      })
      .select()
      .single();

    if (planError) {
      console.error('Error creating plan:', planError);
      return res.status(500).json({ error: 'Failed to create plan' });
    }

    // Add creator as participant
    const { error: participantError } = await supabase
      .from('plan_participants')
      .insert({
        plan_id: plan.id,
        user_id: userId,
        status: 'going'
      });

    if (participantError) {
      console.error('Error adding creator as participant:', participantError);
    }

    // Add invited friends as participants
    if (invitedFriends.length > 0) {
      const participantInserts = invitedFriends.map(friendId => ({
        plan_id: plan.id,
        user_id: friendId,
        status: 'pending'
      }));

      const { error: inviteError } = await supabase
        .from('plan_participants')
        .insert(participantInserts);

      if (inviteError) {
        console.error('Error inviting friends:', inviteError);
      }
    }

    // Get full plan details to return
    const fullPlan = await getPlanWithDetails(plan.id, userId);
    
    // Notify plan creation
    await notifyPlanUpdate(plan.id, 'participant_joined', userId);

    res.status(201).json(fullPlan);
  } catch (error) {
    console.error('Error in POST /plans:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /plans/:id/respond - Respond to plan invitation
router.post('/:id/respond', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { response } = req.body;
    const userId = req.user.id;

    // Validate response
    const validResponses = ['pending', 'going', 'maybe', 'not_going'];
    if (!validResponses.includes(response)) {
      return res.status(400).json({ error: 'Invalid response' });
    }

    // Update or insert participant response
    const { data: participant, error } = await supabase
      .from('plan_participants')
      .upsert({
        plan_id: id,
        user_id: userId,
        status: response,
        joined_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      console.error('Error updating participant response:', error);
      return res.status(500).json({ error: 'Failed to update response' });
    }

    // Notify plan update
    await notifyPlanUpdate(id, 'participant_joined', userId);

    const fullPlan = await getPlanWithDetails(id, userId);
    res.json(fullPlan);
  } catch (error) {
    console.error('Error in POST /plans/:id/respond:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /plans/:id/polls - Create poll for plan
router.post('/:id/polls', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { question, options, type = 'custom', expiresAt } = req.body;
    const userId = req.user.id;

    // Validate input
    if (!question || !options || options.length < 2) {
      return res.status(400).json({ error: 'Question and at least 2 options required' });
    }

    // Check if user can create polls (is participant)
    const { data: participant, error: participantError } = await supabase
      .from('plan_participants')
      .select('status')
      .eq('plan_id', id)
      .eq('user_id', userId)
      .single();

    if (participantError || !participant || participant.status !== 'going') {
      return res.status(403).json({ error: 'Only accepted participants can create polls' });
    }

    // Create poll
    const { data: poll, error: pollError } = await supabase
      .from('plan_polls')
      .insert({
        plan_id: id,
        title: question,
        description: `Poll created by user`,
        poll_type: type,
        ends_at: expiresAt,
        created_by: userId
      })
      .select()
      .single();

    if (pollError) {
      console.error('Error creating poll:', pollError);
      return res.status(500).json({ error: 'Failed to create poll' });
    }

    // Create poll options
    const optionInserts = options.map((optionText, index) => ({
      poll_id: poll.id,
      option_text: optionText,
      option_order: index
    }));

    const { error: optionsError } = await supabase
      .from('plan_poll_options')
      .insert(optionInserts);

    if (optionsError) {
      console.error('Error creating poll options:', optionsError);
      return res.status(500).json({ error: 'Failed to create poll options' });
    }

    // Notify poll creation
    await notifyPlanUpdate(id, 'poll_created', userId, { poll_id: poll.id });

    const fullPlan = await getPlanWithDetails(id, userId);
    res.json(fullPlan);
  } catch (error) {
    console.error('Error in POST /plans/:id/polls:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /plans/:id/polls/:pollId/vote - Vote on poll
router.post('/:id/polls/:pollId/vote', requireAuth, async (req, res) => {
  try {
    const { id, pollId } = req.params;
    const { optionIds } = req.body;
    const userId = req.user.id;

    // Validate input
    if (!Array.isArray(optionIds) || optionIds.length === 0) {
      return res.status(400).json({ error: 'At least one option must be selected' });
    }

    // Check if user can vote (is accepted participant)
    const { data: participant, error: participantError } = await supabase
      .from('plan_participants')
      .select('status')
      .eq('plan_id', id)
      .eq('user_id', userId)
      .single();

    if (participantError || !participant || participant.status !== 'going') {
      return res.status(403).json({ error: 'Only accepted participants can vote' });
    }

    // Remove existing votes for this poll
    const { error: deleteError } = await supabase
      .from('plan_poll_votes')
      .delete()
      .eq('poll_id', pollId)
      .eq('user_id', userId);

    if (deleteError) {
      console.error('Error removing existing votes:', deleteError);
      return res.status(500).json({ error: 'Failed to update vote' });
    }

    // Add new votes
    const voteInserts = optionIds.map(optionId => ({
      poll_id: pollId,
      option_id: optionId,
      user_id: userId
    }));

    const { error: voteError } = await supabase
      .from('plan_poll_votes')
      .insert(voteInserts);

    if (voteError) {
      console.error('Error adding votes:', voteError);
      return res.status(500).json({ error: 'Failed to add vote' });
    }

    // Check if this vote creates a winner (simplified logic)
    // Just notify that someone voted - poll winner logic can be implemented later
    await notifyPlanUpdate(id, 'poll_voted', userId, { poll_id: pollId });

    const fullPlan = await getPlanWithDetails(id, userId);
    res.json(fullPlan);
  } catch (error) {
    console.error('Error in POST /plans/:id/polls/:pollId/vote:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /plans/:id/complete-vote - Vote for plan completion
router.post('/:id/complete-vote', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Check if user is accepted participant
    const { data: participant, error: participantError } = await supabase
      .from('plan_participants')
      .select('status')
      .eq('plan_id', id)
      .eq('user_id', userId)
      .single();

    if (participantError || !participant || participant.status !== 'going') {
      return res.status(403).json({ error: 'Only accepted participants can vote for completion' });
    }

    // Add completion vote
    const { error: voteError } = await supabase
      .from('plan_completion_votes')
      .upsert({
        plan_id: id,
        user_id: userId
      });

    if (voteError) {
      console.error('Error adding completion vote:', voteError);
      return res.status(500).json({ error: 'Failed to add completion vote' });
    }

    // Check if plan should be completed (simplified logic)
    // Get total going participants and completion votes
    const { data: goingParticipants } = await supabase
      .from('plan_participants')
      .select('user_id')
      .eq('plan_id', id)
      .eq('status', 'going');

    const { data: completionVotes } = await supabase
      .from('plan_completion_votes')
      .select('user_id')
      .eq('plan_id', id);

    const totalGoing = goingParticipants?.length || 0;
    const totalVotes = completionVotes?.length || 0;
    
    // Complete if majority of going participants voted for completion
    const shouldComplete = totalGoing > 0 && totalVotes >= Math.ceil(totalGoing / 2);

    if (shouldComplete) {
      // Mark plan as completed
      const { error: completeError } = await supabase
        .from('plans')
        .update({ 
          status: 'completed',
          updated_at: new Date().toISOString()
        })
        .eq('id', id);

      if (completeError) {
        console.error('Error completing plan:', completeError);
      } else {
        await notifyPlanUpdate(id, 'plan_completed', userId);
      }
    }

    const fullPlan = await getPlanWithDetails(id, userId);
    res.json(fullPlan);
  } catch (error) {
    console.error('Error in POST /plans/:id/complete-vote:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /plans/:id/attendance - Update attendance for completed plan
router.post('/:id/attendance', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { attended } = req.body;
    const userId = req.user.id;

    // Check if plan is completed
    const { data: plan, error: planError } = await supabase
      .from('plans')
      .select('status')
      .eq('id', id)
      .single();

    if (planError || !plan) {
      return res.status(404).json({ error: 'Plan not found' });
    }

    if (plan.status !== 'completed') {
      return res.status(400).json({ error: 'Can only update attendance for completed plans' });
    }

    // Update attendance
    const { error } = await supabase
      .from('plan_attendance')
      .upsert({
        plan_id: id,
        user_id: userId,
        attended: attended,
        updated_at: new Date().toISOString()
      });

    if (error) {
      console.error('Error updating attendance:', error);
      return res.status(500).json({ error: 'Failed to update attendance' });
    }

    const fullPlan = await getPlanWithDetails(id, userId);
    res.json(fullPlan);
  } catch (error) {
    console.error('Error in POST /plans/:id/attendance:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router; 