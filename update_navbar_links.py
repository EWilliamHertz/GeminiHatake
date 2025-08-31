import os
import glob
from bs4 import BeautifulSoup

def update_links_in_html_files(directory='.'):
    """
    Finds all HTML files in the specified directory and its subdirectories,
    then updates any navbar links pointing to 'index.html' to point to 'app.html' instead.
    """
    # Use glob to find all .html files recursively
    html_files = glob.glob(os.path.join(directory, '**', '*.html'), recursive=True)
    
    if not html_files:
        print("No HTML files found in this directory.")
        return

    print(f"Found {len(html_files)} HTML files to process...")
    updated_files_count = 0

    for file_path in html_files:
        # We don't want to change links on the new index.html page itself
        if os.path.basename(file_path) == 'index.html':
            print(f"Skipping '{file_path}' (landing page).")
            continue

        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                soup = BeautifulSoup(f, 'html.parser')

            # Find all anchor tags with href="index.html"
            links_to_update = soup.find_all('a', href='index.html')

            if links_to_update:
                print(f"Updating links in '{file_path}'...")
                for link in links_to_update:
                    link['href'] = 'app.html'
                
                # Write the modified HTML back to the file
                with open(file_path, 'w', encoding='utf-8') as f:
                    f.write(str(soup))
                updated_files_count += 1
            else:
                print(f"No links to 'index.html' found in '{file_path}'.")

        except Exception as e:
            print(f"Could not process file {file_path}: {e}")

    print(f"\nProcessing complete. Updated links in {updated_files_count} file(s).")

if __name__ == '__main__':
    # Before running, make sure you have BeautifulSoup installed:
    # pip install beautifulsoup4
    update_links_in_html_files()
