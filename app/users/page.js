/**
 * /app/users/page.js
 * 
 * User list page (admin view)
 * Displays all staff profiles with:
 * - Table with columns: Name, Email (TBD), Role, Created Date, Actions
 * - Search bar for real-time filtering
 * - Create button linking to /users/new
 * - Edit/Delete actions per row
 * 
 * DESIGN COMPLIANCE:
 * - Dark theme (`.dark` class on root)
 * - Amber accent (#D4862A) for primary CTA ("Create Staff")
 * - Role shown as `.badge-admin` or `.badge-staff` (from globals.md)
 * - Dates formatted via formatters.js, displayed in `.text-small`
 * - Table headers in `.text-subheading` uppercase
 * 
 * DATA LOADING:
 * Fetches on mount via useSWR or useEffect + useState.
 * Using simple useEffect (not SWR) to reduce dependencies.
 * In production, would add SWR for caching + revalidation.
 */

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { listUsers, searchUsers } from '@/lib/api/users';
import { deleteUser } from '@/lib/actions/users';
import { formatRole, getStatusBadgeClass, formatDate } from '@/lib/utils/formatters';
import { Edit2, Trash2, Plus, Search } from 'lucide-react';

export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const router = useRouter();

  // Fetch all users on mount
  useEffect(() => {
    const fetchUsers = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const { users: data } = await listUsers();
        setUsers(data);
        setFilteredUsers(data);
      } catch (err) {
        setError(err.message);
        console.error('Failed to fetch users:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchUsers();
  }, []);

  // Handle search (debounced in real app; here simplified)
  const handleSearch = async (query) => {
    setSearchQuery(query);

    if (!query.trim()) {
      setFilteredUsers(users);
      return;
    }

    try {
      const results = await searchUsers(query);
      setFilteredUsers(results);
    } catch (err) {
      console.error('Search failed:', err);
      setError('Search failed. Please try again.');
    }
  };

  // Handle delete with confirmation
  const handleDelete = async (userId, userName) => {
    if (!confirm(`Delete staff member "${userName}"? This cannot be undone.`)) {
      return;
    }

    try {
      await deleteUser(userId);
      setUsers(users.filter((u) => u.id !== userId));
      setFilteredUsers(filteredUsers.filter((u) => u.id !== userId));
    } catch (err) {
      setError(err.message);
      console.error('Failed to delete user:', err);
    }
  };

  return (
    <div className="w-full max-w-6xl mx-auto">
      {/* Page Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-display text-[var(--text-primary)] mb-2">Staff Management</h1>
          <p className="text-body text-[var(--text-secondary)]">
            Create and manage staff accounts. Only admins can access this page.
          </p>
        </div>
        <Link
          href="/users/new"
          className="btn btn-primary flex items-center gap-2"
        >
          <Plus size={18} />
          Create Staff
        </Link>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="card bg-[var(--destructive-bg)] border-[var(--destructive-border)] text-[var(--destructive)] p-4 mb-6">
          <p className="text-body">⚠️ {error}</p>
        </div>
      )}

      {/* Search Bar */}
      <div className="card mb-6">
        <div className="flex items-center gap-3 bg-[var(--surface-raised)] border border-[var(--border)] rounded px-4 py-2">
          <Search size={18} className="text-[var(--text-secondary)]" />
          <input
            type="text"
            placeholder="Search by name…"
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            className="flex-1 bg-transparent outline-none text-[var(--text-primary)] placeholder-[var(--text-muted)]"
          />
        </div>
      </div>

      {/* Users Table */}
      <div className="card overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--accent)]"></div>
            <p className="mt-4 text-[var(--text-secondary)]">Loading staff members…</p>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-[var(--text-secondary)]">
              {users.length === 0 ? 'No staff members yet.' : 'No results match your search.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              {/* Table Header */}
              <thead className="bg-[var(--surface-raised)] border-b border-[var(--border)]">
                <tr>
                  <th className="text-left text-subheading uppercase text-[var(--text-secondary)] font-semibold px-6 py-3">
                    Name
                  </th>
                  <th className="text-left text-subheading uppercase text-[var(--text-secondary)] font-semibold px-6 py-3">
                    Role
                  </th>
                  <th className="text-left text-subheading uppercase text-[var(--text-secondary)] font-semibold px-6 py-3">
                    Created
                  </th>
                  <th className="text-right text-subheading uppercase text-[var(--text-secondary)] font-semibold px-6 py-3">
                    Actions
                  </th>
                </tr>
              </thead>

              {/* Table Body */}
              <tbody>
                {filteredUsers.map((user) => (
                  <tr
                    key={user.id}
                    className="border-b border-[var(--border)] hover:bg-[var(--surface-raised)] transition-colors"
                  >
                    <td className="text-body text-[var(--text-primary)] px-6 py-4">
                      {user.full_name}
                    </td>
                    <td className="text-body px-6 py-4">
                      <span className={`badge ${getStatusBadgeClass(user.role, 'role')}`}>
                        {formatRole(user.role)}
                      </span>
                    </td>
                    <td className="text-small text-[var(--text-secondary)] px-6 py-4">
                      {formatDate(user.created_at, 'short')}
                    </td>
                    <td className="text-body px-6 py-4 flex justify-end gap-2">
                      <Link
                        href={`/users/${user.id}`}
                        className="btn btn-ghost inline-flex items-center gap-1 px-3 py-2"
                      >
                        <Edit2 size={16} />
                        Edit
                      </Link>
                      <button
                        onClick={() => handleDelete(user.id, user.full_name)}
                        className="btn btn-danger inline-flex items-center gap-1 px-3 py-2"
                      >
                        <Trash2 size={16} />
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Footer Info */}
      <div className="mt-6 text-small text-[var(--text-muted)]">
        Showing <span className="font-semibold">{filteredUsers.length}</span> of{' '}
        <span className="font-semibold">{users.length}</span> staff members
      </div>
    </div>
  );
}
