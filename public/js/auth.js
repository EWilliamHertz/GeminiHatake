/**
* HatakeSocial - Complete Authentication & Global UI Script with Currency Integration
* - This is the complete, unabridged version of the global script with currency features added.
* - Contains all helper functions for toasts, modals, and user interactions.
* - Manages user authentication state and dynamically updates all UI components.
* - Includes currency initialization and management.
* - Preserves ALL original functionality while adding currency support.
*/

// Import currency module
import { initCurrency } from './modules/currency.js';

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

// --- Global State ---
let currentUser = null;
let userData = null;

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
                        userElement.className = 'flex items-center p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md cursor-pointer';
                        userElement.innerHTML = `
                            <img class="h-10 w-10 rounded-full mr-3" src="${userData.photoURL || 'https://placehold.co/40'}" alt="">
                            <div>
                                <p class="font-medium">${userData.displayName || 'Unknown User'}</p>
                                <p class="text-sm text-gray-500">${userData.handle ? '@' + userData.handle : userData.email}</p>
                            </div>
                        `;
                        userElement.addEventListener('click', () => {
                            modal.remove();
                            if (callback) callback(doc.id, userData);
                        });
                        searchResultsContainer.appendChild(userElement);
                    });
                }
            } catch (error) {
                console.error('Error searching users:', error);
                searchResultsContainer.innerHTML = '<p class="text-center text-red-500">Error searching users.</p>';
            }
        }, 300);
    });
};

// --- Messenger Widget Functions ---
window.toggleMessengerWidget = () => {
    const widget = document.getElementById('messenger-widget');
    if (!widget) return;
    
    const isHidden = widget.classList.contains('hidden');
    if (isHidden) {
        widget.classList.remove('hidden');
        loadConversations();
    } else {
        widget.classList.add('hidden');
    }
};

window.loadConversations = async () => {
    const currentUser = firebase.auth().currentUser;
    if (!currentUser) return;

    const conversationsContainer = document.getElementById('conversations-container');
    if (!conversationsContainer) return;

    try {
        const conversationsRef = firebase.firestore().collection('conversations');
        const snapshot = await conversationsRef.where('participants', 'array-contains', currentUser.uid).orderBy('lastUpdated', 'desc').get();

        conversationsContainer.innerHTML = '';
        if (snapshot.empty) {
            conversationsContainer.innerHTML = '<p class="text-center text-gray-500 p-4">No conversations yet.</p>';
            return;
        }

        snapshot.forEach(doc => {
            const convoData = doc.data();
            const otherUserId = convoData.participants.find(uid => uid !== currentUser.uid);
            const otherUserInfo = convoData.participantInfo[otherUserId];

            const convoElement = document.createElement('div');
            convoElement.className = 'flex items-center p-3 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer border-b dark:border-gray-600';
            convoElement.innerHTML = `
                <img class="h-10 w-10 rounded-full mr-3" src="${otherUserInfo?.photoURL || 'https://placehold.co/40'}" alt="">
                <div class="flex-grow">
                    <p class="font-medium">${otherUserInfo?.displayName || 'Unknown User'}</p>
                    <p class="text-sm text-gray-500 truncate">${convoData.lastMessage || 'No messages yet'}</p>
                </div>
            `;
            convoElement.addEventListener('click', () => {
                window.location.href = `messages.html?conversation=${doc.id}`;
            });
            conversationsContainer.appendChild(convoElement);
        });
    } catch (error) {
        console.error('Error loading conversations:', error);
        conversationsContainer.innerHTML = '<p class="text-center text-red-500 p-4">Error loading conversations.</p>';
    }
};

// --- Shopping Cart Functions ---
window.updateCartCount = async () => {
    const currentUser = firebase.auth().currentUser;
    if (!currentUser) return;

    const cartBadge = document.getElementById('cart-badge');
    if (!cartBadge) return;

    try {
        const cartRef = firebase.firestore().collection('users').doc(currentUser.uid).collection('cart');
        const snapshot = await cartRef.get();
        const totalItems = snapshot.docs.reduce((sum, doc) => sum + (doc.data().quantity || 1), 0);
        
        if (totalItems > 0) {
            cartBadge.textContent = totalItems;
            cartBadge.classList.remove('hidden');
        } else {
            cartBadge.classList.add('hidden');
        }
    } catch (error) {
        console.error('Error updating cart count:', error);
    }
};

// --- Notification Functions ---
window.updateNotificationCount = async () => {
    const currentUser = firebase.auth().currentUser;
    if (!currentUser) return;

    const notificationBadge = document.getElementById('notification-badge');
    if (!notificationBadge) return;

    try {
        const notificationsRef = firebase.firestore().collection('users').doc(currentUser.uid).collection('notifications');
        const snapshot = await notificationsRef.where('isRead', '==', false).get();
        const unreadCount = snapshot.size;
        
        if (unreadCount > 0) {
            notificationBadge.textContent = unreadCount;
            notificationBadge.classList.remove('hidden');
        } else {
            notificationBadge.classList.add('hidden');
        }
    } catch (error) {
        console.error('Error updating notification count:', error);
    }
};

// --- Header Search Functionality ---
window.initializeHeaderSearch = () => {
    const searchInput = document.getElementById('header-search-input');
    const searchButton = document.getElementById('header-search-button');
    
    if (!searchInput || !searchButton) return;

    const performSearch = () => {
        const query = searchInput.value.trim();
        if (query) {
            window.location.href = `marketplace.html?search=${encodeURIComponent(query)}`;
        }
    };

    searchButton.addEventListener('click', performSearch);
    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            performSearch();
        }
    });
};

// --- Dark Mode Toggle ---
window.toggleDarkMode = () => {
    const html = document.documentElement;
    const isDark = html.classList.contains('dark');
    
    if (isDark) {
        html.classList.remove('dark');
        localStorage.setItem('darkMode', 'false');
    } else {
        html.classList.add('dark');
        localStorage.setItem('darkMode', 'true');
    }
};

// --- Mobile Menu Toggle ---
window.toggleMobileMenu = () => {
    const mobileMenu = document.getElementById('mobile-menu');
    if (mobileMenu) {
        mobileMenu.classList.toggle('hidden');
    }
};

// --- User Menu Toggle ---
window.setupUserMenuToggle = () => {
    const userMenuBtn = document.getElementById('user-menu-btn');
    const userDropdown = document.getElementById('user-dropdown');
    
    if (userMenuBtn && userDropdown) {
        userMenuBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            userDropdown.classList.toggle('hidden');
        });
        
        // Close dropdown when clicking outside
        document.addEventListener('click', () => {
            userDropdown.classList.add('hidden');
        });
        
        // Prevent dropdown from closing when clicking inside it
        userDropdown.addEventListener('click', (e) => {
            e.stopPropagation();
        });
    }
};

// --- Authentication Functions ---
window.signOut = async () => {
    try {
        await firebase.auth().signOut();
        showToast('Signed out successfully', 'success');
        window.location.href = 'index.html';
    } catch (error) {
        console.error('Error signing out:', error);
        showToast('Error signing out', 'error');
    }
};

window.signInWithEmail = async (email, password) => {
    try {
        const userCredential = await firebase.auth().signInWithEmailAndPassword(email, password);
        return userCredential.user;
    } catch (error) {
        console.error('Error signing in:', error);
        throw error;
    }
};

window.signUpWithEmail = async (email, password, displayName) => {
    try {
        const userCredential = await firebase.auth().createUserWithEmailAndPassword(email, password);
        
        // Update user profile
        await userCredential.user.updateProfile({
            displayName: displayName
        });
        
        return userCredential.user;
    } catch (error) {
        console.error('Error signing up:', error);
        throw error;
    }
};

// --- UI Update Functions ---
function updateUIForAuthenticatedUser(user) {
    const userActionsContainer = document.getElementById('user-actions');
    const sidebarUserInfo = document.getElementById('sidebar-user-info');
    
    if (userActionsContainer) {
        userActionsContainer.innerHTML = `
            <div class="flex items-center space-x-4">
                <button class="relative text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white" onclick="window.location.href='cart.html'">
                    <i class="fas fa-shopping-cart text-xl"></i>
                    <span class="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center hidden" id="cart-badge">0</span>
                </button>
                
                <button class="relative text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white" onclick="window.location.href='notifications.html'">
                    <i class="fas fa-bell text-xl"></i>
                    <span class="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center hidden" id="notification-badge">0</span>
                </button>
                
                <div class="relative" id="user-menu">
                    <button class="flex items-center space-x-2 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white" id="user-menu-btn">
                        <img class="h-8 w-8 rounded-full object-cover" src="${userData?.photoURL || user.photoURL || 'https://placehold.co/32x32'}" alt="Profile">
                        <span class="hidden md:block">${userData?.displayName || user.displayName || 'User'}</span>
                        <i class="fas fa-chevron-down text-sm"></i>
                    </button>
                    
                    <div class="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-md shadow-lg py-1 z-50 hidden" id="user-dropdown">
                        <a href="profile.html" class="block px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700">
                            <i class="fas fa-user mr-2"></i>Profile
                        </a>
                        <a href="collection.html" class="block px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700">
                            <i class="fas fa-layer-group mr-2"></i>Collection
                        </a>
                        <a href="settings.html" class="block px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700">
                            <i class="fas fa-cog mr-2"></i>Settings
                        </a>
                        <div class="border-t border-gray-200 dark:border-gray-600"></div>
                        <button onclick="signOut()" class="block w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700">
                            <i class="fas fa-sign-out-alt mr-2"></i>Sign Out
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        // Setup user menu toggle
        setupUserMenuToggle();
        
        // Update cart and notification counts
        updateCartCount();
        updateNotificationCount();
    }
    
    if (sidebarUserInfo) {
        sidebarUserInfo.classList.remove('hidden');
        sidebarUserInfo.innerHTML = `
            <div class="flex items-center space-x-3">
                <img class="h-10 w-10 rounded-full object-cover" src="${userData?.photoURL || user.photoURL || 'https://placehold.co/40x40'}" alt="Profile">
                <div class="flex-1 min-w-0">
                    <p class="text-sm font-medium text-gray-900 dark:text-white truncate">
                        ${userData?.displayName || user.displayName || 'User'}
                    </p>
                    <p class="text-xs text-gray-500 dark:text-gray-400 truncate">
                        ${userData?.handle ? '@' + userData.handle : user.email}
                    </p>
                </div>
            </div>
        `;
    }

    // Show messenger widget if enabled
    const messengerWidget = document.getElementById('messenger-widget');
    if (messengerWidget && userData?.messengerWidgetVisible !== false) {
        messengerWidget.classList.remove('hidden');
    }
}

function updateUIForUnauthenticatedUser() {
    const userActionsContainer = document.getElementById('user-actions');
    const sidebarUserInfo = document.getElementById('sidebar-user-info');
    const messengerWidget = document.getElementById('messenger-widget');
    
    if (userActionsContainer) {
        userActionsContainer.innerHTML = `
            <div class="flex items-center space-x-4">
                <a href="login.html" class="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white">
                    Sign In
                </a>
                <a href="register.html" class="bg-blue-600 text-white px-4 py-2 rounded-full hover:bg-blue-700">
                    Sign Up
                </a>
            </div>
        `;
    }
    
    if (sidebarUserInfo) {
        sidebarUserInfo.classList.add('hidden');
    }

    if (messengerWidget) {
        messengerWidget.classList.add('hidden');
    }
}

// --- Load User Data Function ---
async function loadUserData(user) {
    try {
        const userDoc = await firebase.firestore().collection('users').doc(user.uid).get();
        
        if (userDoc.exists) {
            userData = userDoc.data();
        } else {
            // Create default user document
            userData = {
                displayName: user.displayName || '',
                email: user.email || '',
                photoURL: user.photoURL || '',
                primaryCurrency: 'USD',
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            };
            
            await firebase.firestore().collection('users').doc(user.uid).set(userData);
        }
        
        // Store user data globally for other scripts
        window.HatakeSocial = window.HatakeSocial || {};
        window.HatakeSocial.currentUser = user;
        window.HatakeSocial.currentUserData = userData;
        
    } catch (error) {
        console.error('Error loading user data:', error);
        throw error;
    }
}

// --- Firebase Auth State Listener ---
firebase.auth().onAuthStateChanged(async (user) => {
    currentUser = user;
    
    if (user) {
        try {
            // Load user data from Firestore
            await loadUserData(user);
            
            // Initialize currency system with user's preference
            await initCurrency(userData?.primaryCurrency || 'USD');
            
            // Update UI for authenticated user
            updateUIForAuthenticatedUser(user);
            
        } catch (error) {
            console.error('Error during authentication setup:', error);
            // Fallback to default currency if there's an error
            await initCurrency('USD');
        }
    } else {
        // User is signed out
        userData = null;
        
        // Initialize currency system with default USD
        await initCurrency('USD');
        
        // Update UI for unauthenticated user
        updateUIForUnauthenticatedUser();
    }
    
    // Dispatch event to let other scripts know auth (and currency) is ready
    document.dispatchEvent(new CustomEvent('authReady', { 
        detail: { user, userData } 
    }));
});

// --- Initialize Dark Mode ---
document.addEventListener('DOMContentLoaded', () => {
    const darkMode = localStorage.getItem('darkMode');
    if (darkMode === 'true') {
        document.documentElement.classList.add('dark');
    }
    
    // Initialize header search
    initializeHeaderSearch();
});

// --- Export functions for global use ---
window.showToast = showToast;
window.getCurrentUser = () => currentUser;
window.getCurrentUserData = () => userData;

// Export for module use
export {
    showToast,
    signOut,
    signInWithEmail,
    signUpWithEmail,
    getCurrentUser: () => currentUser,
    getCurrentUserData: () => userData
};

