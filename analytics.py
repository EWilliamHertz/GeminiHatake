import os
import re

# Configuration
TARGET_DIR = 'public'
SCRIPT_TAG = '\n    <!-- Internal Analytics -->\n    <script src="js/simple-analytics.js"></script>'
# Regex to find Firebase script tags (matches generic firebase app/auth/firestore/etc include lines)
FIREBASE_REGEX = re.compile(r'<script src="https://www\.gstatic\.com/firebasejs/[^"]+"></script>', re.IGNORECASE)

def process_html_files():
    print(f"Scanning directory: {TARGET_DIR}...")
    count = 0
    updated_count = 0
    
    if not os.path.exists(TARGET_DIR):
        print(f"Error: Directory '{TARGET_DIR}' not found.")
        return

    for root, dirs, files in os.walk(TARGET_DIR):
        for file in files:
            if file.endswith(".html"):
                file_path = os.path.join(root, file)
                if add_script_to_file(file_path):
                    updated_count += 1
                count += 1
    
    print("-" * 40)
    print(f"Scan complete.")
    print(f"Total HTML files matched: {count}")
    print(f"Files updated: {updated_count}")

def add_script_to_file(file_path):
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()

        # 1. Check if script is already present
        if "js/simple-analytics.js" in content:
            print(f"[SKIP] {file_path} (Already present)")
            return False

        # 2. Find all Firebase script occurrences
        matches = list(FIREBASE_REGEX.finditer(content))
        
        new_content = ""
        
        if matches:
            # Insert after the LAST Firebase script found in the file
            last_match = matches[-1]
            end_pos = last_match.end()
            
            new_content = content[:end_pos] + SCRIPT_TAG + content[end_pos:]
            print(f"[UPDATE] {file_path} (Inserted after Firebase)")
        
        else:
            # Fallback: No Firebase scripts found? Insert before </body>
            if "</body>" in content:
                new_content = content.replace("</body>", SCRIPT_TAG + "\n</body>")
                print(f"[UPDATE] {file_path} (Inserted before body end)")
            else:
                print(f"[WARN] {file_path} (No Firebase scripts or body tag found, skipping)")
                return False

        # 3. Write changes back to file
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(new_content)
            return True

    except Exception as e:
        print(f"[ERROR] processing {file_path}: {e}")
        return False

if __name__ == "__main__":
    process_html_files()
