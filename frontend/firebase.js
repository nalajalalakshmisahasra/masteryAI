// 1. Import the initialization function from the core Firebase app SDK
import { initializeApp } from "firebase/app";
// 2. Import the authentication function from the Firebase Auth SDK
import { getAuth } from "firebase/auth";

// 3. Paste your exact configuration object from the Firebase Console
const firebaseConfig = {
  apiKey: "YOUR_ACTUAL_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

// 4. Initialize the Firebase application
const app = initializeApp(firebaseConfig);

// 5. Initialize the Auth service and export it
export const auth = getAuth(app);