/**
 * HatakeSocial - Messages Page Script (v4 - Final & Stable)
 *
 * This script waits for the 'authReady' event from auth.js before running.
 * It handles all logic for the messages.html page, including:
 * - Sorting conversations by the most recent message.
 * - Displaying sender name and timestamp with each message.
 */
document.addEventListener('authReady', (e) => {
    const currentUser = e.detail.user;
    const chatArea = document.getElementById('chat-area');
    if (!chatArea) return;

    if (!currentUser) {
        chatArea.innerHTML = '<div class="flex items-center justify-center h-full"><p class="text-center p-8 text-gray-500">Please log in to view your messages.</p></div>';
        return;
    }

    let currentChatListener = null;
    let currentRemoteUser = null;

    const conversationsListEl = document.getElementById('conversations-list');
    const userSearchInput = document.getElementById('user-search-input');
    const userSearchResultsEl = document.getElementById('user-search-results');
    const messageInput = document.getElementById('message-input');
    const sendMessageBtn = document.getElementById('send-message-btn');
    const chatWelcomeScreen = document.getElementById('chat-welcome-screen');
    const chatView = document.getElementById('chat-view');

    /**
     * **UPDATED**
     * Loads all conversations for the current user, sorted by the most recent message.
     */
    const loadConversations = async () => {
        const conversationsRef = db.collection('conversations');
        const query = conversationsRef.where('participants', 'array-contains', currentUser.uid).orderBy('updatedAt', 'desc');
        
        query.onSnapshot(snapshot => {
            if (!conversationsListEl) return;
            conversationsListEl.innerHTML = '';
            if (snapshot.empty) {
                conversationsListEl.innerHTML = '<p class="p-4 text-center text-gray-500 text-sm">No conversations yet. Search for a user to start chatting.</p>';
            }
            snapshot.forEach(doc => {
                const conversation = doc.data();
                const remoteUserId = conversation.participants.find(id => id !== currentUser.uid);
                const remoteUserInfo = conversation.participantInfo[remoteUserId];

                const item = document.createElement('div');
                item.className = 'conversation-item';
                item.innerHTML = `
                    <img src="${remoteUserInfo.photoURL || 'https://placehold.co/40x40'}" class="h-12 w-12 rounded-full mr-3 object-cover">
                    <div class="flex-grow overflow-hidden">
                        <span class="font-bold">${remoteUserInfo.displayName}</span>
                        <p class="text-sm text-gray-500 truncate">${conversation.lastMessage || 'No messages yet'}</p>
                    </div>
                `;
                item.addEventListener('click', () => {
                     openChatForUser({ id: remoteUserId, ...remoteUserInfo });
                });
                conversationsListEl.appendChild(item);
            });
        }, error => {
            console.error("Error loading conversations:", error);
            conversationsListEl.innerHTML = '<p class="p-4 text-center text-red-500 text-sm">Could not load conversations.</p>';
        });
    };

    /**
     * Opens a chat window with a specific user and listens for new messages.
     * @param {object} remoteUser - The user object of the person to chat with.
     */
    const openChatForUser = (remoteUser) => {
        if (currentChatListener) currentChatListener();
        currentRemoteUser = remoteUser;

        chatWelcomeScreen.classList.add('hidden');
        chatView.classList.remove('hidden');
        chatView.classList.add('flex');

        document.getElementById('chat-header-avatar').src = remoteUser.photoURL || 'https://placehold.co/40x40';
        document.getElementById('chat-header-name').textContent = remoteUser.displayName;

        const conversationId = [currentUser.uid, remoteUser.id].sort().join('_');
        const conversationRef = db.collection('conversations').doc(conversationId);
        const messagesContainer = document.getElementById('messages-container');

        currentChatListener = conversationRef.onSnapshot(doc => {
            messagesContainer.innerHTML = '';
            if (doc.exists) {
                const conversation = doc.data();
                const messages = conversation.messages || [];
                
                messages.sort((a,b) => a.timestamp.toMillis() - b.timestamp.toMillis()).forEach(msg => {
                    const messageEl = document.createElement('div');
                    const isSent = msg.senderId === currentUser.uid;
                    const senderInfo = isSent ? conversation.participantInfo[currentUser.uid] : conversation.participantInfo[remoteUser.id];
                    
                    // **THE FIX IS HERE**
                    // Add sender name and timestamp above the message bubble.
                    messageEl.className = `message-group ${isSent ? 'sent' : 'received'}`;
                    messageEl.innerHTML = `
                        <div class="message-header">
                            <span class="font-bold text-sm">${senderInfo.displayName}</span>
                            <span class="text-xs text-gray-500 ml-2">${new Date(msg.timestamp.toDate()).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                        </div>
                        <div class="message-bubble">${msg.content}</div>
                    `;
                    messagesContainer.appendChild(messageEl);
                });
            }
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        });
    };

    /**
     * Sends a message to the currently active chat partner.
     */
    const sendMessage = async () => {
        const content = messageInput.value.trim();
        if (!content || !currentRemoteUser) return;

        const conversationId = [currentUser.uid, currentRemoteUser.id].sort().join('_');
        const conversationRef = db.collection('conversations').doc(conversationId);

        const newMessage = {
            content: content,
            senderId: currentUser.uid,
            timestamp: new Date() 
        };

        const participantInfoData = {
            [currentUser.uid]: { 
                displayName: currentUser.displayName || 'Anonymous', 
                photoURL: currentUser.photoURL || null 
            },
            [currentRemoteUser.id]: { 
                displayName: currentRemoteUser.displayName || 'Anonymous', 
                photoURL: currentRemoteUser.photoURL || null 
            }
        };

        messageInput.value = '';

        try {
            await conversationRef.set({
                participants: [currentUser.uid, currentRemoteUser.id],
                participantInfo: participantInfoData,
                lastMessage: content,
                updatedAt: new Date(),
                messages: firebase.firestore.FieldValue.arrayUnion(newMessage)
            }, { merge: true });
        } catch (error) {
            console.error("Error sending message:", error);
            alert("Could not send message. Please check the console for errors.");
        }
    };

    // --- Attach Event Listeners ---
    sendMessageBtn.addEventListener('click', sendMessage);
    messageInput.addEventListener('keyup', (e) => {
        if (e.key === 'Enter') sendMessage();
    });

    userSearchInput.addEventListener('keyup', async (e) => {
        const searchTerm = e.target.value.toLowerCase();
        if (searchTerm.length < 2) {
            userSearchResultsEl.innerHTML = '';
            userSearchResultsEl.classList.add('hidden');
            return;
        }
        userSearchResultsEl.classList.remove('hidden');
        const usersRef = db.collection('users');
        const query = usersRef.orderBy('displayName').startAt(searchTerm).endAt(searchTerm + '\uf8ff');
        
        const snapshot = await query.get();
        userSearchResultsEl.innerHTML = '';
        snapshot.forEach(doc => {
            if (doc.id === currentUser.uid) return;
            const userData = doc.data();
            const resultItem = document.createElement('div');
            resultItem.className = 'p-2 hover:bg-gray-100 cursor-pointer';
            resultItem.textContent = userData.displayName;
            resultItem.addEventListener('click', () => {
                openChatForUser({ id: doc.id, ...userData });
                userSearchInput.value = '';
                userSearchResultsEl.innerHTML = '';
                userSearchResultsEl.classList.add('hidden');
            });
            userSearchResultsEl.appendChild(resultItem);
        });
    });

    // --- Initial Load ---
    loadConversations();

    const params = new URLSearchParams(window.location.search);
    const chatWithId = params.get('with');
    if (chatWithId) {
        db.collection('users').doc(chatWithId).get().then(doc => {
            if(doc.exists) {
                openChatForUser({id: doc.id, ...doc.data()});
            }
        });
    }
});
