import os
from bs4 import BeautifulSoup

def standardize_headers():
    """
    Copies the header from app.html and applies it to all other HTML files
    in the public directory, excluding specified files.
    """
    public_dir = 'public'
    source_file = os.path.join(public_dir, 'app.html')
    exclude_files = ['app.html', 'terms.html', 'privacy.html']

    # 1. Read the header from the source file (app.html)
    try:
        with open(source_file, 'r', encoding='utf-8') as f:
            soup_source = BeautifulSoup(f, 'html.parser')
            
            # Find the header within the main content div, which is more specific
            main_content_div = soup_source.find('div', class_='flex-1')
            if not main_content_div:
                print(f"Error: Could not find the main content div in {source_file}")
                return
            
            source_header = main_content_div.find('header')

            if not source_header:
                print(f"Error: Could not find the <header> tag in {source_file}")
                return
            print("Successfully extracted header from app.html")

    except FileNotFoundError:
        print(f"Error: Source file {source_file} not found.")
        return

    # 2. Iterate through all HTML files in the public directory
    files_updated = 0
    for filename in os.listdir(public_dir):
        if filename.endswith('.html') and filename not in exclude_files:
            target_file_path = os.path.join(public_dir, filename)
            
            try:
                with open(target_file_path, 'r', encoding='utf-8') as f:
                    soup_target = BeautifulSoup(f, 'html.parser')

                # Find the header in the target file
                target_main_div = soup_target.find('div', class_='flex-1')
                if not target_main_div:
                    print(f"Warning: Skipping {filename}, could not find main content div.")
                    continue

                target_header = target_main_div.find('header')

                if target_header:
                    # Replace the existing header
                    target_header.replace_with(source_header)
                    
                    # Write the changes back to the file
                    with open(target_file_path, 'w', encoding='utf-8') as f:
                        f.write(str(soup_target))
                    print(f"Updated header in: {filename}")
                    files_updated += 1
                else:
                    print(f"Warning: No <header> found in {filename}. The file was not modified.")

            except Exception as e:
                print(f"An error occurred while processing {filename}: {e}")

    print(f"\nHeader standardization complete. Updated {files_updated} files.")

if __name__ == '__main__':
    standardize_headers()
