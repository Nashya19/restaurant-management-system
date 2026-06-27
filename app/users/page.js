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
import { Edit2, Archive, RefreshCw, Plus, Search, Filter, Loader2 } from 'lucide-react';
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
    <div className="w-full max-w-7xl mx-auto space-y-8 animate-fade-in">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between pb-4 border-b border-border">
        <div>
          <h1 className="text-display text-2xl font-bold tracking-tight text-[var(--text-primary)]">Staff Management</h1>
          <p className="text-sm text-[var(--text-secondary)] mt-1">
            Create, update, and organize staff accounts. Accessible by administrators only.
          </p>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="flex items-start gap-2 bg-destructive-bg border border-destructive-border text-destructive text-sm p-4 rounded-xl animate-fade-in">
          <span className="shrink-0 mt-0.5">⚠️</span>
          <span>{error}</span>
        </div>
      )}

      {/* Search & Filter Bar */}
      <div className="card bg-surface border border-border p-6 rounded-2xl shadow-lg flex flex-col sm:flex-row gap-4">
        <div className="flex-1 flex items-center gap-2.5 bg-background border border-border rounded-xl px-3.5 h-10 transition-colors focus-within:border-[var(--accent)]">
          <Search size={16} className="text-[var(--text-secondary)]" />
          <input
            type="text"
            placeholder="Search by name…"
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            className="flex-1 bg-transparent border-none p-0 outline-none text-[var(--text-primary)] placeholder-[var(--text-muted)] text-sm h-full"
          />
        </div>
        <div className="flex-1 sm:max-w-xs">
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

      {/* Users Table Card */}
      <div className="card bg-surface border border-border overflow-hidden rounded-2xl shadow-lg">
        {isLoading ? (
          <div className="p-16 text-center">
            <Loader2 size={36} className="animate-spin text-[var(--accent)] inline-block" />
            <p className="mt-4 text-sm text-[var(--text-secondary)] font-medium">Loading staff members…</p>
          </div>
        ) : normalUsers.length === 0 ? (
          <div className="p-16 text-center">
            <p className="text-sm text-[var(--text-secondary)] font-medium">
              {users.filter(u => !u.is_archived).length === 0 ? 'No staff members configured.' : 'No results match your search parameters.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              {/* Table Header */}
              <thead className="bg-background border-b border-border">
                <tr>
                  <th className="text-left text-xs uppercase text-[var(--text-secondary)] font-bold px-6 py-4 tracking-wider">
                    Name
                  </th>
                  <th className="text-left text-xs uppercase text-[var(--text-secondary)] font-bold px-6 py-4 tracking-wider">
                    Role
                  </th>
                  <th className="text-left text-xs uppercase text-[var(--text-secondary)] font-bold px-6 py-4 tracking-wider">
                    Phone
                  </th>
                  <th className="text-left text-xs uppercase text-[var(--text-secondary)] font-bold px-6 py-4 tracking-wider">
                    Created
                  </th>
                  <th className="text-right text-xs uppercase text-[var(--text-secondary)] font-bold px-6 py-4 tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>

              {/* Table Body */}
              <tbody className="divide-y divide-border">
                {normalUsers.map((user) => (
                  <tr
                    key={user.id}
                    className="hover:bg-background/40 transition-colors"
                  >
                    <td className="px-6 py-4 text-sm font-semibold text-[var(--text-primary)]">
                      {user.full_name}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase ${user.role === 'admin' ? 'bg-warning-bg text-warning' : 'bg-surface-raised text-text-secondary'}`}>
                        {formatRole(user.role)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm font-mono font-medium text-[var(--text-secondary)]">
                      {user.phone || '—'}
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-[var(--text-secondary)]">
                      {formatDate(user.created_at, 'short')}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="inline-flex items-center gap-2">
                        <Link
                          href={`/users/${user.id}`}
                          className="btn bg-background border-border hover:bg-surface text-xs px-3 py-1.5 h-8 rounded-lg font-bold inline-flex items-center gap-1.5 cursor-pointer"
                        >
                          <Edit2 size={13} />
                          <span>Edit</span>
                        </Link>
                        <button
                          onClick={() => handleArchive(user.id, user.full_name)}
                          className="btn border border-destructive-border bg-destructive-bg text-destructive hover:bg-red-900 text-xs px-3 py-1.5 h-8 rounded-lg font-bold inline-flex items-center gap-1.5 cursor-pointer"
                        >
                          <Archive size={13} />
                          <span>Archive</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Footer Info */}
      <div className="flex justify-between items-center text-xs text-[var(--text-muted)] font-semibold px-2">
        <span>Showing {staffCount} staff and {adminCount} admin{adminCount !== 1 ? 's' : ''}</span>
      </div>

      {/* Archived staff section */}
      <div className="space-y-4 pt-4 border-t border-border">
        <h2 className="text-md font-bold text-[var(--text-primary)] uppercase tracking-wider">Archived Staff</h2>
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
  if (archived.length === 0) {
    return (
      <p className="text-xs text-[var(--text-secondary)] font-medium py-3 px-4 border border-dashed border-border rounded-xl bg-background/20">
        No archived staff members.
      </p>
    );
  }

  return (
    <div className="card bg-surface border border-border p-4 rounded-2xl shadow-lg">
      <ul className="divide-y divide-border">
        {archived.map((u) => (
          <li key={u.id} className="flex items-center justify-between py-3">
            <div>
              <div className="text-sm font-semibold text-[var(--text-primary)]">{u.full_name}</div>
              <div className="text-xs font-mono font-medium text-[var(--text-secondary)] mt-0.5">{u.phone || '—'}</div>
            </div>
            <div>
              <button 
                onClick={() => onRestore(u.id)} 
                className="btn bg-background border-border hover:bg-surface text-xs px-3 py-1.5 h-8 rounded-lg font-bold inline-flex items-center gap-1.5 cursor-pointer text-green-500 hover:text-green-400"
              >
                <RefreshCw size={12} className="animate-spin-hover" />
                <span>Restore</span>
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
