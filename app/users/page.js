/**
 * /app/users/page.js
 * 
 * User list page (admin view)
 * Displays all staff profiles with:
 * - Table with columns: Name, Email (TBD), Role, Created Date, Actions
 * - Search bar for real-time filtering
 * - Create button linking to /users/new
 * - Edit/Archive actions per row
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

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { listUsers } from '@/lib/api/users';
import { archiveUser, restoreUser } from '@/lib/actions/users';
import { formatRole, getStatusBadgeClass, formatDate } from '@/lib/utils/formatters';
import { Edit2, Archive, RefreshCw, Plus, Search, Filter } from 'lucide-react';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import CustomSelect from '@/components/ui/CustomSelect';

export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [confirmDialog, setConfirmDialog] = useState({ isOpen: false, title: '', message: '', onConfirm: () => {}, confirmStyle: 'btn-danger', confirmText: 'Confirm' });
  const router = useRouter();

  const closeConfirm = () => setConfirmDialog(prev => ({ ...prev, isOpen: false }));

  // Fetch all users on mount
  useEffect(() => {
    const fetchUsers = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const { users: data } = await listUsers();
        setUsers(data);
      } catch (err) {
        setError(err.message);
        console.error('Failed to fetch users:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchUsers();
  }, []);

  const handleSearch = (query) => {
    setSearchQuery(query);
  };

  // Handle archive with custom confirmation
  const handleArchive = (userId, userName) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Archive Staff',
      message: `Archive staff member "${userName}"? This can be restored later.`,
      confirmText: 'Archive',
      confirmStyle: 'btn-warning',
      onConfirm: async () => {
        closeConfirm();
        try {
          await archiveUser(userId);
          setUsers(users.map((u) => u.id === userId ? { ...u, is_archived: true } : u));
        } catch (err) {
          setError(err.message);
          console.error('Failed to archive user:', err);
        }
      }
    });
  };

  const handleRestore = async (userId) => {
    try {
      await restoreUser(userId);
      setUsers(users.map((u) => u.id === userId ? { ...u, is_archived: false } : u));
    } catch (err) {
      setError(err.message);
      console.error('Failed to restore user:', err);
    }
  };

  // Derive lists
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const matchesSearch = u.full_name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesRole = roleFilter === 'all' || u.role === roleFilter;
      return matchesSearch && matchesRole;
    });
  }, [users, searchQuery, roleFilter]);

  const normalUsers = filteredUsers.filter((u) => !u.is_archived);
  const archivedUsers = filteredUsers.filter((u) => u.is_archived);

  const staffCount = normalUsers.filter(u => u.role === 'staff').length;
  const adminCount = normalUsers.filter(u => u.role === 'admin').length;

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
      <div className="card mb-6 flex flex-col sm:flex-row gap-4">
        <div className="flex-1 flex items-center gap-3 bg-[var(--surface-raised)] border border-[var(--border)] rounded px-4 py-2">
          <Search size={18} className="text-[var(--text-secondary)]" />
          <input
            type="text"
            placeholder="Search by name…"
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            className="flex-1 bg-transparent outline-none text-[var(--text-primary)] placeholder-[var(--text-muted)]"
          />
        </div>
        <div className="flex-1 max-w-xs">
          <CustomSelect
            value={roleFilter}
            onChange={setRoleFilter}
            icon={Filter}
            options={[
              { value: 'all', label: 'All Roles' },
              { value: 'admin', label: 'Admin' },
              { value: 'staff', label: 'Staff' }
            ]}
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
        ) : normalUsers.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-[var(--text-secondary)]">
              {users.filter(u => !u.is_archived).length === 0 ? 'No staff members yet.' : 'No results match your search.'}
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
                    Phone
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
                {normalUsers.map((user) => (
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
                      {user.phone || '—'}
                    </td>
                    <td className="text-body px-6 py-4">
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
                        onClick={() => handleArchive(user.id, user.full_name)}
                        className="btn btn-warning inline-flex items-center gap-1 px-3 py-2"
                      >
                        <Archive size={16} />
                        Archive
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
        Showing <span className="font-semibold">{staffCount}</span> staff and{' '}
        <span className="font-semibold">{adminCount}</span> admin{adminCount !== 1 ? 's' : ''}
      </div>

      {/* Archived staff section */}
      <div className="mt-8">
        <h2 className="text-subheading mb-3">Archived Staff</h2>
        <ArchivedList archived={archivedUsers} onRestore={handleRestore} />
      </div>

      <ConfirmDialog 
        {...confirmDialog} 
        onCancel={closeConfirm} 
      />
    </div>
  );
}

function ArchivedList({ archived, onRestore }) {
  if (archived.length === 0) return <p className="text-[var(--text-secondary)]">No archived staff.</p>;

  return (
    <div className="card p-4">
      <ul>
        {archived.map((u) => (
          <li key={u.id} className="flex items-center justify-between py-2">
            <div>
              <div className="font-semibold">{u.full_name}</div>
              <div className="text-small text-[var(--text-secondary)]">{u.phone || '—'}</div>
            </div>
            <div>
              <button onClick={() => onRestore(u.id)} className="btn btn-ghost inline-flex items-center gap-2">
                <RefreshCw size={14} />
                Restore
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
