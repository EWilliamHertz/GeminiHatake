import os
from bs4 import BeautifulSoup, Comment

def update_navigation_in_html(file_path):
    """
    Updates the navigation links in a single HTML file to separate 
    'TCG Articles' and 'Hatake Blog'. Handles both the main sidebar
    and the index.html header.
    """
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            soup = BeautifulSoup(f.read(), 'html.parser')

        # --- Flag to check if any changes were made ---
        made_changes = False

        # --- PART 1: Update the standard sidebar navigation ---
        # Find the 'Articles' link in the sidebar
        sidebar_article_link = soup.find('a', href="articles.html")
        
        if sidebar_article_link and sidebar_article_link.find('span', string='Articles'):
            # Create the new "TCG Articles" link
            tcg_articles_link = soup.new_tag('a', href="articles.html?type=tcg")
            tcg_articles_link['class'] = "flex items-center px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-md"
            
            tcg_icon = soup.new_tag('i')
            tcg_icon['class'] = "fas fa-newspaper w-6 text-center"
            
            tcg_span = soup.new_tag('span', **{'class': 'ml-3'})
            tcg_span.string = "TCG Articles"
            
            tcg_articles_link.append(tcg_icon)
            tcg_articles_link.append(tcg_span)

            # Create the new "Hatake Blog" link
            blog_link = soup.new_tag('a', href="articles.html?type=blog")
            blog_link['class'] = "flex items-center px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-md"

            blog_icon = soup.new_tag('i')
            blog_icon['class'] = "fas fa-blog w-6 text-center" # Using a new icon for the blog

            blog_span = soup.new_tag('span', **{'class': 'ml-3'})
            blog_span.string = "Hatake Blog"

            blog_link.append(blog_icon)
            blog_link.append(blog_span)
            
            # Replace the old link with the two new ones
            sidebar_article_link.replace_with(tcg_articles_link, blog_link)
            made_changes = True
            print(f"  -> Updated sidebar navigation in {os.path.basename(file_path)}")


        # --- PART 2: Update the index.html header (a special case) ---
        # Find the "Blog" link specifically, which is unique to index.html's header
        index_header_blog_link = soup.find('a', href="articles.html", string="Blog")
        if index_header_blog_link:
            # Create the new dropdown structure
            content_dropdown = soup.new_tag('div', **{'class': 'group relative py-3 -my-3'})
            
            button = soup.new_tag('button', **{'class': 'text-gray-300 hover:text-white transition-colors'})
            button.string = "Content"
            
            dropdown_div = soup.new_tag('div', **{'class': 'absolute hidden group-hover:block bg-gray-800 rounded-md shadow-lg mt-2 py-2 w-48 border border-gray-700'})
            
            tcg_link = soup.new_tag('a', href="articles.html?type=tcg", **{'class': 'block px-4 py-2 text-sm text-gray-300 hover:bg-gray-700 hover:text-white'})
            tcg_link.string = "TCG Articles"
            
            blog_link_index = soup.new_tag('a', href="articles.html?type=blog", **{'class': 'block px-4 py-2 text-sm text-gray-300 hover:bg-gray-700 hover:text-white'})
            blog_link_index.string = "Hatake Blog"

            dropdown_div.append(tcg_link)
            dropdown_div.append(blog_link_index)
            content_dropdown.append(button)
            content_dropdown.append(dropdown_div)

            # Replace the old link with the new dropdown
            index_header_blog_link.replace_with(content_dropdown)
            made_changes = True
            print(f"  -> Updated header navigation in {os.path.basename(file_path)}")

        # --- Write changes back to the file if any were made ---
        if made_changes:
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(str(soup))
        
        return made_changes

    except Exception as e:
        print(f"Error processing file {file_path}: {e}")
        return False

def main():
    """
    Main function to find all HTML files in the 'public' directory
    and update their navigation bars.
    """
    public_dir = 'public'
    if not os.path.isdir(public_dir):
        print(f"Error: Directory '{public_dir}' not found. Please run this script from the root of your project.")
        return

    print("Starting navigation update process...")
    
    updated_files_count = 0
    total_files_checked = 0

    for root, _, files in os.walk(public_dir):
        for filename in files:
            if filename.endswith('.html'):
                file_path = os.path.join(root, filename)
                total_files_checked += 1
                if update_navigation_in_html(file_path):
                    updated_files_count += 1

    print("\n-----------------------------------------")
    print("Navigation update process complete.")
    print(f"Checked: {total_files_checked} HTML files.")
    print(f"Updated: {updated_files_count} files.")
    print("-----------------------------------------")


if __name__ == "__main__":
    main()
