import os
import glob
from bs4 import BeautifulSoup

# This is the standard header HTML block that we want to enforce across all pages.
# It includes the structure for the search bar and user actions.
# You can update this block in the future if you change the header design.
STANDARDIZED_HEADER_HTML = """
<header class="h-28 flex items-center justify-between px-6 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
    <div class="flex items-center">
        <button class="lg:hidden mr-4 text-gray-600 dark:text-gray-300" id="sidebar-toggle">
            <i class="fas fa-bars text-xl"></i>
        </button>
        <div class="relative">
            <i class="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"></i>
            <input class="w-full md:w-96 pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-full bg-gray-50 dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500" id="main-search-bar" placeholder="Search for cards, users, articles..." type="text"/>
            <div class="absolute mt-2 w-full md:w-96 bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg shadow-xl z-10 hidden" id="main-search-results">
            </div>
        </div>
    </div>
    <div class="flex items-center space-x-5" id="user-actions">
        </div>
</header>
"""

def update_html_files():
    """
    Finds all .html files in the current directory and replaces their <header>
    with the standardized version.
    """
    html_files = glob.glob('*.html')
    
    if not html_files:
        print("No HTML files found in the current directory.")
        return

    print(f"Found {len(html_files)} HTML files to process...")
    
    # Create a BeautifulSoup object for the standardized header for parsing
    new_header_soup = BeautifulSoup(STANDARDIZED_HEADER_HTML, 'html.parser')

    for file_path in html_files:
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                soup = BeautifulSoup(f, 'html.parser')

            # Find the existing header tag
            existing_header = soup.find('header')

            if existing_header:
                # Replace the old header with the new one
                existing_header.replace_with(new_header_soup)
                
                # Write the modified content back to the file
                with open(file_path, 'w', encoding='utf-8') as f:
                    f.write(str(soup))
                
                print(f"Successfully updated header in: {file_path}")
            else:
                print(f"Warning: No <header> tag found in {file_path}. Skipping.")

        except Exception as e:
            print(f"Error processing {file_path}: {e}")

if __name__ == "__main__":
    update_html_files()
    print("\nHeader update process finished.")
