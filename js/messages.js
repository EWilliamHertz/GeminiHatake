/**
 * HatakeSocial - Messages Page Script (v7 - Final Fix)
 *
 * This script handles all logic for the messages.html page.
 * - Corrects the Firestore query to consistently use the 'participants' field.
 * - Ensures both user and group chats load correctly.
 */
document.addEventListener('authReady', (e) => {
    const currentUser = e.detail.user;
    const chatArea = document.getElementById('chat-area');
    if (!chatArea) return;

    if (!currentUser) {
        chatArea.innerHTML = '<div class="flex items-center justify-center h-full"><p class="text-center p-8 text-gray-500 dark:text-gray-400">Please log in to view your messages.</p></div>';
        return;
    }

    
    let currentChatListener = null;
    let currentConversationId = null;

    const conversationsListEl = document.getElementById('conversations-list');
    const userSearchInput = document.getElementById('user-search-input');
    const userSearchResultsEl = document.getElementById('user-search-results');
    const messageInput = document.getElementById('message-input');
    const sendMessageBtn = document.getElementById('send-message-btn');
    const chatWelcomeScreen = document.getElementById('chat-welcome-screen');
    const chatView = document.getElementById('chat-view');
    const messageTabs = document.querySelectorAll('.message-tab-button');

    let activeTab = 'users';

    messageTabs.forEach(button => {
        button.addEventListener('click', () => {
            messageTabs.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            activeTab = button.dataset.tab;
            loadConversations();
        });
    });

    const loadConversations = () => {
        conversationsListEl.innerHTML = '<p class="p-4 text-center text-gray-500 dark:text-gray-400 text-sm">Loading...</p>';
        
        const isGroup = activeTab === 'groups';
        let query = db.collection('conversations')
                      .where('participants', 'array-contains', currentUser.uid)
                      .where('isGroupChat', '==', isGroup)
                      .orderBy('updatedAt', 'desc');

        query.onSnapshot(snapshot => {
            conversationsListEl.innerHTML = '';
            if (snapshot.empty) {
                conversationsListEl.innerHTML = `<p class="p-4 text-center text-gray-500 dark:text-gray-400 text-sm">No ${activeTab} conversations.</p>`;
                return;
            }
            snapshot.forEach(doc => {
                const conversation = doc.data();
                const convoId = doc.id;
                let title = '';
                let imageUrl = '';

                if (conversation.isGroupChat) {
                    title = conversation.groupName || 'Group Chat';
                    imageUrl = conversation.groupImage || 'https://placehold.co/40x40/cccccc/969696?text=G';
                } else {
                    const remoteUserId = conversation.participants.find(id => id !== currentUser.uid);
                    const remoteUserInfo = conversation.participantInfo[remoteUserId];
                    title = remoteUserInfo?.displayName || 'Unknown User';
                    imageUrl = remoteUserInfo?.photoURL || 'https://placehold.co/40x40?text=U';
                }
                
                const item = document.createElement('div');
                item.className = 'conversation-item';
                item.innerHTML = `
                    <img src="${imageUrl}" class="h-12 w-12 rounded-full mr-3 object-cover">
                    <div class="flex-grow overflow-hidden">
                        <span class="font-bold text-gray-800 dark:text-white">${title}</span>
                        <p class="text-sm text-gray-500 dark:text-gray-400 truncate">${conversation.lastMessage || 'No messages yet'}</p>
                    </div>
                `;
                item.addEventListener('click', () => openChat(convoId, title, imageUrl));
                conversationsListEl.appendChild(item);
            });
        }, error => {
            console.error(`Error loading ${activeTab} conversations:`, error);
            conversationsListEl.innerHTML = `<p class="p-4 text-center text-red-500 text-sm">Could not load ${activeTab}. Check Firestore indexes.</p>`;
        });
    };

    const openChat = (conversationId, title, imageUrl) => {
        if (currentChatListener) currentChatListener();
        currentConversationId = conversationId;

        chatWelcomeScreen.classList.add('hidden');
        chatView.classList.remove('hidden');
        chatView.classList.add('flex');

        document.getElementById('chat-header-avatar').src = imageUrl;
        document.getElementById('chat-header-name').textContent = title;

        const conversationRef = db.collection('conversations').doc(conversationId);
        const messagesContainer = document.getElementById('messages-container');

        currentChatListener = conversationRef.onSnapshot(doc => {
            messagesContainer.innerHTML = '';
            if (doc.exists) {
                const conversation = doc.data();
                const messages = conversation.messages || [];
                
                messages.forEach(msg => {
                    const messageEl = document.createElement('div');
                    const isSent = msg.senderId === currentUser.uid;
                    const senderInfo = conversation.participantInfo[msg.senderId];
                    
                    messageEl.className = `message-group ${isSent ? 'sent' : 'received'}`;
                    messageEl.innerHTML = `
                        <div class="message-header">
                            <span class="font-bold text-sm text-gray-800 dark:text-white">${senderInfo?.displayName || '...'}</span>
                            <span class="text-xs text-gray-500 dark:text-gray-400 ml-2">${new Date(msg.timestamp.toDate()).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                        </div>
                        <div class="message-bubble">${msg.content}</div>
                    `;
                    messagesContainer.appendChild(messageEl);
                });
            }
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        });
    };

    const sendMessage = async () => {
        const content = messageInput.value.trim();
        if (!content || !currentConversationId) return;

        const conversationRef = db.collection('conversations').doc(currentConversationId);
        const newMessage = {
            content: content,
            senderId: currentUser.uid,
            timestamp: new Date() 
        };
        
        messageInput.value = '';
        try {
            await conversationRef.update({
                messages: firebase.firestore.FieldValue.arrayUnion(newMessage),
                lastMessage: content,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        } catch (error) {
            console.error("Error sending message:", error);
            alert("Could not send message.");
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
            resultItem.className = 'p-2 hover:bg-gray-100 dark:hover:bg-gray-600 cursor-pointer';
            resultItem.textContent = userData.displayName;
            resultItem.addEventListener('click', async () => {
                const conversationId = [currentUser.uid, doc.id].sort().join('_');
                const conversationRef = db.collection('conversations').doc(conversationId);
                await conversationRef.set({
                    participants: [currentUser.uid, doc.id],
                    participantInfo: {
                        [currentUser.uid]: { displayName: currentUser.displayName, photoURL: currentUser.photoURL },
                        [doc.id]: { displayName: userData.displayName, photoURL: userData.photoURL }
                    },
                    isGroupChat: false,
                    updatedAt: new Date()
                }, { merge: true });

                openChat(conversationId, userData.displayName, userData.photoURL);
                userSearchInput.value = '';
                userSearchResultsEl.innerHTML = '';
                userSearchResultsEl.classList.add('hidden');
            });
            userSearchResultsEl.appendChild(resultItem);
        });
    });

    loadConversations();
});
