import os
import re

def fix_js_imports(directory):
    """
    Corrects relative import paths in JavaScript modules within a given directory.
    Searches for imports like './modules/module.js' and changes them to './module.js'.
    """
    fixed_files_count = 0
    total_changes_count = 0
    # Regex to find import statements with the incorrect './modules/' path
    pattern = re.compile(r"(import\s+.*?from\s+['\"])(\./modules/)(.*['\"];)")

    print(f"🚀 Starting scan to fix module imports in: {directory}")

    # Ensure the target directory exists
    if not os.path.isdir(directory):
        print(f"❌ Error: Directory not found at '{directory}'")
        return

    for filename in os.listdir(directory):
        if filename.endswith(".js"):
            filepath = os.path.join(directory, filename)
            try:
                with open(filepath, 'r', encoding='utf-8') as f:
                    content = f.read()

                # Check if the incorrect pattern exists and replace it
                if re.search(pattern, content):
                    print(f"🔎 Found incorrect imports in: {filename}")
                    new_content, num_substitutions = pattern.subn(r"\1./\3", content)
                    
                    if num_substitutions > 0:
                        total_changes_count += num_substitutions
                        with open(filepath, 'w', encoding='utf-8') as f:
                            f.write(new_content)
                        print(f"  - ✅ Corrected {num_substitutions} import path(s).")
                        if fixed_files_count == 0:
                            fixed_files_count = 1
                        else:
                            fixed_files_count +=1


            except Exception as e:
                print(f"⚠️ Could not process file {filepath}: {e}")

    if total_changes_count > 0:
        print(f"\n✨ Success! Corrected {total_changes_count} total import(s) in {fixed_files_count} file(s).")
    else:
        print("\n👍 Scan complete. No incorrect import paths were found.")

if __name__ == "__main__":
    # The directory where the JS modules are located
    modules_directory = 'public/js/modules'
    fix_js_imports(modules_directory)
