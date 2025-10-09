/**
* HatakeSocial - Merged Authentication & Global UI Script (v35 - UI Consistency Fix)
* - FIX: Ensures the Dark Mode toggle and Currency Selector are always visible, regardless of login state.
* - RE-INTEGRATE: Restores the currency selector functionality from the previous version.
* - RESTRUCTURE: Initializes UI components after authentication state is confirmed to prevent elements from being overwritten.
*/

// --- Firebase Initialization (Stable & Global) ---
const firebaseConfig = {
    apiKey: "AIzaSyD2Z9tCmmgReMG77ywXukKC_YIXsbP3uoU",
    authDomain: "hatakesocial-88b5e.firebaseapp.com",
    projectId: "hatakesocial-88b5e",
    storageBucket: "hatakesocial-88b5e.appspot.com",
    messagingSenderId: "1091697032506",
    appId: "1:1091697032506:web:6a7cf9f10bd12650b22403",
    measurementId: "G-EH0PS2Z84J"
};

// Initialize Firebase and expose services globally for other scripts to use
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
} catch (error) {
    console.warn('Firebase initialization warning:', error.message);
}


// --- Dark Mode Functionality (Integrated) ---
const DarkMode = {
    init: function() {
        // Apply theme on initial load
        if (localStorage.theme === 'dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }

        // Add a toggle button if it doesn't exist
        this.addToggleButton();

        // Listen for clicks on the toggle button
        const toggle = document.getElementById('dark-mode-toggle');
        if (toggle) {
            toggle.addEventListener('click', () => {
                const isDark = document.documentElement.classList.toggle('dark');
                localStorage.theme = isDark ? 'dark' : 'light';
                this.updateIcon(isDark);
            });
        }
    },
    addToggleButton: function() {
        let toggle = document.getElementById('dark-mode-toggle');
        if (!toggle) {
            toggle = document.createElement('button');
            toggle.id = 'dark-mode-toggle';
            toggle.className = 'text-gray-600 dark:text-gray-300 hover:text-blue-500 dark:hover:text-blue-400 text-xl p-2';
            // Insert it into the user actions container
            const userActions = document.getElementById('user-actions');
            if (userActions) {
                 userActions.insertAdjacentElement('afterbegin', toggle);
            }
        }
        this.updateIcon(document.documentElement.classList.contains('dark'));
    },
    updateIcon: function(isDark) {
        const toggle = document.getElementById('dark-mode-toggle');
        if(toggle) {
             toggle.innerHTML = isDark ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
        }
    }
};

// --- Global Toast Notification Function ---
const showToast = (message, type = 'info') => {
    let container = document.getElementById('toast-container');
    if (!container) {
        const toastContainer = document.createElement('div');
        toastContainer.id = 'toast-container';
        toastContainer.className = 'fixed bottom-5 right-5 z-[1003]';
        document.body.appendChild(toastContainer);
        container = toastContainer;
    }
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    let iconClass = 'fa-info-circle';
    if (type === 'success') iconClass = 'fa-check-circle';
    if (type === 'error') iconClass = 'fa-exclamation-circle';

    toast.innerHTML = `<i class="fas ${iconClass} toast-icon"></i> <p>${message}</p>`;
    container.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('show');
    }, 100);

    setTimeout(() => {
        toast.classList.remove('show');
        toast.addEventListener('transitionend', () => toast.remove());
    }, 5000);
};
window.showToast = showToast; // Make globally accessible

// --- Global Modal Helper Functions ---
window.openModal = (modal) => {
    if (modal) {
        modal.classList.remove('hidden');
        modal.classList.add('flex');
        const errorMsg = modal.querySelector('[id$="-error-message"]');
        if (errorMsg) {
            errorMsg.classList.add('hidden');
            errorMsg.textContent = '';
        }
    }
};
window.closeModal = (modal) => {
    if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }
};

// --- New Conversation Modal ---
window.openNewConversationModal = (isWidget = false, callback) => {
    const existingModal = document.getElementById('new-conversation-modal');
    if (existingModal) existingModal.remove();

    const modal = document.createElement('div');
    modal.id = 'new-conversation-modal';
    modal.className = 'fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[1002]';
    modal.innerHTML = `
        <div class="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md flex flex-col" style="height: 70vh; max-height: 500px;">
            <div class="flex justify-between items-center p-4 border-b dark:border-gray-700">
                <h2 class="text-xl font-bold">New Message</h2>
                <button id="close-new-convo-modal" class="text-gray-500 hover:text-gray-800 dark:hover:text-white text-2xl font-bold">&times;</button>
            </div>
            <div class="p-4">
                <input type="text" id="user-search-input" placeholder="Search for a user..." class="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500">
            </div>
            <div id="user-search-results" class="flex-grow overflow-y-auto p-4 space-y-2">
                <p class="text-center text-gray-500">Start typing to find users.</p>
            </div>
        </div>
    `;
    document.body.appendChild(modal);

    const searchInput = modal.querySelector('#user-search-input');
    const searchResultsContainer = modal.querySelector('#user-search-results');
    const closeModalBtn = modal.querySelector('#close-new-convo-modal');

    closeModalBtn.addEventListener('click', () => modal.remove());
    modal.addEventListener('click', (e) => {
        if (e.target.id === 'new-conversation-modal') modal.remove();
    });

    let searchTimeout;
    searchInput.addEventListener('input', () => {
        clearTimeout(searchTimeout);
        const query = searchInput.value.trim().toLowerCase();
        if (query.length < 2) {
            searchResultsContainer.innerHTML = '<p class="text-center text-gray-500">Enter at least 2 characters.</p>';
            return;
        }

        searchResultsContainer.innerHTML = '<p class="text-center text-gray-500">Searching...</p>';
        searchTimeout = setTimeout(async () => {
            try {
                const currentUser = firebase.auth().currentUser;
                if (!currentUser) return;
                const usersRef = firebase.firestore().collection('users');
                const snapshot = await usersRef.where('displayName_lower', '>=', query).where('displayName_lower', '<=', query + '\uf8ff').limit(10).get();

                searchResultsContainer.innerHTML = '';
                if (snapshot.empty) {
                    searchResultsContainer.innerHTML = '<p class="text-center text-gray-500">No users found.</p>';
                } else {
                    snapshot.forEach(doc => {
                        const userData = doc.data();
                        if (doc.id === currentUser.uid) return;

                        const userElement = document.createElement('div');
                        userElement.className = 'flex items-center p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer';
                        userElement.innerHTML = `
                            <img src="${userData.photoURL || 'https://i.imgur.com/B06rBhI.png'}" alt="${userData.displayName}" class="w-10 h-10 rounded-full object-cover mr-3">
                            <div>
                                <p class="font-semibold">${userData.displayName}</p>
                                <p class="text-sm text-gray-500">@${userData.handle || 'N/A'}</p>
                            </div>`;
                        userElement.addEventListener('click', () => {
                            if (callback) callback(doc.id, userData);
                            modal.remove();
                        });
                        searchResultsContainer.appendChild(userElement);
                    });
                }
            } catch (error) {
                console.error("Error searching for users:", error);
                searchResultsContainer.innerHTML = '<p class="text-center text-red-500">Error searching for users.</p>';
            }
        }, 500);
    });
};


document.addEventListener('DOMContentLoaded', async () => {
     // Import the currency module
    const { initCurrency, updateUserCurrency, getUserCurrency, loadUserCurrency } = await import('./modules/currency.js');

    document.body.style.opacity = '0'; // Hide body until ready

    const auth = window.auth;
    const db = window.db;

    const googleProvider = new firebase.auth.GoogleAuthProvider();
    const loginModal = document.getElementById('loginModal');
    const registerModal = document.getElementById('registerModal');
    
    // --- CURRENCY SELECTOR LOGIC ---
    const setupCurrencySelector = () => {
        const container = document.getElementById('user-actions');
        if (!container) return;

        let currencySelectorContainer = document.getElementById('currency-selector-container');
        if (!currencySelectorContainer) {
            currencySelectorContainer = document.createElement('div');
            currencySelectorContainer.id = 'currency-selector-container';
            currencySelectorContainer.className = 'relative flex items-center';
            // Add it right after the dark mode toggle
            const darkModeButton = document.getElementById('dark-mode-toggle');
            if (darkModeButton) {
                darkModeButton.insertAdjacentElement('afterend', currencySelectorContainer);
            } else {
                container.insertAdjacentElement('afterbegin', currencySelectorContainer);
            }
        }

        currencySelectorContainer.innerHTML = `
            <select id="currency-selector" class="bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="USD">USD</option>
                <option value="SEK">SEK</option>
                <option value="EUR">EUR</option>
                <option value="GBP">GBP</option>
                <option value="NOK">NOK</option>
                <option value="DKK">DKK</option>
            </select>
        `;

        const selector = document.getElementById('currency-selector');
        if (selector) {
            selector.value = getUserCurrency();
            selector.addEventListener('change', async (e) => {
                const newCurrency = e.target.value;
                try {
                    await updateUserCurrency(newCurrency);
                    showToast(`Currency changed to ${newCurrency}`, 'success');
                    document.dispatchEvent(new CustomEvent('currencyChanged', { detail: { currency: newCurrency } }));
                } catch (error) {
                    showToast('Could not save currency preference.', 'error');
                    console.error('Error updating currency:', error);
                }
            });
        }
    };


    const setupHeaderSearch = () => {
        const searchBar = document.getElementById('main-search-bar');
        if (searchBar) {
            searchBar.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    const query = searchBar.value.trim();
                    if (query) {
                        window.location.href = `search.html?query=${encodeURIComponent(query)}`;
                    }
                }
            });
        }
    };

    const setupGlobalListeners = () => {
        const googleLoginButton = document.getElementById('googleLoginButton');
        const googleRegisterButton = document.getElementById('googleRegisterButton');
        const registerForm = document.getElementById('registerForm');

        document.getElementById('closeLoginModal')?.addEventListener('click', () => closeModal(loginModal));
        document.getElementById('closeRegisterModal')?.addEventListener('click', () => closeModal(registerModal));

        document.getElementById('loginForm')?.addEventListener('submit', (e) => {
            e.preventDefault();
            const email = document.getElementById('loginEmail').value;
            const password = document.getElementById('loginPassword').value;
            const errorMessageEl = document.getElementById('login-error-message');

            auth.signInWithEmailAndPassword(email, password)
                .catch(err => {
                    if (errorMessageEl) {
                        errorMessageEl.textContent = err.message;
                        errorMessageEl.classList.remove('hidden');
                    }
                });
        });

        if (registerForm) {
            registerForm.addEventListener('submit', (e) => {
                e.preventDefault();
                showTermsModal();
            });
        }

        const handleGoogleAuth = () => {
            auth.signInWithPopup(googleProvider)
                .catch(err => showToast(err.message, "error"));
        };

        if (googleLoginButton) googleLoginButton.addEventListener('click', handleGoogleAuth);
        if (googleRegisterButton) googleRegisterButton.addEventListener('click', handleGoogleAuth);

        // Mobile navigation is now handled by the dedicated mobile-navigation.js module
        // The module auto-initializes and handles all hamburger menu functionality
        console.log('Mobile navigation will be handled by mobile-navigation.js module');
    };

    let friendRequestHandshakeListener = null;
    function listenForAcceptedRequests(user) {
        if (friendRequestHandshakeListener) {
            friendRequestHandshakeListener();
        }
        const sentRequestsRef = db.collection('friendRequests')
            .where('senderId', '==', user.uid)
            .where('status', '==', 'accepted');

        friendRequestHandshakeListener = sentRequestsRef.onSnapshot(async (snapshot) => {
            if (snapshot.empty) return;
            const batch = db.batch();
            const currentUserRef = db.collection('users').doc(user.uid);
            for (const doc of snapshot.docs) {
                const request = doc.data();
                batch.update(currentUserRef, { friends: firebase.firestore.FieldValue.arrayUnion(request.receiverId) });
                batch.delete(doc.ref);
            }
            await batch.commit().catch(err => console.error("Error in friend handshake:", err));
        });
    }

    function sanitizeHTML(str) {
        const temp = document.createElement('div');
        temp.textContent = str;
        return temp.innerHTML;
    }

    let unsubscribeNotifications = null;
    let verificationTimer = null;

    auth.onAuthStateChanged(async (user) => {
        let userData = null;

        if (verificationTimer) {
            clearInterval(verificationTimer);
            verificationTimer = null;
        }
        
        await initCurrency('USD');
        if (user) {
            const userDoc = await db.collection('users').doc(user.uid).get();
            if (userDoc.exists) {
                userData = userDoc.data();
            }
            
            // Load user's currency preference from Firestore
            await loadUserCurrency(user.uid);
            
            // --- MERGED TOUR TRIGGER ---
            const isNewUser = user.metadata.creationTime === user.metadata.lastSignInTime;
            if (isNewUser || sessionStorage.getItem('tour_step')) {
                if (!userData || !userData.hasCompletedTour) {
                    setTimeout(() => {
                        if (window.initAndStartTour) {
                            window.initAndStartTour(user);
                        } else {
                            console.error("Tour function not available. Make sure tour.js is loaded.");
                        }
                    }, 1500);
                }
            }
            // --- END OF TOUR TRIGGER ---
        }

        document.dispatchEvent(new CustomEvent('authReady', { detail: { user, userData } }));

        const mainSidebarNav = document.querySelector('#sidebar nav');
        const existingAdminSidebarLink = document.getElementById('admin-sidebar-link');
        if (existingAdminSidebarLink) {
            existingAdminSidebarLink.remove();
        }

        if (user && !user.emailVerified) {
            document.body.innerHTML = `
            <div class="flex items-center justify-center min-h-screen bg-gray-100 dark:bg-gray-900">
                <div class="p-8 bg-white dark:bg-gray-800 rounded-lg shadow-xl text-center max-w-lg mx-4">
                    <h1 class="text-2xl font-bold text-gray-800 dark:text-white mb-4">Please Verify Your Email</h1>
                    <p class="text-gray-600 dark:text-gray-400 mb-6">A verification link has been sent to <strong>${user.email}</strong>. Please check your inbox and spam folder.</p>
                    <div class="space-x-4">
                        <button id="resend-verification-btn" class="px-5 py-2 bg-blue-600 text-white font-semibold rounded-full hover:bg-blue-700">Resend Email</button>
                        <button onclick="firebase.auth().signOut()" class="px-5 py-2 bg-gray-600 text-white font-semibold rounded-full hover:bg-gray-700">Logout</button>
                    </div>
                </div>
            </div>`;
            document.getElementById('resend-verification-btn').addEventListener('click', () => {
                user.sendEmailVerification()
                    .then(() => showToast('A new verification email has been sent.', 'success'))
                    .catch(err => showToast('Error sending email: ' + err.message, 'error'));
            });
            verificationTimer = setInterval(async () => {
                await user.reload();
                if (user.emailVerified) {
                    clearInterval(verificationTimer);
                    window.location.reload();
                }
            }, 5000);
            document.body.style.opacity = '1';
            return;
        }

        const userActions = document.getElementById('user-actions');
        const authContainerSidebar = document.getElementById('auth-container-sidebar');

        if (user && userData) {
            const isIndexPage = window.location.pathname === '/' || window.location.pathname.endsWith('index.html');
            if (isIndexPage) {
                window.location.href = 'app.html';
                return;
            }

            closeModal(loginModal);
            closeModal(registerModal);

            const photoURL = userData.photoURL || 'https://i.imgur.com/B06rBhI.png';
            const idTokenResult = await user.getIdTokenResult(true);
            const isAdmin = idTokenResult.claims.admin === true;

            handleAdminAccess(isAdmin);

            if (isAdmin && mainSidebarNav && !document.getElementById('admin-sidebar-link')) {
                const adminLink = document.createElement('a');
                adminLink.id = 'admin-sidebar-link';
                adminLink.className = 'flex items-center px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-md font-bold';
                adminLink.href = 'admin.html';
                adminLink.innerHTML = `<i class="fas fa-user-shield w-6 text-center"></i><span class="ml-3">Admin Panel</span>`;
                mainSidebarNav.appendChild(adminLink);
            }

            if (userActions) {
                userActions.innerHTML = `
                    <button id="cart-btn" class="relative text-gray-600 dark:text-gray-300 hover:text-blue-500 dark:hover:text-blue-400 text-xl p-2">
                        <i class="fas fa-shopping-cart"></i>
                        <span id="cart-item-count" class="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full h-4 w-4 flex items-center justify-center hidden">0</span>
                    </button>
                    <div class="relative">
                        <button id="notification-bell-btn" class="text-gray-600 dark:text-gray-300 hover:text-blue-500 dark:hover:text-blue-400 text-xl p-2">
                            <i class="fas fa-bell"></i>
                            <span id="notification-count" class="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full h-4 w-4 flex items-center justify-center hidden">0</span>
                        </button>
                        <div id="notification-dropdown" class="absolute right-0 mt-2 w-80 bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg shadow-xl z-20 hidden">
                            <div class="p-3 font-bold border-b dark:border-gray-700">Notifications</div>
                            <div id="notification-list" class="max-h-96 overflow-y-auto"><p class="p-4 text-sm text-gray-500">No new notifications.</p></div>
                            <a href="notifications.html" class="block text-center p-2 text-sm text-blue-500 hover:bg-gray-100 dark:hover:bg-gray-700">View all</a>
                        </div>
                    </div>
                    <div class="relative">
                        <button id="profile-avatar-btn"><img src="${photoURL}" alt="User Avatar" class="w-10 h-10 rounded-full object-cover"></button>
                        <div id="profile-dropdown" class="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-xl z-20 hidden">
                            <a href="profile.html?uid=${user.uid}" class="block px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700">My Profile</a>
                            <a href="settings.html" class="block px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700">Settings</a>
                            ${isAdmin ? `<a href="admin.html" class="block px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700">Admin Panel</a>` : ''}
                            <hr class="border-gray-200 dark:border-gray-600">
                            <button id="logout-btn-dropdown" class="block w-full text-left px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700">Logout</button>
                        </div>
                    </div>`;
                
                DarkMode.init(); // Initialize dark mode button
                setupCurrencySelector(); // Initialize currency selector

                document.getElementById('notification-bell-btn').addEventListener('click', (e) => { e.stopPropagation(); document.getElementById('profile-dropdown').classList.add('hidden'); document.getElementById('notification-dropdown').classList.toggle('hidden'); });
                document.getElementById('profile-avatar-btn').addEventListener('click', (e) => { e.stopPropagation(); document.getElementById('notification-dropdown').classList.add('hidden'); document.getElementById('profile-dropdown').classList.toggle('hidden'); });
                document.getElementById('logout-btn-dropdown').addEventListener('click', () => auth.signOut());
            }

            if (unsubscribeNotifications) unsubscribeNotifications();
            unsubscribeNotifications = db.collection('users').doc(user.uid).collection('notifications').orderBy('timestamp', 'desc').onSnapshot(snapshot => {
                const unreadCount = snapshot.docs.filter(doc => !doc.data().isRead).length;
                const countEl = document.getElementById('notification-count');
                const listEl = document.getElementById('notification-list');
                if (countEl) { countEl.textContent = unreadCount; countEl.classList.toggle('hidden', unreadCount === 0); }
                if (listEl) {
                    if (snapshot.empty) { listEl.innerHTML = '<p class="p-4 text-sm text-gray-500">No new notifications.</p>'; }
                    else {
                        listEl.innerHTML = '';
                        snapshot.docs.slice(0, 5).forEach(doc => {
                            const notif = doc.data();
                            const el = document.createElement('a');
                            el.href = notif.link || '#';
                            el.className = `flex items-start p-3 hover:bg-gray-100 dark:hover:bg-gray-700 ${!notif.isRead ? 'bg-blue-50 dark:bg-blue-900/50' : ''}`;
                            el.innerHTML = `<div><p class="text-sm text-gray-700 dark:text-gray-300">${sanitizeHTML(notif.message)}</p><p class="text-xs text-gray-500">${new Date(notif.timestamp?.toDate()).toLocaleString()}</p></div>`;
                            el.addEventListener('click', () => db.collection('users').doc(user.uid).collection('notifications').doc(doc.id).update({ isRead: true }));
                            listEl.appendChild(el);
                        });
                    }
                }
            });

            if (authContainerSidebar) {
                authContainerSidebar.innerHTML = `<div class="flex items-center"><img src="${photoURL}" class="w-10 h-10 rounded-full object-cover"><div class="ml-3"><p class="font-semibold text-gray-800 dark:text-white">${userData.displayName}</p><button id="logout-btn-sidebar" class="text-sm text-gray-500 hover:underline">Logout</button></div></div>`;
                document.getElementById('logout-btn-sidebar').addEventListener('click', () => auth.signOut());
            }
            listenForAcceptedRequests(user);
        } else {
            if (friendRequestHandshakeListener) friendRequestHandshakeListener();
            if (unsubscribeNotifications) unsubscribeNotifications();
            handleAdminAccess(false);

            const loginButtonsHTML = `
                <button id="header-login-btn" class="px-4 py-2 bg-blue-600 text-white font-semibold rounded-full hover:bg-blue-700">Log In</button>
                <button id="header-register-btn" class="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 font-semibold rounded-full hover:bg-gray-300 dark:hover:bg-gray-600">Register</button>`;
            if (userActions) {
                userActions.innerHTML = `${loginButtonsHTML}`;
                DarkMode.init(); // Initialize dark mode button
                setupCurrencySelector(); // Initialize currency selector
                document.getElementById('header-login-btn').addEventListener('click', () => openModal(loginModal));
                document.getElementById('header-register-btn').addEventListener('click', () => openModal(registerModal));
            }
            if (authContainerSidebar) {
                authContainerSidebar.innerHTML = `<div class="space-y-2"><button id="sidebar-login-btn" class="w-full px-4 py-2 bg-blue-600 text-white font-semibold rounded-full hover:bg-blue-700">Log In</button><button id="sidebar-register-btn" class="w-full px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 font-semibold rounded-full hover:bg-gray-300 dark:hover:bg-gray-600">Register</button></div>`;
                document.getElementById('sidebar-login-btn').addEventListener('click', () => openModal(loginModal));
                document.getElementById('sidebar-register-btn').addEventListener('click', () => openModal(registerModal));
            }
        }
        document.body.style.opacity = '1';
    });

    setupGlobalListeners();
    setupHeaderSearch();

    window.addEventListener('click', () => {
        document.getElementById('profile-dropdown')?.classList.add('hidden');
        document.getElementById('notification-dropdown')?.classList.add('hidden');
    });

    document.addEventListener('currencyChanged', ({ detail }) => {
        const selector = document.getElementById('currency-selector');
        if (selector && detail.currency) selector.value = detail.currency;
    });
});

function handleAdminAccess(isAdmin) {
    const currentPage = window.location.pathname.split('/').pop();
    const adminPages = ['admin.html', 'create-article.html', 'edit-article.html'];
    if (adminPages.includes(currentPage) && !isAdmin) {
        window.location.href = 'index.html';
    }
}

async function showTermsModal() {
    const termsModal = document.createElement('div');
    termsModal.id = 'terms-modal';
    termsModal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[1002]';
    let termsContent = '<p>Loading...</p>', privacyContent = '<p>Loading...</p>';
    try {
        const [termsResponse, privacyResponse] = await Promise.all([fetch('terms.html'), fetch('privacy.html')]);
        termsContent = termsResponse.ok ? await termsResponse.text() : '<p>Could not load Terms of Service.</p>';
        privacyContent = privacyResponse.ok ? await privacyResponse.text() : '<p>Could not load Privacy Policy.</p>';
    } catch (error) {
        console.error('Error fetching legal documents:', error);
        termsContent = '<p>Error loading content.</p>';
    }

    termsModal.innerHTML = `
    <div class="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl flex flex-col" style="height: 90vh; max-height: 800px;">
        <div class="flex justify-between items-center p-4 border-b dark:border-gray-700">
            <h2 class="text-xl font-bold">Terms & Privacy</h2>
            <button id="close-terms-modal" class="text-gray-500 hover:text-gray-800 text-2xl">&times;</button>
        </div>
        <div id="terms-content" class="p-6 flex-grow overflow-y-auto">${termsContent}<hr class="my-8">${privacyContent}</div>
        <div class="p-6 border-t dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
            <label class="flex items-center"><input type="checkbox" id="terms-checkbox" class="h-4 w-4"><span class="ml-2">I have read and agree.</span></label>
            <button id="final-register-btn" disabled class="w-full mt-4 bg-blue-600 text-white font-semibold py-3 rounded-lg disabled:bg-gray-400">Register</button>
        </div>
    </div>`;
    document.body.appendChild(termsModal);
    const termsCheckbox = termsModal.querySelector('#terms-checkbox');
    const finalRegisterBtn = termsModal.querySelector('#final-register-btn');
    termsCheckbox.addEventListener('change', () => {
        finalRegisterBtn.disabled = !termsCheckbox.checked;
    });
    termsModal.querySelector('#close-terms-modal').addEventListener('click', () => termsModal.remove());
    finalRegisterBtn.addEventListener('click', async () => {
        const email = document.getElementById('registerEmail').value;
        const password = document.getElementById('registerPassword').value;
        const errorMessageEl = document.getElementById('register-error-message');
        try {
            const userCredential = await auth.createUserWithEmailAndPassword(email, password);
            await userCredential.user.sendEmailVerification();
            // Close the registration and terms modals after success
            closeModal(document.getElementById('registerModal'));
            termsModal.remove();
            showToast('Registration successful! Please check your email to verify your account.', 'success');
        } catch (err) {
            if (errorMessageEl) {
                errorMessageEl.textContent = err.message;
                errorMessageEl.classList.remove('hidden');
            } else {
                showToast(err.message, "error");
            }
        } finally {
            // This ensures the modal is removed even if there's an error
            if (document.body.contains(termsModal)) {
                 termsModal.remove();
            }
        }
    });
}

// --- Currency Selector Setup Function ---
function setupCurrencySelector() {
    const currencySelector = document.getElementById('currency-selector');
    if (!currencySelector) {
        console.warn('Currency selector element not found');
        return;
    }

    // Import currency functions dynamically
    import('./modules/currency.js').then(currencyModule => {
        // Set initial value from localStorage
        const savedCurrency = currencyModule.getUserCurrency();
        currencySelector.value = savedCurrency;

        // Add change event listener
        currencySelector.addEventListener('change', async (e) => {
            const newCurrency = e.target.value;
            try {
                await currencyModule.updateUserCurrency(newCurrency);
                
                // Trigger a custom event to notify other parts of the app
                document.dispatchEvent(new CustomEvent('currencyChanged', { 
                    detail: { currency: newCurrency } 
                }));
                
                // Show success message
                if (window.showToast) {
                    showToast(`Currency changed to ${newCurrency}`, 'success');
                }
                
                // Reload the page to update all prices
                setTimeout(() => {
                    window.location.reload();
                }, 1000);
                
            } catch (error) {
                console.error('Error updating currency:', error);
                if (window.showToast) {
                    showToast('Failed to update currency', 'error');
                }
                // Revert the selector to the previous value
                currencySelector.value = savedCurrency;
            }
        });

        // Listen for currency change events from other parts of the app
        document.addEventListener('currencyChanged', (event) => {
            if (event.detail && event.detail.currency) {
                currencySelector.value = event.detail.currency;
            }
        });

    }).catch(error => {
        console.error('Failed to load currency module:', error);
    });
}