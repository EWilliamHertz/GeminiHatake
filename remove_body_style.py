import os
import re

def remove_body_style_from_html(file_path):
    """
    Reads an HTML file, removes `style="display: none;"` from the body tag,
    and writes the changes back to the file.

    Args:
        file_path (str): The full path to the HTML file.
    """
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()

        # This regex finds the body tag and specifically targets the style attribute
        # It's designed to not affect other attributes on the body tag.
        # It captures the parts of the tag before and after the style attribute.
        pattern = re.compile(r'(<body[^>]*?) style="display: none;"([^>]*?>)', re.IGNORECASE)
        
        if pattern.search(content):
            # Replace the matched pattern with just the captured groups,
            # effectively removing the style attribute.
            new_content = pattern.sub(r'\1\2', content)
            
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(new_content)
            print(f"Successfully removed style from: {file_path}")
        else:
            print(f"No problematic style found in: {file_path}")

    except Exception as e:
        print(f"Error processing file {file_path}: {e}")

def process_all_html_files(root_dir):
    """
    Walks through a directory and applies the style removal function
    to all .html files.

    Args:
        root_dir (str): The root directory to start searching from.
    """
    for subdir, _, files in os.walk(root_dir):
        for file in files:
            if file.endswith('.html'):
                file_path = os.path.join(subdir, file)
                remove_body_style_from_html(file_path)

if __name__ == "__main__":
    public_directory = 'public'
    if os.path.isdir(public_directory):
        print(f"Starting to process HTML files in '{public_directory}' directory...")
        process_all_html_files(public_directory)
        print("\nProcessing complete.")
    else:
        print(f"Error: The directory '{public_directory}' was not found.")
        print("Please run this script from the root of your project.")
