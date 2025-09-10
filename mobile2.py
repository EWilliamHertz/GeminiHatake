import os
from bs4 import BeautifulSoup

def fix_messages_html_structure(file_path):
    """
    Updates the HTML structure of messages.html for mobile responsiveness.
    """
    if not os.path.exists(file_path):
        print(f"File not found: {file_path}")
        return

    with open(file_path, 'r', encoding='utf-8') as f:
        soup = BeautifulSoup(f.read(), 'html.parser')

    # Find the main flex container
    main_container = soup.find('div', class_=lambda c: c and 'flex' in c and 'h-screen' in c)
    if not main_container:
        print("Could not find the main container in messages.html")
        return

    # 1. Update the conversation list sidebar
    sidebar = main_container.find('aside')
    if sidebar:
        sidebar['id'] = 'conversation-list-sidebar'
        sidebar['class'] = "w-full lg:w-1/3 xl:w-1/4 h-screen bg-gray-100 dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col"
    else:
        print("Could not find sidebar.")
        return

    # 2. Update the main chat area
    main_content = main_container.find('main')
    if main_content:
        main_content['id'] = 'chat-area'
        # Make it hidden on mobile by default
        main_content['class'] = "w-full lg:w-2/3 xl:w-3/4 flex-col hidden lg:flex h-screen"

        # 3. Add a 'Back' button to the chat header, visible only on mobile
        chat_header = main_content.find('div', class_=lambda c: c and 'border-b' in c)
        if chat_header:
            back_button_svg = """
            <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
            </svg>
            """
            back_button = soup.new_tag('button', attrs={
                'id': 'back-to-conversations',
                'class': 'lg:hidden p-2 mr-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700'
            })
            back_button.append(BeautifulSoup(back_button_svg, 'html.parser'))
            chat_header.insert(0, back_button)
    else:
        print("Could not find main content.")
        return

    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(str(soup))
    print("Successfully updated HTML structure of messages.html")

def update_messages_js(file_path):
    """
    Adds JavaScript logic to toggle between conversation list and chat view on mobile.
    """
    if not os.path.exists(file_path):
        print(f"File not found: {file_path}")
        return

    mobile_logic = """
// --- Mobile View Toggling ---
document.addEventListener('DOMContentLoaded', () => {
    const conversationListSidebar = document.getElementById('conversation-list-sidebar');
    const chatArea = document.getElementById('chat-area');
    const backToConversationsButton = document.getElementById('back-to-conversations');

    // Function to switch to chat view on mobile
    window.showChatArea = () => {
        if (window.innerWidth < 1024) { // Tailwind's 'lg' breakpoint
            conversationListSidebar.classList.add('hidden');
            chatArea.classList.remove('hidden');
            chatArea.classList.add('flex');
        }
    };

    // Event listener for the back button
    if (backToConversationsButton) {
        backToConversationsButton.addEventListener('click', () => {
            if (window.innerWidth < 1024) {
                chatArea.classList.add('hidden');
                chatArea.classList.remove('flex');
                conversationListSidebar.classList.remove('hidden');
            }
        });
    }
});
"""

    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # Find the function where the conversation is displayed and add our mobile hook
    target_function_start = "function displayConversation(conversation, conversationId, currentUserId)"
    if target_function_start in content:
        # Add the call to our new function inside displayConversation
        replacement = target_function_start + " {\n    showChatArea();"
        content = content.replace(target_function_start, replacement)
    else:
        print("Could not find target function 'displayConversation' to modify.")


    # Append the main mobile logic to the end of the file
    if "// --- Mobile View Toggling ---" not in content:
        with open(file_path, 'a', encoding='utf-8') as f:
            f.write(mobile_logic)
        print("Successfully updated messages.js with mobile logic.")
    else:
        print("Mobile logic already exists in messages.js")


# --- Applying the fixes ---
fix_messages_html_structure('public/messages.html')
update_messages_js('public/js/messages.js')
