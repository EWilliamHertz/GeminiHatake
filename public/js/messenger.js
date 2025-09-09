(function() {
    'use strict';

    let isInitialized = false;
    let unsubscribeWidgetMessages = null;
    let unsubscribeWidgetConversations = null;

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
        // --- FIX: Start with the 'minimized' class by default ---
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

    window.initializeMessengerWidget = ({ detail: { user } }) => {
        if (isInitialized || document.getElementById('messenger-widget-container')) return;

        const isVisible = localStorage.getItem('messengerWidget-visible') !== 'false';
        if (!isVisible) return;
        
        createMessengerWidgetHTML();
        isInitialized = true;
        
        const messengerWidgetContainer = document.getElementById('messenger-widget-container');
        if (!user) {
            messengerWidgetContainer.style.display = 'none';
            return;
        }
        messengerWidgetContainer.style.display = 'block';

        const db = firebase.firestore();
        let activeWidgetConversationId = null;

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

        // Restore minimized state if user has interacted with it before
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

        const selectWidgetConversation = (conversationId, otherUser) => {
            activeWidgetConversationId = conversationId;

            // --- UI FIX: Use Tailwind classes for consistency ---
            widgetListView.classList.add('hidden');
            widgetChatView.classList.remove('hidden');
            widgetChatView.classList.add('flex'); // Ensure it's a flex container when visible

            const widgetChatHeader = document.getElementById('widget-chat-header');
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
                            renderWidgetMessage(change.doc.data(), user);
                        }
                    });
                    widgetMessagesContainer.scrollTop = widgetMessagesContainer.scrollHeight;
                });
        };

        const renderWidgetMessage = (message, currentUser) => {
            const messageWrapper = document.createElement('div');
            const isCurrentUser = message.senderId === currentUser.uid;
            messageWrapper.className = `flex flex-col ${isCurrentUser ? 'items-end' : 'items-start'}`;
            messageWrapper.innerHTML = `<div class="p-2 rounded-lg max-w-xs text-sm ${isCurrentUser ? 'bg-blue-600 text-white' : 'bg-gray-200 dark:bg-gray-700'}">${message.text}</div>`;
            widgetMessagesContainer.appendChild(messageWrapper);
        };

        widgetMessageForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const text = widgetMessageInput.value.trim();
            if (text === '' || !activeWidgetConversationId) return;
            const originalMessage = text;
            widgetMessageInput.value = '';
            const messageData = { text: originalMessage, senderId: user.uid, timestamp: firebase.firestore.FieldValue.serverTimestamp() };
            const convoRef = db.collection('conversations').doc(activeWidgetConversationId);
            const messageRef = convoRef.collection('messages').doc();
            const batch = db.batch();
            batch.set(messageRef, messageData);
            batch.update(convoRef, { lastMessage: originalMessage, lastUpdated: firebase.firestore.FieldValue.serverTimestamp() });
            try { await batch.commit(); } catch (error) { console.error("Error sending widget message:", error); widgetMessageInput.value = originalMessage; }
        });

        const listenForWidgetConversations = () => {
            if (unsubscribeWidgetConversations) unsubscribeWidgetConversations();
            unsubscribeWidgetConversations = db.collection('conversations').where('participants', 'array-contains', user.uid).orderBy('lastUpdated', 'desc').limit(10)
                .onSnapshot(snapshot => {
                    widgetConversationsList.innerHTML = snapshot.empty ? '<p class="p-4 text-center text-gray-500 text-sm">No conversations yet.</p>' : '';
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
                                    </div>`;
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
        
        const startWidgetConversation = async (otherUserId, otherUserData) => {
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
            } catch (error) { console.error("Error starting widget conversation:", error); }
        };
        
        newConversationBtn.addEventListener('click', () => {
            if(window.openNewConversationModal) {
                window.openNewConversationModal(true, startWidgetConversation);
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
    };

    document.addEventListener('authReady', window.initializeMessengerWidget);
})();