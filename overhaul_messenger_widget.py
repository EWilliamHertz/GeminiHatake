import os
from bs4 import BeautifulSoup

def update_widget_html_structure():
    """
    Replaces the old widget structure with a new, two-pane design
    in all HTML files where the widget exists.
    """
    print("Starting HTML structure update for messenger widget...")
    public_dir = "public"
    # Exclude files that shouldn't have the widget
    excluded_files = ["messages.html", "index.html", "auth.html"]
    
    new_widget_body_html = """
    <div class="bg-white dark:bg-gray-800 h-96 border-x border-b border-gray-300 dark:border-gray-600 rounded-b-lg flex flex-col overflow-hidden" id="messenger-widget-body">
        <div class="h-full flex flex-col" id="widget-list-view">
            <div class="flex-grow overflow-y-auto" id="widget-conversations-list">
                <p class="p-4 text-center text-gray-500">Loading...</p>
            </div>
        </div>
        <div class="h-full flex-col hidden" id="widget-chat-view">
            <div class="p-3 border-b border-gray-200 dark:border-gray-700 flex items-center space-x-3 flex-shrink-0" id="widget-chat-header">
                <i class="fas fa-arrow-left cursor-pointer p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full" id="widget-back-btn"></i>
                <img alt="Avatar" class="w-8 h-8 rounded-full object-cover" id="widget-chat-avatar" src="https://placehold.co/32x32"/>
                <span class="font-semibold truncate" id="widget-chat-name">User</span>
            </div>
            <div class="flex-grow p-3 overflow-y-auto space-y-3" id="widget-messages-container">
                </div>
            <div class="p-2 border-t border-gray-200 dark:border-gray-700 flex-shrink-0">
                <form class="flex items-center space-x-2" id="widget-message-form">
                    <input autocomplete="off" class="flex-1 p-2 border rounded-full bg-gray-100 dark:bg-gray-700 dark:border-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm" id="widget-message-input" placeholder="Type a message..." type="text"/>
                    <button class="bg-blue-600 text-white rounded-full h-8 w-8 flex items-center justify-center hover:bg-blue-700 flex-shrink-0" type="submit">
                        <i class="fas fa-paper-plane text-xs"></i>
                    </button>
                </form>
            </div>
        </div>
    </div>
    """

    for file_name in os.listdir(public_dir):
        if file_name.endswith(".html") and file_name not in excluded_files:
            file_path = os.path.join(public_dir, file_name)
            with open(file_path, "r", encoding="utf-8") as f:
                soup = BeautifulSoup(f, "html.parser")

            widget_body = soup.find("div", id="messenger-widget-body")
            if widget_body:
                widget_body.replace_with(BeautifulSoup(new_widget_body_html, "html.parser"))
                with open(file_path, "w", encoding="utf-8") as f:
                    f.write(str(soup))
                print(f"Updated widget HTML in: {file_name}")

def update_widget_javascript():
    """
    Replaces the content of messenger.js with a completely new script
    to handle the redesigned UI and fix functionality bugs.
    """
    print("Updating messenger.js with new logic...")
    messenger_js_path = "public/js/messenger.js"

    new_js_content = """
document.addEventListener('DOMContentLoaded', () => {
    const db = firebase.firestore();
    const auth = firebase.auth();

    // Main Widget Elements
    const widgetContainer = document.getElementById('messenger-widget-container');
    if (!widgetContainer) return;

    const openBtn = document.getElementById('messenger-open-btn');
    const widgetHeader = document.getElementById('messenger-widget-header');
    const toggleIcon = document.getElementById('widget-toggle-icon');

    // View Containers
    const listView = document.getElementById('widget-list-view');
    const chatView = document.getElementById('widget-chat-view');

    // Conversation List Elements
    const conversationsList = document.getElementById('widget-conversations-list');

    // Active Chat Elements
    const backBtn = document.getElementById('widget-back-btn');
    const chatHeaderName = document.getElementById('widget-chat-name');
    const chatHeaderAvatar = document.getElementById('widget-chat-avatar');
    const messagesContainer = document.getElementById('widget-messages-container');
    const messageForm = document.getElementById('widget-message-form');
    const messageInput = document.getElementById('widget-message-input');

    let currentUser = null;
    let conversationsUnsubscribe = null;
    let messagesUnsubscribe = null;

    // --- UTILITY FUNCTIONS ---
    const formatTimestamp = (timestamp) => {
        if (!timestamp || typeof timestamp.toDate !== 'function') return '';
        return timestamp.toDate().toLocaleString();
    };

    // --- VIEW MANAGEMENT ---
    const showListView = () => {
        if (messagesUnsubscribe) messagesUnsubscribe(); // Stop listening to old messages
        messagesUnsubscribe = null;
        if (chatView) chatView.classList.add('hidden');
        if (listView) listView.classList.remove('hidden');
    };

    const showChatView = () => {
        if (listView) listView.classList.add('hidden');
        if (chatView) chatView.classList.remove('hidden');
    };

    // --- DATA FETCHING & RENDERING ---
    const renderMessages = (messages) => {
        if (!messagesContainer || !currentUser) return;
        messagesContainer.innerHTML = messages.map(msg => {
            const isSender = msg.senderId === currentUser.uid;
            return `
                <div class="flex ${isSender ? 'justify-end' : 'justify-start'}">
                    <div class="max-w-[75%] p-2 rounded-lg text-sm ${isSender ? 'bg-blue-500 text-white' : 'bg-gray-200 dark:bg-gray-600'}">
                        <p>${msg.text}</p>
                    </div>
                </div>
            `;
        }).join('');
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    };

    const openConversation = async (conversationId) => {
        if (!currentUser) return;
        showChatView();
        messagesContainer.innerHTML = '<p class="text-center text-gray-500">Loading messages...</p>';

        const convDoc = await db.collection('conversations').doc(conversationId).get();
        const convData = convDoc.data();
        const otherUserId = convData.participants.find(p => p !== currentUser.uid);

        const userDoc = await db.collection('users').doc(otherUserId).get();
        const userData = userDoc.data();

        chatHeaderName.textContent = userData.displayName || 'Chat';
        chatHeaderAvatar.src = userData.profilePic || 'https://placehold.co/32x32';

        if (messagesUnsubscribe) messagesUnsubscribe();
        messagesUnsubscribe = db.collection('conversations').doc(conversationId).collection('messages')
            .orderBy('timestamp', 'asc')
            .onSnapshot(snapshot => {
                const messages = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                renderMessages(messages);
            });
        
        messageForm.dataset.conversationId = conversationId;
    };

    const renderConversations = (conversations) => {
        if (!conversationsList || !currentUser) return;
        if (conversations.length === 0) {
            conversationsList.innerHTML = '<p class="p-4 text-center text-gray-500">No conversations yet.</p>';
            return;
        }
        conversationsList.innerHTML = conversations.map(conv => `
            <div class="conversation-item p-3 border-b border-gray-200 dark:border-gray-700 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center space-x-3" data-id="${conv.id}">
                <img src="${conv.otherUser.profilePic || 'https://placehold.co/40x40'}" alt="Avatar" class="w-10 h-10 rounded-full object-cover flex-shrink-0">
                <div class="overflow-hidden">
                    <p class="font-semibold truncate">${conv.otherUser.displayName || 'User'}</p>
                    <p class="text-sm text-gray-500 truncate">${conv.data.lastMessage || 'No messages yet.'}</p>
                </div>
            </div>
        `).join('');
    };

    const loadConversations = () => {
        if (!currentUser) return;
        if (conversationsUnsubscribe) conversationsUnsubscribe();

        conversationsUnsubscribe = db.collection('conversations')
            .where('participants', 'array-contains', currentUser.uid)
            .orderBy('lastUpdated', 'desc')
            .onSnapshot(async (snapshot) => {
                const promises = snapshot.docs.map(async (doc) => {
                    const data = doc.data();
                    const otherUserId = data.participants.find(p => p !== currentUser.uid);
                    if (!otherUserId) return null;
                    const userDoc = await db.collection('users').doc(otherUserId).get();
                    return {
                        id: doc.id,
                        data,
                        otherUser: userDoc.exists ? userDoc.data() : {}
                    };
                });
                const conversations = (await Promise.all(promises)).filter(Boolean);
                renderConversations(conversations);
            });
    };
    
    // --- EVENT LISTENERS ---
    auth.onAuthStateChanged(user => {
        currentUser = user;
        if (conversationsUnsubscribe) conversationsUnsubscribe();
        if (messagesUnsubscribe) messagesUnsubscribe();

        if (currentUser) {
            loadConversations();
            // Attach new conversation logic
            initializeNewConversationLogic(currentUser);
        } else {
            conversationsList.innerHTML = '<p class="p-4 text-center text-gray-500">Please log in to chat.</p>';
        }
    });

    // Open/close widget
    widgetHeader.addEventListener('click', () => widgetContainer.classList.toggle('minimized'));
    openBtn.addEventListener('click', () => widgetContainer.classList.remove('minimized'));
    
    // Go back from active chat to list
    backBtn.addEventListener('click', showListView);

    // Open conversation from list (event delegation)
    conversationsList.addEventListener('click', (e) => {
        const conversationItem = e.target.closest('.conversation-item');
        if (conversationItem && conversationItem.dataset.id) {
            openConversation(conversationItem.dataset.id);
        }
    });

    // Send message
    messageForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const conversationId = e.currentTarget.dataset.conversationId;
        const text = messageInput.value.trim();
        if (!text || !conversationId || !currentUser) return;

        messageInput.value = '';

        const batch = db.batch();
        const messageRef = db.collection('conversations').doc(conversationId).collection('messages').doc();
        batch.set(messageRef, {
            text: text,
            senderId: currentUser.uid,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });

        const conversationRef = db.collection('conversations').doc(conversationId);
        batch.update(conversationRef, {
            lastMessage: text,
            lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
        });

        await batch.commit();
    });

    // New conversation logic (adapted from previous step)
    function initializeNewConversationLogic(currentUser) {
        const newConversationModal = document.getElementById('new-conversation-modal');
        const userSearchInput = document.getElementById('user-search-input');
        const userSearchResults = document.getElementById('user-search-results');
        const widgetNewConversationBtn = document.getElementById('widget-new-conversation-btn');
        const closeModalBtns = document.querySelectorAll('.close-modal-btn');

        if (widgetNewConversationBtn) {
            widgetNewConversationBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (newConversationModal) newConversationModal.classList.remove('hidden');
            });
        }
        
        closeModalBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                if (newConversationModal) newConversationModal.classList.add('hidden');
            });
        });

        let searchTimeout;
        if (userSearchInput) {
            userSearchInput.addEventListener('input', () => {
                clearTimeout(searchTimeout);
                searchTimeout = setTimeout(() => {
                    const searchTerm = userSearchInput.value.trim();
                    if (searchTerm.length > 1) searchUsers(searchTerm, currentUser, db);
                }, 300);
            });
        }
    }

    async function searchUsers(searchTerm, currentUser, db) {
        const userSearchResults = document.getElementById('user-search-results');
        const usersRef = db.collection('users');
        const snapshot = await usersRef.where('handle', '>=', searchTerm.toLowerCase()).where('handle', '<=', searchTerm.toLowerCase() + '\\uf8ff').limit(10).get();
        userSearchResults.innerHTML = '';
        snapshot.forEach(doc => {
            if (doc.id === currentUser.uid) return;
            const userData = doc.data();
            const userElement = document.createElement('div');
            userElement.className = 'p-3 flex items-center hover:bg-gray-700 cursor-pointer rounded-md';
            userElement.innerHTML = `<img src="${userData.profilePic || 'https://placehold.co/40x40'}" alt="Avatar" class="w-10 h-10 rounded-full mr-3 object-cover"><div><p class="font-semibold">${userData.displayName}</p><p class="text-sm text-gray-400">@${userData.handle}</p></div>`;
            userElement.addEventListener('click', () => startConversation(doc.id, currentUser, db));
            userSearchResults.appendChild(userElement);
        });
    }

    async function startConversation(otherUserId, currentUser, db) {
        document.getElementById('new-conversation-modal').classList.add('hidden');
        
        const conversationsRef = db.collection('conversations');
        const snapshot = await conversationsRef.where('participants', 'array-contains', currentUser.uid).get();
        
        let existingConvId = null;
        snapshot.forEach(doc => {
            const data = doc.data();
            if (data.participants.includes(otherUserId) && data.participants.length === 2) {
                existingConvId = doc.id;
            }
        });

        if (existingConvId) {
            openConversation(existingConvId);
        } else {
            const newConv = await conversationsRef.add({
                participants: [currentUser.uid, otherUserId],
                lastUpdated: firebase.firestore.FieldValue.serverTimestamp(),
                lastMessage: '',
                isGroupChat: false,
            });
            openConversation(newConv.id);
        }
    }
});
    """
    
    with open(messenger_js_path, "w", encoding="utf-8") as f:
        f.write(new_js_content)
    print(f"Rewrote {messenger_js_path} with full functionality.")

if __name__ == "__main__":
    update_widget_html_structure()
    update_widget_javascript()
    print("\\nProcess complete. This was a major update, so please do a hard refresh (Ctrl+Shift+R) on your site to see the changes.")
