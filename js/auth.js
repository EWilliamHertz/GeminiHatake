/**
 * HatakeSocial - Core Authentication & UI Script (v18 - Correct Storage & Intl Merged)
 *
 * This script is included on EVERY page. It handles:
 * - All Login/Register Modal and Form logic.
 * - The main auth state listener that correctly updates the header UI.
 * - Firing a custom 'authReady' event that all other page-specific scripts listen for.
 * - FIX: Uses the correct `firebasestorage.app` URL for the storageBucket.
 * - NEW: Manages global currency selection and conversion.
 * - NEW: Injects a currency selector into the header.
 * - NEW: Adds City and Country to the registration form.
 */
document.addEventListener('DOMContentLoaded', () => {
    document.body.style.opacity = '0';

    const firebaseConfig = {
        apiKey: "AIzaSyD2Z9tCmmgReMG77ywXukKC_YIXsbP3uoU",
        authDomain: "hatakesocial-88b5e.firebaseapp.com",
        projectId: "hatakesocial-88b5e",
        storageBucket: "hatakesocial-88b5e.firebasestorage.app", // <-- CORRECTED
        messagingSenderId: "1091697032506",
        appId: "1:1091697032506:web:6a7cf9f10bd12650b22403"
    };

    if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
    }
    
    window.auth = firebase.auth();
    window.db = firebase.firestore();
    window.storage = firebase.storage();
    const googleProvider = new firebase.auth.GoogleAuthProvider();

    // --- Internationalization & Currency ---
    window.HatakeSocial = {
        // In a real app, these rates would be fetched from an API daily.
        // Rates are relative to SEK (Swedish Krona).
        conversionRates: {
            SEK: 1,
            USD: 0.095,
            EUR: 0.088,
        },
        // Get user's preferred currency from localStorage or default to SEK
        currentCurrency: localStorage.getItem('hatakeCurrency') || 'SEK',

        /**
         * Converts a price from a source currency to the user's currently selected currency.
         * @param {number} amount - The price amount.
         * @param {string} fromCurrency - The currency the price is stored in (e.g., 'USD').
         * @returns {string} - The formatted price string in the user's currency.
         */
        convertAndFormatPrice(amount, fromCurrency = 'SEK') {
            const toCurrency = this.currentCurrency;
            if (amount === undefined || amount === null || isNaN(amount)) {
                return `0.00 ${toCurrency}`;
            }

            // Find the SEK rate for the 'from' currency.
            const fromRate = this.conversionRates[fromCurrency];
            if (fromRate === undefined) {
                 console.error(`Unknown currency to convert from: ${fromCurrency}`);
                 return `N/A`;
            }

            // Convert the amount from its source currency to SEK first.
            const amountInSEK = amount / fromRate;
            
            // Now convert from SEK to the target currency.
            const toRate = this.conversionRates[toCurrency];
             if (toRate === undefined) {
                 console.error(`Unknown currency to convert to: ${toCurrency}`);
                 return `N/A`;
            }
            const convertedAmount = amountInSEK * toRate;

            return `${convertedAmount.toFixed(2)} ${toCurrency}`;
        }
    };

    const setupCurrencySelector = () => {
        const container = document.getElementById('currency-selector-container');
        if (!container) return;

        container.innerHTML = `
            <select id="currency-selector" class="text-sm rounded-md border-gray-300 dark:bg-gray-700 dark:border-gray-600 focus:ring-blue-500 focus:border-blue-500">
                <option value="SEK">SEK</option>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
            </select>
        `;
        const selector = document.getElementById('currency-selector');
        selector.value = window.HatakeSocial.currentCurrency;

        selector.addEventListener('change', (e) => {
            window.HatakeSocial.currentCurrency = e.target.value;
            localStorage.setItem('hatakeCurrency', e.target.value);
            // Reload the page to apply the new currency everywhere.
            window.location.reload();
        });
    };


    // --- Global UI & Auth Logic ---
    window.openModal = (modal) => { if (modal) modal.classList.add('open'); };
    window.closeModal = (modal) => { if (modal) modal.classList.remove('open'); };
    
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
                        displayName_lower: displayName.toLowerCase(),
                        email: email, photoURL: defaultPhotoURL,
                        city: city, country: country, favoriteTcg: favoriteTcg,
                        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                        handle: handle,
                        isAdmin: false,
                        primaryCurrency: 'SEK' // Default currency for new users
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
                            displayName_lower: user.displayName.toLowerCase(),
                            email: user.email, photoURL: user.photoURL,
                            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                            handle: handle, bio: "New HatakeSocial user!", favoriteTcg: "Not set", isAdmin: false, primaryCurrency: 'SEK'
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
        
        const event = new CustomEvent('authReady', { detail: { user } });
        document.dispatchEvent(event);

        document.body.style.transition = 'opacity 0.3s ease-in-out';
        document.body.style.opacity = '1';
    });
    
    setupGlobalListeners();
    setupCurrencySelector();
});
