# Aura - Global Friend Group Ranking App

A Next.js application that allows users to create groups, rate each other's aura, and compete on global leaderboards.

## Features

- **Google Authentication**: Sign in with Google only
- **Group Sessions**: Create and join groups with unique codes
- **Aura Rating System**: Rate friends based on 10 core aura aspects
- **Global Leaderboards**: See rankings of users and famous people
- **Famous People Rating**: Rate celebrities and public figures
- **User Profiles**: Customizable profiles with social handles
- **Real-time Updates**: Live leaderboard and rating updates

## Setup

### 1. Firebase Setup

1. Create a Firebase project at [Firebase Console](https://console.firebase.google.com/)
2. Enable Google Authentication
3. Create a Firestore database
4. Get your Firebase config and add it to `src/lib/firebase.ts`

### 2. TMDB API Setup (for Famous People feature)

1. Get a free API key from [The Movie Database](https://www.themoviedb.org/settings/api)
2. Create a `.env.local` file in the root directory
3. Add your TMDB API key:

```env
NEXT_PUBLIC_TMDB_API_KEY=your_tmdb_api_key_here
```

### 3. Install Dependencies

```bash
npm install
```

### 4. Run the Development Server

```bash
npm run dev
```

## API Integration

### TMDB API
The app uses The Movie Database (TMDB) API to fetch famous people data:
- **Search**: Find celebrities by name
- **Popular People**: Get trending celebrities
- **Person Details**: Get detailed information about specific people

### Free API Benefits
- **No Cost**: Completely free to use
- **Comprehensive Database**: Millions of celebrities and public figures
- **High Quality Data**: Professional photos and accurate information
- **Real-time Updates**: Always up-to-date celebrity information

## Features

### Group Management
- Create groups with unique codes
- Join groups via code or link
- Rate group members
- View group results

### Rating System
- 10 core aura aspects for detailed ratings
- Positive and negative aura points
- Global 10,000 point limit per user
- Preset point values for quick rating

### Leaderboards
- **Users Tab**: Regular user rankings
- **Famous People Tab**: Celebrity rankings with search
- Real-time updates
- User highlighting

### Search Functionality
- **Debounced Search**: 500ms delay to prevent excessive API calls
- **Real-time Results**: Instant search results
- **Fallback Search**: Local search if API fails
- **Loading States**: Visual feedback during search

## File Structure

```
src/
├── app/
│   ├── dashboard/          # User dashboard
│   ├── leaderboard/        # Global rankings
│   ├── group/             # Group management
│   ├── rate-famous/       # Rate celebrities
│   ├── profile/           # User profiles
│   └── onboarding/        # User setup
├── lib/
│   ├── firebase.ts        # Firebase configuration
│   ├── firestore.ts       # Database operations
│   └── auth.ts           # Authentication
└── hooks/
    └── useAuth.ts        # Auth state management
```

## Environment Variables

Create a `.env.local` file with:

```env
# Firebase Config (from Firebase Console)
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_auth_domain
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_storage_bucket
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id

# TMDB API (for famous people feature)
NEXT_PUBLIC_TMDB_API_KEY=your_tmdb_api_key
```

## Deployment

1. Build the project:
```bash
npm run build
```

2. Deploy to your preferred platform (Vercel, Netlify, etc.)

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

MIT License
