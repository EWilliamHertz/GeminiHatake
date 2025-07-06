/**
 * HatakeSocial - Messages Page Script (v8 - Index-Reliant Fix)
 *
 * This script handles all logic for the messages.html page.
 * - FIX: Corrects the Firestore queries to be compliant with the required indexes.
 * - FIX: Ensures both user and group chats load correctly after indexes are built.
 * - FIX: Improves logic for creating new 1-on-1 conversations.
 
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
        conversationsListEl.innerHTML = '<div class="text-center p-4"><i class="fas fa-spinner fa-spin text-blue-500"></i></div>';
        
        const isGroup = activeTab === 'groups';
        // FIX: This query requires a composite index in Firestore.
        let query = db.collection('conversations')
                      .where('participants', 'array-contains', currentUser.uid)
                      .where('isGroupChat', '==', isGroup)
                      .orderBy('updatedAt', 'desc');

        query.onSnapshot(snapshot => {
            if (snapshot.empty) {
                conversationsListEl.innerHTML = `<p class="p-4 text-center text-gray-500 dark:text-gray-400 text-sm">No ${activeTab} conversations.</p>`;
                return;
            }
            
            conversationsListEl.innerHTML = ''; // Clear spinner
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
                    if (remoteUserId && conversation.participantInfo && conversation.participantInfo[remoteUserId]) {
                        const remoteUserInfo = conversation.participantInfo[remoteUserId];
                        title = remoteUserInfo.displayName || 'Unknown User';
                        imageUrl = remoteUserInfo.photoURL || 'https://placehold.co/40x40?text=U';
                    } else {
                        // Skip rendering if data is incomplete
                        return;
                    }
                }
                
                const item = document.createElement('div');
                item.className = 'conversation-item flex items-center p-3 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 border-b border-gray-200 dark:border-gray-600';
                item.innerHTML = `
                    <img src="${imageUrl}" class="h-12 w-12 rounded-full mr-3 object-cover">
                    <div class="flex-grow overflow-hidden">
                        <span class="font-bold text-gray-800 dark:text-white">${title}</span>
                        <p class="text-sm text-gray-500 dark:text-gray-400 truncate">${conversation.lastMessage || 'No messages yet'}</p>
                    </div>
                `;
                item.addEventListener('click', () => openChat(convoId, title, imageUrl, conversation));
                conversationsListEl.appendChild(item);
            });
        }, error => {
            console.error(`Error loading ${activeTab} conversations:`, error);
            conversationsListEl.innerHTML = `<p class="p-4 text-center text-red-500 text-sm">Could not load conversations. This is likely due to a missing database index. Please check the setup instructions.</p>`;
        });
    };

    const openChat = (conversationId, title, imageUrl, conversationData) => {
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
                        <div class="flex items-center ${isSent ? 'flex-row-reverse' : ''}">
                           ${!isSent ? `<img src="${senderInfo?.photoURL || 'https://placehold.co/40x40'}" class="h-6 w-6 rounded-full mr-2">` : ''}
                            <div class="message-bubble">${msg.content}</div>
                        </div>
                         <div class="text-xs text-gray-400 mt-1 ${isSent ? 'text-right' : 'text-left ml-8'}">${new Date(msg.timestamp.toDate()).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
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
            // Use server timestamp for updatedAt for consistency
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
        const searchTerm = e.target.value.toLowerCase().trim();
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
        if (snapshot.empty) {
            userSearchResultsEl.innerHTML = '<div class="p-2 text-sm text-gray-500">No users found</div>';
            return;
        }
        snapshot.forEach(doc => {
            if (doc.id === currentUser.uid) return;
            const userData = doc.data();
            const resultItem = document.createElement('div');
            resultItem.className = 'p-2 hover:bg-gray-100 dark:hover:bg-gray-600 cursor-pointer';
            resultItem.textContent = userData.displayName;
            resultItem.addEventListener('click', async () => {
                userSearchInput.value = '';
                userSearchResultsEl.classList.add('hidden');
                
                // Create a consistent ID for 1-on-1 chats
                const conversationId = [currentUser.uid, doc.id].sort().join('_');
                const conversationRef = db.collection('conversations').doc(conversationId);

                const convoDoc = await conversationRef.get();
                if (!convoDoc.exists) {
                    // Create conversation if it doesn't exist
                    const currentUserData = await db.collection('users').doc(currentUser.uid).get();
                    await conversationRef.set({
                        participants: [currentUser.uid, doc.id],
                        participantInfo: {
                            [currentUser.uid]: { displayName: currentUserData.data().displayName, photoURL: currentUserData.data().photoURL },
                            [doc.id]: { displayName: userData.displayName, photoURL: userData.photoURL }
                        },
                        isGroupChat: false,
                        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                        lastMessage: 'Conversation started.'
                    }, { merge: true });
                }
                
                // Switch to users tab and reload
                document.querySelector('.message-tab-button[data-tab="users"]').click();
                
                // Open the chat
                const newConvoData = (await conversationRef.get()).data();
                openChat(conversationId, userData.displayName, userData.photoURL, newConvoData);

            });
            userSearchResultsEl.appendChild(resultItem);
        });
    });

    loadConversations();
});
