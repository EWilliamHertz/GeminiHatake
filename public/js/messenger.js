/**
 * HatakeSocial - Messenger Widget Script (v8 - Merged & Finalized)
 *
 * This version merges the user's implementation with the refactored script.
 * It combines the robust state management (localStorage), avatar-fix, and date formatting
 * from the user's version with the clean, event-driven architecture of the refactored script.
 *
 * - FEAT: Includes formatTimestamp helper for user-preferred date display.
 * - FEAT: Saves widget's minimized/maximized state in localStorage.
 * - FIX: Rebuilds the chat header on conversation select to reliably update avatars.
 * - FIX: Correctly initializes only on pages containing the widget container.
 * - FEAT: Supports the shared 'new conversation' modal logic for use across the site.
 */

// --- Date Formatting Helper ---
const formatTimestamp = (timestamp) => {
    if (!timestamp || !timestamp.toDate) {
        return ''; // Return empty string if timestamp isn't a valid Firestore Timestamp yet
    }
    const date = timestamp.toDate();
    const userDateFormat = localStorage.getItem('userDateFormat') || 'dmy';
    
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    const time = date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

    let datePart;
    if (userDateFormat === 'mdy') {
        datePart = `${month}/${day}/${year}`;
    } else {
        datePart = `${day}/${month}/${year}`;
    }

    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();

    return isToday ? time : datePart;
};


document.addEventListener('authReady', ({ detail: { user } }) => {
    const messengerWidgetContainer = document.getElementById('messenger-widget-container');
    if (!messengerWidgetContainer) return; // Exit if widget isn't on the page

    if (!user) {
        messengerWidgetContainer.style.display = 'none';
        return;
    }
    messengerWidgetContainer.style.display = 'block';

    const db = firebase.firestore();
    let activeWidgetConversationId = null;
    let unsubscribeWidgetMessages = null;
    let unsubscribeWidgetConversations = null;

    // --- DOM Elements ---
    const messengerOpenBtn = document.getElementById('messenger-open-btn');
    const messengerWidgetHeader = document.getElementById('messenger-widget-header');
    const widgetMainHeaderText = document.getElementById('widget-main-header-text');
    const widgetToggleIcon = document.getElementById('widget-toggle-icon');
    
    const widgetListView = document.getElementById('widget-list-view');
    const widgetConversationsList = document.getElementById('widget-conversations-list');
    
    const widgetChatView = document.getElementById('widget-chat-view');
    const widgetMessagesContainer = document.getElementById('widget-messages-container');
    const widgetMessageForm = document.getElementById('widget-message-form');
    const widgetMessageInput = document.getElementById('widget-message-input');

    const newConversationBtn = document.getElementById('widget-new-conversation-btn');
    const newConversationModal = document.getElementById('new-conversation-modal');
    const closeModalBtn = document.getElementById('close-modal-btn');
    const userSearchInput = document.getElementById('user-search-input');
    const userSearchResults = document.getElementById('user-search-results');

    let isForWidget = false; // Flag to distinguish modal usage

    // --- Widget Visibility and State Management ---
    const isMinimized = localStorage.getItem('messengerWidget-minimized') === 'true';
    if (isMinimized) {
        messengerWidgetContainer.classList.add('minimized');
        widgetToggleIcon.classList.remove('fa-chevron-down');
        widgetToggleIcon.classList.add('fa-chevron-up');
    }

    messengerOpenBtn.addEventListener('click', () => {
        messengerWidgetContainer.classList.remove('minimized');
        localStorage.setItem('messengerWidget-minimized', 'false');
    });
    
    messengerWidgetHeader.addEventListener('click', (e) => {
        if (e.target.id === 'widget-new-conversation-btn' || e.target.parentElement.id === 'widget-new-conversation-btn') {
            return; // Prevent minimizing when clicking the 'new conversation' icon
        }
        
        messengerWidgetContainer.classList.toggle('minimized');
        const minimized = messengerWidgetContainer.classList.contains('minimized');
        localStorage.setItem('messengerWidget-minimized', minimized);

        widgetToggleIcon.classList.toggle('fa-chevron-down', !minimized);
        widgetToggleIcon.classList.toggle('fa-chevron-up', minimized);
    });

    // --- Core Functions ---

    const selectWidgetConversation = (conversationId, otherUser) => {
        activeWidgetConversationId = conversationId;

        widgetListView.classList.add('hidden');
        widgetChatView.classList.remove('hidden');
        widgetChatView.classList.add('flex');

        const widgetChatHeader = document.getElementById('widget-chat-header');
        if (widgetChatHeader) {
            widgetChatHeader.innerHTML = `
                <i class="fas fa-arrow-left cursor-pointer p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full" id="widget-back-btn"></i>
                <img alt="${otherUser.displayName}" class="w-8 h-8 rounded-full object-cover" src="${otherUser.photoURL || 'https://i.imgur.com/B06rBhI.png'}"/>
                <span class="font-semibold truncate">${otherUser.displayName}</span>
            `;
            
            document.getElementById('widget-back-btn').addEventListener('click', () => {
                widgetChatView.classList.add('hidden');
                widgetChatView.classList.remove('flex');
                widgetListView.classList.remove('hidden');
                widgetMainHeaderText.textContent = 'Messages';
                if (unsubscribeWidgetMessages) unsubscribeWidgetMessages();
                activeWidgetConversationId = null;
            });
        }
        
        widgetMainHeaderText.textContent = otherUser.displayName;
        listenForWidgetMessages(conversationId);
    };

    const listenForWidgetMessages = (conversationId) => {
        if (unsubscribeWidgetMessages) unsubscribeWidgetMessages();
        widgetMessagesContainer.innerHTML = '';

        unsubscribeWidgetMessages = db.collection('conversations').doc(conversationId).collection('messages')
            .orderBy('timestamp', 'asc')
            .onSnapshot(snapshot => {
                snapshot.docChanges().forEach(change => {
                    if (change.type === 'added') {
                        renderWidgetMessage(change.doc.data());
                    }
                });
                widgetMessagesContainer.scrollTop = widgetMessagesContainer.scrollHeight;
            });
    };

    const renderWidgetMessage = (message) => {
        const messageWrapper = document.createElement('div');
        const isCurrentUser = message.senderId === user.uid;
        messageWrapper.className = `w-full flex my-1 ${isCurrentUser ? 'justify-end' : 'justify-start'}`;
        messageWrapper.innerHTML = `
            <div class="p-2 rounded-lg max-w-[80%] text-sm ${isCurrentUser ? 'bg-blue-600 text-white' : 'bg-gray-200 dark:bg-gray-700'}">
                ${message.text}
            </div>
        `;
        widgetMessagesContainer.appendChild(messageWrapper);
    };

    widgetMessageForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const text = widgetMessageInput.value.trim();
        if (text === '' || !activeWidgetConversationId) return;

        const originalMessage = text;
        widgetMessageInput.value = '';

        const messageData = {
            text: originalMessage,
            senderId: user.uid,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        };

        const convoRef = db.collection('conversations').doc(activeWidgetConversationId);
        const messageRef = convoRef.collection('messages').doc();

        const batch = db.batch();
        batch.set(messageRef, messageData);
        batch.update(convoRef, {
            lastMessage: originalMessage,
            lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
        });

        try {
            await batch.commit();
        } catch (error) {
            console.error("Error sending widget message:", error);
            widgetMessageInput.value = originalMessage;
        }
    });

    const listenForWidgetConversations = () => {
        if (unsubscribeWidgetConversations) unsubscribeWidgetConversations();

        unsubscribeWidgetConversations = db.collection('conversations')
            .where('participants', 'array-contains', user.uid)
            .orderBy('lastUpdated', 'desc')
            .limit(10)
            .onSnapshot(snapshot => {
                widgetConversationsList.innerHTML = '';
                if (snapshot.empty) {
                    widgetConversationsList.innerHTML = '<p class="p-4 text-center text-gray-500 text-sm">No conversations yet.</p>';
                    return;
                }
                snapshot.forEach(doc => {
                    const convo = doc.data();
                    const otherUserId = convo.participants.find(p => p !== user.uid);
                    if (!otherUserId) return;

                    db.collection('users').doc(otherUserId).get().then(userDoc => {
                        if (userDoc.exists) {
                            const otherUserData = userDoc.data();
                            const convoElement = document.createElement('div');
                            convoElement.className = 'flex items-center p-2 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer rounded-lg mx-1';
                            convoElement.innerHTML = `
                                <img src="${otherUserData.photoURL || 'https://i.imgur.com/B06rBhI.png'}" alt="${otherUserData.displayName}" class="w-10 h-10 rounded-full object-cover mr-3">
                                <div class="flex-1 truncate">
                                    <div class="flex justify-between items-center">
                                        <span class="font-semibold">${otherUserData.displayName}</span>
                                        <span class="text-xs text-gray-400">${formatTimestamp(convo.lastUpdated)}</span>
                                    </div>
                                    <p class="text-sm text-gray-500 dark:text-gray-400 truncate">${convo.lastMessage || 'Start a conversation'}</p>
                                </div>
                            `;
                            convoElement.addEventListener('click', () => selectWidgetConversation(doc.id, otherUserData));
                            widgetConversationsList.appendChild(convoElement);
                        }
                    });
                });
            }, error => {
                console.error("Error listening for widget conversations:", error);
                widgetConversationsList.innerHTML = '<p class="p-4 text-center text-red-500 text-sm">Could not load messages.</p>';
            });
    };
    
    // --- New Conversation Modal Logic ---
    const startWidgetConversation = async (otherUserId, otherUserData) => {
        newConversationModal.classList.add('hidden');
        userSearchInput.value = '';
        userSearchResults.innerHTML = '';

        const conversationId = [user.uid, otherUserId].sort().join('_');
        const convoRef = db.collection('conversations').doc(conversationId);
        
        try {
            const doc = await convoRef.get();
            if (!doc.exists) {
                await convoRef.set({
                    participants: [user.uid, otherUserId],
                    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                    lastUpdated: firebase.firestore.FieldValue.serverTimestamp(),
                    lastMessage: ''
                });
            }
            selectWidgetConversation(conversationId, otherUserData);
        } catch (error) {
            console.error("Error starting widget conversation:", error);
        }
    };
    
    // This is called by the button in the widget header
    if (newConversationBtn) {
       newConversationBtn.addEventListener('click', () => {
           isForWidget = true;
           newConversationModal.classList.remove('hidden');
       });
    }
    if (closeModalBtn) {
        closeModalBtn.addEventListener('click', () => newConversationModal.classList.add('hidden'));
    }

    let searchTimeout;
    userSearchInput.addEventListener('keyup', () => {
        clearTimeout(searchTimeout);
        const query = userSearchInput.value.trim().toLowerCase();
        if (query.length < 2) {
            userSearchResults.innerHTML = '';
            return;
        }
        searchTimeout = setTimeout(async () => {
            userSearchResults.innerHTML = '<p class="text-gray-500 p-2">Searching...</p>';
            try {
                const snapshot = await db.collection('users').where('handle', '>=', query).where('handle', '<=', query + '\uf8ff').limit(10).get();
                
                userSearchResults.innerHTML = '';
                if (snapshot.empty) {
                    userSearchResults.innerHTML = '<p class="text-gray-500 p-2">No users found.</p>';
                    return;
                }
                snapshot.forEach(doc => {
                    const foundUser = doc.data();
                    if (doc.id === user.uid) return;

                    const resultEl = document.createElement('div');
                    resultEl.className = 'flex items-center p-2 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer rounded-md';
                    resultEl.innerHTML = `
                        <img src="${foundUser.photoURL || 'https://i.imgur.com/B06rBhI.png'}" class="h-10 w-10 rounded-full object-cover mr-3">
                        <div>
                            <p class="font-semibold">${foundUser.displayName}</p>
                            <p class="text-sm text-gray-500">@${foundUser.handle}</p>
                        </div>
                    `;
                    resultEl.addEventListener('click', () => {
                         if (isForWidget) {
                            startWidgetConversation(doc.id, foundUser);
                        } else if (window.startConversation) { 
                            // This is called from messages.js
                            window.startConversation(doc.id, foundUser);
                        }
                    });
                    userSearchResults.appendChild(resultEl);
                });
            } catch (error) {
                 console.error("Error searching users:", error);
                 userSearchResults.innerHTML = '<p class="text-red-500 p-2">Error searching users.</p>';
            }
        }, 300);
    });

    // --- Initial Load ---
    listenForWidgetConversations();
});