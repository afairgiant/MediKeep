"""
Application constants and configuration values.
"""

# User roles
ADMIN_ROLES = ["admin", "administrator"]

def is_admin_role(role: str) -> bool:
    """
    Check if a role is an admin role (case-insensitive).

    Args:
        role: Role string to check

    Returns:
        True if the role is an admin role, False otherwise
    """
    if not role:
        return False
    return role.lower() in ADMIN_ROLES

def get_admin_roles_filter():
    """
    Get a list of admin role variations for database queries.
    Includes both lowercase and capitalized versions for compatibility.

    Returns:
        List of admin role strings for database filtering
    """
    admin_variations = []
    for role in ADMIN_ROLES:
        admin_variations.extend([role, role.capitalize(), role.upper()])
    return admin_variations