import os

def update_messages_js_corrected(file_path):
    """
    Adds JavaScript logic to toggle between conversation list and chat view on mobile.
    This version correctly identifies the async function and avoids duplicating code.
    """
    if not os.path.exists(file_path):
        print(f"Error: File not found at {file_path}")
        return

    # This is the helper logic that shows/hides the message panels
    mobile_logic = """
// --- Mobile View Toggling ---
document.addEventListener('DOMContentLoaded', () => {
    const conversationListSidebar = document.getElementById('conversation-list-sidebar');
    const chatArea = document.getElementById('chat-area');
    const backToConversationsButton = document.getElementById('back-to-conversations');

    // Function to switch to chat view on mobile when a conversation is clicked
    window.showChatArea = () => {
        if (window.innerWidth < 1024) { // Tailwind's 'lg' breakpoint
            if (conversationListSidebar) conversationListSidebar.classList.add('hidden');
            if (chatArea) {
                chatArea.classList.remove('hidden');
                chatArea.classList.add('flex');
            }
        }
    };

    // Event listener for the back button in the chat view
    if (backToConversationsButton) {
        backToConversationsButton.addEventListener('click', () => {
            if (window.innerWidth < 1024) {
                if (chatArea) {
                    chatArea.classList.add('hidden');
                    chatArea.classList.remove('flex');
                }
                if (conversationListSidebar) conversationListSidebar.classList.remove('hidden');
            }
        });
    }
});
"""

    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # Part 1: Inject the function call into displayConversation
    # CORRECTED: Now looks for "async function"
    target_function_signature = "async function displayConversation(conversation, conversationId, currentUserId)"
    call_to_inject = "showChatArea();"
    
    # Check if the function exists and our code isn't already there
    if target_function_signature in content and call_to_inject not in content:
        # Inject our call at the beginning of the function
        replacement_string = target_function_signature + " {\n    " + call_to_inject
        content = content.replace(target_function_signature + " {", replacement_string, 1)
        print("Successfully injected mobile hook into 'displayConversation' function.")
    elif call_to_inject in content:
        print("Mobile hook already injected. Skipping injection.")
    else:
        print("Warning: Could not find target function 'displayConversation' to inject hook.")

    # Part 2: Append the helper logic if it's not already there
    if "// --- Mobile View Toggling ---" not in content:
        content += "\n" + mobile_logic
        print("Successfully appended mobile logic to messages.js.")
    else:
        print("Mobile logic block already exists. Skipping append.")

    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)

# --- Applying the fix ---
js_file = 'public/js/messages.js'
print(f"Attempting to patch {js_file}...")
update_messages_js_corrected(js_file)
print("Patch script finished.")
