import { Mixpanel } from 'mixpanel-react-native';

const MIXPANEL_TOKEN = 'e6ac90af23abe0bf0fa300fe9a4cc796';

const mixpanel = new Mixpanel(MIXPANEL_TOKEN, !__DEV__);

export function initAnalytics() {
  mixpanel.init();
}

// ─── Identity ────────────────────────────────────────────────────────────────

export function identifyUser(userId: string, props: {
  name?: string;
  email?: string;
  username?: string;
  createdAt?: string;
}) {
  mixpanel.identify(userId);
  mixpanel.getPeople().set({
    '$name': props.name,
    '$email': props.email,
    'username': props.username,
    '$created': props.createdAt,
  });
}

export function resetAnalytics() {
  mixpanel.reset();
}

// ─── Auth Events ─────────────────────────────────────────────────────────────

export function trackSignUp(props: {
  userId: string;
  email: string;
  method: 'email' | 'apple' | 'google';
}) {
  mixpanel.track('Sign Up', {
    user_id: props.userId,
    email: props.email,
    signup_method: props.method,
  });
}

export function trackSignIn(props: {
  userId: string;
  method: 'email' | 'apple' | 'google';
  success: boolean;
}) {
  mixpanel.track('Sign In', {
    user_id: props.userId,
    login_method: props.method,
    success: props.success,
  });
}

export function trackSignOut() {
  mixpanel.track('Sign Out');
}

export function trackOnboardingCompleted(props: {
  userId: string;
  method: 'email' | 'apple' | 'google';
}) {
  mixpanel.track('Onboarding Completed', {
    user_id: props.userId,
    signup_method: props.method,
  });
}

// ─── Hang Status Events ───────────────────────────────────────────────────────

export function trackHangStatusChanged(props: {
  status: 'available' | 'offline';
  durationMinutes?: number;
  hasActivity: boolean;
}) {
  mixpanel.track('Hang Status Changed', {
    status: props.status,
    duration_minutes: props.durationMinutes ?? null,
    has_activity: props.hasActivity,
  });
}

// ─── Plan Events ─────────────────────────────────────────────────────────────

export function trackPlanCreated(props: {
  planId: string;
  isAnonymous: boolean;
  invitedCount: number;
  hasDate: boolean;
  hasLocation: boolean;
}) {
  mixpanel.track('Plan Created', {
    plan_id: props.planId,
    is_anonymous: props.isAnonymous,
    invited_count: props.invitedCount,
    has_date: props.hasDate,
    has_location: props.hasLocation,
  });
}

export function trackPlanRSVP(props: {
  planId: string;
  response: 'going' | 'maybe' | 'declined' | 'conditional';
}) {
  mixpanel.track('Plan RSVP', {
    plan_id: props.planId,
    response: props.response,
  });
}

export function trackPlanCompleted(planId: string) {
  mixpanel.track('Plan Completed', { plan_id: planId });
}

export function trackPollCreated(props: {
  planId: string;
  pollType: 'when' | 'where' | 'custom' | 'invitation';
  optionsCount: number;
}) {
  mixpanel.track('Poll Created', {
    plan_id: props.planId,
    poll_type: props.pollType,
    options_count: props.optionsCount,
  });
}

export function trackPollVoted(props: {
  planId: string;
  pollType: 'when' | 'where' | 'custom' | 'invitation';
}) {
  mixpanel.track('Poll Voted', {
    plan_id: props.planId,
    poll_type: props.pollType,
  });
}

// ─── Social Events ────────────────────────────────────────────────────────────

export function trackFriendRequestSent() {
  mixpanel.track('Friend Request Sent');
}

export function trackFriendRequestAccepted() {
  mixpanel.track('Friend Request Accepted');
}

export function trackInviteLinkShared(method?: string) {
  mixpanel.track('Invite Link Shared', {
    share_method: method ?? 'unknown',
  });
}

// ─── Chat Events ─────────────────────────────────────────────────────────────

export function trackMessageSent(props: {
  planId: string;
  hasImage: boolean;
}) {
  mixpanel.track('Message Sent', {
    plan_id: props.planId,
    has_image: props.hasImage,
  });
}

// ─── Notification Events ─────────────────────────────────────────────────────

export function trackNotificationReceived(props: {
  type: string;
  appState: 'foreground' | 'background' | 'killed';
}) {
  const now = new Date();
  mixpanel.track('Notification Received', {
    notification_type: props.type,
    app_state: props.appState,
    notification_hour: now.getHours(),
    notification_day_of_week: now.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase(),
  });
}

export function trackNotificationOpened(props: {
  type: string;
  appState: 'background' | 'killed';
  timeToOpenSeconds?: number;
}) {
  const now = new Date();
  mixpanel.track('Notification Opened', {
    notification_type: props.type,
    app_state: props.appState,
    notification_hour: now.getHours(),
    notification_day_of_week: now.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase(),
    time_to_open_seconds: props.timeToOpenSeconds ?? null,
  });
}

// ─── Screen Events ────────────────────────────────────────────────────────────

export function trackScreenViewed(screenName: string) {
  mixpanel.track('Screen Viewed', { screen_name: screenName });
}
