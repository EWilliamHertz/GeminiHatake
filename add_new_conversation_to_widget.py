import os
from bs4 import BeautifulSoup

def update_html_files():
    """
    Adds the 'new conversation' button to the widget header and the 
    user search modal to all relevant HTML files.
    """
    public_dir = "public"
    html_files = [f for f in os.listdir(public_dir) if f.endswith(".html")]

    modal_html = """
<div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center hidden z-[1001]" id="new-conversation-modal">
    <div class="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-md">
        <h2 class="text-2xl font-bold mb-4">Start a new conversation</h2>
        <input class="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 mb-4" id="user-search-input" placeholder="Search for a user by handle..." type="text"/>
        <div class="max-h-60 overflow-y-auto" id="user-search-results">
        </div>
        <button class="mt-4 w-full bg-gray-200 dark:bg-gray-700 py-2 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 close-modal-btn" id="close-modal-btn">
            Cancel
        </button>
    </div>
</div>
    """

    plus_icon_html = """
<i class="fas fa-plus cursor-pointer hover:text-gray-200" id="widget-new-conversation-btn"></i>
    """
    
    print("Starting to update HTML files...")
    for file_name in html_files:
        if file_name == "messages.html":
            continue # messages.html already has this functionality

        file_path = os.path.join(public_dir, file_name)
        with open(file_path, "r", encoding="utf-8") as f:
            soup = BeautifulSoup(f, "html.parser")

        # --- Add Plus Icon to Widget Header ---
        widget_header = soup.find("div", {"id": "messenger-widget-header"})
        if widget_header and not widget_header.find("i", {"id": "widget-new-conversation-btn"}):
            # Find the main text span to insert the icon before it
            main_header_text = widget_header.find("span", {"id": "widget-main-header-text"})
            if main_header_text:
                main_header_text.insert_before(BeautifulSoup(plus_icon_html, "html.parser"))
                
        # --- Add New Conversation Modal to Body ---
        if not soup.find("div", {"id": "new-conversation-modal"}):
            body = soup.find("body")
            if body:
                body.append(BeautifulSoup(modal_html, "html.parser"))

        with open(file_path, "w", encoding="utf-8") as f:
            f.write(str(soup))
        print(f"Updated {file_name}")

def update_messenger_js():
    """
    Appends the necessary JavaScript logic to messenger.js to handle
    the new conversation functionality.
    """
    messenger_js_path = "public/js/messenger.js"
    if not os.path.exists(messenger_js_path):
        print(f"Error: {messenger_js_path} not found.")
        return

    js_to_append = """
// --- START: NEW CONVERSATION LOGIC ---

// Wait for the DOM and currentUser to be ready
document.addEventListener('DOMContentLoaded', () => {
    firebase.auth().onAuthStateChanged(user => {
        if (user) {
            initializeNewConversationLogic(user);
        }
    });
});

function initializeNewConversationLogic(currentUser) {
    const db = firebase.firestore();
    const newConversationModal = document.getElementById('new-conversation-modal');
    const userSearchInput = document.getElementById('user-search-input');
    const userSearchResults = document.getElementById('user-search-results');
    const widgetNewConversationBtn = document.getElementById('widget-new-conversation-btn');
    const closeModalBtns = document.querySelectorAll('.close-modal-btn');

    if (widgetNewConversationBtn) {
        widgetNewConversationBtn.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent the header click from minimizing the widget
            if (newConversationModal) {
                newConversationModal.classList.remove('hidden');
            }
        });
    }

    closeModalBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            if (newConversationModal) {
                newConversationModal.classList.add('hidden');
                if (userSearchInput) userSearchInput.value = '';
                if (userSearchResults) userSearchResults.innerHTML = '';
            }
        });
    });

    let searchTimeout;
    if (userSearchInput) {
        userSearchInput.addEventListener('input', () => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                const searchTerm = userSearchInput.value.trim();
                if (searchTerm.length > 1) {
                    searchUsers(searchTerm, currentUser, db);
                } else {
                    if (userSearchResults) userSearchResults.innerHTML = '';
                }
            }, 300);
        });
    }
}

async function searchUsers(searchTerm, currentUser, db) {
    const userSearchResults = document.getElementById('user-search-results');
    if (!currentUser || !userSearchResults) return;
    
    try {
        const querySnapshot = await db.collection('users')
            .where('handle', '>=', searchTerm.toLowerCase())
            .where('handle', '<=', searchTerm.toLowerCase() + '\\uf8ff')
            .limit(10)
            .get();

        userSearchResults.innerHTML = '';
        if (querySnapshot.empty) {
            userSearchResults.innerHTML = '<p class="text-gray-500 p-3 text-center">No users found.</p>';
            return;
        }

        querySnapshot.forEach(doc => {
            if (doc.id === currentUser.uid) return;
            const userData = doc.data();
            const userElement = document.createElement('div');
            userElement.className = 'p-3 flex items-center hover:bg-gray-700 cursor-pointer rounded-md';
            userElement.innerHTML = `
                <img src="${userData.profilePic || 'https://placehold.co/40x40'}" alt="Avatar" class="w-10 h-10 rounded-full mr-3 object-cover">
                <div>
                    <p class="font-semibold">${userData.displayName || 'User'}</p>
                    <p class="text-sm text-gray-400">@${userData.handle || 'handle'}</p>
                </div>
            `;
            userElement.addEventListener('click', () => startConversation(doc.id, currentUser, db));
            userSearchResults.appendChild(userElement);
        });
    } catch (error) {
        console.error("Error searching users:", error);
        userSearchResults.innerHTML = '<p class="text-red-500 p-3 text-center">Error searching for users.</p>';
    }
}

async function startConversation(otherUserId, currentUser, db) {
    const newConversationModal = document.getElementById('new-conversation-modal');
    if (!currentUser) return;

    try {
        const conversationQuery = await db.collection('conversations')
            .where('participants', 'in', [[currentUser.uid, otherUserId], [otherUserId, currentUser.uid]])
            .get();

        if (conversationQuery.empty) {
            await db.collection('conversations').add({
                participants: [currentUser.uid, otherUserId],
                lastUpdated: firebase.firestore.FieldValue.serverTimestamp(),
                lastMessage: '',
                isGroupChat: false,
                participantInfo: {
                    [currentUser.uid]: { read: true },
                    [otherUserId]: { read: false }
                }
            });
        } else {
            console.log("Conversation already exists.");
        }
    } catch (error) {
        console.error("Error starting conversation: ", error);
    } finally {
        if (newConversationModal) {
            newConversationModal.classList.add('hidden');
            const userSearchInput = document.getElementById('user-search-input');
            const userSearchResults = document.getElementById('user-search-results');
            if (userSearchInput) userSearchInput.value = '';
            if (userSearchResults) userSearchResults.innerHTML = '';
        }
    }
}
// --- END: NEW CONVERSATION LOGIC ---
"""
    with open(messenger_js_path, "a", encoding="utf-8") as f:
        f.write("\n" + js_to_append)
    print(f"Appended new conversation logic to {messenger_js_path}.")

if __name__ == "__main__":
    update_html_files()
    update_messenger_js()
    print("\\nProcess complete. Please clear your cache and check the site.")
