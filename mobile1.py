import os
from bs4 import BeautifulSoup

def fix_my_collection_layout(file_path):
    """
    Fixes the responsive layout for the button container in my_collection.html.
    """
    if not os.path.exists(file_path):
        print(f"File not found: {file_path}")
        return

    with open(file_path, 'r', encoding='utf-8') as f:
        soup = BeautifulSoup(f.read(), 'html.parser')

    # Find the main container for the header and buttons
    header_container = soup.find('div', class_=lambda c: c and 'flex' in c and 'justify-between' in c)
    
    if header_container:
        # Make the main container stack vertically on mobile and horizontally on medium screens and up
        header_container['class'] = "flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6"
        
        # Find the button group container
        button_group = header_container.find('div', class_=lambda c: c and 'flex' in c and 'space-x-2' in c)
        if button_group:
            # Allow buttons to wrap and add a gap for spacing
            button_group['class'] = "flex flex-wrap items-center justify-start sm:justify-end gap-2"
            print("Successfully updated button container in my_collection.html")
        else:
            print("Could not find button group container in my_collection.html")
    else:
        print("Could not find header container in my_collection.html")

    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(str(soup))

# --- Applying the fix ---
fix_my_collection_layout('public/my_collection.html')
