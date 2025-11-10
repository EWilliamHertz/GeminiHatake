import os
from bs4 import BeautifulSoup, Comment

# --- Configuration ---

# This is the HTML snippet you want to add.
# I've cleaned up the non-standard whitespace for you.
NEW_LINK_HTML = """
<a class="flex items-center px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-md" href="contact.html">
    <i class="fas fa-ticket-alt w-6 text-center">
    </i>
    <span class="ml-3">
     Support & Contact
    </span>
</a>"""

# The directory containing your .html files
TARGET_DIRECTORY = 'public'

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

    # Create the BeautifulSoup object for the new link once
    new_link_soup = BeautifulSoup(NEW_LINK_HTML, 'html.parser')

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
                    
                    # Find the "About Us" link, which we'll use as an anchor
                    anchor_link = soup.find('a', href=ANCHOR_HREF)
                    
                    if not anchor_link:
                        # If no anchor link, check if it's in a comment (edge case)
                        if any(ANCHOR_HREF in c for c in soup.find_all(string=lambda text: isinstance(text, Comment))):
                            print(f"INFO: Skipped {file_path} ('{ANCHOR_HREF}' is commented out)")
                        else:
                            print(f"INFO: Skipped {file_path} (Could not find anchor link: '{ANCHOR_HREF}')")
                        skipped_files += 1
                        continue
                        
                    # Check if the "Support & Contact" link already exists
                    if soup.find('a', href=NEW_LINK_HREF):
                        print(f"INFO: Skipped {file_path} (Link '{NEW_LINK_HREF}' already exists)")
                        skipped_files += 1
                        continue

                    # Insert the new link after the anchor link
                    # We also add a newline character before it to keep formatting clean
                    anchor_link.insert_after(new_link_soup)
                    new_link_soup.insert_before('\n') # Adds the newline before the new link
                    
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
