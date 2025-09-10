import os
from bs4 import BeautifulSoup

def cleanup_legal_page(file_path):
    """
    Reads an HTML file, extracts the content from the main content container,
    and overwrites the file with just that content.
    """
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            soup = BeautifulSoup(f, 'html.parser')

        # Find the main content area. Based on your site's structure,
        # this is the most likely container for the article text.
        main_content = soup.find('main', class_='flex-1')

        if not main_content:
            print(f"Warning: Could not find the main content area in {file_path}. Skipping.")
            return

        # Extract the inner HTML of the main content
        content_html = ''.join(str(tag) for tag in main_content.contents)

        # Overwrite the original file with only the extracted content
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(content_html.strip())
            
        print(f"Successfully cleaned up {file_path}")

    except FileNotFoundError:
        print(f"Error: File not found at {file_path}. Please check the path.")
    except Exception as e:
        print(f"An unexpected error occurred while processing {file_path}: {e}")

if __name__ == "__main__":
    # List of legal pages to clean up
    pages_to_clean = [
        os.path.join('public', 'terms.html'),
        os.path.join('public', 'privacy.html')
    ]

    for page in pages_to_clean:
        if os.path.exists(page):
            cleanup_legal_page(page)
        else:
            print(f"Info: File {page} not found, skipping.")
