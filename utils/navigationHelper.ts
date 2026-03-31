import { Router } from 'expo-router';

export const handleNotificationNavigation = (notification: any, router: Router) => {
  const { type, data } = notification;
  if (!data) return;

  console.log('🔔 Handling notification navigation:', { type, data });

  // Normalize plan ID (handle both snake_case from DB and camelCase from push payload)
  const planId = data.plan_id || data.planId;

  // Plaanidega seotud teavitused
  if (
    [
      'plan_invite',
      'plan_update',
      'plan_participant_joined',
      'poll_created',
      'poll_ended',
      'poll_winner'
    ].includes(type)
  ) {
    if (planId) {
      // Kontrollime, kas plaan on lõpetatud (seda infot meil alati pole, 
      // aga eeldame vaikimisi aktiivset, PlansScreen tegeleb edasi)
      // Kui tegu on poll_winner vms, mis võib olla ka completed, 
      // siis PlansScreen otsib selle ise completed listist vajadusel.
      
      router.push({
        pathname: '/plans',
        params: { 
          highlightPlan: planId, 
          tab: 'active', // Vaikimisi aktiivne feed
          modalTab: 'Control Panel' // Vaikimisi detailvaade
        }
      });
    } else {
      router.push('/plans');
    }
    return;
  }

  // Chat teavitused - ava otse chat
  if (type === 'chat_message' && planId) {
    router.push({
      pathname: '/plans',
      params: { 
        highlightPlan: planId, 
        tab: 'active',
        modalTab: 'Chat' // Ava otse chat
      }
    });
    return;
  }

  // Sõbrakutsed - ava profiil ja requests tab
  if (type === 'friend_request' || type === 'friend_accepted') {
    router.push({
      pathname: '/profile',
      params: { tab: 'requests' }
    });
    return;
  }

  // Üldised suunamised
  if (type === 'status_change' || type === 'engagement_friends_online') {
    router.push('/');
    return;
  }

  if (type === 'engagement_comeback') {
    router.push('/plans');
    return;
  }
};
