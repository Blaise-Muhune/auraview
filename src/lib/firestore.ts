import { 
  collection, 
  doc, 
  addDoc, 
  getDoc, 
  getDocs, 
  updateDoc, 
  query, 
  where, 
  orderBy, 
  serverTimestamp,
  Timestamp,
  setDoc,
  documentId
} from 'firebase/firestore';
import { db } from './firebase';
import { User } from 'firebase/auth';

// Types
export interface GroupSession {
  id?: string;
  name: string;
  description?: string;
  code: string;
  createdBy: string;
  createdByDisplayName: string;
  createdAt: Timestamp;
  isActive: boolean;
  participants: string[];
  maxParticipants?: number;
  /** When true, creator has manually closed voting */
  votingClosed?: boolean;
  /** Auto-close voting after this time (default: 7 days after creation) */
  votingClosesAt?: Timestamp;
  /** Close when this many unique voters have submitted (optional) */
  minVotersToClose?: number;
}

export interface UserProfile {
  id: string;
  displayName: string;
  email: string;
  photoURL?: string;
  baseAura: number;
  totalAura: number;
  pointsToGive: number;
  createdAt: Timestamp;
  groupsJoined: string[];
  socialHandles?: {
    instagram?: string;
    twitter?: string;
    linkedin?: string;
    github?: string;
    website?: string;
    other?: string;
    /** Up to 3 social links (Instagram, X/Twitter, LinkedIn, GitHub) */
    socialLinks?: string[];
  };
  auraSources?: {
    description?: string;
    links?: string[];
    achievements?: string[];
    testimonials?: string[];
  };
  /** Email notifications (default true) */
  emailNotifications?: boolean;
  /** Whether to show on global leaderboard (undefined = not asked yet) */
  showOnLeaderboard?: boolean;
  /** When on global leaderboard, show as anonymous (only applies if showOnLeaderboard is true) */
  leaderboardAnonymous?: boolean;
  /** Whether to show on group results/leaderboard (undefined = not asked yet) */
  showOnGroupLeaderboard?: boolean;
  /** When on group leaderboard, show as anonymous (only applies if showOnGroupLeaderboard is true) */
  groupLeaderboardAnonymous?: boolean;
}

export interface Rating {
  id: string;
  groupId: string;
  fromUserId: string;
  fromUserDisplayName: string;
  toUserId: string;
  toUserDisplayName: string;
  points: number;
  reason?: string;
  createdAt: Timestamp;
}

export interface FamousPersonRating {
  id: string;
  fromUserId: string;
  fromUserDisplayName: string;
  famousPersonId: string;
  famousPersonName: string;
  points: number;
  reason?: string;
  createdAt: Timestamp;
}

export interface FamousPerson {
  id: string;
  name: string;
  profession: string;
  imageUrl: string;
  totalAura: number;
  ratingsReceived: number;
  averageRating: number;
  isUnrated?: boolean;
}

// Generate a random 6-character code
export const generateGroupCode = (): string => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

// Check if group code exists
export const checkGroupCodeExists = async (code: string): Promise<boolean> => {
  const q = query(collection(db, 'groups'), where('code', '==', code));
  const querySnapshot = await getDocs(q);
  return !querySnapshot.empty;
};

// Create a new group session
export const createGroupSession = async (
  name: string, 
  description: string, 
  user: User,
  maxParticipants?: number,
  votingDurationDays?: number,
  minVotersToClose?: number
): Promise<string> => {
  let code: string;
  let exists: boolean;
  
  // Generate unique code
  do {
    code = generateGroupCode();
    exists = await checkGroupCodeExists(code);
  } while (exists);

  // Ensure user profile exists and get their display name
  const userProfile = await ensureUserProfile(user);
  const displayName = userProfile.displayName || user.displayName || 'Anonymous';

  const days = votingDurationDays ?? 7;
  const closesAt = Timestamp.fromMillis(Date.now() + days * 24 * 60 * 60 * 1000);

  const groupData: Omit<GroupSession, 'id'> = {
    name,
    description,
    code,
    createdBy: user.uid,
    createdByDisplayName: displayName,
    createdAt: serverTimestamp() as Timestamp,
    isActive: true,
    participants: [user.uid],
    maxParticipants: maxParticipants || 50,
    votingClosesAt: closesAt,
    ...(minVotersToClose != null && minVotersToClose > 0 && { minVotersToClose }),
  };

  const docRef = await addDoc(collection(db, 'groups'), groupData);
  return docRef.id;
};

// Close voting manually (creator only)
export const closeGroupVoting = async (groupId: string): Promise<void> => {
  await updateDoc(doc(db, 'groups', groupId), {
    votingClosed: true,
  });
};

// Check if voting is closed (manual, time-based, or voter threshold)
export const isVotingClosed = (
  group: GroupSession,
  uniqueVoterCount: number,
  now: Date = new Date()
): boolean => {
  if (group.votingClosed) return true;
  if (group.votingClosesAt) {
    const ts = group.votingClosesAt as Timestamp;
    const closesAt = ts?.toDate ? ts.toDate() : new Date((ts as unknown as { seconds: number }).seconds * 1000);
    if (now >= closesAt) return true;
  }
  if (group.minVotersToClose != null && uniqueVoterCount >= group.minVotersToClose) return true;
  return false;
};

// Get group by ID
export const getGroupById = async (groupId: string): Promise<GroupSession | null> => {
  const docRef = doc(db, 'groups', groupId);
  const docSnap = await getDoc(docRef);
  
  if (docSnap.exists()) {
    return { id: docSnap.id, ...docSnap.data() } as GroupSession;
  }
  return null;
};

// Get group by code
export const getGroupByCode = async (code: string): Promise<GroupSession | null> => {
  const q = query(collection(db, 'groups'), where('code', '==', code));
  const querySnapshot = await getDocs(q);
  
  if (!querySnapshot.empty) {
    const doc = querySnapshot.docs[0];
    return { id: doc.id, ...doc.data() } as GroupSession;
  }
  return null;
};

// Join a group
export const joinGroup = async (groupId: string, user: User): Promise<boolean> => {
  const group = await getGroupById(groupId);
  if (!group) return false;
  
  if (group.participants.includes(user.uid)) {
    return true; // Already a member
  }
  
  if (group.maxParticipants && group.participants.length >= group.maxParticipants) {
    throw new Error('Group is full');
  }
  
  // Ensure user profile exists and refresh it with latest Firebase Auth data
  await ensureUserProfile(user);
  await refreshUserProfile(user);
  
  const updatedParticipants = [...group.participants, user.uid];
  await updateDoc(doc(db, 'groups', groupId), {
    participants: updatedParticipants
  });
  
  return true;
};

// Leave a group
export const leaveGroup = async (groupId: string, userId: string): Promise<void> => {
  const group = await getGroupById(groupId);
  if (!group) return;
  
  const updatedParticipants = group.participants.filter(id => id !== userId);
  await updateDoc(doc(db, 'groups', groupId), {
    participants: updatedParticipants
  });
};

// Get user's groups
export const getUserGroups = async (userId: string): Promise<GroupSession[]> => {
  const q = query(
    collection(db, 'groups'), 
    where('participants', 'array-contains', userId),
    orderBy('createdAt', 'desc')
  );
  const querySnapshot = await getDocs(q);
  
  return querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  })) as GroupSession[];
};

// Create or update user profile
export const createUserProfile = async (user: User): Promise<void> => {
  let displayName = user.displayName;
  if (!displayName && user.email) {
    displayName = user.email.split('@')[0];
  }
  if (!displayName) {
    displayName = 'Anonymous User';
  }

  const userData: Omit<UserProfile, 'id'> = {
    displayName: displayName,
    email: user.email || '',
    photoURL: user.photoURL || undefined,
    baseAura: 500,
    totalAura: 500,
    pointsToGive: 10000,
    createdAt: serverTimestamp() as Timestamp,
    groupsJoined: [],
    emailNotifications: true
  };

  const userRef = doc(db, 'users', user.uid);
  await setDoc(userRef, userData);
};

// Update user profile
export const updateUserProfile = async (userId: string, updates: Partial<UserProfile>): Promise<void> => {
  const userRef = doc(db, 'users', userId);
  await updateDoc(userRef, updates);
};

// Get user profile
export const getUserProfile = async (userId: string): Promise<UserProfile | null> => {
  try {
    // First try to get by UID (new structure)
    const userRef = doc(db, 'users', userId);
    const docSnap = await getDoc(userRef);
    
    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() } as UserProfile;
    }
    
    // If not found, try to get by email (old structure)
    return await getUserProfileByEmail(userId);
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error('Error getting user profile:', error);
    }
    return null;
  }
};

// Get user profile by email (for backward compatibility)
export const getUserProfileByEmail = async (email: string): Promise<UserProfile | null> => {
  const q = query(collection(db, 'users'), where('email', '==', email));
  const querySnapshot = await getDocs(q);
  
  if (!querySnapshot.empty) {
    const doc = querySnapshot.docs[0];
    return { id: doc.id, ...doc.data() } as UserProfile;
  }
  return null;
};

// Ensure user profile exists (create if doesn't exist)
export const ensureUserProfile = async (user: User): Promise<UserProfile> => {
  const existingProfile = await getUserProfile(user.uid);

  if (existingProfile) {
    if ((existingProfile.displayName === 'Anonymous' || existingProfile.displayName === 'Anonymous User') &&
        user.displayName && user.displayName !== 'Anonymous' && user.displayName !== 'Anonymous User') {
      await updateUserProfile(user.uid, { displayName: user.displayName });
      existingProfile.displayName = user.displayName;
    }
    return existingProfile;
  }

  await createUserProfile(user);
  const newProfile = await getUserProfile(user.uid);
  if (!newProfile) {
    throw new Error('Failed to create user profile');
  }
  return newProfile;
};

// Refresh user profile from Firebase Auth data
export const refreshUserProfile = async (user: User): Promise<void> => {
  try {
    const existingProfile = await getUserProfile(user.uid);

    if (existingProfile) {
      const updates: Partial<UserProfile> = {};
      let hasUpdates = false;
      if (user.displayName &&
          user.displayName !== 'Anonymous' &&
          user.displayName !== 'Anonymous User' &&
          existingProfile.displayName !== user.displayName) {
        updates.displayName = user.displayName;
        hasUpdates = true;
      }
      if (user.email && existingProfile.email !== user.email) {
        updates.email = user.email;
        hasUpdates = true;
      }
      if (user.photoURL && existingProfile.photoURL !== user.photoURL) {
        updates.photoURL = user.photoURL;
        hasUpdates = true;
      }
      if (hasUpdates) {
        await updateUserProfile(user.uid, updates);
      }
    } else {
      await createUserProfile(user);
    }
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error('Error refreshing user profile:', error);
    }
    throw error;
  }
};

// Submit a rating via API (server-side validation)
export const submitRating = async (
  groupId: string,
  user: User,
  toUserId: string,
  toUserDisplayName: string,
  points: number,
  reason?: string,
  token?: string
): Promise<void> => {
  const idToken = token ?? (await user.getIdToken());
  const res = await fetch('/api/ratings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      idToken,
      groupId,
      toUserId,
      toUserDisplayName,
      points,
      reason: reason?.trim() || undefined,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || `Failed to submit rating (${res.status})`);
  }
};

// Get participant IDs the current user has already rated in a group (persisted)
export const getParticipantIdsRatedByUserInGroup = async (groupId: string, fromUserId: string): Promise<string[]> => {
  const q = query(
    collection(db, 'ratings'),
    where('groupId', '==', groupId),
    where('fromUserId', '==', fromUserId)
  );
  const snapshot = await getDocs(q);
  return [...new Set(snapshot.docs.map(d => (d.data() as Rating).toUserId))];
};

// Get ratings for a group
export const getGroupRatings = async (groupId: string): Promise<Rating[]> => {
  const q = query(
    collection(db, 'ratings'),
    where('groupId', '==', groupId),
    orderBy('createdAt', 'desc')
  );
  const querySnapshot = await getDocs(q);
  
  return querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  })) as Rating[];
};

// Get user's total aura from ratings
export const getUserTotalAura = async (userId: string): Promise<number> => {
  const q = query(collection(db, 'ratings'), where('toUserId', '==', userId));
  const querySnapshot = await getDocs(q);
  
  const totalPoints = querySnapshot.docs.reduce((sum, doc) => {
    const rating = doc.data() as Rating;
    return sum + rating.points;
  }, 0);
  
  return totalPoints + 500; // Base aura + received points
};

// Get user's remaining points to distribute
export const getUserRemainingPoints = async (userId: string): Promise<number> => {
  const q = query(collection(db, 'ratings'), where('fromUserId', '==', userId));
  const querySnapshot = await getDocs(q);
  
  const usedPoints = querySnapshot.docs.reduce((sum, doc) => {
    const rating = doc.data() as Rating;
    // Count both positive and negative points against the limit
    return sum + Math.abs(rating.points);
  }, 0);
  
  return Math.max(0, 10000 - usedPoints); // 10,000 total - absolute points used
};

// Check if user has enough points to submit ratings
export const checkUserPoints = async (userId: string, pointsToUse: number): Promise<boolean> => {
  const remainingPoints = await getUserRemainingPoints(userId);
  // Check absolute value of points to use
  return remainingPoints >= Math.abs(pointsToUse);
};

// Get count of unique people who rated the user
export const getUserRatersCount = async (userId: string): Promise<number> => {
  const q = query(collection(db, 'ratings'), where('toUserId', '==', userId));
  const querySnapshot = await getDocs(q);
  const uniqueRaters = new Set(querySnapshot.docs.map(d => (d.data() as Rating).fromUserId));
  return uniqueRaters.size;
};

// Get user's total distributed points (absolute value)
export const getUserDistributedPoints = async (userId: string): Promise<number> => {
  const q = query(collection(db, 'ratings'), where('fromUserId', '==', userId));
  const querySnapshot = await getDocs(q);
  
  return querySnapshot.docs.reduce((sum, doc) => {
    const rating = doc.data() as Rating;
    // Count absolute value of all points distributed
    return sum + Math.abs(rating.points);
  }, 0);
};

// Fetch leaderboard from server API (avoids full collection scans on client)
// When signed in: full names and aura. When signed out: anonymized (names hidden, aura hidden, ratingsReceived shown).
export const getLeaderboardData = async (getToken: () => Promise<string | undefined>): Promise<{
  rankings: Array<{ userId: string; displayName: string; totalAura: number | null; groupsJoined: number; ratingsReceived: number }>;
  stats: { totalUsers: number; totalRatings: number; averageAura: number | null; highestAura: number | null };
  anonymized?: boolean;
}> => {
  const token = await getToken();

  let res: Response;
  if (token) {
    res = await fetch('/api/leaderboard', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    });
    if (res.status === 401) {
      res = await fetch('/api/leaderboard', { headers: { Authorization: `Bearer ${token}` } });
    }
  } else {
    res = await fetch('/api/leaderboard');
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || 'Failed to load leaderboard data');
  }
  return res.json();
};

// Deprecated: use getLeaderboardData + API instead. Kept for reference; triggers heavy client reads.
export const getGlobalRankings = async (): Promise<Array<{
  userId: string;
  displayName: string;
  totalAura: number;
  groupsJoined: number;
  ratingsReceived: number;
}>> => {
  // Get all groups to find all unique users
  const groupsQuery = query(collection(db, 'groups'));
  const groupsSnapshot = await getDocs(groupsQuery);
  
  // Get all ratings
  const ratingsQuery = query(collection(db, 'ratings'));
  const ratingsSnapshot = await getDocs(ratingsQuery);
  
  // Create a set of all unique user IDs from groups
  const uniqueUserIds = new Set<string>();
  
  // Collect all users from all groups
  groupsSnapshot.docs.forEach(doc => {
    const groupData = doc.data() as GroupSession;
    groupData.participants.forEach(userId => {
      uniqueUserIds.add(userId);
    });
  });
  
  // Fetch user profiles for all unique users to get their display names
  const userProfiles = new Map<string, string>();
  for (const userId of uniqueUserIds) {
    try {
      const userProfile = await getUserProfile(userId);
      if (userProfile && userProfile.displayName) {
        userProfiles.set(userId, userProfile.displayName);
      } else {
        userProfiles.set(userId, 'Anonymous User');
      }
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Failed to fetch profile for user:', error);
      }
      userProfiles.set(userId, 'Anonymous User');
    }
  }
  
  // Calculate rankings
  const userStats = new Map<string, {
    displayName: string;
    totalAura: number;
    groupsJoined: number;
    ratingsReceived: number;
  }>();
  
  // Initialize user stats for all unique users
  uniqueUserIds.forEach(userId => {
    userStats.set(userId, {
      displayName: userProfiles.get(userId) || 'Anonymous User',
      totalAura: 500, // Base aura
      groupsJoined: 0,
      ratingsReceived: 0
    });
  });
  
  // Count groups joined for each user
  groupsSnapshot.docs.forEach(doc => {
    const groupData = doc.data() as GroupSession;
    groupData.participants.forEach(userId => {
      const userStat = userStats.get(userId);
      if (userStat) {
        userStat.groupsJoined += 1;
      }
    });
  });
  
  // Calculate aura from ratings
  ratingsSnapshot.docs.forEach(doc => {
    const rating = doc.data() as Rating;
    const userStat = userStats.get(rating.toUserId);
    if (userStat) {
      userStat.totalAura += rating.points;
      userStat.ratingsReceived += 1;
    }
  });
  
  // Convert to array and sort by total aura
  const rankings = Array.from(userStats.entries()).map(([userId, stats]) => ({
    userId,
    ...stats
  }));
  
  return rankings.sort((a, b) => b.totalAura - a.totalAura);
};

// Get global statistics
export const getGlobalStats = async (): Promise<{
  totalUsers: number;
  totalRatings: number;
  averageAura: number;
  highestAura: number;
}> => {
  // Get all groups to find unique users
  const groupsQuery = query(collection(db, 'groups'));
  const groupsSnapshot = await getDocs(groupsQuery);
  
  // Get all ratings
  const ratingsQuery = query(collection(db, 'ratings'));
  const ratingsSnapshot = await getDocs(ratingsQuery);
  
  // Create a set of all unique user IDs from groups
  const uniqueUserIds = new Set<string>();
  
  // Collect all users from all groups
  groupsSnapshot.docs.forEach(doc => {
    const groupData = doc.data() as GroupSession;
    groupData.participants.forEach(userId => {
      uniqueUserIds.add(userId);
    });
  });
  
  const totalUsers = uniqueUserIds.size;
  const totalRatings = ratingsSnapshot.size;
  
  // Calculate total aura from ratings
  let totalAura = 0;
  ratingsSnapshot.docs.forEach(doc => {
    const rating = doc.data() as Rating;
    totalAura += rating.points;
  });
  
  // Add base aura for all users
  totalAura += (totalUsers * 500);
  
  const averageAura = totalUsers > 0 ? Math.round(totalAura / totalUsers) : 0;
  
  // Get highest aura
  const rankings = await getGlobalRankings();
  const highestAura = rankings.length > 0 ? rankings[0].totalAura : 0;
  
  return {
    totalUsers,
    totalRatings,
    averageAura,
    highestAura
  };
}; 

export const hasUserRatedFamousPerson = async (userId: string, famousPersonId: string): Promise<boolean> => {
  const q = query(
    collection(db, 'famousPersonRatings'),
    where('famousPersonId', '==', famousPersonId),
    where('fromUserId', '==', userId)
  );
  const snapshot = await getDocs(q);
  return !snapshot.empty;
};

export const submitFamousPersonRating = async (
  user: User,
  famousPersonId: string,
  famousPersonName: string,
  points: number,
  reason?: string
): Promise<void> => {
  const alreadyRated = await hasUserRatedFamousPerson(user.uid, famousPersonId);
  if (alreadyRated) {
    throw new Error('You have already rated this person.');
  }

  const ratingData: Partial<Omit<FamousPersonRating, 'id'>> = {
    fromUserId: user.uid,
    fromUserDisplayName: user.displayName || 'Anonymous',
    famousPersonId,
    famousPersonName,
    points,
    createdAt: serverTimestamp() as Timestamp
  };

  // Only include reason if it's not empty
  if (reason && reason.trim()) {
    ratingData.reason = reason.trim();
  }

  await addDoc(collection(db, 'famousPersonRatings'), ratingData);
};

export const getFamousPersonRatings = async (famousPersonId: string): Promise<FamousPersonRating[]> => {
  const q = query(
    collection(db, 'famousPersonRatings'),
    where('famousPersonId', '==', famousPersonId)
  );
  const querySnapshot = await getDocs(q);
  
  return querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  })) as FamousPersonRating[];
};

export const getFamousPersonStats = async (famousPersonId: string): Promise<{
  totalAura: number;
  ratingsReceived: number;
  averageRating: number;
}> => {
  const ratings = await getFamousPersonRatings(famousPersonId);
  
  if (ratings.length === 0) {
    return {
      totalAura: 0,
      ratingsReceived: 0,
      averageRating: 0
    };
  }

  const totalAura = ratings.reduce((sum, rating) => sum + rating.points, 0);
  const ratingsReceived = ratings.length;
  const averageRating = totalAura / ratingsReceived;

  return {
    totalAura,
    ratingsReceived,
    averageRating
  };
};

export const getAllFamousPeopleStats = async (): Promise<{[key: string]: {
  totalAura: number;
  ratingsReceived: number;
  averageRating: number;
} | null}> => {
  const q = query(collection(db, 'famousPersonRatings'));
  const querySnapshot = await getDocs(q);
  
  const stats: {[key: string]: {
    totalAura: number;
    ratingsReceived: number;
    averageRating: number;
  } | null} = {};
  
  querySnapshot.docs.forEach(doc => {
    const rating = doc.data() as FamousPersonRating;
    const personId = rating.famousPersonId;
    
    if (!stats[personId]) {
      stats[personId] = {
        totalAura: 0,
        ratingsReceived: 0,
        averageRating: 0
      };
    }
    
    stats[personId]!.totalAura += rating.points;
    stats[personId]!.ratingsReceived += 1;
  });
  
  // Calculate averages
  Object.keys(stats).forEach(personId => {
    if (stats[personId]) {
      stats[personId]!.averageRating = stats[personId]!.totalAura / stats[personId]!.ratingsReceived;
    }
  });
  
  return stats;
};

// Get multiple user profiles by their IDs (reads from users collection)
export const getUserProfilesByIds = async (userIds: string[]): Promise<UserProfile[]> => {
  if (userIds.length === 0) return [];

  try {
    const profiles: UserProfile[] = [];
    const batchSize = 10;

    for (let i = 0; i < userIds.length; i += batchSize) {
      const batch = userIds.slice(i, i + batchSize);
      const q = query(
        collection(db, 'users'),
        where(documentId(), 'in', batch)
      );
      const querySnapshot = await getDocs(q);

      querySnapshot.docs.forEach((d) => {
        const data = d.data();
        profiles.push({
          id: d.id,
          displayName: data.displayName ?? 'Anonymous User',
          email: data.email ?? '',
          photoURL: data.photoURL,
          baseAura: data.baseAura ?? 500,
          totalAura: data.totalAura ?? 500,
          pointsToGive: data.pointsToGive ?? 10000,
          createdAt: data.createdAt,
          groupsJoined: data.groupsJoined ?? [],
          socialHandles: data.socialHandles,
          auraSources: data.auraSources,
          emailNotifications: data.emailNotifications,
        } as UserProfile);
      });
    }

    return profiles;
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error('Error fetching user profiles:', error);
    }
    return [];
  }
};

// Get user display name with fallback logic (extract from email if needed)
export const getUserDisplayName = async (userId: string): Promise<string> => {
  try {
    // First try to get the user profile
    const userProfile = await getUserProfile(userId);
    
    if (userProfile?.displayName) {
      return userProfile.displayName;
    }
    
    // If no display name but we have email, extract from email
    if (userProfile?.email) {
      return userProfile.email.split('@')[0];
    }
    
    // Try to get by email (old structure)
    const profileByEmail = await getUserProfileByEmail(userId);
    if (profileByEmail?.displayName) {
      return profileByEmail.displayName;
    }
    
    if (profileByEmail?.email) {
      return profileByEmail.email.split('@')[0];
    }
    
    // Final fallback - use a shortened user ID
    return `User ${userId.slice(0, 6)}`;
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error('Error getting user display name:', error);
    }
    return `User ${userId.slice(0, 6)}`;
  }
}; 