
/**
 * Table Management API — Supabase Queries for Module 7
 *
 * Centralized Supabase queries for the `tables` table. Exposes simple CRUD
 * functions used by the admin UI at /app/tables.
 */

import { createClient } from '@/lib/supabase/client';
import { handleSupabaseError } from '@/lib/utils/rls-checks';

function buildDefaultQrCodeUrl(tableNumber) {
  const baseUrl =
    process.env.NEXT_PUBLIC_BASE_URL ||
    (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000');

  return `${baseUrl}/table/${tableNumber}`;
}

export async function listTables() {
  const supabase = createClient();

  try {
    const { data, error } = await supabase
  .from('tables')
  .select('id, table_number, capacity, qr_code_url, created_at, is_active')
  .eq('is_active', true)
  .order('table_number', { ascending: true });

    if (error) {
      throw new Error(
        handleSupabaseError(error, 'Failed to fetch tables')
      );
    }

    return data || [];
  } catch (err) {
    throw err;
  }
}

export async function getTableById(tableId) {
  const supabase = createClient();

  try {
    const { data, error } = await supabase
      .from('tables')
      .select('id, table_number, capacity, qr_code_url, created_at')
      .eq('id', tableId)
      .single();

    if (error) {
      throw new Error(
        handleSupabaseError(error, 'Table not found')
      );
    }

    return data;
  } catch (err) {
    throw err;
  }
}

export async function createTable({ tableNumber, capacity, qrCodeUrl }) {
  const supabase = createClient();

  const normalizedQrCodeUrl =
    qrCodeUrl?.trim() || buildDefaultQrCodeUrl(tableNumber);

  try {
    const { data, error } = await supabase
      .from('tables')
      .insert([
        {
          table_number: tableNumber,
          capacity,
          qr_code_url: normalizedQrCodeUrl,
        },
      ])
      .select()
      .single();

    if (error) {
      throw new Error(
        handleSupabaseError(error, 'Failed to create table')
      );
    }

    return data;
  } catch (err) {
    throw err;
  }
}

export async function updateTable(
  tableId,
  { tableNumber, capacity, qrCodeUrl }
) {
  const supabase = createClient();

  const normalizedQrCodeUrl =
    qrCodeUrl?.trim() || buildDefaultQrCodeUrl(tableNumber);

  try {
    const { data, error } = await supabase
      .from('tables')
      .update({
        table_number: tableNumber,
        capacity,
        qr_code_url: normalizedQrCodeUrl,
      })
      .eq('id', tableId)
      .select()
      .single();

    if (error) {
      throw new Error(
        handleSupabaseError(error, 'Failed to update table')
      );
    }

    return data;
  } catch (err) {
    throw err;
  }
}

export async function deleteTable(tableId) {
  const supabase = createClient();

  try {
    const { error } = await supabase
      .from('tables')
      .delete()
      .eq('id', tableId);

    if (error) {
      throw new Error(
        handleSupabaseError(error, 'Failed to delete table')
      );
    }

    return true;
  } catch (err) {
    throw err;
  }
}

