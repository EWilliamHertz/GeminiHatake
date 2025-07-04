/**
 * HatakeSocial - Main Controller Script (v1 - Stable)
 *
 * This script is included on EVERY page FIRST. It handles:
 * 1. Firebase Initialization.
 * 2. A global registration system for page-specific logic.
 * 3. The main auth state listener that updates the header UI.
 * 4. Executing the correct page script ONLY when Firebase is ready.
 */
document.addEventListener('DOMContentLoaded', () => {
    // Hide the body initially to prevent a "flash" of the wrong content
    document.body.style.opacity = '0';

    // --- Global App Namespace ---
    window.HatakeSocial = {
        pageInit: null, // This will hold the function for the specific page we're on
        onAuthReady: function(initFunction) {
            this.pageInit = initFunction;
        }
    };

    // --- Firebase Configuration ---
    const firebaseConfig = {
        apiKey: "AIzaSyD2Z9tCmmgReMG77ywXukKC_YIXsbP3uoU",
        authDomain: "hatakesocial-88b5e.firebaseapp.com",
        projectId: "hatakesocial-88b5e",
        storageBucket: "hatakesocial-88b5e.appspot.com",
        messagingSenderId: "1091697032506",
        appId: "1:1091697032506:web:6a7cf9f10bd12650b22403"
    };

    // --- Firebase Initialization ---
    if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
    }
    
    window.auth = firebase.auth();
    window.db = firebase.firestore();
    window.storage = firebase.storage();
    const googleProvider = new firebase.auth.GoogleAuthProvider();

    // --- Global Helpers ---
    window.openModal = (modal) => { if (modal) modal.classList.add('open'); };
    window.closeModal = (modal) => { if (modal) modal.classList.remove('open'); };
    
    // --- Core UI Listeners (Run Immediately) ---
    const setupModalAndFormListeners = () => {
        const loginButton = document.getElementById('loginButton');
        const registerButton = document.getElementById('registerButton');
        const logoutButton = document.getElementById('logoutButton');
        const userAvatar = document.getElementById('userAvatar');
        const userDropdown = document.getElementById('userDropdown');
        const loginModal = document.getElementById('loginModal');
        const registerModal = document.getElementById('registerModal');

        if (loginButton) loginButton.addEventListener('click', () => openModal(loginModal));
        if (registerButton) registerButton.addEventListener('click', () => openModal(registerModal));
        document.getElementById('closeLoginModal')?.addEventListener('click', () => closeModal(loginModal));
        document.getElementById('closeRegisterModal')?.addEventListener('click', () => closeModal(registerModal));

        document.getElementById('loginForm')?.addEventListener('submit', (e) => {
            e.preventDefault();
            const email = document.getElementById('loginEmail').value;
            const password = document.getElementById('loginPassword').value;
            auth.signInWithEmailAndPassword(email, password).then(() => closeModal(loginModal)).catch(err => alert(err.message));
        });

        // ... other modal/form listeners ...

        if (logoutButton) logoutButton.addEventListener('click', (e) => { e.preventDefault(); auth.signOut(); });
        if (userAvatar) userAvatar.addEventListener('click', () => userDropdown.classList.toggle('hidden'));
    };

    // --- Auth State Controller ---
    auth.onAuthStateChanged(async (user) => {
        const loginButton = document.getElementById('loginButton');
        const registerButton = document.getElementById('registerButton');
        const userAvatar = document.getElementById('userAvatar');
        
        if (user) {
            if (loginButton) loginButton.classList.add('hidden');
            if (registerButton) registerButton.classList.add('hidden');
            if (userAvatar) userAvatar.classList.remove('hidden');
            const userDoc = await db.collection('users').doc(user.uid).get();
            if (userDoc.exists) {
                if (userAvatar) userAvatar.src = userDoc.data().photoURL || 'https://i.imgur.com/B06rBhI.png';
            }
        } else {
            if (loginButton) loginButton.classList.remove('hidden');
            if (registerButton) registerButton.classList.remove('hidden');
            if (userAvatar) userAvatar.classList.add('hidden');
        }
        
        // ** THE FIX IS HERE **
        // If a page has registered an initialization function, run it now with the user status.
        if (window.HatakeSocial.pageInit && typeof window.HatakeSocial.pageInit === 'function') {
            try {
                window.HatakeSocial.pageInit(user);
            } catch (error) {
                console.error("Error running page-specific script:", error);
            }
        }

        // Finally, fade in the body content to prevent UI flash
        document.body.style.transition = 'opacity 0.3s ease-in-out';
        document.body.style.opacity = '1';
    });

    // --- Initial Call ---
    setupModalAndFormListeners();
});
