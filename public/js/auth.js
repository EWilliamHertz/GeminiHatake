/**
* HatakeSocial - Merged Authentication & Global UI Script (v20 - Complete & Stable)
* - This is the complete, unabridged version of the global script.
* - Contains all helper functions for toasts, modals, and user interactions.
* - Manages user authentication state and dynamically updates all UI components.
* - Initializes all necessary Firebase services for the client-side application.
*/

// --- Firebase Initialization (Stable) ---
const firebaseConfig = {
  apiKey: "AIzaSyD2Z9tCmmgReMG77ywXukKC_YIXsbP3uoU",
  authDomain: "hatakesocial-88b5e.firebaseapp.com",
  projectId: "hatakesocial-88b5e",
  storageBucket: "hatakesocial-88b5e.appspot.com",
  messagingSenderId: "1091697032506",
  appId: "1:1091697032506:web:6a7cf9f10bd12650b22403",
  measurementId: "G-EH0PS2Z84J"
};

if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig); 
}
window.auth = firebase.auth();
window.db = firebase.firestore();
window.storage = firebase.storage();
window.functions = firebase.functions();

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


document.addEventListener('DOMContentLoaded', () => {
    document.body.style.opacity = '0';
    
    const googleProvider = new firebase.auth.GoogleAuthProvider();
    const loginModal = document.getElementById('loginModal');
    const registerModal = document.getElementById('registerModal');

    window.HatakeSocial = {
        conversionRates: { SEK: 1, USD: 0.095, EUR: 0.088 },
        currentCurrency: localStorage.getItem('hatakeCurrency') || 'SEK',
        currentUserData: null,
        convertAndFormatPrice(amount, fromCurrency = 'SEK') {
            const toCurrency = this.currentCurrency;
            if (amount === undefined || amount === null || isNaN(amount)) {
                return `0.00 ${toCurrency}`;
            }
            const fromRate = this.conversionRates[fromCurrency];
            if (fromRate === undefined) return `N/A`;
            const amountInSEK = amount / fromRate;
            const toRate = this.conversionRates[toCurrency];
            if (toRate === undefined) return `N/A`;
            const convertedAmount = amountInSEK * toRate;
            return `${convertedAmount.toFixed(2)} ${toCurrency}`;
        }
    };

    const setupCurrencySelector = () => {
        const container = document.getElementById('currency-selector-container');
        if (!container) return;

        container.innerHTML = `
        <label for="currency-selector" class="text-sm text-gray-600 dark:text-gray-400">Currency</label>
        <select id="currency-selector" class="text-sm rounded-md border-gray-300 dark:bg-gray-700 dark:border-gray-600 focus:ring-blue-500 focus:border-blue-500">
            <option value="SEK">SEK</option>
            <option value="USD">USD</option>
            <option value="EUR">EUR</option>
        </select>
        `;
        const selector = document.getElementById('currency-selector');
        if (selector) {
            selector.value = window.HatakeSocial.currentCurrency;
            selector.addEventListener('change', (e) => {
                window.HatakeSocial.currentCurrency = e.target.value;
                localStorage.setItem('hatakeCurrency', e.target.value);
                window.location.reload();
            });
        }
    };
    
    const setupGlobalListeners = () => {
        const headerSearchForm = document.querySelector('header form#header-search-form');
        const googleLoginButton = document.getElementById('googleLoginButton');
        const googleRegisterButton = document.getElementById('googleRegisterButton');
        const mobileMenuButton = document.getElementById('mobile-menu-button');
        const mobileMenu = document.getElementById('mobile-menu');
        const registerForm = document.getElementById('registerForm');

        document.getElementById('closeLoginModal')?.addEventListener('click', () => closeModal(loginModal));
        document.getElementById('closeRegisterModal')?.addEventListener('click', () => closeModal(registerModal));

        document.getElementById('loginForm')?.addEventListener('submit', (e) => {
            e.preventDefault();
            const email = document.getElementById('loginEmail').value;
            const password = document.getElementById('loginPassword').value;
            const errorMessageEl = document.getElementById('login-error-message');

            auth.signInWithEmailAndPassword(email, password)
                .then(() => {
                    window.location.href = 'app.html';
                })
                .catch(err => {
                    if (errorMessageEl) {
                        errorMessageEl.textContent = err.message;
                        errorMessageEl.classList.remove('hidden');
                    }
                });
        });

        if(registerForm) {
            registerForm.addEventListener('submit', (e) => {
                e.preventDefault();
                showTermsModal();
            });
        }

        const handleGoogleAuth = () => {
            auth.signInWithPopup(googleProvider)
                .then(() => {
                    window.location.href = 'app.html';
                })
                .catch(err => showToast(err.message, "error"));
        };

        if (googleLoginButton) googleLoginButton.addEventListener('click', handleGoogleAuth);
        if (googleRegisterButton) googleRegisterButton.addEventListener('click', handleGoogleAuth);

        if (mobileMenuButton && mobileMenu) {
            mobileMenuButton.addEventListener('click', () => {
                mobileMenu.classList.toggle('hidden');
            });
        }
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
        if (verificationTimer) {
            clearInterval(verificationTimer);
            verificationTimer = null;
        }

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
        const mobileUserActions = document.getElementById('mobile-user-actions');
        
        if (user) {
            const isIndexPage = window.location.pathname === '/' || window.location.pathname.endsWith('index.html');
            if (isIndexPage) {
                window.location.href = 'app.html';
                return;
            }

            closeModal(loginModal);
            closeModal(registerModal);

            const userDocRef = db.collection('users').doc(user.uid);
            let unsubscribeUserDoc = userDocRef.onSnapshot(async (doc) => {
                if (doc.exists) {
                    if (unsubscribeUserDoc) unsubscribeUserDoc();
                    
                    window.HatakeSocial.currentUserData = doc.data();
                    const userData = doc.data();
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
                            <div class="relative">
                                <button id="notification-bell-btn" class="text-gray-300 hover:text-indigo-400 text-xl"><i class="fas fa-bell"></i><span id="notification-count" class="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full h-4 w-4 flex items-center justify-center hidden">0</span></button>
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
                        authContainerSidebar.innerHTML = `<div class="flex items-center"><img src="${photoURL}" alt="User Avatar" class="w-10 h-10 rounded-full object-cover"><div class="ml-3"><p class="font-semibold text-gray-800 dark:text-white">${userData.displayName}</p><button id="logout-btn-sidebar" class="text-sm text-gray-500 hover:underline">Logout</button></div></div>`;
                        document.getElementById('logout-btn-sidebar').addEventListener('click', () => auth.signOut());
                    }
    
                    if (mobileUserActions) {
                        mobileUserActions.innerHTML = `<div class="flex items-center space-x-4 px-3 py-2"><img src="${photoURL}" alt="User Avatar" class="h-10 w-10 rounded-full border-2 border-blue-500 object-cover"><div><div class="font-medium text-base text-gray-800 dark:text-white">${userData.displayName}</div><div class="font-medium text-sm text-gray-500 dark:text-gray-400">${user.email}</div></div></div><div class="mt-3 space-y-1"><a href="profile.html" class="block px-3 py-2 rounded-md text-base font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700">Profile</a><a href="settings.html" class="block px-3 py-2 rounded-md text-base font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700">Settings</a><a href="#" id="mobileLogoutButton" class="block px-3 py-2 rounded-md text-base font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700">Logout</a></div>`;
                        document.getElementById('mobileLogoutButton').addEventListener('click', (e) => { e.preventDefault(); auth.signOut(); });
                    }
                    listenForAcceptedRequests(user);
                } else {
                    console.log("User document not found for uid:", user.uid);
                }
            }, (error) => {
                console.error("Error listening to user document:", error);
                showToast("Could not load your profile data.", "error");
            });

        } else { // User is logged out
            window.HatakeSocial.currentUserData = null;
            if (friendRequestHandshakeListener) friendRequestHandshakeListener();
            if (unsubscribeNotifications) unsubscribeNotifications();

            handleAdminAccess(false);

            const loginButtonsHTML = `
                <button id="header-login-btn" class="text-gray-300 hover:text-white transition-colors">Log In</button>
                <button id="header-register-btn" class="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-5 py-2 rounded-lg transition-colors">Sign Up Free</button>`;
            if (userActions) {
                userActions.innerHTML = loginButtonsHTML;
                document.getElementById('header-login-btn').addEventListener('click', () => openModal(loginModal));
                document.getElementById('header-register-btn').addEventListener('click', () => openModal(registerModal));
            }
            if (authContainerSidebar) {
                authContainerSidebar.innerHTML = loginButtonsHTML.replace('header-login-btn', 'sidebar-login-btn').replace('header-register-btn', 'sidebar-register-btn');
                document.getElementById('sidebar-login-btn').addEventListener('click', () => openModal(loginModal));
                document.getElementById('sidebar-register-btn').addEventListener('click', () => openModal(registerModal));
            }
            if (mobileUserActions) {
                mobileUserActions.innerHTML = `<div class="space-y-2"><button id="mobileLoginButton" class="w-full text-left block px-3 py-2 rounded-md text-base font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700">Login</button><button id="mobileRegisterButton" class="w-full text-left block px-3 py-2 rounded-md text-base font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700">Register</button></div>`;
                document.getElementById('mobileLoginButton').addEventListener('click', () => openModal(loginModal));
                document.getElementById('mobileRegisterButton').addEventListener('click', () => openModal(registerModal));
            }
        }
        document.dispatchEvent(new CustomEvent('authReady', { detail: { user } }));
        document.body.style.transition = 'opacity 0.3s ease-in-out';
        document.body.style.opacity = '1';
    });
    
    setupGlobalListeners();
    setupCurrencySelector();

    window.addEventListener('click', () => {
        document.getElementById('profile-dropdown')?.classList.add('hidden');
        document.getElementById('notification-dropdown')?.classList.add('hidden');
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
            window.location.href = 'app.html';
        } catch (err) {
            if (errorMessageEl) {
                errorMessageEl.textContent = err.message;
                errorMessageEl.classList.remove('hidden');
            } else {
                showToast(err.message, "error");
            }
            termsModal.remove();
        }
    });
}