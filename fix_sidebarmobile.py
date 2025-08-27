import os
import glob
from bs4 import BeautifulSoup

def fix_mobile_sidebar():
    """
    This script fixes the mobile sidebar navigation for all .html files in the current directory.
    It adds the necessary HTML, CSS classes, and JavaScript to make the sidebar functional
    on smaller screens.
    """
    html_files = glob.glob('*.html')

    for file_path in html_files:
        print(f"Processing {file_path}...")
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()

        soup = BeautifulSoup(content, 'html.parser')

        # Find the main container and sidebar
        main_container = soup.find('div', class_='flex')
        sidebar = soup.find('aside')

        if not main_container or not sidebar:
            print(f"  -> Skipping {file_path}: Could not find main container or sidebar.")
            continue

        # Add an ID to the sidebar for easy selection with JavaScript
        sidebar['id'] = 'sidebar'

        # Update sidebar classes for mobile view
        sidebar['class'] = [
            'w-64', 'bg-white', 'dark:bg-gray-800', 'border-r', 'border-gray-200', 'dark:border-gray-700',
            'flex-shrink-0', 'flex', 'flex-col', 'fixed', 'inset-y-0', 'left-0', 'z-50',
            'lg:relative', 'lg:translate-x-0', '-translate-x-full',
            'transition-transform', 'duration-300', 'ease-in-out'
        ]

        # Add the sidebar overlay
        overlay = soup.new_tag(
            'div',
            id='sidebar-overlay',
            attrs={'class': 'fixed inset-0 bg-black bg-opacity-50 z-40 hidden lg:hidden'}
        )
        main_container.insert(0, overlay)

        # Add the JavaScript for toggling the sidebar
        script_tag = soup.new_tag('script')
        script_tag.string = """
            const sidebar = document.getElementById('sidebar');
            const sidebarToggle = document.getElementById('sidebar-toggle');
            const sidebarOverlay = document.getElementById('sidebar-overlay');

            if (sidebarToggle) {
                sidebarToggle.addEventListener('click', () => {
                    sidebar.classList.toggle('-translate-x-full');
                    sidebarOverlay.classList.toggle('hidden');
                });
            }

            if (sidebarOverlay) {
                sidebarOverlay.addEventListener('click', () => {
                    sidebar.classList.add('-translate-x-full');
                    sidebarOverlay.classList.add('hidden');
                });
            }
        """
        soup.body.append(script_tag)

        # Write the changes back to the file
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(str(soup))
        print(f"  -> Successfully updated {file_path}")

if __name__ == '__main__':
    fix_mobile_sidebar()
