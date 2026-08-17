import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth, GoogleAuthProvider } from "firebase/auth"; // <--- ADDED GoogleAuthProvider
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyApz5hncLN4ZgG87Cjkvztj_qlTHt5dizU",
  authDomain: "attendance-app-f3968.firebaseapp.com",
  projectId: "attendance-app-f3968",
  storageBucket: "attendance-app-f3968.firebasestorage.app",
  messagingSenderId: "1054968600634",
  appId: "1:1054968600634:web:ad9a66e50e26b98ccf7d03"
};

// Initialize Firebase safely without duplicate initialization
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app); 
const googleProvider = new GoogleAuthProvider(); // <--- INITIALIZED

export { app, auth, db, storage, googleProvider }; // <--- ADDED googleProvider