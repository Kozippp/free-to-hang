const express = require('express');
const router = express.Router();

// Use global supabase instance
const supabase = global.supabase;

// Select anon key based on active project (fallback to base var)
const ACTIVE = (process.env.SUPABASE_ACTIVE_PROJECT || 'KOZIPPP').toUpperCase();
const resolveEnv = (base, fallback) => process.env[base] || process.env[fallback];
const supabaseAnonKey = resolveEnv(`SUPABASE_ANON_KEY_${ACTIVE}`, 'SUPABASE_ANON_KEY');

// Helper function to get user from token
const getUserFromToken = async (req) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return null;

  try {
    const { createClient } = require('@supabase/supabase-js');
    const supabaseUrl = resolveEnv(`SUPABASE_URL_${ACTIVE}`, 'SUPABASE_URL');

    if (!supabaseAnonKey || !supabaseUrl) {
      return null;
    }

    const clientSupabase = createClient(supabaseUrl, supabaseAnonKey);
    const { data: { user }, error } = await clientSupabase.auth.getUser(token);
    return error ? null : user;
  } catch (error) {
    console.error('Error validating token:', error.message);
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
    const result = await supabase
      .from('plan_updates')
      .insert({
        plan_id: planId,
        update_type: updateType,
        triggered_by: triggeredBy,
        metadata
      });

    if (result.error) {
      console.error('Error inserting plan update notification:', result.error);
    }
  } catch (error) {
    console.error('Error creating plan update notification:', error);
  }
};

// GET /polls/:planId - Get all polls for a plan (when, where, custom only)
router.get('/:planId', requireAuth, async (req, res) => {
  try {
    const { planId } = req.params;
    const userId = req.user.id;

    console.log('📊 Fetching polls for plan:', planId, 'user:', userId);

    // Verify user has access to this plan
    const { data: participant, error: participantError } = await supabase
      .from('plan_participants')
      .select('status')
      .eq('plan_id', planId)
      .eq('user_id', userId)
      .single();

    if (participantError || !participant) {
      return res.status(403).json({ error: 'Access denied - not a participant in this plan' });
    }

    // Get polls (only when, where, custom - exclude invitation polls)
    const { data: polls, error: pollsError } = await supabase
      .from('plan_polls')
      .select('*')
      .eq('plan_id', planId)
      .in('poll_type', ['when', 'where', 'custom'])
      .order('created_at', { ascending: false });

    if (pollsError) {
      console.error('Error fetching polls:', pollsError);
      return res.status(500).json({ error: 'Failed to fetch polls' });
    }

    if (!polls || polls.length === 0) {
      return res.json([]);
    }

    // Get poll options
    const pollIds = polls.map(p => p.id);
    const { data: pollOptions, error: optionsError } = await supabase
      .from('plan_poll_options')
      .select('*')
      .in('poll_id', pollIds)
      .order('option_order', { ascending: true });

    if (optionsError) {
      console.error('Error fetching poll options:', optionsError);
      return res.status(500).json({ error: 'Failed to fetch poll options' });
    }

    // Get poll votes
    const optionIds = pollOptions?.map(o => o.id) || [];
    let pollVotes = [];
    if (optionIds.length > 0) {
      const { data: votesData, error: votesError } = await supabase
        .from('plan_poll_votes')
        .select('*')
        .in('option_id', optionIds);

      if (votesError) {
        console.error('Error fetching poll votes:', votesError);
      } else {
        pollVotes = votesData || [];
      }
    }

    // Get user data for poll creators and voters
    const creatorIds = [...new Set(polls.map(p => p.created_by))];
    const voterIds = [...new Set(pollVotes.map(v => v.user_id))];
    const allUserIds = [...new Set([...creatorIds, ...voterIds])];

    let userData = [];
    if (allUserIds.length > 0) {
      const { data: users, error: userError } = await supabase
        .from('users')
        .select('id, name, username, avatar_url')
        .in('id', allUserIds);

      if (!userError && users) {
        userData = users;
      }
    }

    // Transform polls for frontend
    const transformedPolls = polls.map(poll => {
      const pollCreator = userData.find(u => u.id === poll.created_by);
      const pollOptionsForThisPoll = pollOptions?.filter(o => o.poll_id === poll.id) || [];

      return {
        id: poll.id,
        question: poll.title,
        type: poll.poll_type,
        expiresAt: poll.ends_at,
        createdBy: pollCreator ? {
          id: pollCreator.id,
          name: pollCreator.name,
          username: pollCreator.username,
          avatar: pollCreator.avatar_url
        } : null,
        options: pollOptionsForThisPoll.map(option => {
          const votesForThisOption = pollVotes.filter(v => v.option_id === option.id);
          const voters = votesForThisOption.map(vote => {
            const voter = userData.find(u => u.id === vote.user_id);
            return voter ? {
              id: vote.user_id,
              name: voter.name,
              avatar: voter.avatar_url
            } : null;
          }).filter(v => v !== null);

          return {
            id: option.id,
            text: option.option_text,
            votes: votesForThisOption.map(v => v.user_id),
            voters: voters
          };
        })
      };
    });

    console.log('✅ Polls fetched successfully:', transformedPolls.length);
    res.json(transformedPolls);

  } catch (error) {
    console.error('Error in GET /polls/:planId:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /polls/:planId - Create new poll (when, where, custom only)
router.post('/:planId', requireAuth, async (req, res) => {
  try {
    const { planId } = req.params;
    const { question, options, type, expiresAt } = req.body;
    const userId = req.user.id;

    console.log('📝 Creating poll for plan:', planId, 'type:', type);

    // Validate input
    if (!question || !options || options.length < 2) {
      return res.status(400).json({ error: 'Question and at least 2 options required' });
    }

    if (!['when', 'where', 'custom'].includes(type)) {
      return res.status(400).json({ error: 'Invalid poll type. Only when, where, and custom polls are supported' });
    }

    // Verify user can create polls (must be going participant)
    const { data: participant, error: participantError } = await supabase
      .from('plan_participants')
      .select('status')
      .eq('plan_id', planId)
      .eq('user_id', userId)
      .single();

    if (participantError || !participant || participant.status !== 'going') {
      return res.status(403).json({ error: 'Only going participants can create polls' });
    }

    // Create poll
    const pollData = {
      plan_id: planId,
      title: question,
      description: `Poll created by user`,
      poll_type: type,
      ends_at: expiresAt || null,
      created_by: userId
    };

    const { data: poll, error: pollError } = await supabase
      .from('plan_polls')
      .insert(pollData)
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
      // Clean up the poll if options creation failed
      await supabase.from('plan_polls').delete().eq('id', poll.id);
      return res.status(500).json({ error: 'Failed to create poll options' });
    }

    // Notify plan update
    await notifyPlanUpdate(planId, 'poll_created', userId, { poll_id: poll.id });

    // Return the created poll with full details
    const { data: createdPoll } = await supabase
      .from('plan_polls')
      .select('*')
      .eq('id', poll.id)
      .single();

    const { data: createdOptions } = await supabase
      .from('plan_poll_options')
      .select('*')
      .eq('poll_id', poll.id)
      .order('option_order', { ascending: true });

    const pollCreator = await supabase
      .from('users')
      .select('id, name, username, avatar_url')
      .eq('id', userId)
      .single();

    const transformedPoll = {
      id: createdPoll.id,
      question: createdPoll.title,
      type: createdPoll.poll_type,
      expiresAt: createdPoll.ends_at,
      createdBy: pollCreator.data ? {
        id: pollCreator.data.id,
        name: pollCreator.data.name,
        username: pollCreator.data.username,
        avatar: pollCreator.data.avatar_url
      } : null,
      options: (createdOptions || []).map(option => ({
        id: option.id,
        text: option.option_text,
        votes: [],
        voters: []
      }))
    };

    console.log('✅ Poll created successfully:', poll.id);
    res.status(201).json(transformedPoll);

  } catch (error) {
    console.error('Error in POST /polls/:planId:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /polls/:planId/:pollId/vote - Vote on poll
router.post('/:planId/:pollId/vote', requireAuth, async (req, res) => {
  try {
    const { planId, pollId } = req.params;
    const { optionIds } = req.body;
    const userId = req.user.id;

    console.log('🗳️ Voting on poll:', pollId, 'options:', optionIds);

    // Validate input
    if (!Array.isArray(optionIds)) {
      return res.status(400).json({ error: 'optionIds must be an array' });
    }

    // Verify user can vote (must be going participant)
    const { data: participant, error: participantError } = await supabase
      .from('plan_participants')
      .select('status')
      .eq('plan_id', planId)
      .eq('user_id', userId)
      .single();

    if (participantError || !participant || participant.status !== 'going') {
      return res.status(403).json({ error: 'Only going participants can vote' });
    }

    // Verify poll exists and belongs to the plan
    const { data: poll, error: pollError } = await supabase
      .from('plan_polls')
      .select('id, poll_type')
      .eq('id', pollId)
      .eq('plan_id', planId)
      .single();

    if (pollError || !poll) {
      return res.status(404).json({ error: 'Poll not found' });
    }

    // Verify poll type is supported (not invitation)
    if (!['when', 'where', 'custom'].includes(poll.poll_type)) {
      return res.status(400).json({ error: 'Voting not supported for this poll type' });
    }

    // Remove existing votes for this poll and user
    const { error: deleteError } = await supabase
      .from('plan_poll_votes')
      .delete()
      .eq('poll_id', pollId)
      .eq('user_id', userId);

    if (deleteError) {
      console.error('Error removing existing votes:', deleteError);
      return res.status(500).json({ error: 'Failed to update vote' });
    }

    // Add new votes if any
    if (optionIds.length > 0) {
      // Verify all optionIds belong to this poll
      const { data: validOptions, error: optionsError } = await supabase
        .from('plan_poll_options')
        .select('id')
        .eq('poll_id', pollId)
        .in('id', optionIds);

      if (optionsError) {
        console.error('Error validating options:', optionsError);
        return res.status(500).json({ error: 'Failed to validate options' });
      }

      if (!validOptions || validOptions.length !== optionIds.length) {
        return res.status(400).json({ error: 'Invalid option IDs' });
      }

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
        return res.status(500).json({ error: 'Failed to add votes' });
      }
    }

    // Notify plan update
    await notifyPlanUpdate(planId, 'poll_voted', userId, { poll_id: pollId });

    console.log('✅ Vote submitted successfully');
    res.json({ success: true, message: 'Vote recorded' });

  } catch (error) {
    console.error('Error in POST /polls/:planId/:pollId/vote:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /polls/:planId/:pollId - Edit poll (with locking logic)
router.put('/:planId/:pollId', requireAuth, async (req, res) => {
  try {
    const { planId, pollId } = req.params;
    const { question, options } = req.body;
    const userId = req.user.id;

    console.log('✏️ Editing poll:', pollId);

    // Verify user is the poll creator
    const { data: poll, error: pollError } = await supabase
      .from('plan_polls')
      .select('created_by, poll_type')
      .eq('id', pollId)
      .eq('plan_id', planId)
      .single();

    if (pollError || !poll) {
      return res.status(404).json({ error: 'Poll not found' });
    }

    if (poll.created_by !== userId) {
      return res.status(403).json({ error: 'Only poll creator can edit' });
    }

    if (!['when', 'where', 'custom'].includes(poll.poll_type)) {
      return res.status(400).json({ error: 'Editing not supported for this poll type' });
    }

    // Get current poll options and votes to determine locking
    const { data: currentOptions, error: optionsError } = await supabase
      .from('plan_poll_options')
      .select('id, option_text')
      .eq('poll_id', pollId)
      .order('option_order', { ascending: true });

    if (optionsError) {
      console.error('Error fetching current options:', optionsError);
      return res.status(500).json({ error: 'Failed to fetch poll options' });
    }

    // Get vote counts for each option
    const { data: votes, error: votesError } = await supabase
      .from('plan_poll_votes')
      .select('option_id')
      .eq('poll_id', pollId);

    if (votesError) {
      console.error('Error fetching votes:', votesError);
      return res.status(500).json({ error: 'Failed to fetch vote data' });
    }

    // Calculate vote counts
    const voteCounts = {};
    (votes || []).forEach(vote => {
      voteCounts[vote.option_id] = (voteCounts[vote.option_id] || 0) + 1;
    });

    // Determine protected options (top 2 most voted)
    const sortedOptions = (currentOptions || []).map(option => ({
      ...option,
      votes: voteCounts[option.id] || 0
    })).sort((a, b) => b.votes - a.votes);

    const protectedOptions = new Set();
    if (sortedOptions.length >= 2) {
      protectedOptions.add(sortedOptions[0].option_text);
      protectedOptions.add(sortedOptions[1].option_text);
    } else if (sortedOptions.length === 1) {
      protectedOptions.add(sortedOptions[0].option_text);
    }

    // Validate that protected options are not being changed
    const currentOptionsMap = {};
    (currentOptions || []).forEach(option => {
      currentOptionsMap[option.id] = option.option_text;
    });

    // Check if any protected option text is being changed
    for (let i = 0; i < options.length; i++) {
      const newText = options[i];
      const currentText = currentOptionsMap[currentOptions[i]?.id];

      if (currentText && protectedOptions.has(currentText) && currentText !== newText) {
        return res.status(400).json({
          error: 'Cannot edit protected options that have received significant votes',
          protectedOptions: Array.from(protectedOptions)
        });
      }
    }

    // Update poll title
    const { error: updatePollError } = await supabase
      .from('plan_polls')
      .update({ title: question })
      .eq('id', pollId);

    if (updatePollError) {
      console.error('Error updating poll:', updatePollError);
      return res.status(500).json({ error: 'Failed to update poll' });
    }

    // Update options (only non-protected ones)
    for (let i = 0; i < options.length; i++) {
      const optionId = currentOptions[i]?.id;
      const newText = options[i];
      const currentText = currentOptionsMap[optionId];

      if (optionId && (!currentText || !protectedOptions.has(currentText))) {
        const { error: updateOptionError } = await supabase
          .from('plan_poll_options')
          .update({ option_text: newText })
          .eq('id', optionId);

        if (updateOptionError) {
          console.error('Error updating option:', updateOptionError);
          return res.status(500).json({ error: 'Failed to update option' });
        }
      }
    }

    // Notify plan update
    await notifyPlanUpdate(planId, 'poll_updated', userId, { poll_id: pollId });

    console.log('✅ Poll updated successfully');
    res.json({ success: true, message: 'Poll updated successfully' });

  } catch (error) {
    console.error('Error in PUT /polls/:planId/:pollId:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /polls/:planId/:pollId - Delete poll
router.delete('/:planId/:pollId', requireAuth, async (req, res) => {
  try {
    const { planId, pollId } = req.params;
    const userId = req.user.id;

    console.log('🗑️ Deleting poll:', pollId);

    // Verify user is the poll creator
    const { data: poll, error: pollError } = await supabase
      .from('plan_polls')
      .select('created_by')
      .eq('id', pollId)
      .eq('plan_id', planId)
      .single();

    if (pollError || !poll) {
      return res.status(404).json({ error: 'Poll not found' });
    }

    if (poll.created_by !== userId) {
      return res.status(403).json({ error: 'Only poll creator can delete' });
    }

    // Delete poll (cascade will handle options and votes)
    const { error: deleteError } = await supabase
      .from('plan_polls')
      .delete()
      .eq('id', pollId);

    if (deleteError) {
      console.error('Error deleting poll:', deleteError);
      return res.status(500).json({ error: 'Failed to delete poll' });
    }

    // Notify plan update
    await notifyPlanUpdate(planId, 'poll_deleted', userId, { poll_id: pollId });

    console.log('✅ Poll deleted successfully');
    res.json({ success: true, message: 'Poll deleted successfully' });

  } catch (error) {
    console.error('Error in DELETE /polls/:planId/:pollId:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /polls/:planId/:pollId/results - Get poll results with winner determination
router.get('/:planId/:pollId/results', requireAuth, async (req, res) => {
  try {
    const { planId, pollId } = req.params;
    const userId = req.user.id;

    console.log('📊 Getting poll results for:', pollId);

    // Verify user has access to this plan
    const { data: participant, error: participantError } = await supabase
      .from('plan_participants')
      .select('status')
      .eq('plan_id', planId)
      .eq('user_id', userId)
      .single();

    if (participantError || !participant) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Get poll details
    const { data: poll, error: pollError } = await supabase
      .from('plan_polls')
      .select('*')
      .eq('id', pollId)
      .eq('plan_id', planId)
      .single();

    if (pollError || !poll) {
      return res.status(404).json({ error: 'Poll not found' });
    }

    // Get poll options with vote counts
    const { data: options, error: optionsError } = await supabase
      .from('plan_poll_options')
      .select(`
        id,
        option_text,
        option_order
      `)
      .eq('poll_id', pollId)
      .order('option_order', { ascending: true });

    if (optionsError) {
      console.error('Error fetching options:', optionsError);
      return res.status(500).json({ error: 'Failed to fetch options' });
    }

    // Get vote counts with timestamps
    const optionIds = options?.map(o => o.id) || [];
    const { data: votes, error: votesError } = await supabase
      .from('plan_poll_votes')
      .select('option_id, user_id, created_at')
      .in('option_id', optionIds)
      .order('created_at', { ascending: true });

    if (votesError) {
      console.error('Error fetching votes:', votesError);
      return res.status(500).json({ error: 'Failed to fetch votes' });
    }

    // Calculate vote counts and get going participants count
    const voteCounts = {};
    const voteTimestamps = {};
    const uniqueVoters = new Set();
    (votes || []).forEach(vote => {
      voteCounts[vote.option_id] = (voteCounts[vote.option_id] || 0) + 1;
      uniqueVoters.add(vote.user_id);

      // Store timestamps for each option
      if (!voteTimestamps[vote.option_id]) {
        voteTimestamps[vote.option_id] = [];
      }
      voteTimestamps[vote.option_id].push(new Date(vote.created_at));
    });

    const { data: goingParticipants, error: participantsError } = await supabase
      .from('plan_participants')
      .select('id')
      .eq('plan_id', planId)
      .eq('status', 'going');

    if (participantsError) {
      console.error('Error fetching participants:', participantsError);
      return res.status(500).json({ error: 'Failed to fetch participants' });
    }

    const totalVoters = uniqueVoters.size;
    const goingParticipantsCount = goingParticipants?.length || 0;

    // Winner determination logic
    const winnerThreshold = Math.max(
      Math.ceil(0.4 * goingParticipantsCount), // 40% of going participants
      Math.ceil(0.7 * totalVoters), // 70% of voters
      Math.min(3, goingParticipantsCount) // Minimum threshold
    );

    // Sort options by vote count
    const optionsWithVotes = (options || []).map(option => ({
      id: option.id,
      text: option.option_text,
      votes: voteCounts[option.id] || 0,
      percentage: totalVoters > 0 ? Math.round(((voteCounts[option.id] || 0) / totalVoters) * 100) : 0
    })).sort((a, b) => b.votes - a.votes);

    // Find winners
    const potentialWinners = optionsWithVotes.filter(option =>
      option.votes >= winnerThreshold &&
      option.votes > 0 &&
      totalVoters >= Math.min(3, goingParticipantsCount)
    );

    let winner = null;
    let isRandomlySelected = false;

    if (potentialWinners.length === 1) {
      winner = potentialWinners[0];
    } else if (potentialWinners.length > 1) {
      // Multiple winners with same vote count - select the one that reached the vote count first
      const maxVotes = potentialWinners[0].votes; // All have same vote count

      // Find the earliest timestamp when any option reached the winning vote count
      let earliestWinner = null;
      let earliestTime = null;

      potentialWinners.forEach(option => {
        const timestamps = voteTimestamps[option.id] || [];
        if (timestamps.length >= maxVotes) {
          // The timestamp of the Nth vote (where N = maxVotes) is when this option reached the winning count
          const timeReached = timestamps[maxVotes - 1];
          if (!earliestTime || timeReached < earliestTime) {
            earliestTime = timeReached;
            earliestWinner = option;
          }
        }
      });

      winner = earliestWinner;
      isRandomlySelected = false; // No longer random
    }

    const result = {
      poll: {
        id: poll.id,
        question: poll.title,
        type: poll.poll_type,
        totalVoters,
        totalGoingParticipants: goingParticipantsCount,
        winnerThreshold,
        hasWinner: winner !== null,
        isRandomlySelected,
        winner: winner ? {
          id: winner.id,
          text: winner.text,
          votes: winner.votes,
          percentage: winner.percentage
        } : null
      },
      options: optionsWithVotes,
      stats: {
        totalVotes: totalVoters,
        goingParticipants: goingParticipantsCount,
        winnerThreshold,
        participationRate: goingParticipantsCount > 0 ?
          Math.round((totalVoters / goingParticipantsCount) * 100) : 0
      }
    };

    console.log('✅ Poll results calculated successfully');
    res.json(result);

  } catch (error) {
    console.error('Error in GET /polls/:planId/:pollId/results:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
