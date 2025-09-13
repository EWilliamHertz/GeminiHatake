import os
from bs4 import BeautifulSoup

def add_firebase_scripts_to_html(file_path):
    """
    Adds Firebase SDK scripts to an HTML file if they are not already present.

    Args:
        file_path (str): The full path to the HTML file.
    
    Returns:
        bool: True if the file was modified, False otherwise.
    """
    
    # --- The block of scripts to be added ---
    firebase_scripts_html = """
<!-- Firebase SDK Scripts -->
<script src="/__/firebase/9.6.1/firebase-app-compat.js"></script>
<script src="/__/firebase/9.6.1/firebase-auth-compat.js"></script>
<script src="/__/firebase/9.6.1/firebase-firestore-compat.js"></script>
<script src="/__/firebase/9.6.1/firebase-storage-compat.js"></script>
<script src="/__/firebase/9.6.1/firebase-functions-compat.js"></script>
<script src="/__/firebase/init.js"></script>
"""

    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()

        # A simple check to see if the Firebase init script is already there
        if '/__/firebase/init.js' in content:
            print(f"✅ Scripts already exist in: {file_path}")
            return False

        # Use BeautifulSoup to safely parse and modify the HTML
        soup = BeautifulSoup(content, 'html.parser')
        
        body = soup.find('body')
        if not body:
            print(f"⚠️  No <body> tag found in: {file_path}. Skipping.")
            return False
            
        # Create a new soup object for the scripts to be inserted
        script_soup = BeautifulSoup(firebase_scripts_html, 'html.parser')

        # Insert the scripts before the closing body tag
        body.append(script_soup)

        # Write the modified HTML back to the file
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(str(soup.prettify(formatter='html5')))
        
        print(f"🚀 Successfully added scripts to: {file_path}")
        return True

    except Exception as e:
        print(f"❌ Error processing file {file_path}: {e}")
        return False

def main():
    """
    Walks through the 'public' directory and applies the script update to all HTML files.
    """
    public_dir = 'public'
    if not os.path.isdir(public_dir):
        print(f"Error: Directory '{public_dir}' not found. Please run this script from your project's root directory.")
        return

    print("--- Starting Firebase Script Update ---")
    files_updated = 0
    total_files_scanned = 0

    for root, _, files in os.walk(public_dir):
        for file in files:
            if file.endswith('.html'):
                total_files_scanned += 1
                file_path = os.path.join(root, file)
                if add_firebase_scripts_to_html(file_path):
                    files_updated += 1
    
    print("\n--- Update Complete ---")
    print(f"Scanned: {total_files_scanned} HTML files.")
    print(f"Updated: {files_updated} files.")

if __name__ == '__main__':
    main()
