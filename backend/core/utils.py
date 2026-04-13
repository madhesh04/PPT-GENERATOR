import re

def sanitize_filename(name: str) -> str:
    """
    Sanitizes a string to be used as a filename.
    Removes illegal characters and replaces spaces with underscores.
    """
    if not name:
        return "presentation"
    # Remove characters that aren't alphanumeric, space, dot, underscore, or hyphen
    cleaned = re.sub(r'[^\w\s\.-]', '', name).strip()
    # Replace multiple spaces/hyphens with a single underscore
    return re.sub(r'[-\s]+', '_', cleaned)
