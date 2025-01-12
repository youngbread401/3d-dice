import { initializeApp } from 'firebase/app';
import { getDatabase } from 'firebase/database';

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIZaSyBaOGqEU2Arsw5doCbCrGtDOefL8Q6QtI",
  authDomain: "table-top-ebbed.firebaseapp.com",
  projectId: "table-top-ebbed",
  storageBucket: "table-top-ebbed.firebasestorage.app",
  messagingSenderId: "361322829011",
  appId: "1:361322829011:web:f52fe79b11931cb0cf7026"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Get database instance
export const database = getDatabase(app);