import os
import re

def add_overflow_hidden_to_html_files():
    """
    Scans the current directory for HTML files and adds the 'overflow-hidden'
    Tailwind CSS class to the <body> tag to prevent double scrollbars.
    """
    # Get the current directory where the script is running
    current_directory = os.getcwd()
    files_updated_count = 0
    files_scanned_count = 0

    print(f"Scanning for HTML files in: {current_directory}\n")

    # Iterate over all files in the directory
    for filename in os.listdir(current_directory):
        if filename.endswith(".html"):
            files_scanned_count += 1
            filepath = os.path.join(current_directory, filename)

            try:
                with open(filepath, 'r', encoding='utf-8') as f:
                    content = f.read()

                # Use regex to find the body tag and its class attribute
                body_tag_match = re.search(r'<body([^>]*)>', content)

                if not body_tag_match:
                    print(f"- Skipping '{filename}': No <body> tag found.")
                    continue

                full_body_tag = body_tag_match.group(0)
                body_attributes = body_tag_match.group(1)

                # Check if 'overflow-hidden' is already present
                if 'overflow-hidden' in full_body_tag:
                    print(f"- Skipping '{filename}': 'overflow-hidden' class already exists.")
                    continue

                # Regex to find the class attribute
                class_match = re.search(r'class="([^"]*)"', body_attributes)

                if class_match:
                    # If a class attribute exists, add 'overflow-hidden' to it
                    existing_classes = class_match.group(1)
                    new_classes = f"{existing_classes} overflow-hidden"
                    new_body_tag = full_body_tag.replace(f'class="{existing_classes}"', f'class="{new_classes}"')
                else:
                    # If no class attribute exists, add it
                    new_body_tag = f'<body class="overflow-hidden"{body_attributes}>'

                # Replace the old body tag with the new one
                new_content = content.replace(full_body_tag, new_body_tag, 1)

                # Write the updated content back to the file
                with open(filepath, 'w', encoding='utf-8') as f:
                    f.write(new_content)

                print(f"✔ Updated '{filename}' successfully.")
                files_updated_count += 1

            except Exception as e:
                print(f"❌ Error processing '{filename}': {e}")

    print("\n--------------------")
    print("      Summary      ")
    print("--------------------")
    print(f"Total HTML files scanned: {files_scanned_count}")
    print(f"Total files updated:    {files_updated_count}")
    print("--------------------\n")
    if files_updated_count > 0:
        print("The double scrollbar issue should now be fixed on the updated pages.")
    else:
        print("No files needed updating.")


if __name__ == "__main__":
    add_overflow_hidden_to_html_files()
