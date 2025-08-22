'use client';

import { useState, useEffect } from 'react';
import { User } from 'firebase/auth';
import { onAuthStateChanged, signInWithGoogle, signOutUser } from '@/lib/auth';

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged((user) => {
      setUser(user);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const signIn = async () => {
    const result = await signInWithGoogle();
    if (result.error) {
      throw new Error(result.error);
    }
    return result.user;
  };

  const signOut = async () => {
    const result = await signOutUser();
    if (result.error) {
      throw new Error(result.error);
    }
  };

  return {
    user,
    loading,
    signIn,
    signOut,
  };
}; 