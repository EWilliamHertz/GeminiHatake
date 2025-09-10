import os
from bs4 import BeautifulSoup

def fix_messages_layout_conflict(file_path):
    """
    Fixes the layout conflict in messages.html where the navbar blocks content.
    This is achieved by wrapping the main flex container in a new div that
    controls the overall page layout and scrolling.
    """
    if not os.path.exists(file_path):
        print(f"Error: File not found at {file_path}")
        return

    print(f"Reading {file_path}...")
    with open(file_path, 'r', encoding='utf-8') as f:
        soup = BeautifulSoup(f.read(), 'html.parser')

    # Find the main body tag
    body = soup.body
    if not body:
        print("Error: Could not find the <body> tag.")
        return

    # Find the main flex container that is causing the issue
    main_flex_container = body.find('div', class_=lambda c: c and 'flex' in c and 'h-screen' in c)

    if main_flex_container:
        # Check if the fix has already been applied
        if main_flex_container.parent.get('id') == 'messages-page-wrapper':
            print("Notice: Layout fix seems to be already applied. Aborting.")
            return

        print("Found the conflicting container. Applying layout fix...")

        # 1. Create a new wrapper div
        wrapper = soup.new_tag('div', attrs={
            'id': 'messages-page-wrapper',
            'class': 'bg-gray-50 dark:bg-gray-900 flex flex-col h-screen'
        })

        # 2. Add a placeholder for the header/navbar that will be dynamically included
        header_placeholder = soup.new_tag('div', attrs={'id': 'header-placeholder'})
        wrapper.append(header_placeholder)

        # 3. Modify the existing container to be flexible and scrollable
        main_flex_container['class'] = "flex-1 flex overflow-hidden" # Replaces h-screen with flex-1 and adds overflow-hidden

        # 4. Move the original container inside our new wrapper
        main_flex_container.wrap(wrapper)

        print("Successfully restructured messages.html for proper navbar integration.")

    else:
        print("Warning: Could not find the main flex container to apply the fix.")
        return

    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(str(soup))
    print(f"Successfully wrote updated content to {file_path}")

# --- Run the fix ---
messages_file = 'public/messages.html'
fix_messages_layout_conflict(messages_file)
