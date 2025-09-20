import os
from bs4 import BeautifulSoup

# --- CONFIGURATION ---
PUBLIC_DIR = 'public'
TOUR_PAGES = [
    'app.html', 'articles.html', 'deck.html', 'my_collection.html',
    'marketplace.html', 'community.html', 'messages.html', 'profile.html', 'settings.html'
]

SCRIPTS_TO_ADD = """
<script src="https://cdn.jsdelivr.net/npm/shepherd.js@10.0.1/dist/js/shepherd.min.js"></script>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/shepherd.js@10.0.1/dist/css/shepherd.css"/>
<script src="/js/tour.js"></script>
"""

# --- CORRECTED SELECTORS ---
# These now accurately target the elements in your HTML files.
IDS_TO_ADD = {
    'app.html': [('div#feed-content-container', 'feed-container')],
    'articles.html': [('div.grid.gap-8', 'articles-grid')],
    'deck.html': [('main div.container', 'deck-container')],
    'my_collection.html': [('button#add-card-btn', 'add-card-btn')],
    'marketplace.html': [('input#main-search-bar', 'main-search-bar')],
    'community.html': [('main div.container', 'community-container')],
    'messages.html': [('div#messenger-container', 'messenger-container')],
    'profile.html': [('div.border-b nav', 'profile-tabs')],
    'settings.html': [('div#settings-container nav', 'settings-nav')]
}

def process_html_files():
    """
    Processes all specified HTML files to inject tour scripts and element IDs.
    """
    print("--- Starting Tour Installation Script ---")
    modified_files_count = 0
    
    for root, _, files in os.walk(PUBLIC_DIR):
        for filename in files:
            if filename in TOUR_PAGES:
                filepath = os.path.join(root, filename)
                print(f"\nProcessing: {filepath}")
                made_change = False
                
                try:
                    with open(filepath, 'r', encoding='utf-8') as f:
                        content = f.read()
                    soup = BeautifulSoup(content, 'html.parser')

                    if 'shepherd.min.js' not in content:
                        body_tag = soup.find('body')
                        if body_tag:
                            scripts_soup = BeautifulSoup(SCRIPTS_TO_ADD, 'html.parser')
                            body_tag.append(scripts_soup)
                            print(f"  [+] Injected tour scripts.")
                            made_change = True
                        else:
                            print(f"  [!] Could not find <body> tag.")
                    else:
                        print("  [*] Tour scripts already present.")

                    if filename in IDS_TO_ADD:
                        for selector, new_id in IDS_TO_ADD[filename]:
                            element = soup.select_one(selector)
                            if element:
                                if not element.has_attr('id') or element.get('id') != new_id:
                                    element['id'] = new_id
                                    print(f"  [+] Added id='{new_id}'.")
                                    made_change = True
                                else:
                                    print(f"  [*] ID '{new_id}' already exists.")
                            else:
                                print(f"  [!] WARNING: Could not find selector '{selector}' in {filename}.")

                    if made_change:
                        with open(filepath, 'w', encoding='utf-8') as f:
                            f.write(str(soup.prettify()))
                        modified_files_count += 1
                        print(f"  [*] Saved changes to {filename}.")

                except Exception as e:
                    print(f"  [!] ERROR processing {filename}: {e}")

    print("\n-----------------------------------------")
    print(f"Script finished. {modified_files_count} file(s) were updated.")
    print("Tour installation is complete.")
    print("-----------------------------------------")

if __name__ == '__main__':
    process_html_files()
