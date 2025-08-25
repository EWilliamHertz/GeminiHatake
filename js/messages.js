/**
 * HatakeSocial - Real-time Messaging System (v2 - Robust Error Handling)
 *
 * This script completely revamps the messaging functionality.
 * - FIX: Adds robust error handling and pre-send authentication checks to diagnose permission issues.
 * - FIX: Disables input during message submission to prevent errors.
 * - Implements a modern, two-column chat interface.
 * - Uses Firestore real-time listeners (`onSnapshot`) for conversations and messages.
 * - Allows users to start new conversations by searching for other users.
 */

document.addEventListener('authReady', ({ detail: { user } }) => {
    if (!user) {
        document.getElementById('chat-window').innerHTML = `
            <div class="flex-1 flex flex-col items-center justify-center text-center p-4">
                <i class="fas fa-lock text-6xl text-gray-300 dark:text-gray-600"></i>
                <h2 class="mt-4 text-2xl font-semibold">Authentication Required</h2>
                <p class="text-gray-500 dark:text-gray-400">Please log in to view your messages.</p>
            </div>
        `;
        document.getElementById('conversations-list').classList.add('hidden');
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
    const newConversationModal = document.getElementById('new-conversation-modal');
    const closeModalBtn = document.getElementById('close-modal-btn');
    const userSearchInput = document.getElementById('user-search-input');
    const userSearchResults = document.getElementById('user-search-results');


    /**
     * Fetches and displays the list of the current user's conversations.
     */
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
                    
                    if (!otherUserId) return;

                    db.collection('users').doc(otherUserId).get().then(userDoc => {
                        if (userDoc.exists) {
                            const otherUserData = userDoc.data();
                            const convoElement = document.createElement('div');
                            convoElement.className = 'conversation-item flex items-center p-3 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer border-b border-gray-200 dark:border-gray-700';
                            convoElement.dataset.conversationId = doc.id;

                            convoElement.innerHTML = `
                                <img src="${otherUserData.photoURL || 'https://i.imgur.com/B06rBhI.png'}" alt="${otherUserData.displayName}" class="h-12 w-12 rounded-full object-cover mr-4">
                                <div class="flex-1 truncate">
                                    <p class="font-semibold">${otherUserData.displayName}</p>
                                    <p class="text-sm text-gray-500 dark:text-gray-400 truncate">${convo.lastMessage || 'No messages yet'}</p>
                                </div>
                            `;
                            convoElement.addEventListener('click', () => selectConversation(doc.id, otherUserData));
                            conversationsContainer.appendChild(convoElement);
                        }
                    });
                });
            }, error => {
                console.error("Firestore Error: Failed to listen for conversations.", error);
                conversationsContainer.innerHTML = '<p class="p-4 text-center text-red-500">Could not load conversations. This is likely a permissions issue.</p>';
            });
    };

    /**
     * Handles the UI and logic when a user clicks on a conversation.
     * @param {string} conversationId - The ID of the selected conversation.
     * @param {object} otherUser - The user object of the other participant.
     */
    const selectConversation = (conversationId, otherUser) => {
        activeConversationId = conversationId;

        document.querySelectorAll('.conversation-item').forEach(el => {
            el.classList.toggle('bg-blue-100', el.dataset.conversationId === conversationId);
            el.classList.toggle('dark:bg-blue-900/50', el.dataset.conversationId === conversationId);
        });

        chatPlaceholder.classList.add('hidden');
        activeChatContainer.classList.remove('hidden');
        activeChatContainer.classList.add('flex');

        chatHeader.innerHTML = `
            <img src="${otherUser.photoURL || 'https://i.imgur.com/B06rBhI.png'}" alt="${otherUser.displayName}" class="h-10 w-10 rounded-full object-cover mr-3">
            <div>
                <p class="font-bold">${otherUser.displayName}</p>
                <p class="text-xs text-gray-500">@${otherUser.handle}</p>
            </div>
        `;

        listenForMessages(conversationId);
    };

    /**
     * Listens for new messages in the active conversation and renders them.
     * @param {string} conversationId - The ID of the conversation to listen to.
     */
    const listenForMessages = (conversationId) => {
        if (unsubscribeMessages) unsubscribeMessages();
        messagesContainer.innerHTML = '';

        unsubscribeMessages = db.collection('conversations').doc(conversationId).collection('messages')
            .orderBy('timestamp', 'asc')
            .onSnapshot(snapshot => {
                snapshot.docChanges().forEach(change => {
                    if (change.type === 'added') {
                        const message = change.doc.data();
                        renderMessage(message);
                    }
                });
                scrollToBottom();
            }, error => {
                console.error(`Firestore Error: Failed to listen for messages in ${conversationId}.`, error);
                messagesContainer.innerHTML = '<p class="p-4 text-center text-red-500">Could not load messages.</p>';
            });
    };

    /**
     * Renders a single message bubble in the chat window.
     * @param {object} message - The message data object.
     */
    const renderMessage = (message) => {
        const messageWrapper = document.createElement('div');
        const messageBubble = document.createElement('div');
        
        const isCurrentUser = message.senderId === user.uid;
        
        messageWrapper.className = `flex ${isCurrentUser ? 'justify-end' : 'justify-start'}`;
        messageBubble.className = `p-3 rounded-2xl max-w-xs md:max-w-md ${isCurrentUser ? 'bg-blue-600 text-white' : 'bg-gray-200 dark:bg-gray-700'}`;
        
        messageBubble.textContent = message.text;
        messageWrapper.appendChild(messageBubble);
        messagesContainer.appendChild(messageWrapper);
    };

    const scrollToBottom = () => {
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    };

    messageForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const currentUser = firebase.auth().currentUser;
        if (!currentUser) {
            showToast("You are not signed in. Please refresh and log in.", "error");
            return;
        }

        const text = messageInput.value.trim();
        if (text === '' || !activeConversationId) return;

        const originalMessage = text;
        messageInput.value = '';
        messageInput.disabled = true;

        const messageData = {
            text: originalMessage,
            senderId: currentUser.uid,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        };

        const convoRef = db.collection('conversations').doc(activeConversationId);
        const messageRef = convoRef.collection('messages').doc();
        
        const batch = db.batch();
        batch.set(messageRef, messageData);
        batch.update(convoRef, {
            lastMessage: originalMessage,
            lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
        });

        try {
            await batch.commit();
            scrollToBottom();
        } catch (error) {
            console.error("Firestore Error: Failed to send message.", error);
            showToast(`Error: Could not send message. Check Firestore rules.`, "error");
            messageInput.value = originalMessage; // Restore message on failure
        } finally {
            messageInput.disabled = false;
            messageInput.focus();
        }
    });

    // --- New Conversation Modal Logic ---
    newConversationBtn.addEventListener('click', () => newConversationModal.classList.remove('hidden'));
    closeModalBtn.addEventListener('click', () => newConversationModal.classList.add('hidden'));

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
                const snapshot = await db.collection('users')
                    .where('handle', '>=', query)
                    .where('handle', '<=', query + '\uf8ff')
                    .limit(10)
                    .get();
                
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
                    resultEl.addEventListener('click', () => startConversation(doc.id, foundUser));
                    userSearchResults.appendChild(resultEl);
                });
            } catch (error) {
                 console.error("Firestore Error: Failed to search users.", error);
                 userSearchResults.innerHTML = '<p class="text-red-500 p-2">Error searching users.</p>';
            }
        }, 500);
    });

    const startConversation = async (otherUserId, otherUserData) => {
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
            selectConversation(conversationId, otherUserData);
        } catch (error) {
            console.error("Firestore Error: Failed to start conversation.", error);
            showToast(`Error: Could not start conversation. Check permissions.`, "error");
        }
    };

    // --- Initial Load ---
    listenForConversations();
});
