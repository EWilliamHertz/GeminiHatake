document.addEventListener('DOMContentLoaded', () => {
    const db = firebase.firestore();
    const auth = firebase.auth();

    // Main Widget Elements
    const widgetContainer = document.getElementById('messenger-widget-container');

    // Visibility logic based on user settings
    if (widgetContainer) {
        const isVisible = localStorage.getItem('messengerWidget-visible');
        // Default to hidden if not set or explicitly set to false
        if (isVisible === 'false' || isVisible === null) {
            widgetContainer.classList.add('hidden');
        } else {
            widgetContainer.classList.remove('hidden');
        }
    }

    if (!widgetContainer) return;

    const openBtn = document.getElementById('messenger-open-btn');
    const widgetHeader = document.getElementById('messenger-widget-header');
    const toggleIcon = document.getElementById('widget-toggle-icon');

    // View Containers
    const listView = document.getElementById('widget-list-view');
    const chatView = document.getElementById('widget-chat-view');

    // Conversation List Elements
    const conversationsList = document.getElementById('widget-conversations-list');

    // Active Chat Elements
    const backBtn = document.getElementById('widget-back-btn');
    const chatHeaderName = document.getElementById('widget-chat-name');
    const chatHeaderAvatar = document.getElementById('widget-chat-avatar');
    const messagesContainer = document.getElementById('widget-messages-container');
    const messageForm = document.getElementById('widget-message-form');
    const messageInput = document.getElementById('widget-message-input');

    let currentUser = null;
    let conversationsUnsubscribe = null;
    let messagesUnsubscribe = null;

    // --- UTILITY FUNCTIONS ---
    const formatTimestamp = (timestamp) => {
        if (!timestamp || typeof timestamp.toDate !== 'function') return '';
        return timestamp.toDate().toLocaleString();
    };

    // --- VIEW MANAGEMENT ---
    const showListView = () => {
        if (messagesUnsubscribe) messagesUnsubscribe(); // Stop listening to old messages
        messagesUnsubscribe = null;
        if (chatView) chatView.classList.add('hidden');
        if (listView) listView.classList.remove('hidden');
    };

    const showChatView = () => {
        if (listView) listView.classList.add('hidden');
        if (chatView) chatView.classList.remove('hidden');
    };

    // --- DATA FETCHING & RENDERING ---
    const renderMessages = (messages) => {
        if (!messagesContainer || !currentUser) return;
        messagesContainer.innerHTML = messages.map(msg => {
            const isSender = msg.senderId === currentUser.uid;
            return `
                <div class="flex ${isSender ? 'justify-end' : 'justify-start'}">
                    <div class="max-w-[75%] p-2 rounded-lg text-sm ${isSender ? 'bg-blue-500 text-white' : 'bg-gray-200 dark:bg-gray-600'}">
                        <p>${msg.text}</p>
                    </div>
                </div>
            `;
        }).join('');
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    };

    const openConversation = async (conversationId) => {
        if (!currentUser) return;
        showChatView();
        messagesContainer.innerHTML = '<p class="text-center text-gray-500">Loading messages...</p>';

        const convDoc = await db.collection('conversations').doc(conversationId).get();
        const convData = convDoc.data();
        const otherUserId = convData.participants.find(p => p !== currentUser.uid);

        const userDoc = await db.collection('users').doc(otherUserId).get();
        const userData = userDoc.data();

        chatHeaderName.textContent = userData.displayName || 'Chat';
        chatHeaderAvatar.src = userData.profilePic || 'https://placehold.co/32x32';

        if (messagesUnsubscribe) messagesUnsubscribe();
        messagesUnsubscribe = db.collection('conversations').doc(conversationId).collection('messages')
            .orderBy('timestamp', 'asc')
            .onSnapshot(snapshot => {
                const messages = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                renderMessages(messages);
            });
        
        messageForm.dataset.conversationId = conversationId;
    };

    const renderConversations = (conversations) => {
        if (!conversationsList || !currentUser) return;
        if (conversations.length === 0) {
            conversationsList.innerHTML = '<p class="p-4 text-center text-gray-500">No conversations yet.</p>';
            return;
        }
        conversationsList.innerHTML = conversations.map(conv => `
            <div class="conversation-item p-3 border-b border-gray-200 dark:border-gray-700 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center space-x-3" data-id="${conv.id}">
                <img src="${conv.otherUser.profilePic || 'https://placehold.co/40x40'}" alt="Avatar" class="w-10 h-10 rounded-full object-cover flex-shrink-0">
                <div class="overflow-hidden">
                    <p class="font-semibold truncate">${conv.otherUser.displayName || 'User'}</p>
                    <p class="text-sm text-gray-500 truncate">${conv.data.lastMessage || 'No messages yet.'}</p>
                </div>
            </div>
        `).join('');
    };

    const loadConversations = () => {
        if (!currentUser) return;
        if (conversationsUnsubscribe) conversationsUnsubscribe();

        conversationsUnsubscribe = db.collection('conversations')
            .where('participants', 'array-contains', currentUser.uid)
            .orderBy('lastUpdated', 'desc')
            .onSnapshot(async (snapshot) => {
                const promises = snapshot.docs.map(async (doc) => {
                    const data = doc.data();
                    const otherUserId = data.participants.find(p => p !== currentUser.uid);
                    if (!otherUserId) return null;
                    const userDoc = await db.collection('users').doc(otherUserId).get();
                    return {
                        id: doc.id,
                        data,
                        otherUser: userDoc.exists ? userDoc.data() : {}
                    };
                });
                const conversations = (await Promise.all(promises)).filter(Boolean);
                renderConversations(conversations);
            });
    };
    
    // --- EVENT LISTENERS ---
    auth.onAuthStateChanged(user => {
        currentUser = user;
        if (conversationsUnsubscribe) conversationsUnsubscribe();
        if (messagesUnsubscribe) messagesUnsubscribe();

        if (currentUser) {
            loadConversations();
            // Attach new conversation logic
            initializeNewConversationLogic(currentUser);
        } else {
            conversationsList.innerHTML = '<p class="p-4 text-center text-gray-500">Please log in to chat.</p>';
        }
    });

    // Open/close widget
    widgetHeader.addEventListener('click', () => widgetContainer.classList.toggle('minimized'));
    openBtn.addEventListener('click', () => widgetContainer.classList.remove('minimized'));
    
    // Go back from active chat to list
    backBtn.addEventListener('click', showListView);

    // Open conversation from list (event delegation)
    conversationsList.addEventListener('click', (e) => {
        const conversationItem = e.target.closest('.conversation-item');
        if (conversationItem && conversationItem.dataset.id) {
            openConversation(conversationItem.dataset.id);
        }
    });

    // Send message
    messageForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const conversationId = e.currentTarget.dataset.conversationId;
        const text = messageInput.value.trim();
        if (!text || !conversationId || !currentUser) return;

        messageInput.value = '';

        const batch = db.batch();
        const messageRef = db.collection('conversations').doc(conversationId).collection('messages').doc();
        batch.set(messageRef, {
            text: text,
            senderId: currentUser.uid,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });

        const conversationRef = db.collection('conversations').doc(conversationId);
        batch.update(conversationRef, {
            lastMessage: text,
            lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
        });

        await batch.commit();
    });

    // New conversation logic (adapted from previous step)
    function initializeNewConversationLogic(currentUser) {
        const newConversationModal = document.getElementById('new-conversation-modal');
        const userSearchInput = document.getElementById('user-search-input');
        const userSearchResults = document.getElementById('user-search-results');
        const widgetNewConversationBtn = document.getElementById('widget-new-conversation-btn');
        const closeModalBtns = document.querySelectorAll('.close-modal-btn');

        if (widgetNewConversationBtn) {
            widgetNewConversationBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (newConversationModal) newConversationModal.classList.remove('hidden');
            });
        }
        
        closeModalBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                if (newConversationModal) newConversationModal.classList.add('hidden');
            });
        });

        let searchTimeout;
        if (userSearchInput) {
            userSearchInput.addEventListener('input', () => {
                clearTimeout(searchTimeout);
                searchTimeout = setTimeout(() => {
                    const searchTerm = userSearchInput.value.trim();
                    if (searchTerm.length > 1) searchUsers(searchTerm, currentUser, db);
                }, 300);
            });
        }
    }

    async function searchUsers(searchTerm, currentUser, db) {
        const userSearchResults = document.getElementById('user-search-results');
        const usersRef = db.collection('users');
        const snapshot = await usersRef.where('handle', '>=', searchTerm.toLowerCase()).where('handle', '<=', searchTerm.toLowerCase() + '\uf8ff').limit(10).get();
        userSearchResults.innerHTML = '';
        snapshot.forEach(doc => {
            if (doc.id === currentUser.uid) return;
            const userData = doc.data();
            const userElement = document.createElement('div');
            userElement.className = 'p-3 flex items-center hover:bg-gray-700 cursor-pointer rounded-md';
            userElement.innerHTML = `<img src="${userData.profilePic || 'https://placehold.co/40x40'}" alt="Avatar" class="w-10 h-10 rounded-full mr-3 object-cover"><div><p class="font-semibold">${userData.displayName}</p><p class="text-sm text-gray-400">@${userData.handle}</p></div>`;
            userElement.addEventListener('click', () => startConversation(doc.id, currentUser, db));
            userSearchResults.appendChild(userElement);
        });
    }

    async function startConversation(otherUserId, currentUser, db) {
        document.getElementById('new-conversation-modal').classList.add('hidden');
        
        const conversationsRef = db.collection('conversations');
        const snapshot = await conversationsRef.where('participants', 'array-contains', currentUser.uid).get();
        
        let existingConvId = null;
        snapshot.forEach(doc => {
            const data = doc.data();
            if (data.participants.includes(otherUserId) && data.participants.length === 2) {
                existingConvId = doc.id;
            }
        });

        if (existingConvId) {
            openConversation(existingConvId);
        } else {
            const newConv = await conversationsRef.add({
                participants: [currentUser.uid, otherUserId],
                lastUpdated: firebase.firestore.FieldValue.serverTimestamp(),
                lastMessage: '',
                isGroupChat: false,
            });
            openConversation(newConv.id);
        }
    }
});