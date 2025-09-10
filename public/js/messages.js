/**
 * HatakeSocial - Real-time Messaging System (v9 - URL Handling Merged)
 *
 * - NEW: The page now checks for a `userId` URL parameter on load. If found, it automatically opens or creates a conversation with that user.
 * - This allows other pages (like the LFG feature) to link directly to a specific chat.
 * - FIX: The "New Conversation" button now uses the global `openNewConversationModal` function from auth.js, ensuring the user search modal works correctly.
 * - FIX: Consolidated message sending to use the `sendMessage` cloud function for better security and consistency.
 * - NEW: Adds a `formatTimestamp` helper to display message timestamps according to user preference.
 */

document.addEventListener('authReady', ({ detail: { user } }) => {
    // Check if we are on the messages page by looking for a specific container
    const messagesPageContainer = document.getElementById('chat-window');
    if (!messagesPageContainer) {
        return; // Exit if this is not the main messages page
    }

    if (!user) {
        document.getElementById('chat-window').innerHTML = `
            <div class="flex-1 flex flex-col items-center justify-center text-center p-4">
                <i class="fas fa-lock text-6xl text-gray-300 dark:text-gray-600"></i>
                <h2 class="mt-4 text-2xl font-semibold">Authentication Required</h2>
                <p class="text-gray-500 dark:text-gray-400">Please log in to view your messages.</p>
            </div>
        `;
        const conversationsList = document.getElementById('conversations-list');
        if (conversationsList) conversationsList.classList.add('hidden');
        return;
    }

    const db = firebase.firestore();
    let activeConversationId = null;
    let unsubscribeMessages = null;
    let unsubscribeConversations = null;

    // --- DOM Elements ---
    const conversationsContainer = document.getElementById('conversations-container');
    const chatPlaceholder = document.getElementById('chat-placeholder');
    const activeChatContainer = document.getElementById('active-chat-container');
    const chatHeader = document.getElementById('chat-header');
    const messagesContainer = document.getElementById('messages-container');
    const messageForm = document.getElementById('message-form');
    const messageInput = document.getElementById('message-input');
    const newConversationBtn = document.getElementById('new-conversation-btn');

    // --- Date Formatting Helper ---
    const formatTimestamp = (timestamp) => {
        if (!timestamp || !timestamp.toDate) {
            return '';
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

    const listenForConversations = () => {
        if (unsubscribeConversations) unsubscribeConversations();

        unsubscribeConversations = db.collection('conversations')
            .where('participants', 'array-contains', user.uid)
            .orderBy('lastUpdated', 'desc')
            .onSnapshot(snapshot => {
                if (snapshot.empty) {
                    conversationsContainer.innerHTML = '<p class="p-4 text-center text-gray-500">No conversations yet.</p>';
                    return;
                }
                conversationsContainer.innerHTML = '';
                snapshot.forEach(doc => {
                    const convo = doc.data();
                    const otherUserId = convo.participants.find(p => p !== user.uid);

                    // Use the more efficient participantInfo if available
                    if (!otherUserId || !convo.participantInfo || !convo.participantInfo[otherUserId]) return;
                    
                    const otherUserData = convo.participantInfo[otherUserId];

                    const convoElement = document.createElement('div');
                    convoElement.className = 'conversation-item flex items-center p-3 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer border-b border-gray-200 dark:border-gray-700';
                    convoElement.dataset.conversationId = doc.id;

                    convoElement.innerHTML = `
                        <img src="${otherUserData.photoURL || 'https://i.imgur.com/B06rBhI.png'}" alt="${otherUserData.displayName}" class="h-12 w-12 rounded-full object-cover mr-4">
                        <div class="flex-1 truncate">
                            <div class="flex justify-between items-center">
                                <p class="font-semibold">${otherUserData.displayName}</p>
                                <p class="text-xs text-gray-400">${formatTimestamp(convo.lastUpdated)}</p>
                            </div>
                            <p class="text-sm text-gray-500 dark:text-gray-400 truncate">${convo.lastMessage || 'No messages yet'}</p>
                        </div>
                    `;
                    convoElement.addEventListener('click', () => selectConversation(doc.id, otherUserData));
                    conversationsContainer.appendChild(convoElement);
                });
            }, error => {
                console.error("Firestore Error: Failed to listen for conversations.", error);
                conversationsContainer.innerHTML = '<p class="p-4 text-center text-red-500">Could not load conversations.</p>';
            });
    };

    const selectConversation = (conversationId, otherUser) => {
        showChatArea();
        activeConversationId = conversationId;

        document.querySelectorAll('.conversation-item').forEach(el => {
            el.classList.toggle('bg-blue-100', el.dataset.conversationId === conversationId);
            el.classList.toggle('dark:bg-blue-900/50', el.dataset.conversationId === conversationId);
        });

        chatPlaceholder.classList.add('hidden');
        activeChatContainer.classList.remove('hidden');
        activeChatContainer.classList.add('flex');

        const existingBackButton = chatHeader.querySelector('#mobile-back-btn');
        chatHeader.innerHTML = `
            <img src="${otherUser.photoURL || 'https://i.imgur.com/B06rBhI.png'}" alt="${otherUser.displayName}" class="h-10 w-10 rounded-full object-cover mr-3">
            <div>
                <p class="font-bold">${otherUser.displayName}</p>
                <p class="text-xs text-gray-500">@${otherUser.handle || otherUser.displayName}</p>
            </div>
        `;
        if (existingBackButton) {
            chatHeader.prepend(existingBackButton);
        }

        listenForMessages(conversationId);
    };

    const listenForMessages = (conversationId) => {
        if (unsubscribeMessages) unsubscribeMessages();
        messagesContainer.innerHTML = '';

        unsubscribeMessages = db.collection('conversations').doc(conversationId).collection('messages')
            .orderBy('timestamp', 'asc')
            .onSnapshot(snapshot => {
                snapshot.docChanges().forEach(change => {
                    if (change.type === 'added') {
                        renderMessage(change.doc.id, change.doc.data());
                    }
                });
                scrollToBottom();
            }, error => {
                console.error(`Firestore Error: Failed to listen for messages in ${conversationId}.`, error);
                messagesContainer.innerHTML = '<p class="p-4 text-center text-red-500">Could not load messages.</p>';
            });
    };

    const renderMessage = (messageId, message) => {
        const messageWrapper = document.createElement('div');
        messageWrapper.id = `message-${messageId}`;
        const isCurrentUser = message.senderId === user.uid;

        messageWrapper.className = `flex flex-col mb-3 ${isCurrentUser ? 'items-end' : 'items-start'}`;

        const messageBubble = document.createElement('div');
        messageBubble.className = `p-3 rounded-2xl max-w-xs md:max-w-md ${isCurrentUser ? 'bg-blue-600 text-white' : 'bg-gray-200 dark:bg-gray-700'}`;
        messageBubble.textContent = message.text;

        const timestampEl = document.createElement('p');
        timestampEl.className = 'text-xs text-gray-400 mt-1 px-2 timestamp';
        timestampEl.textContent = formatTimestamp(message.timestamp);

        messageWrapper.appendChild(messageBubble);
        messageWrapper.appendChild(timestampEl);
        messagesContainer.appendChild(messageWrapper);
    };

    const scrollToBottom = () => {
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    };

    messageForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const text = messageInput.value.trim();
        if (text === '' || !activeConversationId) return;

        const originalMessage = text;
        messageInput.value = '';

        const sendMessage = firebase.functions().httpsCallable('sendMessage');
        try {
            const recipientId = activeConversationId.replace(user.uid, '').replace('_', '');
            await sendMessage({ recipientId: recipientId, messageText: originalMessage });
            scrollToBottom();
        } catch (error) {
            console.error("Error sending message via Cloud Function:", error);
            alert("Could not send message.");
            messageInput.value = originalMessage; // Restore message on failure
        }
    });

    const startConversation = async (otherUserId, otherUserData) => {
        const conversationId = [user.uid, otherUserId].sort().join('_');
        const convoRef = db.collection('conversations').doc(conversationId);

        try {
            const doc = await convoRef.get();
            if (!doc.exists) {
                const currentUserDoc = await db.collection('users').doc(user.uid).get();
                const currentUserData = currentUserDoc.data();
                
                const convoData = {
                    participants: [user.uid, otherUserId],
                    participantInfo: {
                        [user.uid]: {
                            displayName: currentUserData.displayName,
                            photoURL: currentUserData.photoURL,
                            handle: currentUserData.handle
                        },
                        [otherUserId]: {
                            displayName: otherUserData.displayName,
                            photoURL: otherUserData.photoURL,
                            handle: otherUserData.handle
                        }
                    },
                    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                    lastUpdated: firebase.firestore.FieldValue.serverTimestamp(),
                    lastMessage: ''
                };
                await convoRef.set(convoData);
            }
            selectConversation(conversationId, otherUserData);
        } catch (error) {
            console.error("Firestore Error: Failed to start conversation.", error);
            alert("Could not start conversation.");
        }
    };

    if (newConversationBtn) {
        newConversationBtn.addEventListener('click', () => {
            if (window.openNewConversationModal) {
                window.openNewConversationModal(false, startConversation);
            } else {
                console.error('openNewConversationModal function not found. Is auth.js loaded correctly?');
            }
        });
    }

    const checkForUrlParams = async () => {
        const params = new URLSearchParams(window.location.search);
        const userIdToMessage = params.get('userId');

        if (userIdToMessage && userIdToMessage !== user.uid) {
            try {
                const userToMessageDoc = await db.collection('users').doc(userIdToMessage).get();
                if (userToMessageDoc.exists) {
                    await startConversation(userIdToMessage, userToMessageDoc.data());
                    // Clean the URL
                    history.replaceState(null, '', window.location.pathname);
                } else {
                    console.warn("User from URL parameter not found.");
                }
            } catch (error) {
                console.error("Error starting conversation from URL:", error);
            }
        }
    };

    // --- Initial Load ---
    listenForConversations();
    checkForUrlParams(); // This will handle direct links to messages
});

// --- Mobile View Toggling ---
document.addEventListener('DOMContentLoaded', () => {
    const conversationsList = document.getElementById('conversations-list');
    const chatWindow = document.getElementById('chat-window');
    const backToConversationsButton = document.getElementById('back-to-conversations');

    window.showChatArea = () => {
        if (window.innerWidth < 1024) { // Tailwind's 'lg' breakpoint
            if (conversationsList) conversationsList.classList.add('hidden');
            if (chatWindow) {
                chatWindow.classList.remove('hidden');
                chatWindow.classList.add('flex');
            }
        }
    };

    if (backToConversationsButton) {
        backToConversationsButton.addEventListener('click', () => {
            if (window.innerWidth < 1024) {
                if (chatWindow) {
                    chatWindow.classList.add('hidden');
                    chatWindow.classList.remove('flex');
                }
                if (conversationsList) conversationsList.classList.remove('hidden');
            }
        });
    }
});