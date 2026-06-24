'use client';

  import { useEffect, useState, useCallback, useRef } from 'react';
  import {
    getTableStatus,
    startTableSession,
    lockTableSession,
    completeTableSession,
    clearTableSession,
    cancelTableSession,
    getSessionDetails,
  } from '@/lib/api/table-sessions';
  import { formatDate } from '@/lib/utils/formatters';
  import { temporarilyUnlockSessionAction } from '@/lib/actions/orders';
  import { Plus, Lock, Check, Trash2, AlertCircle, X, Eye, Loader2, Clock, Users, DollarSign, Zap, RefreshCw } from 'lucide-react';
  import { createClient } from '@/lib/supabase/client';
  import CustomSelect from '@/components/ui/CustomSelect';
  import Link from 'next/link';

const STATUS_COLORS = {
  inactive: 'bg-gray-700 text-gray-200',
  open: 'bg-green-700 text-green-100',
  locked: 'bg-orange-700 text-orange-100',
  completed: 'bg-blue-700 text-blue-100',
  cleared: 'bg-gray-600 text-gray-200',
  cancelled: 'bg-red-700 text-red-100',
  deactivated: 'bg-red-800 text-red-100',
};

const STATUS_LABELS = {
  inactive: 'Inactive',
  open: 'Open',
  locked: 'Locked',
  completed: 'Completed',
  cleared: 'Available',
  cancelled: 'Cancelled',
   deactivated: 'Deactivated'
};

export default function TablesPage() {
  const supabaseRef = useRef(null);
  if (!supabaseRef.current) {
    supabaseRef.current = createClient();
  }
  const supabase = supabaseRef.current;
  
const [tables, setTables] = useState([]);
const [isLoading, setIsLoading] = useState(true);
const [pageError, setPageError] = useState(null);
const [operatingTableId, setOperatingTableId] = useState(null);
const [selectedSession, setSelectedSession] = useState(null);
const [showSessionModal, setShowSessionModal] = useState(false);
const [confirmAction, setConfirmAction] = useState(null);
const [sessionRunningTotal, setSessionRunningTotal] = useState(0);
const [unlockCountdown, setUnlockCountdown] = useState(0);
const [isUnlocking, setIsUnlocking] = useState(false);

// Select session from query parameter on mount/URL change
useEffect(() => {
  if (typeof window !== 'undefined') {
    const handleQueryParam = () => {
      const params = new URLSearchParams(window.location.search);
      const sessionParam = params.get('session');
      if (sessionParam) {
        handleViewSession(sessionParam);
      }
    };
    if (tables.length > 0) {
      handleQueryParam();
    }
    window.addEventListener('popstate', handleQueryParam);
    return () => window.removeEventListener('popstate', handleQueryParam);
  }
}, [tables]);

const [showAddTableModal, setShowAddTableModal] = useState(false);

const [showManageTableModal, setShowManageTableModal] = useState(false);
const [selectedTableId, setSelectedTableId] = useState('');
const [tableNumber, setTableNumber] = useState('');
const [capacity, setCapacity] = useState('');

const [manageTableNumber, setManageTableNumber] = useState('');
const [manageCapacity, setManageCapacity] = useState('');
const [selectedTable, setSelectedTable] = useState(null);

const [editingTable, setEditingTable] = useState(null);
  // Fetch table status
 const fetchTables = useCallback(async (showLoading = false) => {
  if (showLoading) {
    setIsLoading(true);
  }
  setPageError(null);

  try {
    const data = await getTableStatus();

    console.log('ALL TABLES:', data);

    setTables(data);
  } catch (err) {
    setPageError(err.message || 'Unable to load tables.');
    console.error('Failed to load tables:', err);
  } finally {
    if (showLoading) {
      setIsLoading(false);
    }
  }
}, []);

  // Setup realtime subscriptions
  useEffect(() => {
    fetchTables(true);

    // Subscribe to table_sessions changes
    const sessionSubscription = supabase
      .channel('table_sessions_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'table_sessions' },
        async (payload) => {
          fetchTables(false);
        }
      )
      .subscribe();

    // Subscribe to tables changes
    const tablesSubscription = supabase
      .channel('tables_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tables' },
        () => {
          fetchTables(false);
        }
      )
      .subscribe();

    // Background polling fallback (every 15 seconds)
    const intervalId = setInterval(() => {
      fetchTables(false);
    }, 15000);

    return () => {
      sessionSubscription.unsubscribe();
      tablesSubscription.unsubscribe();
      clearInterval(intervalId);
    };
  }, [fetchTables]);
  
  //handle edit section
  const handleEditTable = (table) => {
  setEditingTable(table);
  setTableNumber(table.table_number.toString());
  setCapacity(table.capacity.toString());
  setShowAddTableModal(true);
};
//activation and deactivation of table
const handleToggleTableStatus = async (table) => {
  const action = table.is_active ? 'deactivate' : 'activate';

  const confirmed = window.confirm(
    `Are you sure you want to ${action} Table ${table.table_number}?`
  );

  if (!confirmed) return;

  try {
    const { error } = await supabase
      .from('tables')
      .update({
        is_active: !table.is_active,
      })
      .eq('id', table.id);

    if (error) throw error;

    setSelectedTable((prev) =>
  prev
    ? {
        ...prev,
        is_active: !prev.is_active,
      }
    : prev
);

    

fetchTables();
  } catch (err) {
    console.error(err);
    alert(err.message);
  }
};
  // Handle start session
  const handleStartSession = async (tableId) => {
  console.log('Start Session clicked', tableId);

  setOperatingTableId(tableId);

  try {
    const result = await startTableSession(tableId);

    console.log('New Session:', result);

    await fetchTables();
  } catch (err) {
    console.error('START SESSION ERROR:', err);

    setPageError(err.message || 'Failed to start session.');
  } finally {
    setOperatingTableId(null);
  }
};

  // Handle lock session
  const handleLockSession = async (sessionId) => {
    setOperatingTableId(sessionId);
    try {
      await lockTableSession(sessionId);
      await fetchTables();
    } catch (err) {
      setPageError(err.message || 'Failed to lock session.');
    } finally {
      setOperatingTableId(null);
    }
  };

  // Handle complete session
  const handleCompleteSession = async (sessionId) => {
    setOperatingTableId(sessionId);
    setConfirmAction(null);
    try {
      await completeTableSession(sessionId);
      await fetchTables();
    } catch (err) {
      setPageError(err.message || 'Failed to complete session.');
    } finally {
      setOperatingTableId(null);
    }
  };
  

  // Handle clear table
  const handleClearTable = async (sessionId) => {
    setOperatingTableId(sessionId);
    setConfirmAction(null);
    try {
      await clearTableSession(sessionId);
      await fetchTables();
      setShowSessionModal(false);
    } catch (err) {
      setPageError(err.message || 'Failed to clear table.');
    } finally {
      setOperatingTableId(null);
    }
  };

  // Handle cancel session (emergency)
  const handleCancelSession = async (sessionId) => {
    setOperatingTableId(sessionId);
    setConfirmAction(null);
    try {
      await cancelTableSession(sessionId);
      await fetchTables();
      setShowSessionModal(false);
    } catch (err) {
        console.error('Cancel Session Error:', err);

      setPageError(err.message || 'Failed to cancel session.');
    } finally {
      setOperatingTableId(null);
    }
  };

  // View session details
  const handleViewSession = async (sessionId) => {
    try {
      const details = await getSessionDetails(sessionId);
      setSelectedSession(details);
      setSessionRunningTotal(details.running_total || 0);
      setShowSessionModal(true);
    } catch (err) {
      setPageError(err.message || 'Failed to load session details.');
    }
  };

  useEffect(() => {
    if (selectedSession?.unlock_until) {
      const calculateRemaining = () => {
        const diff = Math.ceil((new Date(selectedSession.unlock_until).getTime() - Date.now()) / 1000);
        return diff > 0 ? diff : 0;
      };
      
      setUnlockCountdown(calculateRemaining());
      
      const interval = setInterval(() => {
        const remaining = calculateRemaining();
        setUnlockCountdown(remaining);
        if (remaining <= 0) {
          clearInterval(interval);
        }
      }, 1000);
      
      return () => clearInterval(interval);
    } else {
      setUnlockCountdown(0);
    }
  }, [selectedSession]);

  const handleTemporarilyUnlock = async (sessionId) => {
    setIsUnlocking(true);
    try {
      const res = await temporarilyUnlockSessionAction(sessionId);
      if (res?.success) {
        setSelectedSession(prev => ({
          ...prev,
          unlock_until: res.data.unlock_until
        }));
        await fetchTables();
      }
    } catch (err) {
      alert(err.message || 'Failed to unlock session');
    } finally {
      setIsUnlocking(false);
    }
  };
  const handleAddTable = async () => {
  try {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
    if (editingTable) {
      const { error } = await supabase
        .from('tables')
        .update({
          table_number: Number(tableNumber),
          capacity: Number(capacity),
          qr_code_url: `${origin}/table/${tableNumber}`,
        })
        .eq('id', editingTable.id);

      if (error) throw error;
    } 
    else {
  const { data: newTable, error } = await supabase
    .from('tables')
    .insert([
      {
        table_number: Number(tableNumber),
        capacity: Number(capacity),
        qr_code_url: `${origin}/table/${tableNumber}`,
      },
    ])
    .select()
    .single();

  if (error) throw error;

  const pin = Math.floor(
    1000 + Math.random() * 9000
  ).toString();

  const { error: sessionError } =
    await supabase
      .from('table_sessions')
      .insert([
        {
          table_id: newTable.id,
          pin,
          status: 'open',
          opened_at:
            new Date().toISOString(),
        },
      ]);

  if (sessionError) throw sessionError;
}

    setShowAddTableModal(false);
    setTableNumber('');
    setCapacity('');
    setEditingTable(null);

    fetchTables();
  } catch (err) {
    console.error(err);
    alert(err.message);
  }
};
 const handleSaveTableChanges = async () => {
  const confirmed = window.confirm(
    'Are you sure you want to save these changes?'
  );

  if (!confirmed) return;

  try {
    const { error } = await supabase
      .from('tables')
      .update({
        table_number: Number(manageTableNumber),
        capacity: Number(manageCapacity),
      })
      .eq('id', selectedTableId);

    if (error) throw error;

    alert('Table updated successfully');
    setSelectedTable({
  ...selectedTable,
  table_number: Number(manageTableNumber),
  capacity: Number(manageCapacity),
});


    setShowManageTableModal(false);

    fetchTables();
  } catch (err) {
    console.error(err);
    alert(err.message);
  }
};
const [devRole, setDevRole] = useState('admin');

useEffect(() => {
  if (typeof window !== 'undefined') {
    setDevRole(localStorage.getItem('dev-role') || 'admin');
  }
}, []);

  return (
    <div className="w-full max-w-7xl mx-auto space-y-8 animate-fade-in">
      {/* Header Controls */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between pb-4 border-b border-[#27272a] mb-8">
        {/* Left: Sub-navigation Tabs */}
        <div className="flex items-center gap-3">
          <Link
            href="/tables"
            className="px-4 py-2 rounded-xl text-sm font-semibold border transition-all duration-200 border-[var(--accent)] bg-[var(--surface-raised)] text-[var(--accent)]"
          >
            Live Status
          </Link>
          {devRole !== 'staff' && (
            <Link
              href="/tables/history"
              className="px-4 py-2 rounded-xl text-sm font-semibold border transition-all duration-200 border-[#27272a] bg-[#09090b] text-[var(--text-secondary)] hover:border-[#3f3f46] hover:text-[var(--text-primary)]"
            >
              Session History
            </Link>
          )}
        </div>

        {/* Right: Actions */}
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={fetchTables}
            className="btn btn-ghost bg-[#09090b] border-[#27272a] hover:bg-[#18181b] hover:text-[var(--accent)] flex items-center justify-center gap-2 rounded-xl font-bold cursor-pointer text-xs h-10 animate-fade-in"
          >
            <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
          {devRole === 'admin' && (
            <>
              <button
                type="button"
                onClick={() => {
                  setEditingTable(null);
                  setTableNumber('');
                  setCapacity('');
                  setShowAddTableModal(true);
                }}
                className="btn btn-primary btn-premium flex items-center justify-center gap-2 rounded-xl font-bold shadow-md shadow-[var(--accent)]/5 cursor-pointer text-xs h-10"
              >
                <Plus size={18} />
                Add New Table
              </button>
              <button
                type="button"
                onClick={() => {
                  setSelectedTableId('');
                  setSelectedTable(null);
                  setManageTableNumber('');
                  setManageCapacity('');
                  setShowManageTableModal(true);
                }}
                className="btn btn-ghost flex items-center justify-center gap-2 rounded-xl bg-[#18181b] border-[#27272a] hover:border-[#3f3f46] hover:bg-[#27272a] text-[var(--text-primary)] font-bold cursor-pointer text-xs h-10"
              >
                Manage Tables
              </button>
            </>
          )}
        </div>
      </div>

      {/* Error Alert */}
      {pageError && (
        <div className="flex items-start gap-2 bg-[#2a1010] border border-[#5a2020] text-[#c45a5a] text-sm p-4 rounded-xl animate-fade-in mb-6">
          <span className="shrink-0 mt-0.5">⚠️</span>
          <span>{pageError}</span>
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={36} className="animate-spin text-[var(--accent)]" />
        </div>
      )}

      {/* Table Status Grid */}
      {!isLoading && tables.length > 0 && (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {tables.map((table) => (
            <div
              key={table.id}
              className={`card bg-[#18181b] border border-[#27272a] p-6 rounded-2xl transition-all duration-300 relative overflow-hidden group shadow-lg ${
                table.is_active
                  ? 'hover:border-[var(--accent)] cursor-pointer hover:-translate-y-1 hover:shadow-xl hover:shadow-[var(--accent)]/5'
                  : 'opacity-50 cursor-not-allowed'
              }`}
              onClick={() => {
                if (!table.is_active) return;
                if (table.session_id) {
                  handleViewSession(table.session_id);
                }
              }}
            >
              {/* Decorative Glow for Active Sessions */}
              {table.current_status !== 'inactive' && table.session_id && (
                <div className="absolute top-0 right-0 w-24 h-24 bg-[var(--accent)] opacity-5 rounded-full blur-2xl pointer-events-none" />
              )}

              {/* Table Number & Status */}
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-lg font-bold text-[var(--text-primary)] group-hover:text-[var(--accent)] transition-colors">Table {table.table_number}</h3>
                  <p className="text-xs text-[var(--text-secondary)] font-medium mt-0.5">Capacity: {table.capacity} pax</p>
                </div>
                {(() => {
                  const isOccupied = table.current_status === 'open' && table.connected_devices_count > 0;
                  const statusLabel = isOccupied ? 'Occupied' : STATUS_LABELS[table.current_status];
                  const statusColor = isOccupied ? 'bg-teal-700 text-teal-100' : STATUS_COLORS[table.current_status];
                  return (
                    <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold tracking-wider uppercase ${statusColor}`}>
                      {statusLabel}
                    </span>
                  );
                })()}
              </div>

              {/* Session Info (if active) */}
              {table.current_status !== 'inactive' && table.session_id && (
                <div className="space-y-2 mb-4 text-small text-[var(--text-secondary)]">
                  <div className="flex items-center gap-2">
                    <Zap size={14} /> PIN: <span className="font-sans font-bold text-[var(--accent)]">{table.current_pin}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span>🆔 ID:</span>
                    <span className="font-mono text-xs text-[var(--text-primary)] truncate max-w-[110px]" title={table.session_id}>
                      {table.session_id.substring(0, 8)}...
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigator.clipboard.writeText(table.session_id);
                        alert('Session ID copied to clipboard!');
                      }}
                      className="text-[10px] hover:text-[var(--accent)] cursor-pointer select-none bg-[#27272a]/60 px-1 py-0.5 rounded border border-[#3f3f46] hover:bg-[#3f3f46]/60 transition-all"
                      title="Copy Full Session ID"
                    >
                      Copy
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
  🔗
  <a
    href={table.qr_code_url}
    target="_blank"
    rel="noopener noreferrer"
    className="text-[var(--accent)] underline"
  >
    QR Link
  </a>
</div>
                  <div className="flex items-center gap-2">
                    <Users size={14} /> {table.connected_devices_count} device{table.connected_devices_count !== 1 ? 's' : ''}
                  </div>
                  <div className="flex items-center gap-2">
  📦 {table.orders_count} order{table.orders_count !== 1 ? 's' : ''}
</div>
                  <div className="flex items-center gap-2">
                    <DollarSign size={14} /> Running total: ${table.running_total?.toFixed(2) || '0.00'}
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock size={14} /> Started: {table.session_started_at ? new Date(table.session_started_at).toLocaleTimeString() : 'N/A'}
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex flex-col gap-2">
                {table.current_status === 'inactive' && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleStartSession(table.id);
                    }}
                    disabled={operatingTableId === table.id}
                    className="btn btn-primary text-small w-full flex items-center justify-center gap-2"
                  >
                    {operatingTableId === table.id ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />}
                    {operatingTableId === table.id ? 'Starting...' : 'Start Session'}
                  </button>
                )}

                {(table.current_status === 'open' || table.current_status === 'locked') && (
                  <>
                    {table.current_status === 'locked' && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setConfirmAction({ action: 'complete', sessionId: table.session_id });
                        }}
                        className="btn btn-primary text-small w-full flex items-center justify-center gap-2"
                      >
                        <Check size={14} />
                        End Ordering & Bill
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleViewSession(table.session_id);
                      }}
                      className="btn btn-ghost text-small w-full flex items-center justify-center gap-2"
                    >
                      <Eye size={14} />
                      View Details
                    </button>
                  </>
                )}

                {table.current_status === 'completed' && (
                  <>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setConfirmAction({ action: 'clear', sessionId: table.session_id });
                      }}
                      className="btn btn-primary text-small w-full flex items-center justify-center gap-2"
                    >
                      <Check size={14} />
                      Confirm Payment & Clear
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleViewSession(table.session_id);
                      }}
                      className="btn btn-ghost text-small w-full flex items-center justify-center gap-2"
                    >
                      <Eye size={14} />
                      View Details
                    </button>
                  </>
                )}
                {table.current_status === 'cleared' && (
  <>
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        handleStartSession(table.id);
      }}
      className="btn btn-primary text-small w-full"
    >
      Start Session
    </button>
  </>
)}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty State */}
      {!isLoading && tables.length === 0 && (
        <div className="card p-8 text-center">
          <p className="text-body text-[var(--text-secondary)]">No tables configured yet.</p>
        </div>
      )}

      {/* Session Details Modal */}
      {showSessionModal && selectedSession && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="card w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-display">
                Table {selectedSession.tables.table_number} - Session Details
              </h2>
              <button
                type="button"
                onClick={() => setShowSessionModal(false)}
                className="text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              >
                <X size={24} />
              </button>
            </div>

            {/* Session Info */}
            <div className="grid gap-4 sm:grid-cols-2 mb-6">
              <div className="bg-[#09090b] border border-[#27272a] p-4 rounded-xl">
                <p className="text-xs text-[var(--text-secondary)] mb-1 font-semibold uppercase">PIN</p>
                <p className="font-mono font-bold text-lg text-[var(--accent)]">{selectedSession.pin}</p>
              </div>
              <div className="bg-[#09090b] border border-[#27272a] p-4 rounded-xl">
                <p className="text-xs text-[var(--text-secondary)] mb-1 font-semibold uppercase">Status</p>
                {(() => {
                  const isOccupied = selectedSession.status === 'open' && selectedSession.connected_devices_count > 0;
                  const statusLabel = isOccupied ? 'Occupied' : STATUS_LABELS[selectedSession.status];
                  const statusColor = isOccupied ? 'bg-teal-700 text-teal-100' : STATUS_COLORS[selectedSession.status];
                  return (
                    <span className={`inline-block px-2.5 py-1 rounded text-xs font-bold uppercase ${statusColor}`}>
                      {statusLabel}
                    </span>
                  );
                })()}
              </div>
              <div className="bg-[#09090b] border border-[#27272a] p-4 rounded-xl">
                <p className="text-xs text-[var(--text-secondary)] mb-1 font-semibold uppercase">Started At</p>
                <p className="text-sm font-semibold">{formatDate(selectedSession.started_at)}</p>
              </div>
              <div className="bg-[#09090b] border border-[#27272a] p-4 rounded-xl">
                <p className="text-xs text-[var(--text-secondary)] mb-1 font-semibold uppercase">Connected Devices</p>
                <p className="text-sm font-bold">{selectedSession.connected_devices_count}</p>
              </div>
            </div>

            {/* Orders */}
            <div className="mb-6">
              <h3 className="text-heading mb-3">Orders ({selectedSession.orders_count})</h3>
              {selectedSession.orders && selectedSession.orders.length > 0 ? (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {selectedSession.orders.map((order) => (
                    <div key={order.id} className="flex justify-between items-center bg-[var(--surface)] p-3 rounded">
                      <div>
                        <p className="text-body">{order.item_name}</p>
                        <p className="text-small text-[var(--text-secondary)]">Qty: {order.quantity}</p>
                      </div>
                      <p className="font-bold text-[var(--accent)]">${order.total_price?.toFixed(2) || '0.00'}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-small text-[var(--text-secondary)]">No orders yet.</p>
              )}
            </div>

            {/* Running Total */}
            <div className="bg-[var(--accent)] text-[var(--background)] p-4 rounded mb-6">
              <p className="text-small mb-1">Running Total</p>
              <p className="text-display font-bold">${sessionRunningTotal.toFixed(2)}</p>
            </div>

            {/* Connected Devices */}
            <div className="mb-6">
              <h3 className="text-heading mb-3">Connected Devices</h3>
              {selectedSession.session_devices && selectedSession.session_devices.length > 0 ? (
                <div className="space-y-2">
                  {selectedSession.session_devices.map((device) => (
                    <div key={device.id} className="bg-[var(--surface)] p-3 rounded text-small">
                      <p className="text-[var(--text-secondary)]">{device.device_fingerprint}</p>
                      <p className="text-xs text-[var(--text-secondary)]">
  Joined: {formatDate(device.joined_at)}
</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-small text-[var(--text-secondary)]">No devices connected.</p>
              )}
            </div>

            {/* Action Buttons */}


            {(selectedSession.status === 'open' || selectedSession.status === 'locked') && (
              <div className="flex flex-col gap-3">
                {selectedSession.status === 'locked' && (
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setConfirmAction({ action: 'complete', sessionId: selectedSession.id });
                        setShowSessionModal(false);
                      }}
                      className="flex-1 btn btn-primary"
                    >
                      <Check size={16} /> End Ordering & Bill
                    </button>
                  </div>
                )}
                
                <div className="flex gap-3">
                  {unlockCountdown > 0 ? (
                    <div className="w-full flex flex-col sm:flex-row items-center gap-2 py-2 px-4 rounded-xl bg-green-950/40 border border-green-800 text-green-300 font-semibold text-xs justify-between">
                      <div className="flex items-center gap-2">
                        <Clock size={14} className="animate-pulse" />
                        <span>Unlock active ({unlockCountdown}s remaining)</span>
                      </div>
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            await lockTableSession(selectedSession.id);
                            setSelectedSession(prev => ({ ...prev, unlock_until: null }));
                            await fetchTables();
                          } catch (err) {
                            alert(err.message || 'Failed to lock session');
                          }
                        }}
                        className="btn btn-ghost hover:bg-red-950/40 text-[var(--destructive)] border border-red-950/60 rounded-lg text-[10px] font-bold px-2 py-1 h-7 cursor-pointer"
                      >
                        Lock Now
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleTemporarilyUnlock(selectedSession.id)}
                      disabled={isUnlocking}
                      className="w-full btn btn-ghost border-[#27272a] hover:bg-[#18181b] flex items-center justify-center gap-2 rounded-xl text-xs font-bold h-10"
                    >
                      {isUnlocking ? <Loader2 size={14} className="animate-spin" /> : <Clock size={14} />}
                      <span>Unlock Session (30s)</span>
                    </button>
                  )}
                </div>
              </div>
            )}

            {selectedSession.status === 'completed' && (
              <div className="flex flex-col gap-3">
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setConfirmAction({ action: 'clear', sessionId: selectedSession.id });
                      setShowSessionModal(false);
                    }}
                    className="flex-1 btn btn-primary"
                  >
                    <Check size={16} /> Confirm Payment & Clear Table
                  </button>
                </div>
              </div>
            )}

            {devRole !== 'staff' && (selectedSession.status === 'open' || selectedSession.status === 'completed' || selectedSession.status === 'locked') && (
              <div className="mt-3 flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setConfirmAction({ action: 'cancel', sessionId: selectedSession.id });
                    setShowSessionModal(false);
                  }}
                  className="flex-1 btn btn-ghost text-[var(--destructive)]"
                >
                  <AlertCircle size={16} /> Cancel Session (Admin)
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={() => setShowSessionModal(false)}
              className="mt-6 w-full btn btn-ghost"
            >
              Close
            </button>
          </div>
        </div>
      )}
      {/* Add New Table Modal */}
      {showAddTableModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="card bg-[#18181b] border border-[#27272a] w-full max-w-md p-8 rounded-2xl shadow-2xl relative">
            <div className="flex items-center justify-between mb-6 pb-2 border-b border-[#27272a]">
              <h3 className="text-lg font-bold text-[var(--text-primary)] uppercase tracking-wider">
                {editingTable ? 'Edit Table Settings' : 'Add New Table'}
              </h3>
              <button
                type="button"
                onClick={() => setShowAddTableModal(false)}
                className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] p-1 transition-colors cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs uppercase text-[var(--text-secondary)] font-bold tracking-wider">Table Number</label>
                <input
                  type="number"
                  placeholder="e.g., 5"
                  value={tableNumber}
                  onChange={(e) => setTableNumber(e.target.value)}
                  className="w-full bg-[#09090b] border-[#27272a] focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:outline-none rounded-xl h-10 px-3.5 text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none transition-all"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs uppercase text-[var(--text-secondary)] font-bold tracking-wider">Seating Capacity</label>
                <input
                  type="number"
                  placeholder="e.g., 4"
                  value={capacity}
                  onChange={(e) => setCapacity(e.target.value)}
                  className="w-full bg-[#09090b] border-[#27272a] focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:outline-none rounded-xl h-10 px-3.5 text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none transition-all"
                />
              </div>

              <div className="flex gap-3 pt-4 border-t border-[#27272a] mt-4">
                <button
                  type="button"
                  onClick={() => setShowAddTableModal(false)}
                  className="btn btn-ghost bg-[#09090b] border-[#27272a] hover:bg-[#18181b] flex-1 rounded-xl font-bold cursor-pointer text-xs h-10"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleAddTable}
                  className="btn btn-primary btn-premium flex-1 rounded-xl font-bold cursor-pointer text-xs h-10"
                >
                  {editingTable ? 'Save Changes' : 'Add Table'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Dialog */}
      {confirmAction && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="card bg-[#18181b] border border-[#27272a] w-full max-w-md p-8 rounded-2xl shadow-2xl text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-[#2a1f0a] border border-[#5a3a10] text-[var(--accent)] mb-4 animate-pulse">
              <AlertCircle size={24} />
            </div>
            <h3 className="text-lg font-bold text-[var(--text-primary)] mb-2">Confirm Action</h3>
            <p className="text-sm text-[var(--text-secondary)] mb-6 font-medium leading-relaxed">
              {confirmAction.action === 'complete' && 'Complete this session and generate billing statement?'}
              {confirmAction.action === 'clear' && 'Clear the physical table and archive this session details?'}
              {confirmAction.action === 'cancel' &&
                'Emergency cancel session? This terminates ordering and logs out connected devices. This action cannot be undone.'}
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setConfirmAction(null)}
                className="flex-1 btn btn-ghost bg-[#09090b] border-[#27272a] hover:bg-[#18181b] rounded-xl font-bold cursor-pointer text-xs h-10"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (confirmAction.action === 'complete') handleCompleteSession(confirmAction.sessionId);
                  if (confirmAction.action === 'clear') handleClearTable(confirmAction.sessionId);
                  if (confirmAction.action === 'cancel') handleCancelSession(confirmAction.sessionId);
                }}
                disabled={operatingTableId === confirmAction.sessionId}
                className="flex-1 btn btn-primary btn-premium rounded-xl font-bold cursor-pointer text-xs h-10"
              >
                {operatingTableId === confirmAction.sessionId ? <Loader2 size={14} className="animate-spin" /> : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manage Tables Modal */}
      {showManageTableModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="card bg-[#18181b] border border-[#27272a] w-full max-w-md p-8 rounded-2xl shadow-2xl relative">
            <div className="flex items-center justify-between mb-6 pb-2 border-b border-[#27272a]">
              <h2 className="text-lg font-bold text-[var(--text-primary)]">Manage Tables</h2>
              <button
                type="button"
                onClick={() => setShowManageTableModal(false)}
                className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] p-1 transition-colors cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs uppercase text-[var(--text-secondary)] font-bold tracking-wider">Select Table to Edit</label>
                {(() => {
                  const tableOptions = [
                    { value: '', label: '-- Choose a Table --' },
                    ...tables.map((t) => ({
                      value: t.id,
                      label: `Table ${t.table_number} (${t.is_active ? 'Active' : 'Deactivated'})`
                    }))
                  ];
                  return (
                    <CustomSelect
                      value={selectedTableId}
                      onChange={(id) => {
                        setSelectedTableId(id);
                        const table = tables.find((t) => t.id === id);
                        if (table) {
                          setSelectedTable(table);
                          setManageTableNumber(table.table_number.toString());
                          setManageCapacity(table.capacity.toString());
                        } else {
                          setSelectedTable(null);
                          setManageTableNumber('');
                          setManageCapacity('');
                        }
                      }}
                      options={tableOptions}
                    />
                  );
                })()}
              </div>

              {selectedTable && (
                <>
                  <div className="space-y-1.5">
                    <label className="text-xs uppercase text-[var(--text-secondary)] font-bold tracking-wider">Table Number</label>
                    <input
                      type="number"
                      value={manageTableNumber}
                      onChange={(e) => setManageTableNumber(e.target.value)}
                      placeholder="e.g., 10"
                      className="w-full bg-[#09090b] border-[#27272a] focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:outline-none rounded-xl h-10 px-3.5 text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none transition-all"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs uppercase text-[var(--text-secondary)] font-bold tracking-wider">Capacity</label>
                    <input
                      type="number"
                      value={manageCapacity}
                      onChange={(e) => setManageCapacity(e.target.value)}
                      placeholder="e.g., 6"
                      className="w-full bg-[#09090b] border-[#27272a] focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:outline-none rounded-xl h-10 px-3.5 text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none transition-all"
                    />
                  </div>
                </>
              )}

              <div className="flex flex-col gap-2.5 pt-4 border-t border-[#27272a] mt-4">
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowManageTableModal(false)}
                    className="btn btn-ghost bg-[#09090b] border-[#27272a] hover:bg-[#18181b] flex-1 rounded-xl font-bold cursor-pointer text-xs h-10"
                  >
                    Cancel
                  </button>

                  <button
                    onClick={handleSaveTableChanges}
                    disabled={!selectedTableId}
                    className="btn btn-primary btn-premium flex-1 rounded-xl font-bold cursor-pointer text-xs h-10"
                  >
                    Save Changes
                  </button>
                </div>

                {selectedTable && (
                  <button
                    onClick={() => handleToggleTableStatus(selectedTable)}
                    className={`btn text-xs font-bold rounded-xl flex items-center justify-center gap-2 cursor-pointer w-full h-10 transition-all ${
                      selectedTable.is_active
                        ? 'border border-red-950 bg-[#2a1010] text-[#c45a5a] hover:bg-red-900'
                        : 'border border-green-950 bg-[#0f2318] text-[#4a9b6a] hover:bg-green-900'
                    }`}
                  >
                    {selectedTable.is_active ? 'Deactivate Table' : 'Activate Table'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
