import os
from bs4 import BeautifulSoup

def fix_firebase_scripts(file_path):
    """
    Completely removes all old and new Firebase scripts and inserts the correct
    v8-compatible SDK script block before the main auth.js script.

    Args:
        file_path (str): The full path to the HTML file.
    
    Returns:
        tuple: (bool, str) indicating if the file was changed and a status message.
    """
    
    # This is the single, correct block of scripts for your v8-style code.
    correct_scripts_html = """<script src="https://www.gstatic.com/firebasejs/9.6.0/firebase-app-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/9.6.0/firebase-auth-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/9.6.0/firebase-firestore-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/9.6.0/firebase-storage-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/9.6.0/firebase-functions-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/9.6.0/firebase-analytics-compat.js"></script>
"""

    # Patterns to find and remove ANY existing Firebase script
    firebase_patterns = ["firebasejs", "/__/firebase/"]

    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()

        soup = BeautifulSoup(content, 'html.parser')
        
        # --- Step 1: Remove ALL existing Firebase scripts ---
        scripts_removed = False
        all_scripts = soup.find_all('script', src=True)
        for script in all_scripts:
            for pattern in firebase_patterns:
                if pattern in script['src']:
                    script.extract()
                    scripts_removed = True
                    break
        
        # --- Step 2: Add the correct script block back in the right place ---
        auth_script_tag = soup.find('script', src='js/auth.js')
        body_tag = soup.find('body')
        
        if auth_script_tag:
            script_soup = BeautifulSoup(correct_scripts_html, 'html.parser')
            # Insert the block right before auth.js to ensure it's loaded first
            auth_script_tag.insert_before(script_soup)
        elif body_tag:
            # Fallback: if auth.js isn't found, append to the end of the body
            script_soup = BeautifulSoup(correct_scripts_html, 'html.parser')
            body_tag.append(script_soup)
        else:
            return (False, "⚠️ No <body> tag found. Skipping.")

        # --- Step 3: Save the file ---
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(str(soup.prettify(formatter='html5')))
        
        return (True, "✅ Reverted and fixed Firebase scripts.")

    except Exception as e:
        return (False, f"❌ Error: {e}")

def main():
    public_dir = 'public'
    if not os.path.isdir(public_dir):
        print(f"Error: Directory '{public_dir}' not found. Please run this from your project's root.")
        return

    print("--- Reverting and Fixing Firebase Scripts ---")
    files_changed = 0
    total_files_scanned = 0

    for root, _, files in os.walk(public_dir):
        for file in files:
            if file.endswith('.html'):
                total_files_scanned += 1
                file_path = os.path.join(root, file)
                changed, message = fix_firebase_scripts(file_path)
                print(f"[{os.path.basename(file_path)}] - {message}")
                if changed:
                    files_changed += 1
    
    print("\n--- Process Complete ---")
    print(f"Scanned: {total_files_scanned} HTML files.")
    print(f"Standardized: {files_changed} files.")

if __name__ == '__main__':
    main()
