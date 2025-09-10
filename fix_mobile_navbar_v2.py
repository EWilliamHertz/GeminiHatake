import os
from bs4 import BeautifulSoup

def fix_mobile_navbar_globally(app_js_path):
    """
    Modifies the core app.js file to change how the mobile navbar is toggled.
    Instead of just changing the transform, it will also toggle a class on the
    body to prevent background content from scrolling and to manage layout.
    """
    if not os.path.exists(app_js_path):
        print(f"Error: Could not find app.js at '{app_js_path}'")
        return

    print("Reading app.js to apply a more robust navbar fix...")

    with open(app_js_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # Find the sidebar toggle logic
    toggle_logic_pattern = "sidebarToggle.addEventListener('click', () => {"
    
    if toggle_logic_pattern not in content:
        print("Error: Could not find the sidebar toggle event listener in app.js.")
        return

    # This is the new, improved logic.
    # It adds a class to the body and checks the state to prevent scrolling issues.
    new_logic = """
    sidebarToggle.addEventListener('click', () => {
        const isHidden = sidebar.classList.contains('-translate-x-full');
        if (isHidden) {
            sidebar.classList.remove('-translate-x-full');
            sidebar.classList.add('translate-x-0');
            document.body.classList.add('mobile-menu-open'); // Prevents background scroll
        } else {
            sidebar.classList.remove('translate-x-0');
            sidebar.classList.add('-translate-x-full');
            document.body.classList.remove('mobile-menu-open');
        }
    });
    """

    # Replace the old, simple toggle with our new, more robust version
    # We need to find the start and end of the original listener to replace it accurately.
    start_index = content.find(toggle_logic_pattern)
    if start_index != -1:
        # Find the closing bracket '});' for this specific listener
        brace_count = 0
        end_index = -1
        for i in range(start_index, len(content)):
            if content[i] == '{':
                brace_count += 1
            elif content[i] == '}':
                brace_count -= 1
                if brace_count == 0:
                    # We found the closing brace of the function body
                    # Now find the closing parenthesis and semicolon of the listener
                    end_of_listener = content.find(');', i)
                    if end_of_listener != -1:
                        end_index = end_of_listener + 2
                        break
        
        if end_index != -1:
            original_block = content[start_index:end_index]
            content = content.replace(original_block, new_logic)
            print("Successfully replaced old sidebar toggle logic with the new version.")
        else:
            print("Error: Could not determine the end of the sidebar toggle listener block.")
            return

    else:
        # Fallback if the specific pattern isn't found
        old_line = "sidebar.classList.toggle('-translate-x-full');"
        if old_line in content:
             print("Warning: Using fallback replacement method. This may be less reliable.")
             content = content.replace(old_line, """
                if (sidebar.classList.contains('-translate-x-full')) {
                    sidebar.classList.remove('-translate-x-full');
                    document.body.classList.add('mobile-menu-open');
                } else {
                    sidebar.classList.add('-translate-x-full');
                    document.body.classList.remove('mobile-menu-open');
                }
             """)
        else:
            print("Critical Error: Could not find any sidebar toggle logic to replace.")
            return

    with open(app_js_path, 'w', encoding='utf-8') as f:
        f.write(content)

    print("Successfully updated app.js.")

def add_global_styles(css_file_path):
    """
    Adds a critical CSS rule to prevent scrolling when the mobile menu is open.
    """
    if not os.path.exists(css_file_path):
        print(f"Error: Could not find CSS file at '{css_file_path}'")
        return

    print("Adding global style to handle mobile menu state...")
    
    style_rule = """
/* Prevents scrolling of the main content when the mobile sidebar is open */
body.mobile-menu-open {
    overflow: hidden;
}
"""

    with open(css_file_path, 'a', encoding='utf-8') as f:
        f.write(style_rule)
        
    print(f"Successfully added helper style to {css_file_path}")


# --- Main Execution ---
app_js_file = 'public/js/app.js'
style_css_file = 'public/css/style.css'

fix_mobile_navbar_globally(app_js_file)
add_global_styles(style_css_file)

print("\nNavbar fix has been applied. Please clear your browser cache and test again.")
