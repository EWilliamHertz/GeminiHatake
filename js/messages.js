/**
 * HatakeSocial - Messages Page Script (v3 - Final & Stable)
 *
 * This script waits for the 'authReady' event from auth.js before running.
 * It handles all logic for the messages.html page, including searching for users,
 * opening chat conversations, and sending/receiving messages in real-time.
 * This version includes a fix for the undefined field value error.
 */
document.addEventListener('authReady', (e) => {
    const currentUser = e.detail.user;
    const chatArea = document.getElementById('chat-area');
    if (!chatArea) return;

    if (!currentUser) {
        chatArea.innerHTML = '<p class="text-center p-8 text-gray-500">Please log in to view your messages.</p>';
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

    const loadUserList = async () => {
        const usersSnapshot = await db.collection('users').get();
        if (!conversationsListEl) return;
        conversationsListEl.innerHTML = '';
        usersSnapshot.forEach(doc => {
            if (doc.id === currentUser.uid) return;
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
                const messages = doc.data().messages || [];
                messages.sort((a,b) => a.timestamp.toMillis() - b.timestamp.toMillis()).forEach(msg => {
                    const messageEl = document.createElement('div');
                    const isSent = msg.senderId === currentUser.uid;
                    messageEl.className = `message ${isSent ? 'sent' : 'received'}`;
                    messageEl.innerHTML = `<div class="message-bubble">${msg.content}</div>`;
                    messagesContainer.appendChild(messageEl);
                });
            }
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        });
    };

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

        // **THE FIX IS HERE:** Ensure no 'undefined' values are sent to Firestore.
        // We use '|| null' to provide a safe fallback value that Firestore accepts.
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

    loadUserList();

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
