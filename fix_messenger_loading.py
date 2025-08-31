import os

def fix_messenger_js():
    messenger_js_path = "public/js/messenger.js"
    
    # Check if the file exists before trying to modify it
    if not os.path.exists(messenger_js_path):
        print(f"Error: {messenger_js_path} not found. Please run the initial installation script first.")
        return

    # New, more robust content for messenger.js
    new_messenger_js_content = """
document.addEventListener('DOMContentLoaded', () => {
    const db = firebase.firestore();
    const auth = firebase.auth();

    const widgetContainer = document.getElementById('messenger-widget-container');
    if (!widgetContainer) return; // Exit if widget is not on this page

    const openBtn = document.getElementById('messenger-open-btn');
    const widget = document.getElementById('messenger-widget');
    const widgetHeader = document.getElementById('messenger-widget-header');
    const widgetBody = document.getElementById('messenger-widget-body');
    const conversationsList = document.getElementById('widget-conversations-list');
    const toggleIcon = document.getElementById('widget-toggle-icon');

    let currentUser = null;
    let conversationsListener = null;

    // Check settings for widget visibility
    if (localStorage.getItem('messengerWidget-visible') === 'false') {
        widgetContainer.classList.add('hidden');
    }

    auth.onAuthStateChanged(user => {
        currentUser = user;
        if (conversationsListener) conversationsListener(); // Detach any old listener
        
        if (currentUser) {
            loadConversations();
        } else {
            conversationsList.innerHTML = '<p class="p-4 text-center text-gray-500">Please log in to see your messages.</p>';
        }
    });

    function formatTimestamp(timestamp) {
        if (!timestamp || typeof timestamp.toDate !== 'function') return '';
        const date = timestamp.toDate();
        return date.toLocaleString();
    }

    function loadConversations() {
        if (!currentUser) return;

        conversationsList.innerHTML = '<p class="p-4 text-center text-gray-500">Loading conversations...</p>';

        conversationsListener = db.collection('conversations')
            .where('participants', 'array-contains', currentUser.uid)
            .orderBy('lastMessageTimestamp', 'desc')
            .onSnapshot(async (querySnapshot) => {
                try {
                    if (querySnapshot.empty) {
                        conversationsList.innerHTML = '<p class="p-4 text-center text-gray-500">No conversations yet.</p>';
                        return;
                    }

                    const promises = querySnapshot.docs.map(doc => {
                        const conversation = doc.data();
                        const otherParticipantId = conversation.participants.find(p => p !== currentUser.uid);
                        if (!otherParticipantId) return Promise.resolve(null);

                        return db.collection('users').doc(otherParticipantId).get().then(userDoc => {
                            if (!userDoc.exists) return null;
                            return {
                                id: doc.id,
                                data: conversation,
                                otherUser: userDoc.data()
                            };
                        });
                    });

                    const conversations = (await Promise.all(promises)).filter(Boolean);

                    if (conversations.length === 0) {
                         conversationsList.innerHTML = '<p class="p-4 text-center text-gray-500">No conversations to display.</p>';
                         return;
                    }

                    conversationsList.innerHTML = conversations.map(conv => `
                        <div class="conversation-item p-3 border-b border-gray-200 dark:border-gray-700 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center space-x-3" data-id="${conv.id}">
                            <img src="${conv.otherUser.profilePic || 'https://placehold.co/40x40'}" alt="Avatar" class="w-10 h-10 rounded-full object-cover flex-shrink-0">
                            <div class="overflow-hidden">
                                <p class="font-semibold truncate">${conv.otherUser.displayName || 'User'}</p>
                                <p class="text-sm text-gray-500 truncate">${conv.data.lastMessage || ''}</p>
                                <p class="text-xs text-gray-400">${formatTimestamp(conv.data.lastMessageTimestamp)}</p>
                            </div>
                        </div>
                    `).join('');

                } catch (error) {
                    console.error("Error processing conversations snapshot:", error);
                    conversationsList.innerHTML = '<p class="p-4 text-center text-red-500">Error displaying conversations.</p>';
                }
            }, (error) => {
                console.error("Firestore listener error:", error);
                conversationsList.innerHTML = '<p class="p-4 text-center text-red-500">Could not fetch messages. Check console for details.</p>';
                if (error.code === 'failed-precondition') {
                    console.warn("This query likely requires a composite index in Firestore. The error message above should contain a link to create it in the Firebase console.");
                }
            });
    }

    if (widgetHeader) {
        widgetHeader.addEventListener('click', () => {
            widgetContainer.classList.toggle('minimized');
            if (toggleIcon) {
                toggleIcon.classList.toggle('fa-chevron-down');
                toggleIcon.classList.toggle('fa-chevron-up');
            }
        });
    }
    
    if (openBtn) {
        openBtn.addEventListener('click', () => {
            widgetContainer.classList.remove('minimized');
            if (toggleIcon) {
                toggleIcon.classList.remove('fa-chevron-down');
                toggleIcon.classList.add('fa-chevron-up');
            }
        });
    }
});
    """
    
    try:
        with open(messenger_js_path, "w", encoding="utf-8") as f:
            f.write(new_messenger_js_content)
        print(f"Successfully updated {messenger_js_path} with a fix for the loading issue.")
    except IOError as e:
        print(f"Error writing to file {messenger_js_path}: {e}")


if __name__ == "__main__":
    fix_messenger_js()
