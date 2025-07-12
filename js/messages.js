/**
 * HatakeSocial - Messages Page Script (v17 - UI Enhancements)
 *
 * This script handles all logic for the messages.html page.
 * It provides a clean, well-commented, and fully functional implementation
 * for real-time messaging.
 *
 * Key Features:
 * - Adds timestamps and sender avatars to messages for a better chat experience.
 * - Highlights the currently active conversation in the list for better UX.
 * - Fixes the "Could not start conversation" error by explicitly setting `isGroupChat: false`
 * when creating new one-on-one chats, satisfying Firestore index requirements.
 * - Robust real-time listeners for conversations and messages.
 * - User search functionality to initiate new chats.
 * - Handles URL parameters to open a chat directly (e.g., `messages.html?with=USER_ID`).
 * - Generates a direct link to create missing Firestore indexes on error, simplifying debugging.
 */
document.addEventListener('authReady', (e) => {
    const currentUser = e.detail.user;
    const chatArea = document.getElementById('chat-area');
    if (!chatArea) return; // Exit if not on the messages page

    if (!currentUser) {
        const mainContent = document.querySelector('main.container');
        if(mainContent) {
            mainContent.innerHTML = '<div class="flex items-center justify-center h-full"><p class="text-center p-8 text-gray-500 dark:text-gray-400">Please log in to view your messages.</p></div>';
        }
        return;
    }

    // --- STATE MANAGEMENT ---
    let currentChatListener = null;
    let currentConversationId = null;
    let currentConversationData = null;
    let activeTab = 'users';

    // --- DOM ELEMENT REFERENCES ---
    const conversationsListEl = document.getElementById('conversations-list');
    const userSearchInput = document.getElementById('user-search-input');
    const userSearchResultsEl = document.getElementById('user-search-results');
    const messageForm = document.getElementById('message-form');
    const messageInput = document.getElementById('message-input');
    const chatWelcomeScreen = document.getElementById('chat-welcome-screen');
    const chatView = document.getElementById('chat-view');
    const messageTabs = document.querySelectorAll('.message-tab-button');

    // --- HELPER FUNCTIONS ---
    const generateIndexCreationLink = (collection, fields) => {
        const projectId = db.app.options.projectId;
        let url = `https://console.firebase.google.com/project/${projectId}/firestore/indexes/composite/create?collectionId=${collection}`;
        fields.forEach(field => {
            url += `&fields=${field.name},${field.order.toUpperCase()}`;
        });
        return url;
    };

    const createNotification = async (userId, message, link) => {
        if (!userId || !message) return;
        const notificationData = {
            message: message,
            link: link || '#',
            isRead: false,
            timestamp: new Date()
        };
        try {
            await db.collection('users').doc(userId).collection('notifications').add(notificationData);
        } catch (error) {
            console.error("Error creating notification:", error);
        }
    };

    // --- CORE MESSAGING LOGIC ---
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
                let title = '', imageUrl = '', otherUserId = null;

                if (conversation.isGroupChat) {
                    title = conversation.groupName || 'Group Chat';
                    imageUrl = conversation.groupImage || 'https://placehold.co/40x40/cccccc/969696?text=G';
                } else {
                    otherUserId = conversation.participants.find(id => id !== currentUser.uid);
                    if (otherUserId && conversation.participantInfo && conversation.participantInfo[otherUserId]) {
                        const remoteUserInfo = conversation.participantInfo[otherUserId];
                        title = remoteUserInfo.displayName || 'Unknown User';
                        imageUrl = remoteUserInfo.photoURL || 'https://placehold.co/40x40/cccccc/969696?text=U';
                    } else { return; }
                }
                
                const item = document.createElement('div');
                item.className = 'conversation-item flex items-center p-3 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 border-b border-gray-200 dark:border-gray-600';
                item.dataset.convoId = convoId;
                if (convoId === currentConversationId) {
                    item.classList.add('bg-blue-50', 'dark:bg-blue-900/50');
                }

                item.innerHTML = `
                    <img src="${imageUrl}" class="h-12 w-12 rounded-full mr-3 object-cover flex-shrink-0">
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
                const indexFields = [{ name: 'participants', order: 'asc' }, { name: 'isGroupChat', order: 'asc' }, { name: 'updatedAt', order: 'desc' }];
                const indexLink = generateIndexCreationLink('conversations', indexFields);
                const errorMessage = `<div class="p-4 bg-red-100 dark:bg-red-900/50 rounded-lg text-center"><p class="font-bold text-red-700 dark:text-red-300">Database Error</p><p class="text-red-600 dark:text-red-400 mt-2 text-sm">A required database index is missing.</p><a href="${indexLink}" target="_blank" rel="noopener noreferrer" class="mt-4 inline-block px-4 py-2 bg-blue-600 text-white font-semibold rounded-full shadow-md hover:bg-blue-700 text-sm">Click Here to Create the Index</a><p class="text-xs text-gray-500 mt-2">This opens Firebase. Click "Save" to create the index. It may take a few minutes.</p></div>`;
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

        document.querySelectorAll('.conversation-item').forEach(item => {
            item.classList.toggle('bg-blue-50', item.dataset.convoId === conversationId);
            item.classList.toggle('dark:bg-blue-900/50', item.dataset.convoId === conversationId);
        });

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
                    const isSentByCurrentUser = msg.senderId === currentUser.uid;
                    const senderInfo = conversation.participantInfo[msg.senderId];
                    const timestamp = msg.timestamp ? new Date(msg.timestamp.toDate()) : new Date();
                    const formattedTime = timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                    messageEl.className = `message-group flex flex-col ${isSentByCurrentUser ? 'items-end' : 'items-start'}`;
                    
                    messageEl.innerHTML = `
                        <div class="flex items-end gap-2 ${isSentByCurrentUser ? 'flex-row-reverse' : ''}">
                            <div class="message-bubble">
                                <p class="text-sm font-normal">${msg.content}</p>
                            </div>
                        </div>
                        <p class="message-timestamp">${formattedTime}</p>
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
            alert("Could not send message. Please try again.");
            messageInput.value = content;
        }
    };

    const startConversationWithUser = async (userId, userData) => {
        const conversationId = [currentUser.uid, userId].sort().join('_');
        const conversationRef = db.collection('conversations').doc(conversationId);

        try {
            const convoDoc = await conversationRef.get();
            
            if (!convoDoc.exists) {
                const currentUserDoc = await db.collection('users').doc(currentUser.uid).get();
                if (!currentUserDoc.exists) throw new Error("Could not find current user's profile data.");
                const currentUserData = currentUserDoc.data();
                
                const newConversationData = {
                    participants: [currentUser.uid, userId],
                    participantInfo: {
                        [currentUser.uid]: { displayName: currentUserData.displayName, photoURL: currentUserData.photoURL },
                        [userId]: { displayName: userData.displayName, photoURL: userData.photoURL }
                    },
                    isGroupChat: false,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                    lastMessage: 'Conversation started.',
                    messages: []
                };
                await conversationRef.set(newConversationData);
            }
            
            document.querySelector('.message-tab-button[data-tab="users"]').click();
            
            const finalConvoData = (await conversationRef.get()).data();
            openChat(conversationId, userData.displayName, userData.photoURL, finalConvoData);

        } catch (error) {
            console.error("Error starting conversation:", error);
            alert(`Could not start conversation. Error: ${error.message}. Please check console for details.`);
        }
    };

    // --- EVENT LISTENERS ---
    messageTabs.forEach(button => {
        button.addEventListener('click', () => {
            messageTabs.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            activeTab = button.dataset.tab;
            loadConversations();
        });
    });

    messageForm.addEventListener('submit', (e) => {
        e.preventDefault();
        sendMessage();
    });

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
        const queryByDisplayName = usersRef.orderBy('displayName_lower').startAt(searchTerm).endAt(searchTerm + '\uf8ff').get();
        const queryByHandle = usersRef.orderBy('handle').startAt(searchTerm).endAt(searchTerm + '\uf8ff').get();

        try {
            const [displayNameSnapshot, handleSnapshot] = await Promise.all([queryByDisplayName, queryByHandle]);
            
            const results = new Map();
            displayNameSnapshot.forEach(doc => { if (doc.id !== currentUser.uid) results.set(doc.id, doc.data()); });
            handleSnapshot.forEach(doc => { if (doc.id !== currentUser.uid) results.set(doc.id, doc.data()); });

            userSearchResultsEl.innerHTML = '';
            if (results.size === 0) {
                userSearchResultsEl.innerHTML = '<div class="p-2 text-sm text-gray-500">No users found</div>';
                return;
            }
            
            results.forEach((userData, userId) => {
                const resultItem = document.createElement('div');
                resultItem.className = 'flex items-center p-2 hover:bg-gray-100 dark:hover:bg-gray-600 cursor-pointer';
                resultItem.innerHTML = `<img src="${userData.photoURL || 'https://i.imgur.com/B06rBhI.png'}" class="h-8 w-8 rounded-full mr-2 object-cover"><span class="text-sm dark:text-gray-200">${userData.displayName} (@${userData.handle})</span>`;
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

    document.addEventListener('click', (e) => {
        if (!userSearchInput.contains(e.target) && !userSearchResultsEl.contains(e.target)) {
            userSearchResultsEl.classList.add('hidden');
        }
    });

    const checkForUrlParams = async () => {
        const params = new URLSearchParams(window.location.search);
        const userIdToMessage = params.get('with');
        if (userIdToMessage) {
            try {
                const userDoc = await db.collection('users').doc(userIdToMessage).get();
                if (userDoc.exists) {
                    startConversationWithUser(userDoc.id, userDoc.data());
                } else {
                    console.warn("User ID from URL parameter not found.");
                }
            } catch (error) {
                console.error("Error fetching user from URL parameter:", error);
            }
        }
    };

    // --- INITIALIZATION ---
    loadConversations();
    checkForUrlParams();
});
