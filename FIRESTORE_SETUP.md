# Firestore Security Rules Setup

## 🔥 Fix "Missing or insufficient permissions" Error

The error you're seeing is because Firestore security rules are blocking access. Follow these steps to fix it:

### 1. Install Firebase CLI (if not already installed)

```bash
npm install -g firebase-tools
```

### 2. Login to Firebase

```bash
firebase login
```

### 3. Initialize Firebase in your project

```bash
firebase init firestore
```

When prompted:
- Select your project: `aura-c0748`
- Use existing rules: No
- Use existing indexes: No

### 4. Deploy the Security Rules

The `firestore.rules` file has been updated in your project root. Deploy it:

```bash
firebase deploy --only firestore:rules
```

### 5. Alternative: Manual Setup in Firebase Console

If you prefer to set up rules manually:

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project: `aura-c0748`
3. Go to **Firestore Database** in the left sidebar
4. Click on the **Rules** tab
5. Replace the existing rules with:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Allow authenticated users to read and write to all collections
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
    
    // Specific rules for groups collection
    match /groups/{groupId} {
      allow read: if request.auth != null;
      allow create: if request.auth != null && 
        request.auth.uid == resource.data.createdBy;
      allow update: if request.auth != null && 
        (request.auth.uid == resource.data.createdBy || 
         request.auth.uid in resource.data.participants);
      allow delete: if request.auth != null && 
        request.auth.uid == resource.data.createdBy;
    }
    
    // Specific rules for users collection
    match /users/{userId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && 
        request.auth.uid == userId;
    }
    
    // Specific rules for ratings collection
    match /ratings/{ratingId} {
      allow read: if request.auth != null;
      allow create: if request.auth != null && 
        request.auth.uid == resource.data.fromUserId;
      allow update, delete: if request.auth != null && 
        request.auth.uid == resource.data.fromUserId;
    }
  }
}
```

6. Click **Publish**

### 6. Test the Fix

After deploying the rules:

1. Refresh your app
2. Try creating a group again
3. Try submitting ratings
4. The errors should be resolved

## 🔒 What These Rules Do

- **Allow authenticated users** to read and write to all collections
- **Group-specific rules**: Only group creators can create/delete, participants can update
- **User-specific rules**: Users can only modify their own profiles
- **Rating rules**: Users can only create ratings from their own account

## 🚨 Important Notes

- These rules allow any authenticated user to read all data
- For production, you might want more restrictive rules
- The rules ensure users can only modify their own data
- Group participants can update group data (for joining/leaving)

## 🐛 Troubleshooting

If you still get permission errors:

1. **Check authentication**: Make sure you're signed in
2. **Clear browser cache**: Hard refresh the page
3. **Check Firebase Console**: Verify rules were published
4. **Check project ID**: Ensure you're using the correct Firebase project

## 📱 Next Steps

Once the rules are deployed:
- ✅ Group creation will work
- ✅ Users can join groups
- ✅ Rating submission will work
- ✅ All Firestore operations will function properly
- ✅ Ready to implement rating system

The app should now work without permission errors! ✧ 