import os

def final_js_patch(file_path):
    """
    Correctly patches messages.js by targeting the 'selectConversation' function
    to implement the mobile view toggle.
    """
    if not os.path.exists(file_path):
        print(f"Error: File not found at {file_path}")
        return

    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # --- This is the mobile view logic that should already be in the file ---
    # We are just ensuring it's there and then hooking into it.
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

    # Part 1: Inject the function call into the CORRECT function
    # CORRECTED TARGET: Now looking for 'selectConversation'
    target_function_signature = "const selectConversation = (conversationId, otherUser) => {"
    call_to_inject = "showChatArea();"
    
    # Check if the function exists and our code isn't already there
    if target_function_signature in content and call_to_inject not in content:
        # Inject our call right after the function definition
        replacement_string = target_function_signature + "\n        " + call_to_inject
        content = content.replace(target_function_signature, replacement_string, 1)
        print("Success: Injected mobile view hook into 'selectConversation' function.")
    elif call_to_inject in content:
        print("Notice: Mobile hook already seems to be injected. Skipping that step.")
    else:
        print("Error: Could not find the target function 'selectConversation'.")
        return # Exit if we can't do the most important part

    # Part 2: Append the helper logic only if it's completely missing
    if "// --- Mobile View Toggling ---" not in content:
        content += "\n" + mobile_logic
        print("Success: Appended the mobile view logic block to the script.")
    else:
        print("Notice: Mobile logic block already exists. Skipping append.")

    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)

# --- Applying the final fix ---
js_file = 'public/js/messages.js'
print(f"Attempting to apply the final patch to {js_file}...")
final_js_patch(js_file)
print("Patch script finished.")
