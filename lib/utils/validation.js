/**
 * Validation Rules for User Management, Menu Management
 * 
 * DESIGN DECISION: Centralized validation allows consistent error messages across forms
 * and makes it easy to update rules in one place. Used by Module 2 (users) and Module 4 (menu).
 * 
 * EMAIL & PASSWORD follow security best practices (RFC 5322 simplified, 8+ chars with mixed case)
 * PRICE validation ensures numeric, non-negative, max 2 decimals (currency standard)
 * CATEGORY/MENU ITEM names prevent SQL injection via character restrictions
 */

export const validateEmail = (email) => {
  if (!email || email.trim().length === 0) return 'Email is required';
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) return 'Invalid email format';
  return null;
};

export const validatePassword = (password) => {
  if (!password || password.length === 0) return 'Password is required';
  if (password.length < 8) return 'Password must be at least 8 characters';
  if (!/[a-z]/.test(password)) return 'Password must contain lowercase letters';
  if (!/[A-Z]/.test(password)) return 'Password must contain uppercase letters';
  if (!/[0-9]/.test(password)) return 'Password must contain numbers';
  return null;
};

export const validateFullName = (fullName) => {
  if (!fullName || fullName.trim().length === 0) return 'Full name is required';
  if (fullName.trim().length < 2) return 'Full name must be at least 2 characters';
  if (fullName.length > 100) return 'Full name cannot exceed 100 characters';
  return null;
};

export const validateRole = (role) => {
  if (!role) return 'Role is required';
  if (!['admin', 'staff'].includes(role)) return 'Invalid role';
  return null;
};

export const validatePrice = (price) => {
  if (price === null || price === undefined || price === '') return 'Price is required';
  const numPrice = parseFloat(price);
  if (isNaN(numPrice)) return 'Price must be a valid number';
  if (numPrice < 0) return 'Price cannot be negative';
  if (numPrice > 99999.99) return 'Price exceeds maximum value';
  // Check decimal places
  const decimalPlaces = (price.toString().split('.')[1] || '').length;
  if (decimalPlaces > 2) return 'Price can have at most 2 decimal places';
  return null;
};

export const validatePrepTime = (prepTime) => {
  if (prepTime === null || prepTime === undefined || prepTime === '') return 'Prep time is required';
  const numTime = parseInt(prepTime);
  if (isNaN(numTime)) return 'Prep time must be a valid number';
  if (numTime < 1) return 'Prep time must be at least 1 minute';
  if (numTime > 1440) return 'Prep time cannot exceed 24 hours (1440 minutes)';
  return null;
};

export const validateMenuItemName = (name) => {
  if (!name || name.trim().length === 0) return 'Menu item name is required';
  if (name.trim().length < 2) return 'Menu item name must be at least 2 characters';
  if (name.length > 150) return 'Menu item name cannot exceed 150 characters';
  // Allow alphanumeric, spaces, hyphens, parentheses, ampersands
  if (!/^[a-zA-Z0-9\s\-()&']/.test(name)) return 'Menu item name contains invalid characters';
  return null;
};

export const validateCategoryName = (name) => {
  if (!name || name.trim().length === 0) return 'Category name is required';
  if (name.trim().length < 2) return 'Category name must be at least 2 characters';
  if (name.length > 50) return 'Category name cannot exceed 50 characters';
  if (!/^[a-zA-Z0-9\s\-&']/.test(name)) return 'Category name contains invalid characters';
  return null;
};

/**
 * Batch validation for forms
 * Returns object with field names as keys; null value = valid, string = error message
 */
export const validateUserForm = ({ email, password, fullName, role, isNewUser = true }) => {
  const errors = {};
  errors.email = validateEmail(email);
  if (isNewUser) {
    errors.password = validatePassword(password);
  }
  errors.fullName = validateFullName(fullName);
  errors.role = validateRole(role);
  // Filter out null values
  return Object.fromEntries(Object.entries(errors).filter(([, v]) => v !== null));
};

export const validateMenuItemForm = ({ name, categoryId, price, prepTime }) => {
  const errors = {};
  errors.name = validateMenuItemName(name);
  if (!categoryId) errors.categoryId = 'Category is required';
  errors.price = validatePrice(price);
  errors.prepTime = validatePrepTime(prepTime);
  return Object.fromEntries(Object.entries(errors).filter(([, v]) => v !== null));
};

export const validateCategoryForm = ({ name }) => {
  const errors = {};
  errors.name = validateCategoryName(name);
  return Object.fromEntries(Object.entries(errors).filter(([, v]) => v !== null));
};
