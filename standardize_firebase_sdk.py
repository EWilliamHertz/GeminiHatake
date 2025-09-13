import os
from bs4 import BeautifulSoup

def standardize_firebase_scripts(file_path):
    """
    Removes old Firebase v8 SDK scripts and ensures the modern Firebase Hosting
    scripts are present in an HTML file.

    Args:
        file_path (str): The full path to the HTML file.

    Returns:
        tuple: (bool, str) indicating if the file was changed and a status message.
    """
    
    # Modern Firebase Hosting scripts to ensure are present
    firebase_scripts_html = """
<script src="/__/firebase/9.6.1/firebase-app-compat.js"></script>
<script src="/__/firebase/9.6.1/firebase-auth-compat.js"></script>
<script src="/__/firebase/9.6.1/firebase-firestore-compat.js"></script>
<script src="/__/firebase/9.6.1/firebase-storage-compat.js"></script>
<script src="/__/firebase/9.6.1/firebase-functions-compat.js"></script>
<script src="/__/firebase/init.js"></script>
"""

    # Patterns to identify and remove old v8 scripts
    old_sdk_patterns = [
        "firebasejs/8.", # Catches any 8.x.x version
        "firebasejs/9.6.0" # Also remove this specific older version
    ]

    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()

        soup = BeautifulSoup(content, 'html.parser')

        # Step 1: Remove old script tags
        scripts_removed = False
        old_scripts = soup.find_all('script', src=True)
        for script in old_scripts:
            for pattern in old_sdk_patterns:
                if pattern in script['src']:
                    script.extract()
                    scripts_removed = True
                    break
        
        # Step 2: Check if modern scripts exist
        # Re-parse the content after potential removals
        current_html = str(soup)
        modern_scripts_exist = '/__/firebase/init.js' in current_html

        # Step 3: Add modern scripts if they are missing
        scripts_added = False
        if not modern_scripts_exist:
            body = soup.find('body')
            if body:
                script_soup = BeautifulSoup(firebase_scripts_html, 'html.parser')
                body.append(script_soup)
                scripts_added = True
            else:
                return (False, "⚠️ No <body> tag found. Skipping.")

        # Step 4: Write changes if any were made
        if scripts_removed or scripts_added:
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(str(soup.prettify(formatter='html5')))
            
            status = []
            if scripts_removed: status.append("Removed old SDK")
            if scripts_added: status.append("Added modern SDK")
            return (True, f"✅ Standardized: {', '.join(status)}")
            
        return (False, "✅ Already compliant.")

    except Exception as e:
        return (False, f"❌ Error: {e}")

def main():
    """
    Main function to execute the standardization process.
    """
    public_dir = 'public'
    if not os.path.isdir(public_dir):
        print(f"Error: Directory '{public_dir}' not found. Please run this from your project's root.")
        return

    print("--- Standardizing Firebase SDKs in all HTML files ---")
    files_changed = 0
    total_files_scanned = 0

    for root, _, files in os.walk(public_dir):
        for file in files:
            if file.endswith('.html'):
                total_files_scanned += 1
                file_path = os.path.join(root, file)
                changed, message = standardize_firebase_scripts(file_path)
                print(f"[{os.path.basename(file_path)}] - {message}")
                if changed:
                    files_changed += 1
    
    print("\n--- Standardization Complete ---")
    print(f"Scanned: {total_files_scanned} HTML files.")
    print(f"Modified: {files_changed} files.")

if __name__ == '__main__':
    main()

