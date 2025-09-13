/**
 * HatakeSocial - Real-time Messaging System (v16.3 - Profile Links Added)
 */

document.addEventListener('authReady', ({ detail: { user } }) => {
    const messagesPageContainer = document.getElementById('chat-window');
    if (!messagesPageContainer) return;

    if (!user) {
        // ... (User not logged in message)
        return;
    }

    const db = firebase.firestore();
    let activeConversationId = null;
    let unsubscribeMessages = null;
    let unsubscribeConversations = null;

    const conversationsContainer = document.getElementById('conversations-container');
    const chatPlaceholder = document.getElementById('chat-placeholder');
    const activeChatContainer = document.getElementById('active-chat-container');
    const chatHeader = document.getElementById('chat-header');
    const messagesContainer = document.getElementById('messages-container');
    const messageForm = document.getElementById('message-form');
    const messageInput = document.getElementById('message-input');
    const newConversationBtn = document.getElementById('new-conversation-btn');

    const formatTimestamp = (timestamp) => {
        if (!timestamp || !timestamp.toDate) return '';
        const date = timestamp.toDate();
        const time = date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
        const isToday = (new Date()).toDateString() === date.toDateString();
        return isToday ? time : date.toLocaleDateString();
    };

    const listenForConversations = () => {
        if (unsubscribeConversations) unsubscribeConversations();
        conversationsContainer.innerHTML = '<p class="p-4 text-center text-gray-500">Loading conversations...</p>';
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
                    if (!otherUserId || !convo.participantInfo || !convo.participantInfo[otherUserId]) return;
                    const otherUserData = convo.participantInfo[otherUserId];
                    const convoElement = document.createElement('div');
                    convoElement.className = 'conversation-item flex items-center p-3 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer border-b border-gray-200 dark:border-gray-700';
                    convoElement.dataset.conversationId = doc.id;
                    convoElement.innerHTML = `
                        <a href="profile.html?uid=${otherUserId}" class="flex-shrink-0">
                            <img src="${otherUserData.photoURL || 'https://i.imgur.com/B06rBhI.png'}" alt="${otherUserData.displayName}" class="h-12 w-12 rounded-full object-cover mr-4">
                        </a>
                        <div class="flex-1 truncate">
                            <div class="flex justify-between items-center">
                                <a href="profile.html?uid=${otherUserId}" class="font-semibold hover:underline">${otherUserData.displayName || "User"}</a>
                                <p class="text-xs text-gray-400">${formatTimestamp(convo.lastUpdated)}</p>
                            </div>
                            <p class="text-sm text-gray-500 dark:text-gray-400 truncate">${convo.lastMessage || 'No messages yet'}</p>
                        </div>`;
                    convoElement.querySelector('.flex-1').addEventListener('click', (e) => {
                        // Prevent link navigation when clicking the general conversation area
                        if (e.target.tagName !== 'A') {
                           selectConversation(doc.id, otherUserData, otherUserId);
                        }
                    });
                    conversationsContainer.appendChild(convoElement);
                });
            }, error => {
                console.error("Firestore Error: Failed to listen for conversations.", error);
                conversationsContainer.innerHTML = '<p class="p-4 text-center text-red-500">Could not load conversations.</p>';
            });
    };

    const selectConversation = (conversationId, otherUser, otherUserId) => {
        if (typeof window.showChatArea === 'function') window.showChatArea();
        activeConversationId = conversationId;
        document.querySelectorAll('.conversation-item').forEach(el => el.classList.remove('bg-blue-100', 'dark:bg-blue-900/50'));
        const selectedEl = conversationsContainer.querySelector(`[data-conversation-id="${conversationId}"]`);
        if(selectedEl) selectedEl.classList.add('bg-blue-100', 'dark:bg-blue-900/50');
        
        chatPlaceholder.classList.add('hidden');
        activeChatContainer.classList.remove('hidden');
        activeChatContainer.classList.add('flex');
        const existingBackButton = chatHeader.querySelector('#mobile-back-btn');
        chatHeader.innerHTML = `
            <a href="profile.html?uid=${otherUserId}">
                <img src="${otherUser.photoURL || 'https://i.imgur.com/B06rBhI.png'}" alt="${otherUser.displayName}" class="h-10 w-10 rounded-full object-cover mr-3">
            </a>
            <div>
                <a href="profile.html?uid=${otherUserId}" class="font-bold hover:underline">${otherUser.displayName || "User"}</a>
                <p class="text-xs text-gray-500">@${otherUser.handle || otherUser.displayName}</p>
            </div>`;
        if (existingBackButton) chatHeader.prepend(existingBackButton);
        listenForMessages(conversationId);
    };

    const listenForMessages = (conversationId) => {
        if (unsubscribeMessages) unsubscribeMessages();
        messagesContainer.innerHTML = '';
        unsubscribeMessages = db.collection('conversations').doc(conversationId).collection('messages')
            .orderBy('timestamp', 'asc')
            .onSnapshot(snapshot => {
                messagesContainer.innerHTML = ''; // Clear messages to prevent duplicates
                snapshot.forEach(doc => renderMessage(doc.id, doc.data()));
                scrollToBottom();
            }, error => {
                console.error(`Firestore Error: Failed to listen for messages in ${conversationId}.`, error);
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

        const messageData = {
            text: originalMessage,
            senderId: user.uid,
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
            console.error("Error sending message:", error);
            alert("Could not send message.");
            messageInput.value = originalMessage;
        }
    });
    
    // --- MODIFIED FUNCTION ---
    const startConversation = async (otherUserId, otherUserData) => {
        if (user.uid === otherUserId) {
            alert("You cannot start a conversation with yourself.");
            return;
        }

        try {
            const conversationId = [user.uid, otherUserId].sort().join('_');
            const convoRef = db.collection('conversations').doc(conversationId);
            
            // FIX: Ensure all participant info fields have a fallback value to prevent 'undefined' errors.
            const conversationData = {
                participants: [user.uid, otherUserId],
                participantInfo: {
                    [user.uid]: {
                        displayName: user.displayName || "User",
                        photoURL: user.photoURL || null,
                        handle: user.handle || user.displayName || "user"
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

            selectConversation(conversationId, conversationData.participantInfo[otherUserId], otherUserId);
        } catch (error) {
            console.error("Error starting conversation:", error);
            alert("Could not start conversation: " + error.message);
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
        const userIdToMessage = params.get('with'); // Changed from 'userId' to 'with'
        if (userIdToMessage && userIdToMessage !== user.uid) {
            const userToMessageDoc = await db.collection('users').doc(userIdToMessage).get();
            if (userToMessageDoc.exists) {
                await startConversation(userIdToMessage, userToMessageDoc.data());
                history.replaceState(null, '', window.location.pathname);
            }
        }
    };

    listenForConversations();
    checkForUrlParams();
});