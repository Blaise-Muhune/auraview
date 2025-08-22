import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// Your Firebase configuration
// Replace these with your actual Firebase project config
const firebaseConfig = {
    apiKey: "AIzaSyDixDDDAIj6MlLUVBKxyQdck33MzCLd-44",
    authDomain: "aura-c0748.firebaseapp.com",
    projectId: "aura-c0748",
    storageBucket: "aura-c0748.firebasestorage.app",
    messagingSenderId: "756554007861",
    appId: "1:756554007861:web:7ad6bf8c5b6ac99aab787c",
    measurementId: "G-HKKWZ7T5DE"
  };
// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Authentication and get a reference to the service
export const auth = getAuth(app);

// Initialize Firestore
export const db = getFirestore(app);

// Google Auth Provider
export const googleProvider = new GoogleAuthProvider();

export default app; 