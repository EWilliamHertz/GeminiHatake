(function() {
    'use strict';

    if (!window.messenger) {
        window.messenger = {};
    }

    let isInitialized = false;
    let unsubscribeWidgetMessages = null;
    let unsubscribeWidgetConversations = null;
    let db, currentUser;

    const formatTimestamp = (timestamp) => {
        if (!timestamp || !timestamp.toDate) return '';
        const date = timestamp.toDate();
        const userDateFormat = localStorage.getItem('userDateFormat') || 'dmy';
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        const time = date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
        let datePart = (userDateFormat === 'mdy') ? `${month}/${day}/${year}` : `${day}/${month}/${year}`;
        const isToday = date.toDateString() === new Date().toDateString();
        return isToday ? time : datePart;
    };

    const createMessengerWidgetHTML = () => {
        const widgetContainer = document.createElement('div');
        widgetContainer.id = 'messenger-widget-container';
        widgetContainer.className = 'minimized';
        widgetContainer.innerHTML = `
            <div id="messenger-open-btn">
                <i class="fas fa-comments"></i>
            </div>
            <div class="fixed bottom-0 right-5 w-80 z-[1000]" id="messenger-widget">
                <div class="bg-blue-700 text-white p-3 rounded-t-lg cursor-pointer flex justify-between items-center" id="messenger-widget-header">
                    <i class="fas fa-plus cursor-pointer hover:text-gray-200" id="widget-new-conversation-btn"></i>
                    <span class="font-bold truncate" id="widget-main-header-text">Messages</span>
                    <i class="fas fa-chevron-up" id="widget-toggle-icon"></i>
                </div>
                <div class="bg-white dark:bg-gray-800 h-96 border-x border-b border-gray-300 dark:border-gray-600 rounded-b-lg flex flex-col overflow-hidden" id="messenger-widget-body">
                    <div class="h-full flex flex-col" id="widget-list-view">
                        <div class="flex-grow overflow-y-auto" id="widget-conversations-list">
                            <p class="p-4 text-center text-gray-500">Loading...</p>
                        </div>
                    </div>
                    <div class="h-full flex-col hidden" id="widget-chat-view">
                        <div class="p-3 border-b border-gray-200 dark:border-gray-700 flex items-center space-x-3 flex-shrink-0" id="widget-chat-header"></div>
                        <div class="flex-grow p-3 overflow-y-auto space-y-3" id="widget-messages-container"></div>
                        <div class="p-2 border-t border-gray-200 dark:border-gray-700 flex-shrink-0">
                            <form class="flex items-center space-x-2" id="widget-message-form">
                                <input autocomplete="off" class="flex-1 p-2 border rounded-full bg-gray-100 dark:bg-gray-700 dark:border-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm" id="widget-message-input" placeholder="Type a message..." type="text"/>
                                <button class="bg-blue-600 text-white rounded-full h-8 w-8 flex items-center justify-center hover:bg-blue-700 flex-shrink-0" type="submit">
                                    <i class="fas fa-paper-plane text-xs"></i>
                                </button>
                            </form>
                        </div>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(widgetContainer);
    };

    const selectWidgetConversation = (conversationId, otherUser) => {
        const messengerWidgetContainer = document.getElementById('messenger-widget-container');
        const widgetListView = document.getElementById('widget-list-view');
        const widgetChatView = document.getElementById('widget-chat-view');
        const widgetMainHeaderText = document.getElementById('widget-main-header-text');

        if (messengerWidgetContainer.classList.contains('minimized')) {
            messengerWidgetContainer.classList.remove('minimized');
            localStorage.setItem('messengerWidget-minimized', 'false');
            const widgetToggleIcon = document.getElementById('widget-toggle-icon');
            widgetToggleIcon.classList.add('fa-chevron-down');
            widgetToggleIcon.classList.remove('fa-chevron-up');
        }

        window.messenger.activeWidgetConversationId = conversationId;
        widgetListView.classList.add('hidden');
        widgetChatView.classList.remove('hidden');
        widgetChatView.classList.add('flex');

        const widgetChatHeader = document.getElementById('widget-chat-header');
        widgetChatHeader.innerHTML = `
            <i class="fas fa-arrow-left cursor-pointer p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full" id="widget-back-btn"></i>
            <img alt="${otherUser.displayName}" class="w-8 h-8 rounded-full object-cover" src="${otherUser.photoURL || 'https://i.imgur.com/B06rBhI.png'}"/>
            <span class="font-semibold truncate">${otherUser.displayName || "User"}</span>
        `;
        
        document.getElementById('widget-back-btn').addEventListener('click', () => {
            widgetChatView.classList.add('hidden');
            widgetChatView.classList.remove('flex');
            widgetListView.classList.remove('hidden');
            widgetMainHeaderText.textContent = 'Messages';
            if (unsubscribeWidgetMessages) unsubscribeWidgetMessages();
            window.messenger.activeWidgetConversationId = null;
        });
        
        widgetMainHeaderText.textContent = otherUser.displayName;
        listenForWidgetMessages(conversationId);
    };

    const listenForWidgetMessages = (conversationId) => {
        const widgetMessagesContainer = document.getElementById('widget-messages-container');
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
        const widgetMessagesContainer = document.getElementById('widget-messages-container');
        const messageWrapper = document.createElement('div');
        const isCurrentUser = message.senderId === currentUser.uid;
        messageWrapper.className = `flex flex-col ${isCurrentUser ? 'items-end' : 'items-start'}`;
        messageWrapper.innerHTML = `<div class="p-2 rounded-lg max-w-xs text-sm ${isCurrentUser ? 'bg-blue-600 text-white' : 'bg-gray-200 dark:bg-gray-700'}">${message.text}</div>`;
        widgetMessagesContainer.appendChild(messageWrapper);
    };

    // --- MODIFIED FUNCTION ---
    window.messenger.startNewConversation = async (otherUserId) => {
        if (!isInitialized || !currentUser) {
            alert("Messenger is not ready. Please wait a moment.");
            return;
        }

        if (currentUser.uid === otherUserId) {
            alert("You cannot start a conversation with yourself.");
            return;
        }
        
        try {
            const userDoc = await db.collection('users').doc(otherUserId).get();
            if (!userDoc.exists) {
                throw new Error("User not found.");
            }
            const otherUserData = userDoc.data();
            
            const conversationId = [currentUser.uid, otherUserId].sort().join('_');
            const convoRef = db.collection('conversations').doc(conversationId);
            
            // FIX: Ensure all participant info fields have a fallback value to prevent 'undefined' errors.
            const conversationData = {
                participants: [currentUser.uid, otherUserId],
                participantInfo: {
                    [currentUser.uid]: {
                        displayName: currentUser.displayName || "User",
                        photoURL: currentUser.photoURL || null,
                        handle: currentUser.handle || currentUser.displayName || "user"
                    },
                    [otherUserId]: {
                        displayName: otherUserData.displayName || "User",
                        photoURL: otherUserData.photoURL || null,
                        handle: otherUserData.handle || otherUserData.displayName || "user"
                    }
                },
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                lastUpdated: firebase.firestore.FieldValue.serverTimestamp(),
                lastMessage: ''
            };
            
            await convoRef.set(conversationData, { merge: true }); // Use merge:true to avoid overwriting messages
            
            selectWidgetConversation(conversationId, conversationData.participantInfo[otherUserId]);

        } catch (error) {
            console.error("Error starting new conversation:", error);
            alert(`Could not start conversation: ${error.message}`);
        }
    };

    window.initializeMessengerWidget = ({ detail: { user } }) => {
        if (isInitialized || document.getElementById('messenger-widget-container')) return;
        
        const isVisible = localStorage.getItem('messengerWidget-visible') !== 'false';
        if (!isVisible) return;
        
        createMessengerWidgetHTML();
        isInitialized = true;
        
        currentUser = user;
        const messengerWidgetContainer = document.getElementById('messenger-widget-container');
        if (!currentUser) {
            messengerWidgetContainer.style.display = 'none';
            return;
        }
        messengerWidgetContainer.style.display = 'block';

        db = firebase.firestore();
        
        const messengerOpenBtn = document.getElementById('messenger-open-btn');
        const messengerWidgetHeader = document.getElementById('messenger-widget-header');
        const widgetToggleIcon = document.getElementById('widget-toggle-icon');
        const widgetMessageForm = document.getElementById('widget-message-form');
        const widgetMessageInput = document.getElementById('widget-message-input');
        const newConversationBtn = document.getElementById('widget-new-conversation-btn');

        const isMinimized = localStorage.getItem('messengerWidget-minimized') === 'true';
        if (isMinimized) {
            messengerWidgetContainer.classList.add('minimized');
            widgetToggleIcon.classList.remove('fa-chevron-down');
            widgetToggleIcon.classList.add('fa-chevron-up');
        } else {
             messengerWidgetContainer.classList.remove('minimized');
             widgetToggleIcon.classList.add('fa-chevron-down');
            widgetToggleIcon.classList.remove('fa-chevron-up');
        }

        messengerOpenBtn.addEventListener('click', () => {
            messengerWidgetContainer.classList.remove('minimized');
            localStorage.setItem('messengerWidget-minimized', 'false');
            widgetToggleIcon.classList.add('fa-chevron-down');
            widgetToggleIcon.classList.remove('fa-chevron-up');
        });
        
        messengerWidgetHeader.addEventListener('click', (e) => {
            if (e.target.id === 'widget-new-conversation-btn') return;
            messengerWidgetContainer.classList.toggle('minimized');
            const minimized = messengerWidgetContainer.classList.contains('minimized');
            localStorage.setItem('messengerWidget-minimized', minimized);
            widgetToggleIcon.classList.toggle('fa-chevron-down', !minimized);
            widgetToggleIcon.classList.toggle('fa-chevron-up', minimized);
        });

        widgetMessageForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const text = widgetMessageInput.value.trim();
            if (text === '' || !window.messenger.activeWidgetConversationId) return;
            const originalMessage = text;
            widgetMessageInput.value = '';
            const messageData = { text: originalMessage, senderId: currentUser.uid, timestamp: firebase.firestore.FieldValue.serverTimestamp() };
            const convoRef = db.collection('conversations').doc(window.messenger.activeWidgetConversationId);
            const messageRef = convoRef.collection('messages').doc();
            const batch = db.batch();
            batch.set(messageRef, messageData);
            batch.update(convoRef, { lastMessage: originalMessage, lastUpdated: firebase.firestore.FieldValue.serverTimestamp() });
            try { await batch.commit(); } catch (error) { console.error("Error sending widget message:", error); widgetMessageInput.value = originalMessage; }
        });

        const listenForWidgetConversations = () => {
            const widgetConversationsList = document.getElementById('widget-conversations-list');
            if (unsubscribeWidgetConversations) unsubscribeWidgetConversations();
            unsubscribeWidgetConversations = db.collection('conversations').where('participants', 'array-contains', currentUser.uid).orderBy('lastUpdated', 'desc').limit(10)
                .onSnapshot(snapshot => {
                    widgetConversationsList.innerHTML = snapshot.empty ? '<p class="p-4 text-center text-gray-500 text-sm">No conversations yet.</p>' : '';
                    snapshot.forEach(doc => {
                        const convo = doc.data();
                        const otherUserId = convo.participants.find(p => p !== currentUser.uid);
                        if (!otherUserId || !convo.participantInfo || !convo.participantInfo[otherUserId]) return;
                        
                        const otherUserData = convo.participantInfo[otherUserId];
                        const convoElement = document.createElement('div');
                        convoElement.className = 'flex items-center p-2 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer rounded-lg mx-1';
                        convoElement.innerHTML = `
                            <img src="${otherUserData.photoURL || 'https://i.imgur.com/B06rBhI.png'}" alt="${otherUserData.displayName}" class="w-10 h-10 rounded-full object-cover mr-3">
                            <div class="flex-1 truncate">
                                <div class="flex justify-between items-center">
                                    <span class="font-semibold">${otherUserData.displayName || "User"}</span>
                                    <span class="text-xs text-gray-400">${formatTimestamp(convo.lastUpdated)}</span>
                                </div>
                                <p class="text-sm text-gray-500 dark:text-gray-400 truncate">${convo.lastMessage || 'Start a conversation'}</p>
                            </div>`;
                        convoElement.addEventListener('click', () => selectWidgetConversation(doc.id, otherUserData));
                        widgetConversationsList.appendChild(convoElement);
                    });
                }, error => {
                    console.error("Error listening for widget conversations:", error);
                    widgetConversationsList.innerHTML = '<p class="p-4 text-center text-red-500 text-sm">Could not load messages.</p>';
                });
        };
        
        newConversationBtn.addEventListener('click', () => {
            if(window.openNewConversationModal) {
                window.openNewConversationModal(true, window.messenger.startNewConversation);
            }
        });

        listenForWidgetConversations();
    };

    window.destroyMessengerWidget = () => {
        const widgetContainer = document.getElementById('messenger-widget-container');
        if (widgetContainer) widgetContainer.remove();
        if (unsubscribeWidgetMessages) unsubscribeWidgetMessages();
        if (unsubscribeWidgetConversations) unsubscribeWidgetConversations();
        isInitialized = false;
        currentUser = null;
        db = null;
    };

    document.addEventListener('authReady', window.initializeMessengerWidget);
})();