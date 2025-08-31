import os
from bs4 import BeautifulSoup

def create_messenger_js():
    messenger_js_content = """
document.addEventListener('DOMContentLoaded', () => {
    const db = firebase.firestore();
    const auth = firebase.auth();

    const widgetContainer = document.getElementById('messenger-widget-container');
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
        if (currentUser) {
            if (conversationsListener) conversationsListener(); // Detach old listener
            loadConversations();
        } else {
            conversationsList.innerHTML = '<p class="p-4 text-center text-gray-500">Please log in to see your messages.</p>';
        }
    });

    function formatTimestamp(timestamp) {
        if (!timestamp) return '';
        const date = timestamp.toDate();
        return date.toLocaleString();
    }

    async function loadConversations() {
        if (!currentUser) return;

        conversationsList.innerHTML = '<p class="p-4 text-center text-gray-500">Loading conversations...</p>';

        conversationsListener = db.collection('conversations')
            .where('participants', 'array-contains', currentUser.uid)
            .orderBy('lastMessageTimestamp', 'desc')
            .onSnapshot(async (querySnapshot) => {
                if (querySnapshot.empty) {
                    conversationsList.innerHTML = '<p class="p-4 text-center text-gray-500">No conversations yet.</p>';
                    return;
                }

                let conversationsHTML = '';
                for (const doc of querySnapshot.docs) {
                    const conversation = doc.data();
                    const otherParticipantId = conversation.participants.find(p => p !== currentUser.uid);

                    if (otherParticipantId) {
                        const userDoc = await db.collection('users').doc(otherParticipantId).get();
                        const userData = userDoc.data();
                        const conversationId = doc.id;
                        
                        conversationsHTML += `
                            <div class="conversation-item p-3 border-b border-gray-200 dark:border-gray-700 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700" data-id="${conversationId}">
                                <div class="flex items-center">
                                    <img src="${userData.profilePic || 'https://placehold.co/40x40'}" alt="Avatar" class="w-10 h-10 rounded-full mr-3">
                                    <div>
                                        <p class="font-semibold">${userData.displayName || 'User'}</p>
                                        <p class="text-sm text-gray-500 truncate">${conversation.lastMessage || ''}</p>
                                        <p class="text-xs text-gray-400">${formatTimestamp(conversation.lastMessageTimestamp)}</p>
                                    </div>
                                </div>
                            </div>
                        `;
                    }
                }
                conversationsList.innerHTML = conversationsHTML;
            });
    }

    widgetHeader.addEventListener('click', () => {
        widgetContainer.classList.toggle('minimized');
        if (widgetContainer.classList.contains('minimized')) {
            toggleIcon.classList.remove('fa-chevron-up');
            toggleIcon.classList.add('fa-chevron-down');
        } else {
            toggleIcon.classList.remove('fa-chevron-down');
            toggleIcon.classList.add('fa-chevron-up');
        }
    });
    
    openBtn.addEventListener('click', () => {
        widgetContainer.classList.remove('minimized');
        toggleIcon.classList.remove('fa-chevron-down');
        toggleIcon.classList.add('fa-chevron-up');
    });

});
    """
    with open("public/js/messenger.js", "w") as f:
        f.write(messenger_js_content)
    print("Created public/js/messenger.js")

def add_widget_to_html_files():
    public_dir = "public"
    html_files = [f for f in os.listdir(public_dir) if f.endswith(".html")]

    messenger_widget_html = """
<div id="messenger-widget-container" class="minimized">
    <div id="messenger-open-btn">
        <i class="fas fa-comments"></i>
    </div>
    <div id="messenger-widget" class="fixed bottom-0 right-5 w-80 z-[1000]">
        <div id="messenger-widget-header" class="bg-blue-700 text-white p-3 rounded-t-lg cursor-pointer flex justify-between items-center">
            <span id="widget-main-header-text" class="font-bold truncate">Messages</span>
            <i id="widget-toggle-icon" class="fas fa-chevron-down"></i>
        </div>
        <div id="messenger-widget-body" class="bg-white dark:bg-gray-800 h-96 border-x border-b border-gray-300 dark:border-gray-600 rounded-b-lg flex flex-col">
            <div id="widget-conversations-list" class="flex-grow overflow-y-auto">
                </div>
        </div>
    </div>
</div>
    """

    for file_name in html_files:
        if file_name == "messages.html":
            continue

        file_path = os.path.join(public_dir, file_name)
        with open(file_path, "r", encoding="utf-8") as f:
            soup = BeautifulSoup(f, "html.parser")

        if not soup.find("div", {"id": "messenger-widget-container"}):
            body_tag = soup.find("body")
            if body_tag:
                body_tag.append(BeautifulSoup(messenger_widget_html, "html.parser"))
                
                # Add messenger.js script
                messenger_script_tag = soup.new_tag("script", src="js/messenger.js")
                body_tag.append(messenger_script_tag)

                with open(file_path, "w", encoding="utf-8") as f:
                    f.write(str(soup))
                print(f"Added messenger widget to {file_name}")

def update_settings_html():
    settings_file = "public/settings.html"
    with open(settings_file, "r", encoding="utf-8") as f:
        soup = BeautifulSoup(f, "html.parser")

    # Create Display tab
    nav = soup.find("nav", {"class": "space-y-1"})
    if nav and not nav.find("button", {"data-section": "display"}):
        display_button = BeautifulSoup("""
<button class="settings-nav-btn w-full text-left px-4 py-2 rounded-md font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700" data-section="display">
    <i class="fas fa-desktop mr-2"></i>
    Display
</button>
        """, "html.parser")
        nav.append(display_button)

    # Create Display section
    main_content = soup.find("div", {"class": "md:w-3/4"})
    if main_content and not soup.find("section", {"id": "settings-display"}):
        display_section = BeautifulSoup("""
<section class="settings-section hidden bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md" id="settings-display">
    <h2 class="text-2xl font-bold mb-6 border-b pb-4 dark:border-gray-700 dark:text-white">Display Settings</h2>
    <div class="flex items-center justify-between">
        <div>
            <h3 class="text-lg font-medium text-gray-900 dark:text-white">Show Messenger Widget</h3>
            <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">
                Show or hide the messenger widget on all pages.
            </p>
        </div>
        <label for="toggle-messenger" class="inline-flex relative items-center cursor-pointer">
            <input type="checkbox" value="" id="toggle-messenger" class="sr-only peer">
            <div class="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
        </label>
    </div>
</section>
        """, "html.parser")
        main_content.append(display_section)

    # Add script for the toggle
    settings_script = """
<script>
    document.addEventListener('DOMContentLoaded', () => {
        const toggleMessenger = document.getElementById('toggle-messenger');

        // Set initial state of the toggle
        if (localStorage.getItem('messengerWidget-visible') === 'false') {
            toggleMessenger.checked = false;
        } else {
            toggleMessenger.checked = true;
        }

        toggleMessenger.addEventListener('change', (e) => {
            localStorage.setItem('messengerWidget-visible', e.target.checked);
            
            // Show/hide on other pages - this is just a placeholder, 
            // the logic is in messenger.js to check local storage on load
            const messengerWidget = document.getElementById('messenger-widget-container');
            if(messengerWidget) {
                messengerWidget.classList.toggle('hidden', !e.target.checked);
            }

        });
    });
</script>
    """
    body_tag = soup.find("body")
    if body_tag:
        body_tag.append(BeautifulSoup(settings_script, "html.parser"))


    with open(settings_file, "w", encoding="utf-8") as f:
        f.write(str(soup))
    print("Updated settings.html with display tab and messenger toggle")


if __name__ == "__main__":
    create_messenger_js()
    add_widget_to_html_files()
    update_settings_html()
