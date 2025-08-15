/**
 * Auth utility functions
 */

/**
 * Determines if a user role is an admin role
 * @param {string} role - The user role to check
 * @returns {boolean} True if the role is admin, false otherwise
 */
export const isAdminRole = (role) => {
  if (!role || typeof role !== 'string') {
    return false;
  }
  
  const adminRoles = ['admin', 'administrator'];
  return adminRoles.includes(role.toLowerCase());
};

/**
 * Determines if a user object has admin privileges
 * @param {Object} user - The user object to check
 * @returns {boolean} True if the user is an admin, false otherwise
 */
export const isUserAdmin = (user) => {
  return user?.role ? isAdminRole(user.role) : false;
};