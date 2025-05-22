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
    createdAt: '2023-05-21T14:30:00Z'
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
    createdAt: '2023-05-21T10:15:00Z'
  },
  {
    id: '3',
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
    createdAt: '2023-05-21T08:45:00Z'
  }
];

// Mock active plans (plans you've accepted)
export const mockActivePlans: Plan[] = [
  {
    id: '4',
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
            votes: []
          }
        ]
      }
    ]
  },
  {
    id: '5',
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
    createdAt: '2023-05-20T15:00:00Z'
  }
];

// Mock completed plans (past plans)
export const mockCompletedPlans: Plan[] = [
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
    date: 'Yesterday, 10:00 AM',
    location: 'Yellowstone National Park',
    isRead: true,
    createdAt: '2023-05-19T08:00:00Z'
  }
];