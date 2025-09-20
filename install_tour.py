import os
from bs4 import BeautifulSoup

# --- CONFIGURATION ---
# The directory where your HTML files are located
PUBLIC_DIR = 'public'

# The files that are part of the tour
TOUR_PAGES = [
    'index.html', 'app.html', 'articles.html', 'deck.html', 'my_collection.html',
    'marketplace.html', 'community.html', 'messages.html', 'profile.html', 'settings.html'
]

# The HTML snippet to inject before the closing </body> tag
SCRIPTS_TO_ADD = """
<script src="https://cdn.jsdelivr.net/npm/shepherd.js@10.0.1/dist/js/shepherd.min.js"></script>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/shepherd.js@10.0.1/dist/css/shepherd.css"/>
<script src="/js/tour.js" type="module"></script>
"""

# A dictionary to map filenames to the elements that need an ID
# Format: 'filename.html': [('selector', 'new_id'), ...]
IDS_TO_ADD = {
    'my_collection.html': [
        ('button:contains("+ Add Card")', 'add-card-btn')
    ],
    'marketplace.html': [
        ('input[placeholder*="Search for cards"]', 'main-search-bar')
    ],
    'profile.html': [
        ('div.border-b > nav', 'profile-tabs')
    ],
    'settings.html': [
        ('nav[aria-label="Sidebar"]', 'settings-nav')
    ]
}

def process_html_files():
    """
    Processes all specified HTML files to inject tour scripts and element IDs.
    """
    modified_files_count = 0
    
    # Use os.walk to find files, making it more robust
    for root, _, files in os.walk(PUBLIC_DIR):
        for filename in files:
            if filename in TOUR_PAGES:
                filepath = os.path.join(root, filename)
                print(f"Processing: {filepath}...")
                
                try:
                    with open(filepath, 'r', encoding='utf-8') as f:
                        content = f.read()

                    # Check if scripts are already present to avoid duplication
                    if 'shepherd.min.js' in content:
                        print(f"  - Tour scripts already exist in {filename}. Skipping script injection.")
                        soup = BeautifulSoup(content, 'html.parser')
                        made_change = False
                    else:
                        soup = BeautifulSoup(content, 'html.parser')
                        body_tag = soup.find('body')
                        if body_tag:
                            # Parse the scripts snippet and append it
                            scripts_soup = BeautifulSoup(SCRIPTS_TO_ADD, 'html.parser')
                            body_tag.append(scripts_soup)
                            print(f"  + Injected tour scripts into {filename}.")
                            made_change = True
                        else:
                            print(f"  - Could not find <body> tag in {filename}. Skipping script injection.")
                            made_change = False
                    
                    # Add necessary IDs for tour steps
                    if filename in IDS_TO_ADD:
                        id_mappings = IDS_TO_ADD[filename]
                        for selector, new_id in id_mappings:
                            element = soup.select_one(selector)
                            if element and not element.has_attr('id'):
                                element['id'] = new_id
                                print(f"  + Added id='{new_id}' to an element in {filename}.")
                                made_change = True
                            elif element and element.get('id') == new_id:
                                pass # ID already exists, do nothing
                            else:
                                print(f"  - Warning: Could not find selector '{selector}' in {filename}.")

                    # Write back to the file only if changes were made
                    if made_change:
                        with open(filepath, 'w', encoding='utf-8') as f:
                            f.write(str(soup.prettify()))
                        modified_files_count += 1

                except Exception as e:
                    print(f"  - ERROR processing {filename}: {e}")

    print("\n-----------------------------------------")
    print(f"Script finished. Modified {modified_files_count} files.")
    print("Your website is now ready for the guided tour!")
    print("-----------------------------------------")

if __name__ == '__main__':
    process_html_files()
