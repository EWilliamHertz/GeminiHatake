/**
 * HatakeSocial - Messages Page Script (v13 - Index Link Generation)
 *
 * This script handles all logic for the messages.html page.
 * - FIX: Implements a robust user search by querying multiple fields and merging results.
 * - FIX: Ensures new conversations are created correctly and opened immediately.
 * - Creates notifications for the recipient when a new message is sent.
 * - NEW: Generates a direct link to create missing Firestore indexes on error.
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
    let currentConversationData = null;

    const conversationsListEl = document.getElementById('conversations-list');
    const userSearchInput = document.getElementById('user-search-input');
    const userSearchResultsEl = document.getElementById('user-search-results');
    const messageForm = document.getElementById('message-form');
    const messageInput = document.getElementById('message-input');
    const chatWelcomeScreen = document.getElementById('chat-welcome-screen');
    const chatView = document.getElementById('chat-view');
    const messageTabs = document.querySelectorAll('.message-tab-button');

    let activeTab = 'users';

    // --- Helper to generate a Firestore index creation link ---
    const generateIndexCreationLink = (collection, fields) => {
        const projectId = db.app.options.projectId;
        let url = `https://console.firebase.google.com/project/${projectId}/firestore/indexes/composite/create?collectionId=${collection}`;
        fields.forEach(field => {
            url += `&fields=${field.name},${field.order.toUpperCase()}`;
        });
        return url;
    };

    const createNotification = async (userId, message, link) => {
        const notificationData = {
            message: message,
            link: link,
            isRead: false,
            timestamp: new Date()
        };
        await db.collection('users').doc(userId).collection('notifications').add(notificationData);
    };

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
        let query = db.collection('conversations')
                      .where('participants', 'array-contains', currentUser.uid)
                      .where('isGroupChat', '==', isGroup)
                      .orderBy('updatedAt', 'desc');

        query.onSnapshot(snapshot => {
            if (snapshot.empty) {
                conversationsListEl.innerHTML = `<p class="p-4 text-center text-gray-500 dark:text-gray-400 text-sm">No ${activeTab} conversations.</p>`;
                return;
            }
            
            conversationsListEl.innerHTML = '';
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
            if (error.code === 'failed-precondition') {
                const indexFields = [
                    { name: 'participants', order: 'asc' },
                    { name: 'isGroupChat', order: 'asc' },
                    { name: 'updatedAt', order: 'desc' }
                ];
                const indexLink = generateIndexCreationLink('conversations', indexFields);
                const errorMessage = `
                    <div class="col-span-full text-center p-4 bg-red-100 dark:bg-red-900/50 rounded-lg">
                        <p class="font-bold text-red-700 dark:text-red-300">Database Error</p>
                        <p class="text-red-600 dark:text-red-400 mt-2">A required database index is missing for this query.</p>
                        <a href="${indexLink}" target="_blank" rel="noopener noreferrer" 
                           class="mt-4 inline-block px-6 py-2 bg-blue-600 text-white font-semibold rounded-full shadow-md hover:bg-blue-700">
                           Click Here to Create the Index
                        </a>
                        <p class="text-xs text-gray-500 mt-2">This will open the Firebase console. Click "Save" to create the index. It may take a few minutes to build.</p>
                    </div>
                 `;
                conversationsListEl.innerHTML = errorMessage;
            } else {
                conversationsListEl.innerHTML = `<p class="p-4 text-center text-red-500 text-sm">Could not load conversations.</p>`;
            }
        });
    };

    const openChat = (conversationId, title, imageUrl, conversationData) => {
        if (currentChatListener) currentChatListener();
        currentConversationId = conversationId;
        currentConversationData = conversationData;

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
                        <div class="flex items-center ${isSent ? 'flex-row-reverse' : ''} gap-2">
                           ${!isSent && conversation.isGroupChat ? `<img src="${senderInfo?.photoURL || 'https://placehold.co/40x40'}" class="h-6 w-6 rounded-full self-end">` : ''}
                            <div class="message-bubble">${msg.content}</div>
                        </div>
                         <div class="text-xs text-gray-400 mt-1 ${isSent ? 'text-right' : (conversation.isGroupChat ? 'text-left ml-8' : 'text-left')}">${new Date(msg.timestamp.toDate()).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
                    `;
                    messagesContainer.appendChild(messageEl);
                });
            }
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        });
    };

    const sendMessage = async () => {
        const content = messageInput.value.trim();
        if (!content || !currentConversationId || !currentConversationData) return;

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
            
            const recipients = currentConversationData.participants.filter(id => id !== currentUser.uid);
            for (const recipientId of recipients) {
                await createNotification(
                    recipientId,
                    `New message from ${currentUser.displayName}`,
                    `/messages.html?with=${currentUser.uid}`
                );
            }
        } catch (error) {
            console.error("Error sending message:", error);
            alert("Could not send message.");
        }
    };

    messageForm.addEventListener('submit', (e) => {
        e.preventDefault();
        sendMessage();
    });

    const startConversationWithUser = async (userId, userData) => {
        const conversationId = [currentUser.uid, userId].sort().join('_');
        const conversationRef = db.collection('conversations').doc(conversationId);

        try {
            const convoDoc = await conversationRef.get();
            if (!convoDoc.exists) {
                const currentUserDoc = await db.collection('users').doc(currentUser.uid).get();
                const currentUserData = currentUserDoc.data();
                await conversationRef.set({
                    participants: [currentUser.uid, userId],
                    participantInfo: {
                        [currentUser.uid]: { displayName: currentUserData.displayName, photoURL: currentUserData.photoURL },
                        [userId]: { displayName: userData.displayName, photoURL: userData.photoURL }
                    },
                    isGroupChat: false,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                    lastMessage: 'Conversation started.'
                }, { merge: true });
            }
            
            document.querySelector('.message-tab-button[data-tab="users"]').click();
            
            const newConvoData = (await conversationRef.get()).data();
            openChat(conversationId, userData.displayName, userData.photoURL, newConvoData);
        } catch (error) {
            console.error("Error starting conversation:", error);
            alert("Could not start conversation.");
        }
    };

    userSearchInput.addEventListener('keyup', async (e) => {
        const searchTerm = e.target.value.toLowerCase().trim();
        if (searchTerm.length < 2) {
            userSearchResultsEl.innerHTML = '';
            userSearchResultsEl.classList.add('hidden');
            return;
        }
        userSearchResultsEl.classList.remove('hidden');
        userSearchResultsEl.innerHTML = '<div class="p-2 text-sm text-gray-500">Searching...</div>';
        
        const usersRef = db.collection('users');
        // Firestore doesn't support OR queries on different fields.
        // We must run two separate queries and merge the results client-side.
        const queryByDisplayName = usersRef.orderBy('displayName_lower').startAt(searchTerm).endAt(searchTerm + '\uf8ff').get();
        const queryByHandle = usersRef.orderBy('handle').startAt(searchTerm).endAt(searchTerm + '\uf8ff').get();

        try {
            const [displayNameSnapshot, handleSnapshot] = await Promise.all([queryByDisplayName, queryByHandle]);
            
            const results = new Map();
            displayNameSnapshot.forEach(doc => {
                if (doc.id !== currentUser.uid) results.set(doc.id, doc.data());
            });
            handleSnapshot.forEach(doc => {
                if (doc.id !== currentUser.uid) results.set(doc.id, doc.data());
            });

            userSearchResultsEl.innerHTML = '';
            if (results.size === 0) {
                userSearchResultsEl.innerHTML = '<div class="p-2 text-sm text-gray-500">No users found</div>';
                return;
            }
            
            results.forEach((userData, userId) => {
                const resultItem = document.createElement('div');
                resultItem.className = 'flex items-center p-2 hover:bg-gray-100 dark:hover:bg-gray-600 cursor-pointer';
                resultItem.innerHTML = `
                    <img src="${userData.photoURL || 'https://i.imgur.com/B06rBhI.png'}" class="h-8 w-8 rounded-full mr-2 object-cover">
                    <span class="text-sm dark:text-gray-200">${userData.displayName} (@${userData.handle})</span>
                `;
                resultItem.addEventListener('click', () => {
                    userSearchInput.value = '';
                    userSearchResultsEl.classList.add('hidden');
                    startConversationWithUser(userId, userData);
                });
                userSearchResultsEl.appendChild(resultItem);
            });
        } catch (error) {
            console.error("User search error:", error);
            userSearchResultsEl.innerHTML = '<div class="p-2 text-sm text-red-500">Error searching. Required indexes might be missing.</div>';
        }
    });

    const checkForUrlParams = async () => {
        const params = new URLSearchParams(window.location.search);
        const userIdToMessage = params.get('with');

        if (userIdToMessage) {
            const userDoc = await db.collection('users').doc(userIdToMessage).get();
            if (userDoc.exists) {
                startConversationWithUser(userDoc.id, userDoc.data());
            }
        }
    };

    loadConversations();
    checkForUrlParams();
});
