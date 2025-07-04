document.addEventListener('authReady', (e) => {
    const currentUser = e.detail.user;
    if (!document.getElementById('chat-area')) return;

    if (!currentUser) {
        document.getElementById('chat-area').innerHTML = '<p class="text-center p-8">Please log in to view your messages.</p>';
        return;
    }

    let currentChatListener = null;

    const conversationsListEl = document.getElementById('conversations-list');
    const userSearchInput = document.getElementById('user-search-input');
    const userSearchResultsEl = document.getElementById('user-search-results');
    const messageInput = document.getElementById('message-input');
    const sendMessageBtn = document.getElementById('send-message-btn');

    const loadConversations = async (currentUserId, container) => {
        const usersSnapshot = await db.collection('users').get();
        if (!container) return;
        container.innerHTML = '';
        usersSnapshot.forEach(doc => {
            if (doc.id === currentUserId) return;
            const userData = doc.data();
            const item = document.createElement('div');
            item.className = 'conversation-item';
            item.innerHTML = `<img src="${userData.photoURL || 'https://placehold.co/40x40'}" class="h-10 w-10 rounded-full mr-3"><span class="font-bold">${userData.displayName}</span>`;
            item.addEventListener('click', () => {
                 openChatForUser(currentUser, { id: doc.id, ...userData });
            });
            container.appendChild(item);
        });
    };

    loadConversations(currentUser.uid, conversationsListEl);

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
                openChatForUser(currentUser, { id: doc.id, ...userData });
                userSearchInput.value = '';
                userSearchResultsEl.innerHTML = '';
                userSearchResultsEl.classList.add('hidden');
            });
            userSearchResultsEl.appendChild(resultItem);
        });
    });

    const openChatForUser = (localUser, remoteUser) => {
        if (currentChatListener) currentChatListener();

        document.getElementById('chat-welcome-screen').classList.add('hidden');
        const chatView = document.getElementById('chat-view');
        chatView.classList.remove('hidden');
        chatView.classList.add('flex');

        document.getElementById('chat-header-avatar').src = remoteUser.photoURL;
        document.getElementById('chat-header-name').textContent = remoteUser.displayName;

        const conversationId = [localUser.uid, remoteUser.id].sort().join('_');
        const conversationRef = db.collection('conversations').doc(conversationId);
        const messagesContainer = document.getElementById('messages-container');

        currentChatListener = conversationRef.onSnapshot(doc => {
            messagesContainer.innerHTML = '';
            if (doc.exists) {
                const messages = doc.data().messages || [];
                messages.sort((a,b) => a.timestamp - b.timestamp).forEach(msg => {
                    const messageEl = document.createElement('div');
                    const isSent = msg.senderId === localUser.uid;
                    messageEl.className = `message ${isSent ? 'sent' : 'received'}`;
                    messageEl.innerHTML = `<div class="message-bubble">${msg.content}</div>`;
                    messagesContainer.appendChild(messageEl);
                });
            }
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        });

        const sendMessage = async () => {
            const content = messageInput.value.trim();
            if (!content) return;

            const newMessage = {
                content: content,
                senderId: localUser.uid,
                timestamp: firebase.firestore.FieldValue.serverTimestamp()
            };

            messageInput.value = '';
            await conversationRef.set({
                participants: [localUser.uid, remoteUser.id],
                lastMessage: content,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                messages: firebase.firestore.FieldValue.arrayUnion(newMessage)
            }, { merge: true });
        };

        sendMessageBtn.onclick = sendMessage;
        messageInput.onkeyup = (e) => { if (e.key === 'Enter') sendMessage(); };
    };
    
    const params = new URLSearchParams(window.location.search);
    const chatWithId = params.get('with');
    if (chatWithId) {
        db.collection('users').doc(chatWithId).get().then(doc => {
            if(doc.exists) {
                openChatForUser(currentUser, {id: doc.id, ...doc.data()});
            }
        });
    }
});
