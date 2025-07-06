/**
 * HatakeSocial - Core Authentication & UI Script (v15 - Race Condition & Search Fix)
 *
 * This script is included on EVERY page. It handles:
 * - All Login/Register Modal and Form logic.
 * - The main auth state listener that correctly updates the header UI.
 * - FIX: Implements a global registry (window.HatakeSocial) to prevent race conditions,
 * ensuring page-specific scripts run only after authentication is ready.
 * - FIX: Adds a 'displayName_lower' field on user creation to enable case-insensitive searching.
 * - Checks for admin status and dynamically adds an "Admin" link to the user dropdown.
 */
document.addEventListener('DOMContentLoaded', () => {
    document.body.style.opacity = '0';

    // --- Global App Namespace ---
    window.HatakeSocial = {
        pageInit: null, // This will hold the function for the specific page
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
    const setupGlobalListeners = () => {
        const headerSearchForm = document.querySelector('header form#header-search-form');
        const loginButton = document.getElementById('loginButton');
        const registerButton = document.getElementById('registerButton');
        const logoutButton = document.getElementById('logoutButton');
        const userAvatar = document.getElementById('userAvatar');
        const userDropdown = document.getElementById('userDropdown');
        const loginModal = document.getElementById('loginModal');
        const registerModal = document.getElementById('registerModal');
        const googleLoginButton = document.getElementById('googleLoginButton');
        const googleRegisterButton = document.getElementById('googleRegisterButton');

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

        document.getElementById('registerForm')?.addEventListener('submit', (e) => {
            e.preventDefault();
            const email = document.getElementById('registerEmail').value;
            const password = document.getElementById('registerPassword').value;
            const city = document.getElementById('registerCity')?.value || '';
            const country = document.getElementById('registerCountry')?.value || '';
            const favoriteTcg = document.getElementById('registerFavoriteTcg')?.value || '';
            const displayName = email.split('@')[0];
            const handle = displayName.replace(/[^a-zA-Z0-9]/g, '');

            auth.createUserWithEmailAndPassword(email, password)
                .then(cred => {
                    const defaultPhotoURL = `https://ui-avatars.com/api/?name=${displayName.charAt(0)}&background=random&color=fff`;
                    cred.user.updateProfile({ displayName: displayName, photoURL: defaultPhotoURL });
                    return db.collection('users').doc(cred.user.uid).set({
                        displayName: displayName,
                        displayName_lower: displayName.toLowerCase(), // Added for searching
                        email: email,
                        photoURL: defaultPhotoURL,
                        city: city,
                        country: country,
                        favoriteTcg: favoriteTcg,
                        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                        handle: handle,
                        bio: "New HatakeSocial user!",
                        isAdmin: false
                    });
                })
                .then(() => closeModal(registerModal))
                .catch(err => alert(err.message));
        });

        const handleGoogleAuth = () => {
             auth.signInWithPopup(googleProvider).then(result => {
                const user = result.user;
                const userRef = db.collection('users').doc(user.uid);
                return userRef.get().then(doc => {
                    if (!doc.exists) {
                        const handle = user.email.split('@')[0].replace(/[^a-zA-Z0-9]/g, '');
                        return userRef.set({
                            displayName: user.displayName,
                            displayName_lower: user.displayName.toLowerCase(), // Added for searching
                            email: user.email,
                            photoURL: user.photoURL,
                            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                            handle: handle,
                            bio: "New HatakeSocial user!",
                            favoriteTcg: "Not set",
                            isAdmin: false
                        });
                    }
                });
            }).then(() => {
                closeModal(loginModal);
                closeModal(registerModal);
            }).catch(err => alert(err.message));
        };

        if (googleLoginButton) googleLoginButton.addEventListener('click', handleGoogleAuth);
        if (googleRegisterButton) googleRegisterButton.addEventListener('click', handleGoogleAuth);

        if (logoutButton) logoutButton.addEventListener('click', (e) => { e.preventDefault(); auth.signOut(); });
        if (userAvatar) userAvatar.addEventListener('click', () => userDropdown.classList.toggle('hidden'));

        if (headerSearchForm) {
            headerSearchForm.addEventListener('submit', (e) => {
                e.preventDefault();
                const searchBar = document.getElementById('searchBar');
                const query = searchBar.value.trim();
                if (query) {
                    window.location.href = `search.html?query=${encodeURIComponent(query)}`;
                }
            });
        }
    };

    // --- Auth State Controller ---
    auth.onAuthStateChanged(async (user) => {
        const loginButton = document.getElementById('loginButton');
        const registerButton = document.getElementById('registerButton');
        const userAvatar = document.getElementById('userAvatar');
        const userDropdown = document.getElementById('userDropdown');
        const sidebarUserInfo = document.getElementById('sidebar-user-info');

        const existingAdminLink = document.getElementById('admin-link-container');
        if (existingAdminLink) existingAdminLink.remove();

        if (user) {
            loginButton?.classList.add('hidden');
            registerButton?.classList.add('hidden');
            userAvatar?.classList.remove('hidden');

            try {
                const userDoc = await db.collection('users').doc(user.uid).get();
                if (userDoc.exists) {
                    const userData = userDoc.data();
                    const photo = userData.photoURL || 'https://i.imgur.com/B06rBhI.png';
                    const name = userData.displayName || 'User';
                    const handle = userData.handle || name.toLowerCase().replace(/\s/g, '');

                    if (userAvatar) userAvatar.src = photo;

                    if (sidebarUserInfo) {
                        sidebarUserInfo.classList.remove('hidden');
                        document.getElementById('sidebar-user-avatar').src = photo;
                        document.getElementById('sidebar-user-name').textContent = name;
                        document.getElementById('sidebar-user-handle').textContent = `@${handle}`;
                    }

                    if (userData.isAdmin === true && userDropdown) {
                        const adminLinkContainer = document.createElement('div');
                        adminLinkContainer.id = 'admin-link-container';
                        adminLinkContainer.innerHTML = `
                            <div class="border-t my-1 border-gray-200 dark:border-gray-600"></div>
                            <a href="admin.html" class="block px-4 py-2 text-red-600 dark:text-red-400 font-bold hover:bg-gray-100 dark:hover:bg-gray-600">
                                <i class="fas fa-user-shield mr-2"></i>Admin
                            </a>
                        `;
                        userDropdown.appendChild(adminLinkContainer);
                    }
                }
            } catch (error) {
                console.error("Error fetching user data:", error);
            }
        } else {
            loginButton?.classList.remove('hidden');
            registerButton?.classList.remove('hidden');
            userAvatar?.classList.add('hidden');
            userDropdown?.classList.add('hidden');
            sidebarUserInfo?.classList.add('hidden');
        }

        // **THE FIX**: Check if a page has registered an initialization function, and run it.
        if (window.HatakeSocial.pageInit && typeof window.HatakeSocial.pageInit === 'function') {
            try {
                // Pass the user object to the page's init function
                window.HatakeSocial.pageInit(user);
            } catch (error) {
                console.error("Error running page-specific script:", error);
            }
        }

        // Finally, make the body visible to prevent UI flash
        document.body.style.transition = 'opacity 0.3s ease-in-out';
        document.body.style.opacity = '1';
    });

    // --- Initial Call ---
    setupGlobalListeners();
});
