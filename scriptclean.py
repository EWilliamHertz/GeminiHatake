import os
import re
import argparse
from pathlib import Path
import logging

# Set up logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def find_protected_ranges(content: str) -> list[tuple[int, int]]:
    """Finds the start and end positions of modals protected by comments."""
    ranges = []
    # Pattern to find <!-- Login/Register Modal --> ... </div>
    # This is a simplified approach; it assumes the next </div> closes the modal.
    # A more complex parser would be needed for perfect nesting, but this should work for the given structure.
    for match in re.finditer(r'<!--\s*(Login|Register)\s+Modal\s*-->', content):
        start_pos = match.start()
        # Find the start of the div right after the comment
        div_start = content.find('<div', match.end())
        if div_start == -1:
            continue

        # Find the corresponding closing div
        # This is tricky without a full parser. We'll find the next major closing element.
        # Let's find the end of the form within it.
        form_end = content.find('</form>', div_start)
        if form_end != -1:
             div_end_search_start = content.find('</div>', form_end)
             if div_end_search_start != -1:
                 end_pos = content.find('</div>', div_end_search_start + 1) # find the second closing div
                 if end_pos != -1:
                     ranges.append((start_pos, end_pos + 6))
    return ranges

def remove_unwanted_forms(file_path: Path, backup: bool = True):
    """
    Reads an HTML file, removes unwanted forms, and writes it back.
    """
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
    except Exception as e:
        logger.error(f"Could not read file {file_path}: {e}")
        return

    original_content = content
    protected_ranges = find_protected_ranges(content)
    
    # Pattern for the original authModal
    auth_modal_pattern = re.compile(r'<div class="modal" id="authModal">.*?</div>\s*</div>', re.DOTALL)
    
    # Pattern for the loose form elements found in community.html
    loose_form_pattern = re.compile(
        r'<div>\s*<label[^>]+for="registerPassword".*?</button>', 
        re.DOTALL
    )

    patterns_to_remove = [auth_modal_pattern, loose_form_pattern]
    forms_removed_count = 0

    for pattern in patterns_to_remove:
        matches = list(pattern.finditer(content))
        # Iterate backwards to not mess up indices
        for match in reversed(matches):
            is_protected = False
            for start, end in protected_ranges:
                if start <= match.start() < end:
                    is_protected = True
                    break
            
            if not is_protected:
                logger.info(f"Removing unwanted form from {file_path} (pattern: {pattern.pattern[:30]}...)")
                content = content[:match.start()] + content[match.end():]
                forms_removed_count += 1

    if forms_removed_count > 0:
        if backup:
            backup_path = file_path.with_suffix(file_path.suffix + '.backup')
            with open(backup_path, 'w', encoding='utf-8') as f:
                f.write(original_content)
            logger.info(f"Backup created: {backup_path}")

        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(content)
        logger.info(f"Successfully removed {forms_removed_count} form(s) from {file_path}")
    else:
        logger.info(f"No unwanted forms found in {file_path}")


def main():
    parser = argparse.ArgumentParser(
        description="Remove unwanted login/register forms from HTML files."
    )
    parser.add_argument(
        'path',
        help='Path to an HTML file or a directory containing HTML files.'
    )
    parser.add_argument(
        '--no-backup',
        action='store_true',
        help="Don't create backup files."
    )
    parser.add_argument(
        '--verbose',
        action='store_true',
        help='Enable detailed logging.'
    )
    args = parser.parse_args()

    if args.verbose:
        logger.setLevel(logging.DEBUG)

    root_path = Path(args.path)
    if not root_path.exists():
        logger.error(f"Path does not exist: {root_path}")
        return

    if root_path.is_dir():
        for html_file in root_path.glob('**/*.html'):
            remove_unwanted_forms(html_file, not args.no_backup)
    elif root_path.is_file() and root_path.suffix == '.html':
        remove_unwanted_forms(root_path, not args.no_backup)
    else:
        logger.error(f"Path is not a valid HTML file or directory: {root_path}")


if __name__ == "__main__":
    main()
