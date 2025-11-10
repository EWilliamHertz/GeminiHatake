import os
from bs4 import BeautifulSoup, Comment
import copy # Import the copy module

# --- Configuration ---
NEW_LINK_HTML = """
<a class="flex items-center px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-md" href="contact.html">
    <i class="fas fa-ticket-alt w-6 text-center">
    </i>
    <span class="ml-3">
     Support & Contact
    </span>
</a>"""

TARGET_DIRECTORY = 'public'

# The class of the <nav> element containing the links.
# This scopes our search to just the navbar.
NAVBAR_CLASS = 'flex-1 px-4 py-6 space-y-2 overflow-y-auto'

# The anchor link we're looking for to insert after
ANCHOR_HREF = 'about.html'

# The new link's href, to check if it already exists
NEW_LINK_HREF = 'contact.html'
# --- End Configuration ---

def update_html_files():
    """
    Walks through the target directory and updates HTML files
    to include the new contact link in the navbar.
    """
    total_files = 0
    updated_files = 0
    skipped_files = 0

    # Parse the new link HTML *once* and extract the <a> tag
    try:
        new_link_soup = BeautifulSoup(NEW_LINK_HTML, 'html.parser')
        new_link_tag = new_link_soup.a
        if not new_link_tag:
            print("CRITICAL ERROR: Could not parse NEW_LINK_HTML. The snippet might be invalid.")
            return
    except Exception as e:
        print(f"CRITICAL ERROR: Failed to parse NEW_LINK_HTML. {e}")
        return

    print(f"Searching for HTML files in '{TARGET_DIRECTORY}'...")
    print(f"Will add '{NEW_LINK_HREF}' after '{ANCHOR_HREF}' inside '<nav class=\"{NAVBAR_CLASS}\">'")
    print("---")

    # Walk through the target directory
    for root, dirs, files in os.walk(TARGET_DIRECTORY):
        for file in files:
            if file.endswith('.html'):
                total_files += 1
                file_path = os.path.join(root, file)
                
                try:
                    with open(file_path, 'r', encoding='utf-8') as f:
                        content = f.read()
                    
                    soup = BeautifulSoup(content, 'html.parser')
                    
                    # Find the specific navigation bar
                    nav_bar = soup.find('nav', class_=NAVBAR_CLASS)
                    
                    if not nav_bar:
                        print(f"INFO: Skipped {file_path} (No navbar found)")
                        skipped_files += 1
                        continue
                        
                    # Find the "About Us" link *within the navbar*
                    anchor_link = nav_bar.find('a', href=ANCHOR_HREF)
                    
                    if not anchor_link:
                        print(f"INFO: Skipped {file_path} (No '{ANCHOR_HREF}' link found *in* navbar)")
                        skipped_files += 1
                        continue
                        
                    # Check if the "Support & Contact" link *already exists in the navbar*
                    if nav_bar.find('a', href=NEW_LINK_HREF):
                        print(f"INFO: Skipped {file_path} (Link '{NEW_LINK_HREF}' already exists *in* navbar)")
                        skipped_files += 1
                        continue

                    # --- If we get here, we need to add the link ---
                    
                    # Create a deep copy of the tag to insert it
                    # This is crucial so we can use the tag in multiple files
                    tag_to_insert = copy.copy(new_link_tag)
                    
                    # Insert the new link tag after the anchor link
                    anchor_link.insert_after(tag_to_insert)
                    
                    # Insert a newline *after* the anchor link (which is *before* the new tag)
                    # This keeps the HTML formatting clean
                    anchor_link.insert_after('\n') 
                    
                    # Write the modified content back to the file
                    with open(file_path, 'w', encoding='utf-8') as f:
                        f.write(str(soup))
                        
                    print(f"SUCCESS: Updated {file_path}")
                    updated_files += 1

                except Exception as e:
                    print(f"ERROR: Could not process {file_path}. Reason: {e}")
                    skipped_files += 1

    print("\n--- Update Complete ---")
    print(f"Total .html files found: {total_files}")
    print(f"Files updated:         {updated_files}")
    print(f"Files skipped:         {skipped_files}")

if __name__ == "__main__":
    if not os.path.isdir(TARGET_DIRECTORY):
        print(f"ERROR: Target directory '{TARGET_DIRECTORY}' not found.")
        print("Please run this script from the root of your project (e.g., 'GeminiHatake-f2e4e844be00b3cd0391db5fa42bb597707146cc').")
    else:
        update_html_files()
