const express = require('express');
const { supabase } = require('../index');
const router = express.Router();

// Helper function to get user from token
const getUserFromToken = async (req) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return null;
  
  const { data: { user }, error } = await supabase.auth.getUser(token);
  return error ? null : user;
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
      .select(`
        *,
        creator:creator_id (
          id,
          name,
          username,
          avatar_url
        )
      `)
      .eq('id', planId)
      .single();

    if (planError) throw planError;

    // Get participants
    const { data: participants, error: participantsError } = await supabase
      .from('plan_participants')
      .select(`
        *,
        user:user_id (
          id,
          name,
          username,
          avatar_url
        )
      `)
      .eq('plan_id', planId);

    if (participantsError) throw participantsError;

    // Get polls with options and votes
    const { data: polls, error: pollsError } = await supabase
      .from('plan_polls')
      .select(`
        *,
        options:poll_options (
          id,
          option_text,
          votes:poll_votes (
            user_id,
            user:user_id (
              id,
              name,
              username,
              avatar_url
            )
          )
        ),
        created_by_user:created_by (
          id,
          name,
          username,
          avatar_url
        )
      `)
      .eq('plan_id', planId)
      .order('created_at', { ascending: true });

    if (pollsError) throw pollsError;

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
        .select(`
          *,
          user:user_id (
            id,
            name,
            username,
            avatar_url
          )
        `)
        .eq('plan_id', planId);

      if (!attendanceError) {
        attendance = attendanceData || [];
      }
    }

    // Transform polls to match frontend format
    const transformedPolls = polls.map(poll => ({
      id: poll.id,
      question: poll.question,
      type: poll.poll_type,
      expiresAt: poll.expires_at,
      invitedUsers: poll.invited_users,
      createdBy: poll.created_by_user,
      options: poll.options.map(option => ({
        id: option.id,
        text: option.option_text,
        votes: option.votes.map(vote => vote.user_id),
        voters: option.votes.map(vote => ({
          id: vote.user.id,
          name: vote.user.name,
          avatar: vote.user.avatar_url
        }))
      }))
    }));

    // Check if user has voted for completion
    const userCompletionVote = userId ? 
      completionVotes.some(vote => vote.user_id === userId) : false;

    return {
      ...plan,
      creator: plan.creator,
      participants: participants.map(p => ({
        id: p.user.id,
        name: p.user.name,
        avatar: p.user.avatar_url,
        status: p.response,
        joinedAt: p.created_at
      })),
      polls: transformedPolls,
      completionVotes: completionVotes.map(v => v.user_id),
      userCompletionVote,
      attendance: attendance.map(a => ({
        userId: a.user.id,
        name: a.user.name,
        avatar: a.user.avatar_url,
        attended: a.attended
      }))
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

    let query = supabase
      .from('plans')
      .select(`
        *,
        creator:creator_id (
          id,
          name,
          username,
          avatar_url
        ),
        participants:plan_participants (
          user_id,
          response,
          created_at,
          user:user_id (
            id,
            name,
            username,
            avatar_url
          )
        )
      `)
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

    // Transform plans for frontend
    const transformedPlans = plans.map(plan => ({
      id: plan.id,
      title: plan.title,
      description: plan.description,
      location: plan.location,
      date: plan.date,
      isAnonymous: plan.is_anonymous,
      maxParticipants: plan.max_participants,
      status: plan.status,
      creator: plan.is_anonymous ? null : plan.creator,
      participants: plan.participants.map(p => ({
        id: p.user.id,
        name: p.user.name,
        avatar: p.user.avatar_url,
        status: p.response,
        joinedAt: p.created_at
      })),
      createdAt: plan.created_at,
      updatedAt: plan.updated_at
    }));

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
        is_anonymous: isAnonymous,
        max_participants: maxParticipants,
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
        response: 'accepted'
      });

    if (participantError) {
      console.error('Error adding creator as participant:', participantError);
    }

    // Add invited friends as participants
    if (invitedFriends.length > 0) {
      const participantInserts = invitedFriends.map(friendId => ({
        plan_id: plan.id,
        user_id: friendId,
        response: 'pending'
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
    const validResponses = ['accepted', 'maybe', 'declined', 'pending'];
    if (!validResponses.includes(response)) {
      return res.status(400).json({ error: 'Invalid response' });
    }

    // Update or insert participant response
    const { data: participant, error } = await supabase
      .from('plan_participants')
      .upsert({
        plan_id: id,
        user_id: userId,
        response,
        updated_at: new Date().toISOString()
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
    const { question, options, type = 'custom', expiresAt, invitedUsers } = req.body;
    const userId = req.user.id;

    // Validate input
    if (!question || !options || options.length < 2) {
      return res.status(400).json({ error: 'Question and at least 2 options required' });
    }

    // Check if user can create polls (is participant)
    const { data: participant, error: participantError } = await supabase
      .from('plan_participants')
      .select('response')
      .eq('plan_id', id)
      .eq('user_id', userId)
      .single();

    if (participantError || !participant || participant.response !== 'accepted') {
      return res.status(403).json({ error: 'Only accepted participants can create polls' });
    }

    // Create poll
    const { data: poll, error: pollError } = await supabase
      .from('plan_polls')
      .insert({
        plan_id: id,
        question,
        poll_type: type,
        expires_at: expiresAt,
        invited_users: invitedUsers,
        created_by: userId
      })
      .select()
      .single();

    if (pollError) {
      console.error('Error creating poll:', pollError);
      return res.status(500).json({ error: 'Failed to create poll' });
    }

    // Create poll options
    const optionInserts = options.map(optionText => ({
      poll_id: poll.id,
      option_text: optionText
    }));

    const { error: optionsError } = await supabase
      .from('poll_options')
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
      .select('response')
      .eq('plan_id', id)
      .eq('user_id', userId)
      .single();

    if (participantError || !participant || participant.response !== 'accepted') {
      return res.status(403).json({ error: 'Only accepted participants can vote' });
    }

    // Remove existing votes for this poll
    const { error: deleteError } = await supabase
      .from('poll_votes')
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
      .from('poll_votes')
      .insert(voteInserts);

    if (voteError) {
      console.error('Error adding votes:', voteError);
      return res.status(500).json({ error: 'Failed to add vote' });
    }

    // Check if this vote creates a winner
    const { data: pollResults } = await supabase
      .rpc('get_poll_results', { poll_id_param: pollId });

    if (pollResults && pollResults.winner) {
      await notifyPlanUpdate(id, 'poll_won', userId, { 
        poll_id: pollId,
        winner: pollResults.winner
      });
    } else {
      await notifyPlanUpdate(id, 'poll_voted', userId, { poll_id: pollId });
    }

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
      .select('response')
      .eq('plan_id', id)
      .eq('user_id', userId)
      .single();

    if (participantError || !participant || participant.response !== 'accepted') {
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

    // Check if plan should be completed
    const { data: shouldComplete } = await supabase
      .rpc('check_plan_completion', { plan_id_param: id });

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