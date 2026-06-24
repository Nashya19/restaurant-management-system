/**
 * Formatters for Date, Currency, Time Display
 * 
 * DESIGN DECISION: Centralized formatters ensure consistent display of numeric data.
 * Per globals.md, all numeric values (prices, times, counts) must display in JetBrains Mono.
 * These formatters provide the formatted strings; styling (.text-data) is applied in components.
 */

/**
 * Format currency to USD with 2 decimal places
 * Example: 1250.5 → "$1,250.50"
 */
export const formatCurrency = (value) => {
  if (value === null || value === undefined) return '$0.00';
  const num = parseFloat(value);
  if (isNaN(num)) return '$0.00';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
};

/**
 * Format date/time for display
 * Examples: 2024-01-15T10:30:00Z → "Jan 15, 2024" or "Jan 15, 10:30 AM"
 */
export const formatDate = (timestamp, format = 'short') => {
  if (!timestamp) return '—';
  const date = new Date(timestamp);
  if (isNaN(date)) return '—';
  
  if (format === 'short') {
    // "Jan 15, 2024"
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }
  if (format === 'long') {
    // "January 15, 2024"
    return date.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  }
  if (format === 'time') {
    // "10:30 AM"
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  }
  if (format === 'time24') {
    // "10:30"
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  }
  if (format === 'datetime') {
    // "Jan 15, 2024, 10:30 AM"
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  }
  if (format === 'datetime24') {
    // "Jan 15, 2024, 10:30"
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  }
  return date.toISOString();
};

/**
 * Format time in minutes to readable format
 * Examples: 15 → "15 min", 90 → "1h 30m"
 */
export const formatWaitTime = (minutes) => {
  if (!minutes || minutes <= 0) return '0 min';
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
};

/**
 * Get CSS class for wait time based on minutes
 * Used for coloring wait times per globals.md design tokens
 * < 30 min: normal (text-primary)
 * 30-45 min: amber (accent)
 * > 45 min: danger (destructive)
 */
export const getWaitTimeClass = (minutes) => {
  if (!minutes) return 'wait-normal';
  if (minutes < 30) return 'wait-normal';
  if (minutes < 46) return 'wait-amber';
  return 'wait-danger';
};

/**
 * Format order status to readable text
 */
export const formatOrderStatus = (status) => {
  const statusMap = {
    placed: 'Placed',
    preparing: 'Preparing',
    ready: 'Ready',
    delivered: 'Delivered',
    cancelled: 'Cancelled',
  };
  return statusMap[status] || status;
};

/**
 * Format table session status to readable text
 */
export const formatTableStatus = (status) => {
  const statusMap = {
    inactive: 'Inactive',
    open: 'Open',
    locked: 'Locked',
    completed: 'Completed',
    cleared: 'Cleared',
  };
  return statusMap[status] || status;
};

/**
 * Format user role to readable text
 */
export const formatRole = (role) => {
  const roleMap = {
    admin: 'Admin',
    staff: 'Staff',
  };
  return roleMap[role] || role;
};

/**
 * Get CSS badge class for status
 * Returns class names like "badge-placed", "badge-ready", etc.
 */
export const getStatusBadgeClass = (status, context = 'order') => {
  if (context === 'order') {
    const orderStatuses = {
      placed: 'badge-placed',
      preparing: 'badge-preparing',
      ready: 'badge-ready',
      delivered: 'badge-delivered',
      cancelled: 'badge-cancelled',
    };
    return orderStatuses[status] || '';
  }
  if (context === 'table') {
    const tableStatuses = {
      inactive: 'badge-inactive',
      open: 'badge-open',
      locked: 'badge-locked',
      completed: 'badge-completed',
      cleared: 'badge-cleared',
    };
    return tableStatuses[status] || '';
  }
  if (context === 'role') {
    return status === 'admin' ? 'badge-admin' : 'badge-staff';
  }
  return '';
};

/**
 * Shorten UUID for display (first 8 chars)
 * Example: "a1b2c3d4-5e6f..." → "a1b2c3d4"
 */
export const shortenId = (id) => {
  if (!id) return '—';
  return id.substring(0, 8).toUpperCase();
};

/**
 * Format count with locale-aware spacing
 * Example: 1000 → "1,000"
 */
export const formatCount = (count) => {
  if (count === null || count === undefined) return '0';
  return new Intl.NumberFormat('en-US').format(count);
};
