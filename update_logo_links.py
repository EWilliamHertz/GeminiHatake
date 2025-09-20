import os

def replace_logo_link(new_url):
    """
    Replaces all instances of the old logo URL with the new one in all HTML files
    within the 'public' directory.
    """
    old_url = "https://i.imgur.com/B06rBhI.png"
    public_dir = "public"

    # Check if the public directory exists
    if not os.path.isdir(public_dir):
        print(f"Error: Directory '{public_dir}' not found.")
        return

    # Walk through all files and subdirectories in the public directory
    for root, dirs, files in os.walk(public_dir):
        for file in files:
            if file.endswith(".html"):
                file_path = os.path.join(root, file)
                try:
                    with open(file_path, "r", encoding="utf-8") as f:
                        content = f.read()

                    # Replace the old URL with the new URL
                    if old_url in content:
                        new_content = content.replace(old_url, new_url)
                        with open(file_path, "w", encoding="utf-8") as f:
                            f.write(new_content)
                        print(f"Updated logo link in: {file_path}")

                except Exception as e:
                    print(f"Error processing file {file_path}: {e}")

if __name__ == "__main__":
    new_logo_url = "https://firebasestorage.googleapis.com/v0/b/hatakesocial-88b5e.firebasestorage.app/o/IMG_7951.png?alt=media&token=e7c2dc48-2836-4feb-9fc7-324aecacba6b"
    replace_logo_link(new_logo_url)
