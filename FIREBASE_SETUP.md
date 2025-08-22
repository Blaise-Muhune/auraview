# Firebase Setup for Aura App

## 🔥 Firebase Configuration

Follow these steps to set up Firebase with Google authentication for your Aura app:

### 1. Create a Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Create a project" or "Add project"
3. Enter a project name (e.g., "aura-app")
4. Choose whether to enable Google Analytics (optional)
5. Click "Create project"

### 2. Enable Authentication

1. In your Firebase project, go to "Authentication" in the left sidebar
2. Click "Get started"
3. Go to the "Sign-in method" tab
4. Click on "Google" provider
5. Enable it and configure:
   - **Project support email**: Your email
   - **Authorized domains**: Add `localhost` for development
6. Click "Save"

### 3. Get Your Firebase Config

1. In your Firebase project, click the gear icon (⚙️) next to "Project Overview"
2. Select "Project settings"
3. Scroll down to "Your apps" section
4. Click the web icon (</>)
5. Register your app with a nickname (e.g., "aura-web")
6. Copy the Firebase configuration object

### 4. Update Your Firebase Config

Replace the placeholder values in `src/lib/firebase.ts` with your actual Firebase configuration:

```typescript
const firebaseConfig = {
  apiKey: "your-actual-api-key",
  authDomain: "your-project-id.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project-id.appspot.com",
  messagingSenderId: "your-messaging-sender-id",
  appId: "your-app-id"
};
```

### 5. Configure Authorized Domains

1. In Firebase Authentication → Settings → Authorized domains
2. Add your domains:
   - `localhost` (for development)
   - Your production domain (when deployed)

### 6. Test the Setup

1. Run your development server: `npm run dev`
2. Go to `http://localhost:3000/signup`
3. Click "Continue with Google"
4. You should see the Google sign-in popup

## 🔧 Environment Variables (Optional)

For better security, you can use environment variables:

1. Create a `.env.local` file in your project root
2. Add your Firebase config:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=your-api-key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project-id.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project-id.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your-messaging-sender-id
NEXT_PUBLIC_FIREBASE_APP_ID=your-app-id
```

3. Update `src/lib/firebase.ts` to use environment variables:

```typescript
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};
```

## 🚀 Features Included

- ✅ Google Sign-in/Sign-up
- ✅ User authentication state management
- ✅ Protected dashboard route
- ✅ Sign-out functionality
- ✅ Loading states and error handling
- ✅ Automatic redirects after authentication

## 📱 User Flow

1. User visits `/signup` or `/login`
2. Clicks "Continue with Google"
3. Google popup opens for authentication
4. After successful sign-in, user is redirected to `/dashboard`
5. Dashboard shows user info and basic stats
6. User can sign out to return to home page

## 🔒 Security Notes

- Firebase handles all authentication securely
- No passwords stored in your app
- Google manages user credentials
- Firebase provides built-in security features

## 🐛 Troubleshooting

**Common Issues:**
- **"Firebase not initialized"**: Check your config values
- **"Unauthorized domain"**: Add `localhost` to authorized domains
- **"Google sign-in not working"**: Ensure Google provider is enabled
- **"Redirect issues"**: Check your domain configuration

**Debug Steps:**
1. Check browser console for errors
2. Verify Firebase config values
3. Ensure Google provider is enabled
4. Check authorized domains in Firebase console 