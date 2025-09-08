import os

def add_nav_scrolling_to_html_files():
    """
    Scans the current directory for HTML files and adds 'overflow-y-auto'
    to the specific sidebar <nav> element to enable scrolling on smaller screens.
    """
    current_directory = os.getcwd()
    files_updated_count = 0
    files_scanned_count = 0

    # The specific class string of the nav element we want to modify
    target_nav_class = 'class="flex-1 px-4 py-6 space-y-2"'
    # The new class string with the added scrolling class
    replacement_nav_class = 'class="flex-1 px-4 py-6 space-y-2 overflow-y-auto"'

    print(f"Scanning for HTML files in: {current_directory}\n")

    for filename in os.listdir(current_directory):
        if filename.endswith(".html"):
            files_scanned_count += 1
            filepath = os.path.join(current_directory, filename)

            try:
                with open(filepath, 'r', encoding='utf-8') as f:
                    content = f.read()

                # Check if the fix is already applied
                if replacement_nav_class in content:
                    print(f"- Skipping '{filename}': Navigation scrollbar fix already applied.")
                    continue

                # Check if the target nav element exists in the file
                if target_nav_class in content:
                    # Replace the old class string with the new one
                    new_content = content.replace(target_nav_class, replacement_nav_class, 1)

                    # Write the updated content back to the file
                    with open(filepath, 'w', encoding='utf-8') as f:
                        f.write(new_content)

                    print(f"✔ Updated '{filename}': Added scrolling to the sidebar navigation.")
                    files_updated_count += 1
                else:
                    print(f"- Skipping '{filename}': Sidebar navigation element not found.")

            except Exception as e:
                print(f"❌ Error processing '{filename}': {e}")

    print("\n--------------------")
    print("      Summary      ")
    print("--------------------")
    print(f"Total HTML files scanned: {files_scanned_count}")
    print(f"Total files updated:    {files_updated_count}")
    print("--------------------\n")
    if files_updated_count > 0:
        print("The sidebar navigation should now scroll correctly on smaller screens.")
    else:
        print("No files needed updating.")


if __name__ == "__main__":
    add_nav_scrolling_to_html_files()
