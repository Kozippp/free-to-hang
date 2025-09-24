const express = require('express');
const router = express.Router();

// Use global supabase instance
const supabase = global.supabase;

// Select anon key based on active project (fallback to base var)
const ACTIVE = (process.env.SUPABASE_ACTIVE_PROJECT || 'KOZIPPP').toUpperCase();
const resolveEnv = (base, fallback) => process.env[base] || process.env[fallback];
const supabaseAnonKey = resolveEnv(`SUPABASE_ANON_KEY_${ACTIVE}`, 'SUPABASE_ANON_KEY');

if (!supabaseAnonKey) {
  console.warn('⚠️ SUPABASE_ANON_KEY environment variable is missing');
  console.warn('🚨 JWT authentication will be disabled');
  console.warn('💡 Please set SUPABASE_ANON_KEY in Railway environment variables');
  console.warn('🔧 Backend will start but plan creation will fail until this is fixed');
}

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
    
    // Check if anon key is available
    if (!supabaseAnonKey) {
      console.log('🔑 No anon key available, cannot validate JWT');
      return null;
    }
    
    console.log('🔑 Using anon key from environment');
    const supabaseUrl = resolveEnv(`SUPABASE_URL_${ACTIVE}`, 'SUPABASE_URL');
    console.log('🔑 Supabase URL:', supabaseUrl);
    
    const clientSupabase = createClient(
      supabaseUrl,
      supabaseAnonKey
    );
    
    const { data: { user }, error } = await clientSupabase.auth.getUser(token);
    console.log('🔑 Token validation result:', error ? 'Failed' : 'Success');
    if (error) {
      console.log('🔑 Token validation error:', error.message);
      console.log('🔑 Error details:', JSON.stringify(error, null, 2));
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
    console.log('🔔 Sending real-time notification:', {
      planId,
      updateType,
      triggeredBy,
      metadata
    });

    const result = await supabase
      .from('plan_updates')
      .insert({
        plan_id: planId,
        update_type: updateType,
        triggered_by: triggeredBy,
        metadata
      })
      .select();

    console.log('✅ Real-time notification sent successfully:', {
      planId,
      updateType,
      result: result.data ? 'INSERTED' : 'FAILED',
      error: result.error
    });

    if (result.error) {
      console.error('❌ Error inserting plan update notification:', result.error);
    }

  } catch (error) {
    console.error('❌ Error creating plan update notification:', error);
    console.error('❌ Stack trace:', error.stack);
  }
};

// Helper function to transform participant status for conditional visibility
const transformParticipantStatus = (participant, currentUserId) => {

  // Apply conditional status transformation
  let actualStatus = participant.status;
  let conditionalFriends = participant.conditionalFriends; // Keep original conditionalFriends!

  if (participant.status === 'conditional') {
    if (currentUserId === participant.id) {
      // Current user sees their own conditional status
      actualStatus = 'conditional';
      conditionalFriends = participant.conditionalFriends || [];
    } else {
      // Other users see conditional as "maybe"
      actualStatus = 'maybe';
      conditionalFriends = undefined; // Hide conditionalFriends from other users s
    }
  }

  return {
    ...participant,
    status: actualStatus,
    conditionalFriends: conditionalFriends
  };
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

    // Get participants with new schema (status instead of response)
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

    // Completion votes deprecated: plans auto-complete after 24h

    // Get conditional dependencies from dedicated table
    const { data: depsRows, error: depsError } = await supabase
      .from('plan_conditional_dependencies')
      .select('user_id, friend_id')
      .eq('plan_id', planId);

    if (depsError) throw depsError;
    const depsMap = new Map();
    depsRows?.forEach(r => {
      if (!depsMap.has(r.user_id)) depsMap.set(r.user_id, []);
      depsMap.get(r.user_id).push(r.friend_id);
    });

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
      
      const transformedPoll = {
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

      // Add invitedUsers for invitation polls
      if (poll.poll_type === 'invitation' && poll.invited_users) {
        transformedPoll.invitedUsers = poll.invited_users;
      }

      return transformedPoll;
    });

    // Transform participants with user data and conditional friends
    const transformedParticipants = participants.map(p => {
      const user = participantUsers.find(u => u.id === p.user_id);
      const conditionalFriendsList = depsMap.get(p.user_id) || [];


      // Apply conditional status transformation using helper function
      const transformedParticipant = {
        id: p.user_id,
        name: user?.name || 'Unknown',
        avatar: user?.avatar_url,
        status: p.status,
        conditionalFriends: conditionalFriendsList,
        joinedAt: p.created_at
      };

      return transformParticipantStatus(transformedParticipant, userId);
    });

    const response = {
      ...plan,
      creator: creator,
      participants: transformedParticipants,
      polls: transformedPolls,
      attendance: attendance
    };


    return response;
  } catch (error) {
    console.error('Error getting plan details:', error);
    throw error;
  }
};

const processConditionalDependencies = async (planId) => {
  try {

    // Get all participants
    const { data: participants, error: participantsError } = await supabase
      .from('plan_participants')
      .select('*')
      .eq('plan_id', planId);

    if (participantsError) throw participantsError;

    // Get conditional dependencies
    const { data: depRows, error: depError } = await supabase
      .from('plan_conditional_dependencies')
      .select('user_id, friend_id')
      .eq('plan_id', planId);

    if (depError) throw depError;

    const conditionalMap = new Map();
    depRows?.forEach(r => {
      if (!conditionalMap.has(r.user_id)) conditionalMap.set(r.user_id, []);
      conditionalMap.get(r.user_id).push(r.friend_id);
    });

    // Helper function to check if a participant can become "going"
    const canBecomeGoing = (userId, visited = new Set(), memo = new Map()) => {
      // Check memoization first
      if (memo.has(userId)) {
        return memo.get(userId);
      }

      // Cycle detection - if we've seen this user in current path, assume cycle can be resolved
      if (visited.has(userId)) {
        return true;
      }

      const participant = participants.find(p => p.user_id === userId);
      if (!participant) {
        memo.set(userId, false);
        return false;
      }

      // If already going, satisfied
      if (participant.status === 'going') {
        memo.set(userId, true);
        return true;
      }

      // If not conditional, cannot become going
      if (participant.status !== 'conditional') {
        memo.set(userId, false);
        return false;
      }

      const dependencies = conditionalMap.get(userId) || [];
      if (dependencies.length === 0) {
        // No dependencies = can go
        memo.set(userId, true);
        return true;
      }

      // Add to current path for cycle detection
      visited.add(userId);

      // Check if all dependencies can be satisfied
      const canSatisfyAll = dependencies.every(depId => {
        return canBecomeGoing(depId, new Set(visited), memo);
      });

      // Remove from current path
      visited.delete(userId);

      memo.set(userId, canSatisfyAll);
      return canSatisfyAll;
    };

    // Find all conditional participants that can become "going"
    const participantsToConvert = [];
    for (const participant of participants) {
      if (participant.status === 'conditional') {
        if (canBecomeGoing(participant.user_id)) {
          participantsToConvert.push(participant);
        }
      }
    }

    // Convert all eligible participants to "going" in one batch
    if (participantsToConvert.length > 0) {
      console.log('✅ Converting conditional participants to going:', participantsToConvert.map(p => p.user_id));

      // Update all participants to going
      const userIdsToConvert = participantsToConvert.map(p => p.user_id);
      const { error: batchUpdateError } = await supabase
        .from('plan_participants')
        .update({
          status: 'going'
          // updated_at is handled by database trigger
        })
        .eq('plan_id', planId)
        .in('user_id', userIdsToConvert);

      if (!batchUpdateError) {
        // Remove conditional dependencies for all converted users
        await supabase
          .from('plan_conditional_dependencies')
          .delete()
          .eq('plan_id', planId)
          .in('user_id', userIdsToConvert);

        // Notify about status changes for each participant
        for (const participant of participantsToConvert) {
          await notifyPlanUpdate(planId, 'participant_accepted_conditionally', participant.user_id);
        }

        console.log(`✅ Successfully converted ${participantsToConvert.length} conditional participants to going`);
      } else {
        console.error('❌ Error updating participants:', batchUpdateError);
      }
    } else {
      console.log('ℹ️ No conditional participants can be converted to going');
    }

  } catch (error) {
    console.error('❌ Error processing conditional dependencies:', error);
  }
};

// GET /plans - Get user's plans
router.get('/', requireAuth, async (req, res) => {
  try {
    const { status = 'all' } = req.query;
    const userId = req.user.id;

    console.log('🔍 Fetching plans for user:', userId, 'with status:', status);
    console.log('🔍 Request headers:', JSON.stringify(req.headers, null, 2));
    console.log('🔍 Request query:', JSON.stringify(req.query, null, 2));

    // Use service role but with explicit user filtering to avoid RLS recursion
    // Get plans where user is creator
    let creatorQuery = supabase
      .from('plans')
      .select('*')
      .eq('creator_id', userId)
      .order('created_at', { ascending: false });

    if (status !== 'all') {
      creatorQuery = creatorQuery.eq('status', status);
    }

    const { data: creatorPlans, error: creatorError } = await creatorQuery;

    if (creatorError) {
      console.error('❌ Error fetching creator plans:', creatorError);
      console.error('❌ Creator query details:', { userId, status, query: creatorQuery });
      return res.status(500).json({ error: 'Failed to fetch plans' });
    }

    // Get plan IDs where user is participant
    const { data: participantRecords, error: participantError } = await supabase
      .from('plan_participants')
      .select('plan_id')
      .eq('user_id', userId);

    if (participantError) {
      console.error('Error fetching participant records:', participantError);
      return res.status(500).json({ error: 'Failed to fetch plans' });
    }

    // Get plans where user is participant (but not creator)
    let participantPlans = [];
    if (participantRecords.length > 0) {
      const participantPlanIds = participantRecords.map(p => p.plan_id);
      
      let participantQuery = supabase
        .from('plans')
        .select('*')
        .in('id', participantPlanIds)
        .neq('creator_id', userId) // Exclude plans where user is also creator
        .order('created_at', { ascending: false });

      if (status !== 'all') {
        participantQuery = participantQuery.eq('status', status);
      }

      const { data: participantPlansData, error: participantPlansError } = await participantQuery;

      if (participantPlansError) {
        console.error('Error fetching participant plans:', participantPlansError);
        return res.status(500).json({ error: 'Failed to fetch plans' });
      }

      participantPlans = participantPlansData || [];
    }

    // Combine and deduplicate plans
    const allPlans = [...(creatorPlans || []), ...participantPlans];
    const plans = allPlans.filter((plan, index, self) => 
      index === self.findIndex(p => p.id === plan.id)
    );

    console.log('✅ Found plans:', plans.length);

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

    // Get polls for all plans
    const { data: allPolls, error: pollsError } = await supabase
      .from('plan_polls')
      .select('*')
      .in('plan_id', planIds);

    if (pollsError) {
      console.error('Error fetching polls:', pollsError);
    }

    // Get poll options for all polls
    const pollIds = allPolls ? allPolls.map(p => p.id) : [];
    let pollOptions = [];
    if (pollIds.length > 0) {
      const { data: optionsData, error: optionsError } = await supabase
        .from('plan_poll_options')
        .select('*')
        .in('poll_id', pollIds);
      
      if (!optionsError) {
        pollOptions = optionsData || [];
      }
    }

    // Get poll votes for all options
    const optionIds = pollOptions.map(o => o.id);
    let pollVotes = [];
    if (optionIds.length > 0) {
      const { data: votesData, error: votesError } = await supabase
        .from('plan_poll_votes')
        .select('*')
        .in('option_id', optionIds);
      
      if (!votesError) {
        pollVotes = votesData || [];
      }
    }

    // Get voter user data
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
    const pollCreatorIds = [...new Set((allPolls || []).map(p => p.created_by))];
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

    // Get conditional dependencies for all plans
    let conditionalDeps = [];
    if (planIds.length > 0) {
      const { data: depsData, error: depsError } = await supabase
        .from('plan_conditional_dependencies')
        .select('plan_id, user_id, friend_id')
        .in('plan_id', planIds);

      if (!depsError && depsData) {
        conditionalDeps = depsData;
      }
    }

    // Create conditional dependencies map
    const depsMap = new Map();
    conditionalDeps.forEach(dep => {
      const key = `${dep.plan_id}-${dep.user_id}`;
      if (!depsMap.has(key)) depsMap.set(key, []);
      depsMap.get(key).push(dep.friend_id);
    });

    // Transform plans for frontend
    const transformedPlans = plans.map(plan => {
      const planParticipants = allParticipants.filter(p => p.plan_id === plan.id);
      const participantsWithUserData = planParticipants.map(p => {
        const user = participantUsers.find(u => u.id === p.user_id);
        const depsKey = `${plan.id}-${p.user_id}`;
        const conditionalFriends = depsMap.get(depsKey) || [];

        // Apply conditional status transformation
        const transformedParticipant = {
          id: p.user_id,
          name: user?.name || 'Unknown',
          avatar: user?.avatar_url,
          status: p.status,
          conditionalFriends: conditionalFriends,
          joinedAt: p.created_at
        };

        return transformParticipantStatus(transformedParticipant, userId);
      });

      // Get polls for this plan
      const planPolls = (allPolls || []).filter(poll => poll.plan_id === plan.id);
      const transformedPolls = planPolls.map(poll => {
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

      return {
        id: plan.id,
        title: plan.title,
        description: plan.description,
        location: plan.location,
        date: plan.date,
        isAnonymous: plan.is_private || plan.is_anonymous,
        status: plan.status,
        creator: (plan.is_private || plan.is_anonymous) ? null : creators[plan.creator_id],
        participants: participantsWithUserData,
        polls: transformedPolls,
        createdAt: plan.created_at,
        updatedAt: plan.updated_at
      };
    });

    res.json(transformedPlans);
  } catch (error) {
    console.error('❌ Error in GET /plans:', error);
    console.error('❌ Error stack:', error.stack);
    console.error('❌ Error details:', JSON.stringify(error, null, 2));
    res.status(500).json({ error: 'Failed to fetch plans' });
  }
});

// GET /plans/test-realtime - Test real-time functionality
router.get('/test-realtime', async (req, res) => {
  try {
    console.log('🧪 Testing real-time functionality...');

    // Test by inserting a dummy plan update
    const testPlanId = 'test-plan-' + Date.now();
    const testUpdateType = 'test_notification';
    const testTriggeredBy = 'system-test';

    await notifyPlanUpdate(testPlanId, testUpdateType, testTriggeredBy, {
      test: true,
      timestamp: new Date().toISOString()
    });

    res.json({
      message: 'Real-time test notification sent',
      testData: {
        planId: testPlanId,
        updateType: testUpdateType,
        triggeredBy: testTriggeredBy
      }
    });

  } catch (error) {
    console.error('❌ Error in test-realtime:', error);
    res.status(500).json({ error: 'Real-time test failed', details: error.message });
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

    // Ensure creator exists in public.users (FK requirement)
    try {
      const { data: existingUser, error: existingUserError } = await supabase
        .from('users')
        .select('id')
        .eq('id', userId)
        .single();

      if (existingUserError && existingUserError.code !== 'PGRST116') {
        console.warn('⚠️ Error checking existing user:', existingUserError.message);
      }

      if (!existingUser) {
        console.log('🆕 Inserting missing user row for creator');
        const email = req.user.email || 'unknown@example.com';
        const name = email.split('@')[0];
        const username = name;
        const { error: insertUserError } = await supabase
          .from('users')
          .insert({ id: userId, email, name, username })
          .single();
        if (insertUserError) {
          console.error('❌ Failed to insert missing user row:', insertUserError);
        }
      }
    } catch (e) {
      console.warn('⚠️ Skipping ensure-user step due to error:', e.message);
    }

    // Create plan with schema fallback (is_anonymous vs is_private)
    let plan = null;
    let planError = null;
    try {
      const resp = await supabase
        .from('plans')
        .insert({
          title,
          description,
          location,
          date,
          is_anonymous: isAnonymous,
          creator_id: userId
        })
        .select()
        .single();
      plan = resp.data;
      planError = resp.error;
    } catch (e) {
      planError = e;
    }

    // Retry with legacy column name if needed
    if (planError) {
      const needsLegacy = (planError.message && planError.message.includes("is_anonymous")) || planError.code === 'PGRST204';
      if (needsLegacy) {
        console.log('🔁 Retrying plan insert with legacy column is_private');
        const { data: planLegacy, error: legacyError } = await supabase
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
        plan = planLegacy;
        planError = legacyError;
      }
    }

    if (planError || !plan) {
      console.error('Error creating plan:', planError);
      return res.status(500).json({ error: 'Failed to create plan' });
    }

    // Add creator as participant with new status column
    const { error: creatorInsertError } = await supabase
      .from('plan_participants')
      .insert({
        plan_id: plan.id,
        user_id: userId,
        status: isAnonymous ? 'pending' : 'going'
      });
    if (creatorInsertError) {
      // As a secondary attempt, try 'status' for newer schemas
      const { error: secondaryError } = await supabase
        .from('plan_participants')
        .insert({
          plan_id: plan.id,
          user_id: userId,
          status: isAnonymous ? 'pending' : 'going'
        });
      if (secondaryError) {
        console.error('Error adding creator as participant:', secondaryError);
      }
    }

    // participantError block removed (legacy variable)

    // Add invited friends as participants
    if (invitedFriends.length > 0) {
      console.log('🎯 Adding invited friends as participants:', invitedFriends);
      const participantInserts = invitedFriends.map(friendId => ({
        plan_id: plan.id,
        user_id: friendId,
        status: 'pending'
      }));

      const { error: inviteError } = await supabase
        .from('plan_participants')
        .insert(participantInserts);
      if (inviteError) {
        // Try 'response' as fallback for old schema compatibility
        const participantInsertsResponse = invitedFriends.map(friendId => ({
          plan_id: plan.id,
          user_id: friendId,
          response: 'pending'
        }));
        const { error: inviteErrorFallback } = await supabase
          .from('plan_participants')
          .insert(participantInsertsResponse);
        if (inviteErrorFallback) {
          console.error('❌ Error inviting friends:', inviteErrorFallback);
        }
      } else {
        console.log('✅ Successfully added', invitedFriends.length, 'participants');
      }
    } else {
      console.log('ℹ️ No invited friends to add');
    }

    // Get full plan details to return
    const fullPlan = await getPlanWithDetails(plan.id, userId);
    
    // Notify plan creation and visibility updates
    console.log('🚀 Sending real-time notifications for new plan:', plan.id);
    await notifyPlanUpdate(plan.id, 'plan_created', userId);
    await notifyPlanUpdate(plan.id, 'participant_joined', userId);
    console.log('✅ Real-time notifications sent for plan creation');

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
    // Backward compatibility: accept both `status` and legacy `response`
    let { status, conditionalFriends, response } = req.body;
    if (!status && response) {
      status = response === 'accepted' ? 'going' : response;
    }
    const userId = req.user.id;

    // Validate status
    const validStatuses = ['pending', 'going', 'maybe', 'declined', 'conditional'];
    const statusMapping = {
      'going': 'going',
      'maybe': 'maybe',
      'declined': 'declined',
      'pending': 'pending',
      'conditional': 'conditional'
    };

    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    // Check if participant already exists
    const { data: existingParticipant, error: checkError } = await supabase
      .from('plan_participants')
      .select('*')
      .eq('plan_id', id)
      .eq('user_id', userId)
      .single();

    let participant;
    let error;

    // Prepare participant data with new status column
    const participantData = {
      status: statusMapping[status] || status
    };

    // Handle conditional friends data in dedicated table
    if (status === 'conditional') {

      // ALWAYS clear existing deps for this user first
      await supabase
        .from('plan_conditional_dependencies')
        .delete()
        .eq('plan_id', id)
        .eq('user_id', userId);

      // ALWAYS save conditional friends - even if empty array
      console.log('💾 Saving conditional dependencies (even if empty array)');
      const friendsToSave = conditionalFriends || [];
      const rows = friendsToSave.map(friendId => ({
        plan_id: id,
        user_id: userId,
        friend_id: friendId
      }));

      const { error: insertError } = await supabase.from('plan_conditional_dependencies').insert(rows);
      if (insertError) {
        console.error('❌ Error saving conditional dependencies:', insertError);
      } else {
        console.log('✅ Conditional dependencies saved successfully:', rows.length, 'rows inserted');
      }
    } else {
      // Remove any deps if user leaves conditional
      await supabase
        .from('plan_conditional_dependencies')
        .delete()
        .eq('plan_id', id)
        .eq('user_id', userId);
    }

    if (existingParticipant) {
      // Update existing participant (legacy first)
      let updatedParticipant = null;
      let updateError = null;
      try {
        const resp = await supabase
          .from('plan_participants')
          .update(participantData)
          .eq('plan_id', id)
          .eq('user_id', userId)
          .select()
          .single();
        updatedParticipant = resp.data;
        updateError = resp.error;
      } catch (e) {
        updateError = e;
      }

      // Fallback to 'status' column for newer schemas
      if (updateError) {
        const { data: updated2, error: updateError2 } = await supabase
          .from('plan_participants')
          .update({ status: statusMapping[status] || status })
          .eq('plan_id', id)
          .eq('user_id', userId)
          .select()
          .single();
        updatedParticipant = updated2;
        updateError = updateError2;
      }
      participant = updatedParticipant;
      error = updateError;
    } else {
      // Insert new participant (legacy first)
      let newParticipant = null;
      let insertError = null;
      try {
        const resp = await supabase
          .from('plan_participants')
          .insert({
            plan_id: id,
            user_id: userId,
            ...participantData,
            created_at: new Date().toISOString()
          })
          .select()
          .single();
        newParticipant = resp.data;
        insertError = resp.error;
      } catch (e) {
        insertError = e;
      }

      if (insertError) {
        const { data: newParticipant2, error: insertError2 } = await supabase
          .from('plan_participants')
          .insert({
            plan_id: id,
            user_id: userId,
            status: statusMapping[status] || status,
            created_at: new Date().toISOString()
          })
          .select()
          .single();
        newParticipant = newParticipant2;
        insertError = insertError2;
      }
      participant = newParticipant;
      error = insertError;
    }

    if (error) {
      console.error('Error updating participant response:', error);
      return res.status(500).json({ error: 'Failed to update response' });
    }

    // Notify plan update
    await notifyPlanUpdate(id, 'participant_joined', userId);

    // Process conditional dependencies after status change
    await processConditionalDependencies(id);

    const fullPlan = await getPlanWithDetails(id, userId);
    res.json(fullPlan);
  } catch (error) {
    console.error('Error in POST /plans/:id/respond:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /plans/:id/mark-seen - Mark plan as seen (not_seen -> seen)
// TODO: Enable when database schema includes seen_at column
// router.post('/:id/mark-seen', requireAuth, async (req, res) => {
//   try {
//     const { id } = req.params;
//     const userId = req.user.id;

//     // Check if participant exists
//     const { data: existingParticipant, error: checkError } = await supabase
//       .from('plan_participants')
//       .select('status')
//       .eq('plan_id', id)
//       .eq('user_id', userId)
//       .single();

//     if (checkError && checkError.code !== 'PGRST116') {
//       console.error('Error checking participant:', checkError);
//       return res.status(500).json({ error: 'Failed to check participant' });
//     }

//     // Only update if participant exists and is currently pending (not_seen)
//     if (existingParticipant && existingParticipant.status === 'pending') {
//       // Update status to 'seen' - we'll use a special field for this
//       const { data: participant, error } = await supabase
//         .from('plan_participants')
//         .update({
//           seen_at: new Date().toISOString()
//         })
//         .eq('plan_id', id)
//         .eq('user_id', userId)
//         .select()
//         .single();

//       if (error) {
//         console.error('Error marking plan as seen:', error);
//         return res.status(500).json({ error: 'Failed to mark as seen' });
//       }
//     }

//     const fullPlan = await getPlanWithDetails(id, userId);
//     res.json(fullPlan);
//   } catch (error) {
//     console.error('Error in POST /plans/:id/mark-seen:', error);
//     res.status(500).json({ error: 'Internal server error' });
//   }
// });

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
      .select('status')
      .eq('plan_id', id)
      .eq('user_id', userId)
      .single();

    if (participantError || !participant || participant.status !== 'going') {
      return res.status(403).json({ error: 'Only going participants can create polls' });
    }

    // Create poll
    const pollData = {
      plan_id: id,
      title: question,
      description: `Poll created by user`,
      poll_type: type,
      ends_at: expiresAt,
      created_by: userId
    };

    // Add invited_users for invitation polls
    if (type === 'invitation' && invitedUsers && invitedUsers.length > 0) {
      pollData.invited_users = invitedUsers;
    }

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
    if (!Array.isArray(optionIds)) {
      return res.status(400).json({ error: 'optionIds must be an array' });
    }
    
    // Allow empty array (no votes selected)
    // This allows users to "unvote" by selecting no options

    // Check if user can vote (is accepted participant)
    // Allow vote removal (empty array) for users who were previously going, but prevent new votes
    const { data: participant, error: participantError } = await supabase
      .from('plan_participants')
      .select('status')
      .eq('plan_id', id)
      .eq('user_id', userId)
      .single();

    if (participantError || !participant) {
      return res.status(403).json({ error: 'Participant not found' });
    }

    // Allow voting if:
    // 1. User is currently going, OR
    // 2. User is removing all votes (empty array) - allow cleanup when changing status
    const canVote = participant.status === 'going' || (Array.isArray(optionIds) && optionIds.length === 0);
    if (!canVote) {
      return res.status(403).json({ error: 'Only going participants can vote' });
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

// PUT /plans/:id/polls/:pollId - Update poll
router.put('/:id/polls/:pollId', requireAuth, async (req, res) => {
  try {
    const { id, pollId } = req.params;
    const { question, options } = req.body;
    const userId = req.user.id;

    // Validate input
    if (!question || !options || options.length < 2) {
      return res.status(400).json({ error: 'Question and at least 2 options required' });
    }

    // Check if user is participant and can edit polls
    const { data: participant, error: participantError } = await supabase
      .from('plan_participants')
      .select('status')
      .eq('plan_id', id)
      .eq('user_id', userId)
      .single();

    if (participantError || !participant || participant.status !== 'going') {
      return res.status(403).json({ error: 'Only going participants can edit polls' });
    }

    // Check if poll exists
    const { data: existingPoll, error: pollError } = await supabase
      .from('plan_polls')
      .select('created_by')
      .eq('id', pollId)
      .eq('plan_id', id)
      .single();

    if (pollError || !existingPoll) {
      return res.status(404).json({ error: 'Poll not found' });
    }

    // For collaborative planning, allow all "going" participants to edit polls
    // (we already checked above that the user is going and a participant)

    // Update poll title
    const { error: updatePollError } = await supabase
      .from('plan_polls')
      .update({ title: question })
      .eq('id', pollId)
      .eq('plan_id', id);

    if (updatePollError) {
      console.error('Error updating poll:', updatePollError);
      return res.status(500).json({ error: 'Failed to update poll' });
    }

    // Get existing options to preserve votes where possible
    const { data: existingOptions, error: optionsError } = await supabase
      .from('plan_poll_options')
      .select('id, option_text')
      .eq('poll_id', pollId)
      .order('option_order');

    if (optionsError) {
      console.error('Error fetching existing options:', optionsError);
      return res.status(500).json({ error: 'Failed to fetch existing options' });
    }

    // Create a map of existing option text to option ID to preserve votes
    const existingOptionMap = new Map();
    existingOptions?.forEach(option => {
      existingOptionMap.set(option.option_text.toLowerCase().trim(), option.id);
    });

    // Separate new options from existing ones
    const newOptions = [];
    const existingOptionsToUpdate = [];

    options.forEach((optionText, index) => {
      const existingId = existingOptionMap.get(optionText.toLowerCase().trim());
      if (existingId) {
        // This option exists, we need to update it
        existingOptionsToUpdate.push({
          id: existingId,
          option_text: optionText,
          option_order: index
        });
      } else {
        // This is a new option, we need to insert it
        newOptions.push({
          poll_id: pollId,
          option_text: optionText,
          option_order: index
        });
      }
    });

    // Delete existing options that are not in the new options list
    const newOptionsLower = options.map(opt => opt.toLowerCase().trim());
    const optionsToDelete = existingOptions?.filter(opt =>
      !newOptionsLower.includes(opt.option_text.toLowerCase().trim())
    ) || [];

    if (optionsToDelete.length > 0) {
      const { error: deleteOptionsError } = await supabase
        .from('plan_poll_options')
        .delete()
        .in('id', optionsToDelete.map(opt => opt.id));

      if (deleteOptionsError) {
        console.error('Error deleting old options:', deleteOptionsError);
        return res.status(500).json({ error: 'Failed to delete old options' });
      }
    }

    // Update existing options
    if (existingOptionsToUpdate.length > 0) {
      for (const option of existingOptionsToUpdate) {
        const { error: updateError } = await supabase
          .from('plan_poll_options')
          .update({
            option_text: option.option_text,
            option_order: option.option_order
          })
          .eq('id', option.id);

        if (updateError) {
          console.error('Error updating option:', updateError);
          return res.status(500).json({ error: 'Failed to update existing options' });
        }
      }
    }

    // Insert new options
    if (newOptions.length > 0) {
      const { error: insertOptionsError } = await supabase
        .from('plan_poll_options')
        .insert(newOptions);

      if (insertOptionsError) {
        console.error('Error inserting new options:', insertOptionsError);
        return res.status(500).json({ error: 'Failed to insert new options' });
      }
    }

    // Notify poll update
    await notifyPlanUpdate(id, 'poll_updated', userId, { poll_id: pollId });

    const fullPlan = await getPlanWithDetails(id, userId);
    res.json(fullPlan);
  } catch (error) {
    console.error('Error in PUT /plans/:id/polls/:pollId:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /plans/:id/polls/:pollId - Delete poll
router.delete('/:id/polls/:pollId', requireAuth, async (req, res) => {
  try {
    const { id, pollId } = req.params;
    const userId = req.user.id;

    // Check if user is participant and can delete polls
    const { data: participant, error: participantError } = await supabase
      .from('plan_participants')
      .select('status')
      .eq('plan_id', id)
      .eq('user_id', userId)
      .single();

    if (participantError || !participant || participant.status !== 'going') {
      return res.status(403).json({ error: 'Only going participants can delete polls' });
    }

    // Check if poll exists
    const { data: existingPoll, error: pollError } = await supabase
      .from('plan_polls')
      .select('created_by')
      .eq('id', pollId)
      .eq('plan_id', id)
      .single();

    if (pollError || !existingPoll) {
      return res.status(404).json({ error: 'Poll not found' });
    }

    // For collaborative planning, allow all "going" participants to delete polls
    // (we already checked above that the user is going and a participant)

    // Delete poll options first (due to foreign key constraint)
    const { error: deleteOptionsError } = await supabase
      .from('plan_poll_options')
      .delete()
      .eq('poll_id', pollId);

    if (deleteOptionsError) {
      console.error('Error deleting poll options:', deleteOptionsError);
      return res.status(500).json({ error: 'Failed to delete poll options' });
    }

    // Delete poll votes
    const { error: deleteVotesError } = await supabase
      .from('plan_poll_votes')
      .delete()
      .eq('poll_id', pollId);

    if (deleteVotesError) {
      console.error('Error deleting poll votes:', deleteVotesError);
      return res.status(500).json({ error: 'Failed to delete poll votes' });
    }

    // Delete poll
    const { error: deletePollError } = await supabase
      .from('plan_polls')
      .delete()
      .eq('id', pollId)
      .eq('plan_id', id);

    if (deletePollError) {
      console.error('Error deleting poll:', deletePollError);
      return res.status(500).json({ error: 'Failed to delete poll' });
    }

    // Notify poll deletion
    await notifyPlanUpdate(id, 'poll_deleted', userId, { poll_id: pollId });

    const fullPlan = await getPlanWithDetails(id, userId);
    res.json(fullPlan);
  } catch (error) {
    console.error('Error in DELETE /plans/:id/polls/:pollId:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /plans/:id/polls - Get all polls for a plan
router.get('/:id/polls', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Check if user has access to this plan
    const { data: participant, error: participantError } = await supabase
      .from('plan_participants')
      .select('status')
      .eq('plan_id', id)
      .eq('user_id', userId)
      .single();

    if (participantError || !participant) {
      return res.status(403).json({ error: 'Access denied to plan' });
    }

    const fullPlan = await getPlanWithDetails(id, userId);
    res.json(fullPlan.polls || []);
  } catch (error) {
    console.error('Error in GET /plans/:id/polls:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /plans/:id/polls/:pollId/results - Get poll results
router.get('/:id/polls/:pollId/results', requireAuth, async (req, res) => {
  try {
    const { id, pollId } = req.params;
    const userId = req.user.id;

    // Check if user has access to this plan
    const { data: participant, error: participantError } = await supabase
      .from('plan_participants')
      .select('status')
      .eq('plan_id', id)
      .eq('user_id', userId)
      .single();

    if (participantError || !participant) {
      return res.status(403).json({ error: 'Access denied to plan' });
    }

    // Get poll with options and votes
    const { data: poll, error: pollError } = await supabase
      .from('plan_polls')
      .select('*')
      .eq('id', pollId)
      .eq('plan_id', id)
      .single();

    if (pollError || !poll) {
      return res.status(404).json({ error: 'Poll not found' });
    }

    // Get poll options
    const { data: options, error: optionsError } = await supabase
      .from('plan_poll_options')
      .select('*')
      .eq('poll_id', pollId)
      .order('option_order');

    if (optionsError) {
      return res.status(500).json({ error: 'Failed to fetch poll options' });
    }

    // Get poll votes
    const { data: votes, error: votesError } = await supabase
      .from('plan_poll_votes')
      .select('*')
      .eq('poll_id', pollId);

    if (votesError) {
      return res.status(500).json({ error: 'Failed to fetch poll votes' });
    }

    // Transform data to match frontend format
    const transformedPoll = {
      id: poll.id,
      question: poll.title,
      type: poll.poll_type,
      expiresAt: poll.ends_at,
      createdBy: { id: poll.created_by, name: '', username: '', avatar_url: '' },
      options: options.map(option => ({
        id: option.id,
        text: option.option_text,
        votes: votes.filter(v => v.option_id === option.id).map(v => v.user_id),
        voters: [] // We'll populate this if needed
      }))
    };

    res.json(transformedPoll);
  } catch (error) {
    console.error('Error in GET /plans/:id/polls/:pollId/results:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /plans/:id/complete-vote - Vote for plan completion
// Deprecated: manual completion voting removed in favor of 24h auto-complete
router.post('/:id/complete-vote', requireAuth, async (req, res) => {
  return res.status(410).json({ error: 'Completion voting is deprecated. Plans auto-complete after 24h.' });
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

// ===== INVITATION POLLS ENDPOINTS =====

// POST /plans/:id/invitation-polls - Create invitation polls for multiple users
router.post('/:id/invitation-polls', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { invitedUserIds } = req.body; // Array of user IDs to invite
    const userId = req.user.id;

    // Validate input
    if (!Array.isArray(invitedUserIds) || invitedUserIds.length === 0) {
      return res.status(400).json({ error: 'invitedUserIds must be a non-empty array' });
    }

    if (invitedUserIds.length > 10) {
      return res.status(400).json({ error: 'Cannot create more than 10 invitation polls at once' });
    }

    // Check if user can create invitation polls (must be "going" participant)
    const { data: participant, error: participantError } = await supabase
      .from('plan_participants')
      .select('status')
      .eq('plan_id', id)
      .eq('user_id', userId)
      .single();

    if (participantError || !participant || participant.status !== 'going') {
      return res.status(403).json({ error: 'Only going participants can create invitation polls' });
    }

    // Check if invited users are not already in the plan
    const { data: existingParticipants, error: existingError } = await supabase
      .from('plan_participants')
      .select('user_id')
      .eq('plan_id', id)
      .in('user_id', invitedUserIds);

    if (existingError) {
      console.error('Error checking existing participants:', existingError);
      return res.status(500).json({ error: 'Failed to validate participants' });
    }

    const existingUserIds = existingParticipants?.map(p => p.user_id) || [];
    const validUserIds = invitedUserIds.filter(id => !existingUserIds.includes(id));

    if (validUserIds.length === 0) {
      return res.status(400).json({ error: 'All selected users are already in the plan' });
    }

    // Check for existing active invitation polls for these users
    const { data: existingPolls, error: pollsError } = await supabase
      .from('invitation_polls')
      .select('invited_user_id')
      .eq('plan_id', id)
      .eq('status', 'active')
      .in('invited_user_id', validUserIds);

    if (pollsError) {
      console.error('Error checking existing polls:', pollsError);
      return res.status(500).json({ error: 'Failed to check existing polls' });
    }

    const existingPollUserIds = existingPolls?.map(p => p.invited_user_id) || [];
    const finalUserIds = validUserIds.filter(id => !existingPollUserIds.includes(id));

    if (finalUserIds.length === 0) {
      return res.status(400).json({ error: 'All selected users already have active invitation polls' });
    }

    // Create invitation polls for each user
    const pollsToCreate = finalUserIds.map(invitedUserId => ({
      plan_id: id,
      invited_user_id: invitedUserId,
      created_by: userId,
      expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(), // 10 minutes from now
      status: 'active'
    }));

    const { data: createdPolls, error: createError } = await supabase
      .from('invitation_polls')
      .insert(pollsToCreate)
      .select();

    if (createError) {
      console.error('Error creating invitation polls:', createError);
      return res.status(500).json({ error: 'Failed to create invitation polls' });
    }

    // Notify about new invitation polls
    for (const poll of createdPolls) {
      await notifyPlanUpdate(id, 'invitation_poll_created', userId, {
        poll_id: poll.id,
        invited_user_id: poll.invited_user_id
      });
    }

    console.log(`✅ Created ${createdPolls.length} invitation polls for plan ${id}`);

    // Return updated plan with new polls
    const fullPlan = await getPlanWithDetails(id, userId);
    res.status(201).json(fullPlan);

  } catch (error) {
    console.error('Error in POST /plans/:id/invitation-polls:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /plans/:id/invitation-polls - Get invitation polls for a plan
router.get('/:id/invitation-polls', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Check if user has access to this plan
    const { data: participant, error: participantError } = await supabase
      .from('plan_participants')
      .select('status')
      .eq('plan_id', id)
      .eq('user_id', userId)
      .single();

    if (participantError || !participant) {
      return res.status(403).json({ error: 'Access denied to plan' });
    }

    // Get invitation polls using the secure function
    const { data: polls, error: pollsError } = await supabase
      .rpc('get_invitation_polls_for_plan', { plan_id_param: id });

    if (pollsError) {
      console.error('Error fetching invitation polls:', pollsError);
      return res.status(500).json({ error: 'Failed to fetch invitation polls' });
    }

    // Transform data to match frontend format
    const transformedPolls = polls.map(poll => ({
      id: poll.id,
      invitedUser: {
        id: poll.invited_user_id,
        name: poll.invited_user_name,
        avatar: poll.invited_user_avatar
      },
      createdBy: {
        id: poll.created_by,
        name: poll.creator_name,
        avatar: poll.creator_avatar
      },
      timeLeft: Math.max(0, Math.floor((new Date(poll.expires_at).getTime() - Date.now()) / 1000)),
      isExpired: new Date(poll.expires_at) <= new Date(),
      expiresAt: poll.expires_at,
      allowVotes: poll.allow_votes,
      denyVotes: poll.deny_votes,
      currentUserVote: poll.current_user_vote,
      canVote: participant.status === 'going'
    }));

    res.json(transformedPolls);

  } catch (error) {
    console.error('Error in GET /plans/:id/invitation-polls:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /plans/:id/invitation-polls/:pollId/vote - Vote on invitation poll
router.post('/:id/invitation-polls/:pollId/vote', requireAuth, async (req, res) => {
  try {
    const { id, pollId } = req.params;
    const { vote } = req.body; // 'allow' or 'deny'
    const userId = req.user.id;

    // Validate vote
    if (!['allow', 'deny'].includes(vote)) {
      return res.status(400).json({ error: 'Vote must be either "allow" or "deny"' });
    }

    // Check if user can vote (must be "going" participant)
    const { data: participant, error: participantError } = await supabase
      .from('plan_participants')
      .select('status')
      .eq('plan_id', id)
      .eq('user_id', userId)
      .single();

    if (participantError || !participant || participant.status !== 'going') {
      return res.status(403).json({ error: 'Only going participants can vote on invitation polls' });
    }

    // Check if poll exists and is active
    const { data: poll, error: pollError } = await supabase
      .from('invitation_polls')
      .select('*')
      .eq('id', pollId)
      .eq('plan_id', id)
      .eq('status', 'active')
      .single();

    if (pollError || !poll) {
      return res.status(404).json({ error: 'Invitation poll not found or not active' });
    }

    // Check if poll has expired
    if (new Date(poll.expires_at) <= new Date()) {
      return res.status(400).json({ error: 'Invitation poll has expired' });
    }

    // Insert or update vote
    const { error: voteError } = await supabase
      .from('invitation_poll_votes')
      .upsert({
        poll_id: pollId,
        user_id: userId,
        vote: vote
      }, {
        onConflict: 'poll_id,user_id'
      });

    if (voteError) {
      console.error('Error voting on invitation poll:', voteError);
      return res.status(500).json({ error: 'Failed to submit vote' });
    }

    // Notify about the vote
    await notifyPlanUpdate(id, 'invitation_poll_voted', userId, {
      poll_id: pollId,
      vote: vote
    });

    console.log(`✅ Vote submitted: ${vote} on poll ${pollId} by user ${userId}`);

    // Return updated plan
    const fullPlan = await getPlanWithDetails(id, userId);
    res.json(fullPlan);

  } catch (error) {
    console.error('Error in POST /plans/:id/invitation-polls/:pollId/vote:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /plans/:id/invitation-polls/:pollId - Get specific invitation poll details
router.get('/:id/invitation-polls/:pollId', requireAuth, async (req, res) => {
  try {
    const { id, pollId } = req.params;
    const userId = req.user.id;

    // Check if user has access to this plan
    const { data: participant, error: participantError } = await supabase
      .from('plan_participants')
      .select('status')
      .eq('plan_id', id)
      .eq('user_id', userId)
      .single();

    if (participantError || !participant) {
      return res.status(403).json({ error: 'Access denied to plan' });
    }

    // Get poll details
    const { data: poll, error: pollError } = await supabase
      .from('invitation_poll_details')
      .select('*')
      .eq('id', pollId)
      .eq('plan_id', id)
      .single();

    if (pollError || !poll) {
      return res.status(404).json({ error: 'Invitation poll not found' });
    }

    // Get all votes for this poll
    const { data: votes, error: votesError } = await supabase
      .from('invitation_poll_votes')
      .select(`
        id,
        vote,
        created_at,
        user_id,
        users!inner(name, username, avatar_url)
      `)
      .eq('poll_id', pollId);

    if (votesError) {
      console.error('Error fetching poll votes:', votesError);
      return res.status(500).json({ error: 'Failed to fetch poll votes' });
    }

    // Transform votes
    const transformedVotes = votes.map(vote => ({
      id: vote.id,
      vote: vote.vote,
      createdAt: vote.created_at,
      user: {
        id: vote.user_id,
        name: vote.users.name,
        username: vote.users.username,
        avatar: vote.users.avatar_url
      }
    }));

    // Return poll details
    const pollDetails = {
      id: poll.id,
      invitedUser: {
        id: poll.invited_user_id,
        name: poll.invited_user_name,
        avatar: poll.invited_user_avatar
      },
      createdBy: {
        id: poll.created_by,
        name: poll.creator_name,
        avatar: poll.creator_avatar
      },
      planTitle: poll.plan_title,
      createdAt: poll.created_at,
      expiresAt: poll.expires_at,
      status: poll.status,
      timeLeft: Math.max(0, Math.floor((new Date(poll.expires_at).getTime() - Date.now()) / 1000)),
      isExpired: new Date(poll.expires_at) <= new Date(),
      allowVotes: poll.allow_votes,
      denyVotes: poll.deny_votes,
      totalVotes: poll.total_votes,
      currentUserVote: poll.current_user_vote,
      canVote: participant.status === 'going',
      votes: transformedVotes
    };

    res.json(pollDetails);

  } catch (error) {
    console.error('Error in GET /plans/:id/invitation-polls/:pollId:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Export the router as default, but also expose internal helpers for scheduler
router.processConditionalDependencies = processConditionalDependencies;
module.exports = router;