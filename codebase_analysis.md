# HatakeSocial Codebase Analysis

## Current Features Overview

### Authentication & User Management
- Firebase Authentication with email/password and Google sign-in
- User profiles with avatar, bio, achievements, and ratings
- User collections, wishlists, and decks
- Friend system with requests and suggestions

### Social Features (Existing)
- **Feed System**: Social posts with likes, comments, and polls
- **Messaging**: Direct messaging between users
- **Groups**: Basic group creation and discovery (partially implemented)
- **Community Hub**: Friends, groups, and "Looking for Game" status

### Trading & Marketplace
- Marketplace for buying/selling cards
- Trading system with proposals and feedback
- Collection tracking with real-time market data
- Wishlist management

### Content & Events
- TCG Articles system with content creator roles
- Events system for tournaments and local gaming
- Deck builder with public deck sharing
- Blog functionality

### Technical Stack
- **Frontend**: HTML/CSS/JavaScript (vanilla JS, not React despite preferences)
- **Backend**: Firebase Firestore for database
- **Authentication**: Firebase Auth
- **Hosting**: Firebase Hosting
- **Real-time**: Firebase real-time listeners

## Current Group System Analysis

### Existing Group Features
1. **Group Discovery**: Users can browse public groups
2. **Group Creation**: Basic group creation functionality exists
3. **Group Membership**: Join/leave group functionality
4. **Group Posts**: Groups have their own post feeds
5. **Group Moderation**: Moderator roles and permissions

### Current Group Structure (Firestore)
```
groups/{groupId}
├── name: string
├── description: string
├── isPublic: boolean
├── creatorId: string
├── participants: array
├── moderators: array
├── participantCount: number
├── participantInfo: object
└── posts/{postId}
    ├── authorId: string
    ├── content: string
    ├── timestamp: timestamp
    └── ...
```

## Missing Features for Epic Requirements

### 1. Enhanced Group Management
- **Missing**: Group search functionality
- **Missing**: Private group invitation system
- **Missing**: Group member list display
- **Missing**: Group settings and administration

### 2. Group Chat System
- **Missing**: Real-time group chat functionality
- **Missing**: Chat message persistence
- **Missing**: Chat member management
- **Missing**: Integration with existing messaging system

### 3. Unified Profile Enhancement
- **Existing**: Basic profile with collection, decks, trade history
- **Missing**: Enhanced profile showcase
- **Missing**: Social discovery features
- **Missing**: Profile visibility controls

## Implementation Strategy

### Phase 1: Enhanced Group Management
1. Improve group creation UI with better form validation
2. Add group search and filtering capabilities
3. Implement group member list with roles display
4. Add group invitation system for private groups

### Phase 2: Group Chat Implementation
1. Extend existing messaging system for group chats
2. Create group chat UI components
3. Implement real-time chat functionality
4. Add chat history and message management

### Phase 3: Profile Enhancement
1. Redesign profile layout for better showcase
2. Add social discovery features
3. Integrate collection and deck highlights
4. Improve profile visibility and sharing

## Database Schema Extensions Needed

### Group Chat Messages
```
groups/{groupId}/messages/{messageId}
├── senderId: string
├── senderName: string
├── content: string
├── timestamp: timestamp
├── type: string (text, image, card_share)
└── metadata: object
```

### Enhanced Group Data
```
groups/{groupId}
├── [existing fields]
├── chatEnabled: boolean
├── lastActivity: timestamp
├── tags: array
├── category: string
└── settings: object
```

### Profile Enhancements
```
users/{userId}
├── [existing fields]
├── profileVisibility: string
├── featuredDecks: array
├── featuredCards: array
├── socialStats: object
└── preferences: object
```

## Current File Structure
```
public/
├── index.html (landing page)
├── app.html (main feed)
├── community.html (community hub)
├── profile.html (user profiles)
├── messages.html (direct messaging)
├── auth.html (authentication)
├── css/style.css (main styles)
└── js/ (JavaScript files)
```

## Next Steps
1. Enhance existing group functionality
2. Implement group chat system
3. Improve profile showcase features
4. Update Firestore security rules
5. Test and deploy new features
