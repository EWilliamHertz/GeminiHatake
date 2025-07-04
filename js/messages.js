/**
 * HatakeSocial - Messages Page Script (v4 - Final & Stable)
 *
 * This script waits for the 'authReady' event from auth.js before running.
 * It handles all logic for the messages.html page, including searching for users,
 * opening chat conversations, and sending/receiving messages in real-time.
 */
document.addEventListener('authReady', (e) => {
    const currentUser = e.detail.user;
    const chatArea = document.getElementById('chat-area');
    // If this element doesn't exist, or if the user isn't logged in, do nothing.
    if (!chatArea) return;

    if (!currentUser) {
        chatArea.innerHTML = '<div class="flex items-center justify-center h-full"><p class="text-center p-8 text-gray-500">Please log in to view your messages.</p></div>';
        return;
    }

    let currentChatListener = null; // Holds the real-time listener function to unsubscribe later
    let currentRemoteUser = null; // Holds the data of the person we are chatting with

    const conversationsListEl = document.getElementById('conversations-list');
    const userSearchInput = document.getElementById('user-search-input');
    const userSearchResultsEl = document.getElementById('user-search-results');
    const messageInput = document.getElementById('message-input');
    const sendMessageBtn = document.getElementById('send-message-btn');
    const chatWelcomeScreen = document.getElementById('chat-welcome-screen');
    const chatView = document.getElementById('chat-view');

    /**
     * Loads all other users into the left-hand panel to start conversations.
     */
    const loadUserList = async () => {
        const usersSnapshot = await db.collection('users').get();
        if (!conversationsListEl) return;
        conversationsListEl.innerHTML = '';
        usersSnapshot.forEach(doc => {
            if (doc.id === currentUser.uid) return; // Don't list the user themselves
            const userData = doc.data();
            const item = document.createElement('div');
            item.className = 'conversation-item';
            item.innerHTML = `<img src="${userData.photoURL || 'https://placehold.co/40x40'}" class="h-10 w-10 rounded-full mr-3 object-cover"><span class="font-bold">${userData.displayName}</span>`;
            item.addEventListener('click', () => {
                 openChatForUser({ id: doc.id, ...userData });
            });
            conversationsListEl.appendChild(item);
        });
    };

    /**
     * Opens a chat window with a specific user and listens for new messages.
     * @param {object} remoteUser - The user object of the person to chat with.
     */
    const openChatForUser = (remoteUser) => {
        // Unsubscribe from any previous chat listener to prevent getting messages from old chats
        if (currentChatListener) {
            currentChatListener();
        }

        currentRemoteUser = remoteUser; // Set the currently active chat partner

        // Update the UI to show the chat window
        chatWelcomeScreen.classList.add('hidden');
        chatView.classList.remove('hidden');
        chatView.classList.add('flex');

        document.getElementById('chat-header-avatar').src = remoteUser.photoURL || 'https://placehold.co/40x40';
        document.getElementById('chat-header-name').textContent = remoteUser.displayName;

        // Create a consistent conversation ID by sorting the two user IDs.
        // This ensures both users load the same conversation document.
        const conversationId = [currentUser.uid, remoteUser.id].sort().join('_');
        const conversationRef = db.collection('conversations').doc(conversationId);
        const messagesContainer = document.getElementById('messages-container');

        // --- Real-time Message Listener ---
        // This is the core of the real-time functionality.
        currentChatListener = conversationRef.onSnapshot(doc => {
            messagesContainer.innerHTML = '';
            if (doc.exists) {
                const messages = doc.data().messages || [];
                // Sort messages by timestamp to ensure correct order
                messages.sort((a,b) => a.timestamp.toMillis() - b.timestamp.toMillis()).forEach(msg => {
                    const messageEl = document.createElement('div');
                    const isSent = msg.senderId === currentUser.uid;
                    messageEl.className = `message ${isSent ? 'sent' : 'received'}`;
                    messageEl.innerHTML = `<div class="message-bubble">${msg.content}</div>`;
                    messagesContainer.appendChild(messageEl);
                });
            }
            // Automatically scroll to the newest message
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        });
    };

    /**
     * Sends a message to the currently active chat partner.
     */
    const sendMessage = async () => {
        const content = messageInput.value.trim();
        // Don't send if there's no active chat or the message is empty
        if (!content || !currentRemoteUser) {
            console.error("Cannot send message: No remote user selected.");
            return;
        }

        const conversationId = [currentUser.uid, currentRemoteUser.id].sort().join('_');
        const conversationRef = db.collection('conversations').doc(conversationId);

        const newMessage = {
            content: content,
            senderId: currentUser.uid,
            timestamp: new Date() 
        };

        // This object ensures no 'undefined' values are sent to Firestore.
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
            // Use set with merge=true to create the doc if it doesn't exist,
            // or update it by adding the new message to the array.
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
        if (e.key === 'Enter') {
            sendMessage();
        }
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
    loadUserList();

    // Check if the URL has a 'with' parameter to directly open a chat
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
