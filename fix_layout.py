import os
from bs4 import BeautifulSoup

def fix_html_layout(file_path):
    """
    Reads an HTML file, extracts the main content, and rebuilds the file
    with a standardized, correct layout that ensures the messenger widget
    is clickable and functional.
    """
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            soup = BeautifulSoup(f, 'html.parser')

        # Find the main content of the page
        main_content = soup.find('main')
        if not main_content:
            print(f"Could not find a <main> tag in {file_path}. Skipping.")
            return

        # Define the standardized, correct layout
        new_layout = f"""
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{soup.title.string if soup.title else 'HatakeSocial'}</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css">
    <link rel="stylesheet" href="css/style.css">
</head>
<body class="bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-200 font-sans overflow-hidden">

    <div class="flex h-screen">
        <div id="sidebar-container"></div>

        <div class="flex-1 flex flex-col overflow-hidden">
            <div id="header-container"></div>

            {main_content.prettify()}
        </div>
    </div>

    <div id="messenger-widget-container"></div>
    <div id="login-modal-container"></div>
    <div id="register-modal-container"></div>

    <script src="https://www.gstatic.com/firebasejs/9.6.1/firebase-app-compat.js"></script>
    <script src="https://www.gstatic.com/firebasejs/9.6.1/firebase-auth-compat.js"></script>
    <script src="https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore-compat.js"></script>
    <script src="https://www.gstatic.com/firebasejs/9.6.1/firebase-storage-compat.js"></script>
    <script src="https://www.gstatic.com/firebasejs/9.6.1/firebase-analytics-compat.js"></script>
    <script src="/__/firebase/init.js"></script>

    <script src="js/auth.js"></script>
    <script src="js/darkmode.js"></script>
    <script src="js/messenger.js"></script>
    
    </body>
</html>
        """

        # Extract the page-specific scripts from the original file
        page_specific_scripts = []
        for script in soup.find_all('script'):
            if script.get('src') and not any(s in script['src'] for s in ['firebase', 'auth.js', 'darkmode.js', 'messenger.js']):
                page_specific_scripts.append(str(script))

        # Replace the placeholder with the page-specific scripts
        scripts_html = '\n    '.join(page_specific_scripts)
        final_html = new_layout.replace('', scripts_html)

        # Write the corrected HTML back to the file
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(final_html)
            
        print(f"Successfully fixed the layout for {file_path}")

    except Exception as e:
        print(f"An error occurred while processing {file_path}: {e}")


if __name__ == '__main__':
    # List of files to fix
    files_to_fix = [
        'public/app.html',
        'public/articles.html',
        'public/trades.html',
        'public/profile.html',
        'public/events.html',
        'public/settings.html'
    ]

    for file in files_to_fix:
        if os.path.exists(file):
            fix_html_layout(file)
        else:
            print(f"File not found: {file}")
