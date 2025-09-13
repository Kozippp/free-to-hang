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
  // DEBUG: Log currentUserId and participant info
  console.log('🔄 transformParticipantStatus called:', {
    participantId: participant.user_id,
    participantStatus: participant.status,
    currentUserId: currentUserId,
    isCurrentUser: currentUserId && currentUserId === participant.user_id,
    conditionalFriends: participant.conditionalFriends
  });

  // CRITICAL DEBUG: Check if currentUserId is null/undefined
  if (!currentUserId) {
    console.log('❌ CRITICAL: currentUserId is null/undefined! This is why conditional logic fails!');
  }

  // Apply conditional status transformation
  let actualStatus = participant.status;
  let conditionalFriends = participant.conditionalFriends; // Keep original conditionalFriends!

  if (participant.status === 'conditional') {
    if (currentUserId && currentUserId === participant.user_id) {
      console.log('🎯 Current user viewing their own conditional status');
      // Current user sees their own conditional status
      actualStatus = 'conditional';
      conditionalFriends = participant.conditionalFriends || [];
    } else {
      console.log('👥 Other user viewing conditional status - hiding details');
      // Other users see conditional as "maybe"
      actualStatus = 'maybe';
      conditionalFriends = undefined; // Hide conditionalFriends from other users
    }
  }

  const result = {
    ...participant,
    status: actualStatus,
    conditionalFriends: conditionalFriends
  };

  console.log('🔄 transformParticipantStatus result:', {
    originalStatus: participant.status,
    finalStatus: result.status,
    finalConditionalFriends: result.conditionalFriends
  });

  return result;
};

// Helper function to get plan with full details
const getPlanWithDetails = async (planId, userId = null) => {
  try {
    console.log('🔍 getPlanWithDetails called with planId:', planId, 'userId:', userId);

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
    console.log('🔍 Fetching conditional dependencies for planId:', planId);
    const { data: depsRows, error: depsError } = await supabase
      .from('plan_conditional_dependencies')
      .select('user_id, friend_id')
      .eq('plan_id', planId);

    console.log('🔍 depsRows:', depsRows, 'depsError:', depsError);

    if (depsError) throw depsError;
    const depsMap = new Map();
    depsRows?.forEach(r => {
      if (!depsMap.has(r.user_id)) depsMap.set(r.user_id, []);
      depsMap.get(r.user_id).push(r.friend_id);
    });

    console.log('🔍 depsMap after building:', Array.from(depsMap.entries()));

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

      console.log('🔄 Transforming participant:', {
        user_id: p.user_id,
        user_name: user?.name,
        status: p.status,
        conditionalFriendsList: conditionalFriendsList,
        depsMapKeys: Array.from(depsMap.keys()),
        depsMapHasUser: depsMap.has(p.user_id)
      });

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

    console.log('📤 API Response participants:', response.participants.map(p => ({
      id: p.id,
      name: p.name,
      status: p.status,
      conditionalFriends: p.conditionalFriends
    })));

    return response;
  } catch (error) {
    console.error('Error getting plan details:', error);
    throw error;
  }
};

const processConditionalDependencies = async (planId) => {
  try {
    console.log('🔄 Processing conditional dependencies for plan:', planId);
    
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

    // Process conditional participants
    let hasChanges = false;
    const maxIterations = 10; // Prevent infinite loops
    
    for (let iteration = 0; iteration < maxIterations; iteration++) {
      let iterationChanges = false;
      
      for (const participant of participants) {
        // Skip if not conditional or no dependencies
        if (participant.status !== 'conditional' || !conditionalMap.has(participant.user_id)) {
          continue;
        }
        
        const conditionalFriends = conditionalMap.get(participant.user_id);
        if (!conditionalFriends || conditionalFriends.length === 0) {
          continue;
        }
        
        // Check if all conditional friends are accepted
        const allFriendsAccepted = conditionalFriends.every(friendId => {
          const friend = participants.find(p => p.user_id === friendId);
          return friend && friend.status === 'going';
        });
        
        if (allFriendsAccepted) {
          console.log('✅ Converting conditional participant to going:', participant.user_id);
          
          // Update participant to going
          const { error: updateError } = await supabase
            .from('plan_participants')
            .update({
              status: 'going'
              // updated_at is handled by database trigger
            })
            .eq('plan_id', planId)
            .eq('user_id', participant.user_id);
          
          if (!updateError) {
            // Remove conditional dependencies for this user
            await supabase
              .from('plan_conditional_dependencies')
              .delete()
              .eq('plan_id', planId)
              .eq('user_id', participant.user_id);
            
            // Update local data
            participant.status = 'going';
            conditionalMap.delete(participant.user_id);
            iterationChanges = true;
            hasChanges = true;
            
            // Notify about status change
            await notifyPlanUpdate(planId, 'participant_accepted_conditionally', participant.user_id);
          }
        }
      }
      
      // If no changes this iteration, we're done
      if (!iterationChanges) {
        break;
      }
    }
    
    if (hasChanges) {
      console.log('✅ Conditional dependencies processed with changes');
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
      console.log('🔄 SETTING CONDITIONAL STATUS for user:', userId, 'with friends:', conditionalFriends, 'friends length:', conditionalFriends?.length || 0);

      // ALWAYS clear existing deps for this user first
      console.log('🗑️ Clearing existing conditional dependencies for user:', userId);
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

      console.log('📝 Inserting rows:', rows.length, 'conditional dependency rows');
      const { error: insertError } = await supabase.from('plan_conditional_dependencies').insert(rows);
      if (insertError) {
        console.error('❌ Error saving conditional dependencies:', insertError);
      } else {
        console.log('✅ Conditional dependencies saved successfully:', rows.length, 'rows inserted');
      }
    } else {
      console.log('🔄 REMOVING CONDITIONAL STATUS for user:', userId, 'setting status to:', status);
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
    const { data: participant, error: participantError } = await supabase
      .from('plan_participants')
      .select('status')
      .eq('plan_id', id)
      .eq('user_id', userId)
      .single();

    if (participantError || !participant || participant.status !== 'going') {
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

// Export the router as default, but also expose internal helpers for scheduler
router.processConditionalDependencies = processConditionalDependencies;
module.exports = router;