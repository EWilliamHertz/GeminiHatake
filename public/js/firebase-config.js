// Firebase Configuration for HatakeSocial
const firebaseConfig = {
    apiKey: "AIzaSyD2Z9tCmmgReMG77ywXukKC_YIXsbP3uoU",
    authDomain: "hatakesocial-88b5e.firebaseapp.com",
    projectId: "hatakesocial-88b5e",
    storageBucket: "hatakesocial-88b5e.appspot.com",
    messagingSenderId: "1091697032506",
    appId: "1:1091697032506:web:6a7cf9f10bd12650b22403",
    measurementId: "G-EH0PS2Z84J"
};

// Initialize Firebase if not already initialized
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

// Initialize Firebase services safely
try {
    window.auth = firebase.auth();
    window.db = firebase.firestore();
    
    // Only initialize functions if available
    if (firebase.functions) {
        window.functions = firebase.functions();
    }
    
    // Only initialize storage if available
    if (firebase.storage) {
        window.storage = firebase.storage();
    }
    
    console.log('Firebase initialized successfully');
} catch (error) {
    console.warn('Firebase initialization warning:', error.message);
}
