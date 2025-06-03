import { Plan } from '@/store/plansStore';

// Mock invitations (plans you've been invited to)
export const mockInvitations: Plan[] = [
  {
    id: '1',
    title: 'Movie Night',
    description: 'Let\'s watch the new Marvel movie at the theater.',
    type: 'normal' as const,
    creator: {
      id: 'user1',
      name: 'Alex Johnson',
      avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?ixlib=rb-1.2.1&ixid=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=crop&w=634&q=80'
    },
    participants: [
      {
        id: 'current',
        name: 'You',
        avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?ixlib=rb-1.2.1&ixid=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=crop&w=1350&q=80',
        status: 'pending'
      },
      {
        id: 'user1',
        name: 'Alex Johnson',
        avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?ixlib=rb-1.2.1&ixid=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=crop&w=634&q=80',
        status: 'accepted'
      },
      {
        id: 'user2',
        name: 'Sam Wilson',
        avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?ixlib=rb-1.2.1&ixid=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=crop&w=634&q=80',
        status: 'maybe'
      },
      {
        id: 'user3',
        name: 'Taylor Swift',
        avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?ixlib=rb-1.2.1&ixid=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=crop&w=634&q=80',
        status: 'pending'
      }
    ],
    date: 'Today, 7:00 PM',
    location: 'AMC Theater',
    isRead: false,
    createdAt: '2023-05-21T14:30:00Z',
    lastUpdatedAt: '2023-05-21T14:30:00Z',
    hasUnreadUpdates: false,
    completionVotes: []
  },
  {
    id: '2',
    title: 'Coffee Catch-up',
    description: 'Let\'s grab coffee and catch up!',
    type: 'anonymous' as const,
    creator: null,
    participants: [
      {
        id: 'current',
        name: 'You',
        avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?ixlib=rb-1.2.1&ixid=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=crop&w=1350&q=80',
        status: 'pending'
      },
      {
        id: 'user4',
        name: 'Jamie Lee',
        avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?ixlib=rb-1.2.1&ixid=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=crop&w=1350&q=80',
        status: 'accepted'
      },
      {
        id: 'user5',
        name: 'Chris Evans',
        avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?ixlib=rb-1.2.1&ixid=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=crop&w=634&q=80',
        status: 'pending'
      }
    ],
    date: 'Today, 3:00 PM',
    location: 'Starbucks Downtown',
    isRead: true,
    createdAt: '2023-05-21T10:15:00Z',
    lastUpdatedAt: '2023-05-21T10:15:00Z',
    hasUnreadUpdates: false,
    completionVotes: []
  },
  {
    id: '4',
    title: 'Beach Day',
    description: 'Let\'s go to the beach and enjoy the sun!',
    type: 'normal' as const,
    creator: {
      id: 'user6',
      name: 'Emma Watson',
      avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?ixlib=rb-1.2.1&ixid=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=crop&w=634&q=80'
    },
    participants: [
      {
        id: 'current',
        name: 'You',
        avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?ixlib=rb-1.2.1&ixid=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=crop&w=1350&q=80',
        status: 'pending'
      },
      {
        id: 'user6',
        name: 'Emma Watson',
        avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?ixlib=rb-1.2.1&ixid=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=crop&w=634&q=80',
        status: 'accepted'
      },
      {
        id: 'user7',
        name: 'Tom Holland',
        avatar: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?ixlib=rb-1.2.1&ixid=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=crop&w=634&q=80',
        status: 'maybe'
      },
      {
        id: 'user8',
        name: 'Zendaya',
        avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?ixlib=rb-1.2.1&ixid=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=crop&w=700&q=80',
        status: 'accepted'
      }
    ],
    date: 'Today, 12:00 PM',
    location: 'Venice Beach',
    isRead: false,
    createdAt: '2023-05-21T08:45:00Z',
    lastUpdatedAt: '2023-05-21T15:30:00Z',
    updateType: 'new_message',
    hasUnreadUpdates: true,
    completionVotes: []
  }
];

// Mock active plans (plans you've accepted)
export const mockActivePlans: Plan[] = [
  {
    id: 'plan-test-completion',
    title: '✅ Test Plan (Others Voted!)',
    description: 'This plan has completion votes for testing the voting system.',
    type: 'normal' as const,
    creator: {
      id: 'user70',
      name: 'Test Creator',
      avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face'
    },
    participants: [
      {
        id: 'current',
        name: 'You',
        avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&h=150&fit=crop&crop=face',
        status: 'accepted'
      },
      {
        id: 'user70',
        name: 'Test Creator',
        avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face',
        status: 'accepted'
      },
      {
        id: 'user71',
        name: 'Test Friend 1',
        avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&h=150&fit=crop&crop=face',
        status: 'accepted'
      },
      {
        id: 'user72',
        name: 'Test Friend 2',
        avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=face',
        status: 'accepted'
      }
    ],
    date: 'Today, 5:00 PM',
    location: 'Test Location',
    isRead: false,
    createdAt: new Date(Date.now() - 10 * 60 * 60 * 1000).toISOString(), // 10 hours ago - can be completed
    lastUpdatedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
    updateType: 'poll_voted',
    hasUnreadUpdates: true,
    completionVotes: ['user70'], // Only 1 person has voted - user can test both buttons (need 2 total)
    polls: [
      {
        id: 'test-when-poll',
        question: 'What time worked best?',
        type: 'when',
        options: [
          {
            id: 'test-time-5pm',
            text: '5:00 PM',
            votes: ['current', 'user70', 'user71']
          },
          {
            id: 'test-time-6pm',
            text: '6:00 PM',
            votes: ['user72']
          }
        ]
      }
    ]
  },
  {
    id: '3',
    title: 'sõnumid',
    description: 'Testimiseks chat sõnumite vaatamiseks ja reageerimiseks.',
    type: 'normal' as const,
    creator: {
      id: 'user1',
      name: 'Alex Johnson',
      avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face'
    },
    participants: [
      {
        id: 'current',
        name: 'You',
        avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&h=150&fit=crop&crop=face',
        status: 'accepted'
      },
      {
        id: 'user1',
        name: 'Alex Johnson',
        avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face',
        status: 'accepted'
      },
      {
        id: 'user2',
        name: 'Emma Wilson',
        avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&h=150&fit=crop&crop=face',
        status: 'accepted'
      },
      {
        id: 'user3',
        name: 'Michael Chen',
        avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=face',
        status: 'accepted'
      }
    ],
    date: 'Today, 7:00 PM',
    location: 'Test Location',
    isRead: false,
    createdAt: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(), // 4 hours ago - can be completed
    completionVotes: []
  },
  {
    id: '5',
    title: 'Dinner at Italian Restaurant',
    description: 'Let\'s try the new Italian place downtown.',
    type: 'normal' as const,
    creator: {
      id: 'current',
      name: 'You',
      avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?ixlib=rb-1.2.1&ixid=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=crop&w=1350&q=80'
    },
    participants: [
      {
        id: 'current',
        name: 'You',
        avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?ixlib=rb-1.2.1&ixid=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=crop&w=1350&q=80',
        status: 'accepted'
      },
      {
        id: 'user9',
        name: 'Robert Downey Jr.',
        avatar: 'https://images.unsplash.com/photo-1566492031773-4f4e44671857?ixlib=rb-1.2.1&ixid=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=crop&w=634&q=80',
        status: 'accepted'
      },
      {
        id: 'user10',
        name: 'Scarlett Johansson',
        avatar: 'https://images.unsplash.com/photo-1557296387-5358ad7997bb?ixlib=rb-1.2.1&ixid=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=crop&w=694&q=80',
        status: 'maybe'
      }
    ],
    date: 'Today, 8:00 PM',
    location: 'Bella Italia',
    isRead: true,
    createdAt: '2023-05-20T19:30:00Z',
    completionVotes: [],
    polls: [
      {
        id: 'poll1',
        question: 'What time works best?',
        type: 'when',
        options: [
          {
            id: 'option1',
            text: '7:00 PM',
            votes: ['user9']
          },
          {
            id: 'option2',
            text: '8:00 PM',
            votes: ['current', 'user10']
          },
          {
            id: 'option3',
            text: '9:00 PM',
            votes: ['current']
          }
        ]
      },
      {
        id: 'poll2',
        question: 'Where should we meet?',
        type: 'where',
        options: [
          {
            id: 'option4',
            text: 'Bella Italia Downtown',
            votes: ['current', 'user9', 'user10']
          },
          {
            id: 'option5',
            text: 'Luigi\'s Pizzeria',
            votes: ['user9']
          },
          {
            id: 'option6',
            text: 'Tony\'s Trattoria',
            votes: ['current']
          }
        ]
      },
      {
        id: 'poll3',
        question: 'What should we order for dessert?',
        type: 'custom',
        options: [
          {
            id: 'option7',
            text: 'Tiramisu',
            votes: ['current', 'user9']
          },
          {
            id: 'option8',
            text: 'Gelato',
            votes: ['user10', 'current']
          },
          {
            id: 'option9',
            text: 'Cannoli',
            votes: ['user9']
          },
          {
            id: 'option10',
            text: 'Skip dessert',
            votes: []
          }
        ]
      }
    ]
  },
  {
    id: '8',
    title: 'Game Night',
    description: 'Board games and snacks at my place.',
    type: 'normal' as const,
    creator: {
      id: 'user11',
      name: 'Chris Hemsworth',
      avatar: 'https://images.unsplash.com/photo-1542624937-8d1e9f53c1b9?ixlib=rb-1.2.1&ixid=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=crop&w=634&q=80'
    },
    participants: [
      {
        id: 'current',
        name: 'You',
        avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?ixlib=rb-1.2.1&ixid=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=crop&w=1350&q=80',
        status: 'accepted'
      },
      {
        id: 'user11',
        name: 'Chris Hemsworth',
        avatar: 'https://images.unsplash.com/photo-1542624937-8d1e9f53c1b9?ixlib=rb-1.2.1&ixid=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=crop&w=634&q=80',
        status: 'accepted'
      },
      {
        id: 'user12',
        name: 'Mark Ruffalo',
        avatar: 'https://images.unsplash.com/photo-1552058544-f2b08422138a?ixlib=rb-1.2.1&ixid=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=crop&w=644&q=80',
        status: 'accepted'
      },
      {
        id: 'user13',
        name: 'Jeremy Renner',
        avatar: 'https://images.unsplash.com/photo-1541647376583-8934aaf3448a?ixlib=rb-1.2.1&ixid=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=crop&w=634&q=80',
        status: 'maybe'
      }
    ],
    date: 'Today, 6:00 PM',
    location: 'Chris\'s Apartment',
    isRead: true,
    createdAt: '2023-05-20T15:00:00Z',
    completionVotes: []
  },
  {
    id: 'plan-weekend-hike',
    title: '🔥 Mountain Hike (2 votes to complete!)',
    description: 'Early morning hike to catch the sunrise from the peak!',
    type: 'normal' as const,
    creator: {
      id: 'user20',
      name: 'Sarah Adventure',
      avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&h=150&fit=crop&crop=face'
    },
    participants: [
      {
        id: 'current',
        name: 'You',
        avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&h=150&fit=crop&crop=face',
        status: 'accepted'
      },
      {
        id: 'user20',
        name: 'Sarah Adventure',
        avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&h=150&fit=crop&crop=face',
        status: 'accepted'
      },
      {
        id: 'user21',
        name: 'Mike Trail',
        avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=face',
        status: 'accepted'
      },
      {
        id: 'user22',
        name: 'Jenny Fit',
        avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&h=150&fit=crop&crop=face',
        status: 'maybe'
      },
      {
        id: 'user23',
        name: 'Alex Outdoors',
        avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face',
        status: 'pending'
      }
    ],
    date: 'Saturday, 6:00 AM',
    location: 'Mountain Trail Head',
    isRead: true,
    createdAt: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(), // 6 hours ago - can be completed
    completionVotes: ['user20'], // Only 1 person has voted - shows two button interface
    polls: [
      {
        id: 'hike-time-poll',
        question: 'What time should we start?',
        type: 'when',
        options: [
          {
            id: 'time-6am',
            text: '6:00 AM (Watch sunrise)',
            votes: ['current', 'user20', 'user21']
          },
          {
            id: 'time-8am',
            text: '8:00 AM (More comfortable)',
            votes: ['user22']
          }
        ]
      }
    ]
  },
  {
    id: 'plan-study-group',
    title: 'Exam Study Session',
    description: 'Final prep for the big exam. Bring notes and snacks!',
    type: 'normal' as const,
    creator: {
      id: 'current',
      name: 'You',
      avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&h=150&fit=crop&crop=face'
    },
    participants: [
      {
        id: 'current',
        name: 'You',
        avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&h=150&fit=crop&crop=face',
        status: 'accepted'
      },
      {
        id: 'user30',
        name: 'Emma Study',
        avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&h=150&fit=crop&crop=face',
        status: 'accepted'
      },
      {
        id: 'user31',
        name: 'David Focus',
        avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=face',
        status: 'accepted'
      },
      {
        id: 'user32',
        name: 'Lisa Smart',
        avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&h=150&fit=crop&crop=face',
        status: 'conditional',
        conditionalFriends: ['user33'] // Will join if user33 joins
      },
      {
        id: 'user33',
        name: 'Tom Learn',
        avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face',
        status: 'maybe'
      }
    ],
    date: 'Tonight, 7:00 PM',
    location: 'University Library',
    isRead: false,
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago - too fresh to complete
    completionVotes: [],
    polls: [
      {
        id: 'study-location-poll',
        question: 'Where should we study?',
        type: 'where',
        options: [
          {
            id: 'library-main',
            text: 'Main Library (Quiet)',
            votes: ['current', 'user30', 'user31']
          },
          {
            id: 'library-group',
            text: 'Group Study Room',
            votes: ['user32']
          },
          {
            id: 'campus-cafe',
            text: 'Campus Café',
            votes: ['user33']
          }
        ]
      },
      {
        id: 'study-snacks-poll',
        question: 'What snacks should we bring?',
        type: 'custom',
        options: [
          {
            id: 'snack-coffee',
            text: 'Coffee & Energy drinks',
            votes: ['current', 'user30']
          },
          {
            id: 'snack-healthy',
            text: 'Nuts & Fruits',
            votes: ['user31', 'user32']
          },
          {
            id: 'snack-sweet',
            text: 'Cookies & Chocolate',
            votes: ['user33', 'current']
          }
        ]
      }
    ]
  },
  {
    id: 'plan-volleyball',
    title: 'Beach Volleyball',
    description: 'Fun volleyball game by the beach. All skill levels welcome!',
    type: 'anonymous' as const,
    creator: null, // Anonymous plan
    participants: [
      {
        id: 'current',
        name: 'You',
        avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&h=150&fit=crop&crop=face',
        status: 'accepted'
      },
      {
        id: 'user40',
        name: 'Beach Lover',
        avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&h=150&fit=crop&crop=face',
        status: 'accepted'
      },
      {
        id: 'user41',
        name: 'Volleyball Pro',
        avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=face',
        status: 'accepted'
      },
      {
        id: 'user42',
        name: 'Sandy Player',
        avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&h=150&fit=crop&crop=face',
        status: 'accepted'
      },
      {
        id: 'user43',
        name: 'Net Jumper',
        avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face',
        status: 'maybe'
      }
    ],
    date: 'Tomorrow, 4:00 PM',
    location: 'Santa Monica Beach',
    isRead: true,
    createdAt: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(), // 5 hours ago - can be completed
    completionVotes: [], // No votes yet - will show completion section
    polls: [
      {
        id: 'invite-poll-beach-1',
        question: 'Should we invite Anna Beach to this plan?',
        type: 'invitation',
        expiresAt: Date.now() + 5 * 60 * 1000, // Expires in 5 minutes
        invitedUsers: ['user44'],
        options: [
          {
            id: 'allow-anna',
            text: 'Allow',
            votes: ['current', 'user40']
          },
          {
            id: 'deny-anna',
            text: 'Deny',
            votes: ['user41']
          }
        ]
      }
    ]
  },
  {
    id: 'plan-game-night-test',
    title: 'Board Game Evening',
    description: 'Let\'s play some board games and have fun!',
    type: 'normal' as const,
    creator: {
      id: 'user60',
      name: 'Game Master',
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=face'
    },
    participants: [
      {
        id: 'current',
        name: 'You',
        avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&h=150&fit=crop&crop=face',
        status: 'accepted'
      },
      {
        id: 'user60',
        name: 'Game Master',
        avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=face',
        status: 'accepted'
      },
      {
        id: 'user61',
        name: 'Strategy Player',
        avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&h=150&fit=crop&crop=face',
        status: 'accepted'
      }
    ],
    date: 'Tonight, 8:00 PM',
    location: 'Community Center',
    isRead: true,
    createdAt: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString(), // 8 hours ago - can be completed
    completionVotes: [], // No votes yet - will show single button
    polls: [
      {
        id: 'game-choice-poll',
        question: 'What games should we play?',
        type: 'custom',
        options: [
          {
            id: 'monopoly',
            text: 'Monopoly',
            votes: ['current', 'user60']
          },
          {
            id: 'scrabble',
            text: 'Scrabble',
            votes: ['user61']
          },
          {
            id: 'chess',
            text: 'Chess',
            votes: ['current']
          }
        ]
      }
    ]
  }
];

// Mock completed plans (past plans)
export const mockCompletedPlans: Plan[] = [
  {
    id: 'completed-recent-1',
    title: 'Coffee & Study Session',
    description: 'Quick coffee break and study session at the library café.',
    type: 'normal' as const,
    creator: {
      id: 'current',
      name: 'You',
      avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face'
    },
    participants: [
      {
        id: 'current',
        name: 'You',
        avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face',
        status: 'accepted'
      },
      {
        id: 'user50',
        name: 'Study Buddy',
        avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&h=150&fit=crop&crop=face',
        status: 'accepted'
      },
      {
        id: 'user51',
        name: 'Library Friend',
        avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=face',
        status: 'accepted'
      }
    ],
    date: 'Yesterday, 2:00 PM',
    location: 'University Library Café',
    isRead: true,
    createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(), // 1 day ago
    completionVotes: ['current', 'user50', 'user51'],
    attendanceRecord: {
      'current': true, // User attended
      'user50': true, // Friend attended
      'user51': true  // Friend attended
    },
    polls: [
      {
        id: 'coffee-time-poll',
        question: 'What time worked best?',
        type: 'when',
        options: [
          {
            id: 'time-2pm',
            text: '2:00 PM',
            votes: ['current', 'user50', 'user51']
          },
          {
            id: 'time-3pm',
            text: '3:00 PM',
            votes: ['user50']
          }
        ]
      },
      {
        id: 'coffee-location-poll',
        question: 'Where you met',
        type: 'where',
        options: [
          {
            id: 'library-cafe',
            text: 'Library Café',
            votes: ['current', 'user50', 'user51']
          },
          {
            id: 'starbucks',
            text: 'Starbucks',
            votes: []
          }
        ]
      }
    ]
  },
  {
    id: 'completed-recent-2',
    title: 'Quick Lunch Meet',
    description: 'Fast lunch break together between classes.',
    type: 'normal' as const,
    creator: {
      id: 'user52',
      name: 'Lunch Buddy',
      avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&h=150&fit=crop&crop=face'
    },
    participants: [
      {
        id: 'current',
        name: 'You',
        avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face',
        status: 'accepted'
      },
      {
        id: 'user52',
        name: 'Lunch Buddy',
        avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&h=150&fit=crop&crop=face',
        status: 'accepted'
      },
      {
        id: 'user53',
        name: 'Food Lover',
        avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=face',
        status: 'maybe'
      }
    ],
    date: 'Today, 12:30 PM',
    location: 'Campus Food Court',
    isRead: true,
    createdAt: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(), // 6 hours ago
    completionVotes: ['current', 'user52'],
    polls: [
      {
        id: 'lunch-location-poll',
        question: 'Where you met',
        type: 'where',
        options: [
          {
            id: 'food-court',
            text: 'Campus Food Court',
            votes: ['current', 'user52']
          },
          {
            id: 'subway',
            text: 'Subway',
            votes: ['user53']
          }
        ]
      }
    ]
  },
  {
    id: 'completed-recent-3',
    title: 'Morning Jog',
    description: 'Early morning run around the park.',
    type: 'normal' as const,
    creator: {
      id: 'user54',
      name: 'Running Partner',
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=face'
    },
    participants: [
      {
        id: 'current',
        name: 'You',
        avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face',
        status: 'accepted'
      },
      {
        id: 'user54',
        name: 'Running Partner',
        avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=face',
        status: 'accepted'
      }
    ],
    date: 'Today, 7:00 AM',
    location: 'Central Park',
    isRead: true,
    createdAt: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(), // 12 hours ago
    completionVotes: ['current', 'user54'],
    polls: [
      {
        id: 'run-time-poll',
        question: 'What time worked best?',
        type: 'when',
        options: [
          {
            id: 'time-7am',
            text: '7:00 AM',
            votes: ['current', 'user54']
          },
          {
            id: 'time-8am',
            text: '8:00 AM',
            votes: []
          }
        ]
      }
    ]
  },
  {
    id: '6',
    title: 'Hiking Trip',
    description: 'Hiking at the national park.',
    type: 'normal' as const,
    creator: {
      id: 'user14',
      name: 'Chris Pratt',
      avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?ixlib=rb-1.2.1&ixid=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=crop&w=634&q=80'
    },
    participants: [
      {
        id: 'current',
        name: 'You',
        avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?ixlib=rb-1.2.1&ixid=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=crop&w=1350&q=80',
        status: 'accepted'
      },
      {
        id: 'user14',
        name: 'Chris Pratt',
        avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?ixlib=rb-1.2.1&ixid=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=crop&w=634&q=80',
        status: 'accepted'
      },
      {
        id: 'user15',
        name: 'Bryce Dallas Howard',
        avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?ixlib=rb-1.2.1&ixid=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=crop&w=634&q=80',
        status: 'accepted'
      }
    ],
    date: 'Last Week, 10:00 AM',
    location: 'Yellowstone National Park',
    isRead: true,
    createdAt: new Date(Date.now() - 9 * 24 * 60 * 60 * 1000).toISOString(), // 9 days ago
    completionVotes: ['current', 'user14', 'user15']
  }
];

// Updated Beach Day plan
export const mockUpdatedBeachDay: Plan = {
  id: '7',
  title: 'Beach Day',
  description: 'Let\'s go to the beach and enjoy the sun!',
  type: 'normal' as const,
  creator: {
    id: 'user6',
    name: 'Emma Watson',
    avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?ixlib=rb-1.2.1&ixid=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=crop&w=634&q=80'
  },
  participants: [
    {
      id: 'current',
      name: 'You',
      avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?ixlib=rb-1.2.1&ixid=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=crop&w=1350&q=80',
      status: 'pending'
    },
    {
      id: 'user6',
      name: 'Emma Watson',
      avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?ixlib=rb-1.2.1&ixid=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=crop&w=634&q=80',
      status: 'accepted'
    },
    {
      id: 'user7',
      name: 'Tom Holland',
      avatar: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?ixlib=rb-1.2.1&ixid=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=crop&w=634&q=80',
      status: 'maybe'
    },
    {
      id: 'user8',
      name: 'Zendaya',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?ixlib=rb-1.2.1&ixid=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=crop&w=700&q=80',
      status: 'accepted'
    }
  ],
  date: 'Today, 12:00 PM',
  location: 'Venice Beach',
  isRead: false,
  createdAt: '2023-05-21T08:45:00Z',
  completionVotes: []
};