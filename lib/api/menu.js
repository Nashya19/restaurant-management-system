/**
 * Menu API — Supabase Queries for Module 4: Menu Management
 * 
 * DESIGN DECISION: Centralized queries for menu and category management.
 * 
 * ADMIN VS. STAFF ACCESS:
 * - Admin: Full CRUD on categories, items, pricing, availability, archiving
 * - Staff: Can only toggle is_available (RLS enforces this at database level)
 * - Customers: See menu via QR (queries don't distinguish; RLS handles via role)
 * 
 * ARCHIVING vs. DELETING:
 * - Never delete menu items (breaks historical order records)
 * - Archive instead (is_archived = true)
 * - Customers don't see archived items
 * - Admins see archived items for reference
 * 
 * CATEGORY INTEGRITY:
 * - Categories use ON DELETE RESTRICT (can't delete if items reference it)
 * - Prevents orphaned menu items
 * - If admin tries to delete, Supabase returns FK constraint error
 * 
 * PRICING:
 * - All prices in database as numeric(10,2) (cents or currency units)
 * - API returns as-is; UI formats via formatCurrency()
 * - price_at_order: when item added to order, save current price (price locked in time)
 */

import { createClient } from '@/lib/supabase/client';
import { handleSupabaseError } from '@/lib/utils/rls-checks';

// ============ CATEGORIES ============

/**
 * Fetch all categories
 * Used by menu list page (filter dropdown) and category management page
 */
export async function listCategories() {
  const supabase = createClient();

  try {
    const { data, error } = await supabase
      .from('categories')
      .select(`
        id,
        name,
        created_at,
        menu_items (
          id,
          is_archived
        )
      `)
      .order('name', { ascending: true });

    if (error) {
      throw new Error(handleSupabaseError(error, 'Failed to fetch categories'));
    }

    return data || [];
  } catch (err) {
    throw err;
  }
}

/**
 * Create new category
 * Admin only (RLS enforces)
 */
export async function createCategory(name) {
  const supabase = createClient();

  try {
    const { data, error } = await supabase
      .from('categories')
      .insert([{ name }])
      .select()
      .single();

    if (error) {
      throw new Error(handleSupabaseError(error, 'Failed to create category'));
    }

    return data;
  } catch (err) {
    throw err;
  }
}

/**
 * Update category name
 * Admin only (RLS enforces)
 */
export async function updateCategory(categoryId, name) {
  const supabase = createClient();

  try {
    const { data, error } = await supabase
      .from('categories')
      .update({ name })
      .eq('id', categoryId)
      .select()
      .single();

    if (error) {
      throw new Error(handleSupabaseError(error, 'Failed to update category'));
    }

    return data;
  } catch (err) {
    throw err;
  }
}

/**
 * Delete category
 * Admin only (RLS enforces)
 * 
 * Will fail with FK constraint error if items reference this category
 * User-friendly error message in error handler
 */
export async function deleteCategory(categoryId) {
  const supabase = createClient();

  try {
    const { error } = await supabase
      .from('categories')
      .delete()
      .eq('id', categoryId);

    if (error) {
      throw new Error(handleSupabaseError(error, 'Failed to delete category'));
    }

    return true;
  } catch (err) {
    throw err;
  }
}

// ============ MENU ITEMS ============

/**
 * Fetch all menu items (admin view - includes archived)
 * Admin sees all items for management
 */
export async function listAllMenuItems() {
  const supabase = createClient();

  try {
    const { data, error } = await supabase
      .from('menu_items')
      .select(
        `
        id,
        name,
        price,
        category_id,
        categories(id, name),
        is_available,
        is_archived,
        prep_time_minutes,
        created_at
      `
      )
      .order('categories(name)', { ascending: true })
      .order('name', { ascending: true });

    if (error) {
      throw new Error(handleSupabaseError(error, 'Failed to fetch menu items'));
    }

    return data || [];
  } catch (err) {
    throw err;
  }
}

/**
 * Fetch only available menu items (customer view - excludes archived)
 * Customers on QR see only available items
 */
export async function listAvailableMenuItems(categoryId = null) {
  const supabase = createClient();

  try {
    let query = supabase
      .from('menu_items')
      .select(
        `
        id,
        name,
        price,
        category_id,
        categories(id, name),
        is_available,
        prep_time_minutes,
        created_at
      `
      )
      .eq('is_archived', false)
      .order('categories(name)', { ascending: true })
      .order('name', { ascending: true });

    if (categoryId) {
      query = query.eq('category_id', categoryId);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(handleSupabaseError(error, 'Failed to fetch menu items'));
    }

    return data || [];
  } catch (err) {
    throw err;
  }
}

/**
 * Get single menu item by ID
 * Used by edit form
 */
export async function getMenuItemById(itemId) {
  const supabase = createClient();

  try {
    const { data, error } = await supabase
      .from('menu_items')
      .select(
        `
        id,
        name,
        price,
        category_id,
        categories(id, name),
        is_available,
        is_archived,
        prep_time_minutes,
        created_at
      `
      )
      .eq('id', itemId)
      .single();

    if (error) {
      throw new Error(handleSupabaseError(error, 'Menu item not found'));
    }

    return data;
  } catch (err) {
    throw err;
  }
}

/**
 * Create new menu item
 * Admin only (RLS enforces)
 */
export async function createMenuItem({ name, categoryId, price, prepTime }) {
  const supabase = createClient();

  try {
    const { data, error } = await supabase
      .from('menu_items')
      .insert([
        {
          name,
          category_id: categoryId,
          price: parseFloat(price),
          prep_time_minutes: parseInt(prepTime),
          is_available: true,
          is_archived: false,
        },
      ])
      .select(
        `
        id,
        name,
        price,
        category_id,
        categories(id, name),
        is_available,
        is_archived,
        prep_time_minutes,
        created_at
      `
      )
      .single();

    if (error) {
      throw new Error(handleSupabaseError(error, 'Failed to create menu item'));
    }

    return data;
  } catch (err) {
    throw err;
  }
}

/**
 * Update menu item
 * Admin only (RLS enforces)
 * Can update: name, category, price, prep time, is_available, is_archived
 */
export async function updateMenuItem(itemId, { name, categoryId, price, prepTime, isAvailable, isArchived }) {
  const supabase = createClient();

  try {
    const updateData = {
      name,
      category_id: categoryId,
      price: parseFloat(price),
      prep_time_minutes: parseInt(prepTime),
      is_available: isAvailable,
      is_archived: isArchived,
    };

    const { data, error } = await supabase
      .from('menu_items')
      .update(updateData)
      .eq('id', itemId)
      .select(
        `
        id,
        name,
        price,
        category_id,
        categories(id, name),
        is_available,
        is_archived,
        prep_time_minutes,
        created_at
      `
      )
      .single();

    if (error) {
      throw new Error(handleSupabaseError(error, 'Failed to update menu item'));
    }

    return data;
  } catch (err) {
    throw err;
  }
}

/**
 * Archive menu item (soft delete)
 * Admin only; staff cannot delete or archive
 * Never fully delete (breaks order history)
 */
export async function archiveMenuItem(itemId) {
  const supabase = createClient();

  try {
    const { data, error } = await supabase
      .from('menu_items')
      .update({ is_archived: true })
      .eq('id', itemId)
      .select(
        `
        id,
        name,
        price,
        category_id,
        categories(id, name),
        is_available,
        is_archived,
        prep_time_minutes,
        created_at
      `
      )
      .single();

    if (error) {
      throw new Error(handleSupabaseError(error, 'Failed to archive item'));
    }

    return data;
  } catch (err) {
    throw err;
  }
}

/**
 * Restore archived menu item
 * Admin only
 */
export async function restoreMenuItem(itemId) {
  const supabase = createClient();

  try {
    const { data, error } = await supabase
      .from('menu_items')
      .update({ is_archived: false })
      .eq('id', itemId)
      .select(
        `
        id,
        name,
        price,
        category_id,
        categories(id, name),
        is_available,
        is_archived,
        prep_time_minutes,
        created_at
      `
      )
      .single();

    if (error) {
      throw new Error(handleSupabaseError(error, 'Failed to restore item'));
    }

    return data;
  } catch (err) {
    throw err;
  }
}

/**
 * Toggle availability of menu item
 * Admin and Staff can use this (RLS allows)
 * Used during service: disable item if out of stock
 */
export async function toggleMenuItemAvailability(itemId) {
  const supabase = createClient();

  try {
    // Fetch current state
    const { data: current, error: fetchError } = await supabase
      .from('menu_items')
      .select('is_available')
      .eq('id', itemId)
      .single();

    if (fetchError) {
      throw new Error(handleSupabaseError(fetchError, 'Failed to fetch item'));
    }

    // Toggle
    const { data, error } = await supabase
      .from('menu_items')
      .update({ is_available: !current.is_available })
      .eq('id', itemId)
      .select(
        `
        id,
        name,
        price,
        category_id,
        categories(id, name),
        is_available,
        is_archived,
        prep_time_minutes,
        created_at
      `
      )
      .single();

    if (error) {
      throw new Error(handleSupabaseError(error, 'Failed to update availability'));
    }

    return data;
  } catch (err) {
    throw err;
  }
}

/**
 * Search menu items by name
 * Used by menu list search bar
 */
export async function searchMenuItems(query, includeArchived = false) {
  const supabase = createClient();

  try {
    if (!query || query.trim().length === 0) {
      return [];
    }

    const searchTerm = `%${query.trim()}%`;
    let queryBuilder = supabase
      .from('menu_items')
      .select(
        `
        id,
        name,
        price,
        category_id,
        categories(id, name),
        is_available,
        is_archived,
        prep_time_minutes
      `
      )
      .ilike('name', searchTerm)
      .order('name', { ascending: true })
      .limit(20);

    if (!includeArchived) {
      queryBuilder = queryBuilder.eq('is_archived', false);
    }

    const { data, error } = await queryBuilder;

    if (error) {
      throw new Error(handleSupabaseError(error, 'Search failed'));
    }

    return data || [];
  } catch (err) {
    throw err;
  }
}

/**
 * Get menu item count
 * For dashboard KPI (total items in system)
 */
export async function getMenuItemCount(includeArchived = false) {
  const supabase = createClient();

  try {
    let queryBuilder = supabase
      .from('menu_items')
      .select('*', { count: 'exact', head: true });

    if (!includeArchived) {
      queryBuilder = queryBuilder.eq('is_archived', false);
    }

    const { count, error } = await queryBuilder;

    if (error) {
      console.error('Failed to get menu item count:', error);
      return 0;
    }

    return count || 0;
  } catch (err) {
    console.error('Error fetching menu item count:', err);
    return 0;
  }
}
