import os
from bs4 import BeautifulSoup

def rebuild_messages_page_from_template(messages_path, template_path):
    """
    Overhauls messages.html by taking its unique components and inserting them
    into the known-good structure of a template page (e.g., profile.html).
    """
    if not os.path.exists(messages_path):
        print(f"Error: Messages page not found at '{messages_path}'")
        return
    if not os.path.exists(template_path):
        print(f"Error: Template page not found at '{template_path}'")
        return

    print("--- Starting a complete layout overhaul for messages.html ---")

    # --- Step 1: Read both files ---
    with open(messages_path, 'r', encoding='utf-8') as f:
        messages_soup = BeautifulSoup(f.read(), 'html.parser')
    with open(template_path, 'r', encoding='utf-8') as f:
        template_soup = BeautifulSoup(f.read(), 'html.parser')

    # --- Step 2: Extract the essential chat components from messages.html ---
    conversation_sidebar = messages_soup.find('aside', {'id': 'conversation-list-sidebar'})
    chat_area = messages_soup.find('main', {'id': 'chat-area'})

    if not conversation_sidebar or not chat_area:
        print("Critical Error: Could not find the core 'conversation-list-sidebar' or 'chat-area' components in messages.html.")
        print("Aborting to prevent data loss. The page might have been modified by a previous script.")
        return

    # Detach them from the old document
    conversation_sidebar.extract()
    chat_area.extract()

    # --- Step 3: Prepare the new chat container ---
    # This div will hold both components and will fill the main content area
    chat_wrapper = messages_soup.new_tag('div', attrs={
        'class': 'flex h-full w-full' # Use h-full to fill parent, not h-screen
    })
    chat_wrapper.append(conversation_sidebar)
    chat_wrapper.append(chat_area)

    # --- Step 4: Find the main content area in the template ---
    main_content_area = template_soup.find('main')
    if not main_content_area:
        # Fallback to find the main content div if <main> isn't used
        main_content_area = template_soup.find('div', class_="lg:pl-64")
        if main_content_area:
             main_content_area = main_content_area.find('main') # find main inside

    if not main_content_area:
        print("Critical Error: Could not find the <main> content area in the template file.")
        return

    # --- Step 5: Replace the template's content with our chat component ---
    main_content_area.clear()  # Remove everything from the template's main area
    main_content_area['class'] = "h-[calc(100vh-4rem)]" # Set height to fill viewport minus header
    main_content_area.append(chat_wrapper)

    # --- Step 6: Ensure the messages.js script is included ---
    # The template might not have it.
    body = template_soup.body
    if body and not template_soup.find('script', {'src': 'js/messages.js'}):
        messages_script_tag = template_soup.new_tag('script', src="js/messages.js", defer=True)
        body.append(messages_script_tag)

    # --- Step 7: Overwrite the old messages.html with the new structure ---
    with open(messages_path, 'w', encoding='utf-8') as f:
        f.write(str(template_soup))

    print(f"Success! '{messages_path}' has been completely rebuilt using the layout from '{template_path}'.")
    print("This should definitively fix the mobile navigation and layout issues.")


# --- Main Execution ---
messages_file = 'public/messages.html'
profile_template_file = 'public/profile.html' # Our known-good template

rebuild_messages_page_from_template(messages_file, profile_template_file)
