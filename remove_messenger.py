import os
import glob
from bs4 import BeautifulSoup

def remove_messenger_widget():
    """
    This script iterates through all .html files in the current directory
    and removes the messenger widget HTML container and its corresponding
    JavaScript file inclusion.
    """
    # Get a list of all HTML files in the current directory
    html_files = glob.glob('*.html')

    if not html_files:
        print("No .html files found in this directory.")
        return

    print(f"Found {len(html_files)} HTML files to process...")

    for file_path in html_files:
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()

            soup = BeautifulSoup(content, 'html.parser')

            # Find the messenger widget container by its ID
            widget_container = soup.find('div', id='messenger-widget-container')
            
            # Find the script tag for the messenger JavaScript
            messenger_script = soup.find('script', src='js/messenger.js')

            made_changes = False
            if widget_container:
                widget_container.decompose() # This completely removes the tag and its contents
                print(f"  -> Removed messenger widget from {file_path}")
                made_changes = True
            
            if messenger_script:
                messenger_script.decompose()
                print(f"  -> Removed messenger script tag from {file_path}")
                made_changes = True

            # Only write back to the file if changes were actually made
            if made_changes:
                with open(file_path, 'w', encoding='utf-8') as f:
                    f.write(str(soup))
                print(f"  -> Saved changes to {file_path}")
            else:
                print(f"  -> No messenger widget found in {file_path}. Skipping.")

        except Exception as e:
            print(f"  -> Error processing {file_path}: {e}")

    print("\nProcessing complete.")

if __name__ == '__main__':
    remove_messenger_widget()
