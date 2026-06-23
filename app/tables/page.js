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
  import { Plus, Lock, Check, Trash2, AlertCircle, X, Eye, Loader2, Clock, Users, DollarSign, Zap } from 'lucide-react';
  import { createClient } from '@/lib/supabase/client';

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
 const fetchTables = useCallback(async () => {
  setIsLoading(true);
  setPageError(null);

  try {
    const data = await getTableStatus();

    console.log('ALL TABLES:', data);

    setTables(data);
  } catch (err) {
    setPageError(err.message || 'Unable to load tables.');
    console.error('Failed to load tables:', err);
  } finally {
    setIsLoading(false);
  }
}, []);

  // Setup realtime subscriptions
  useEffect(() => {
    fetchTables();

    // Subscribe to table_sessions changes
    const sessionSubscription = supabase
      .channel('table_sessions_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'table_sessions' },
        () => {
          fetchTables();
        }
      )
      .subscribe();

    return () => {
      sessionSubscription.unsubscribe();
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
  const handleAddTable = async () => {
  try {
    if (editingTable) {
      const { error } = await supabase
        .from('tables')
        .update({
          table_number: Number(tableNumber),
          capacity: Number(capacity),
          qr_code_url: `http://localhost:3000/table/${tableNumber}`,
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
        qr_code_url: `http://localhost:3000/table/${tableNumber}`,
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
  return (
    <div className="w-full">
      {/* Header with Add Table Button */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-8">
        <div />
       <button
  type="button"
  onClick={() => setShowAddTableModal(true)}
  className="btn btn-primary flex items-center gap-2"
>
  <Plus size={18} />
  Add New Table
</button>
<button
  type="button"
  onClick={() => setShowManageTableModal(true)}
  className="btn btn-primary flex items-center gap-2"
>
  Manage Tables
</button>
      </div>

      {/* Error Alert */}
      {pageError && (
        <div className="card bg-[var(--destructive-bg)] border-[var(--destructive-border)] text-[var(--destructive)] p-4 mb-6">
          <p className="text-body">⚠️ {pageError}</p>
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 size={32} className="animate-spin text-[var(--accent)]" />
        </div>
      )}

      {/* Table Status Grid */}
      {!isLoading && tables.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {tables.map((table) => (
            <div
              key={table.id}
              className={`card p-5 border border-[var(--border)] transition-all ${
  table.is_active
    ? 'hover:border-[var(--accent)] cursor-pointer'
    : 'opacity-75 cursor-not-allowed'
}`}
              onClick={() => {
  if (!table.is_active) return;

  if (table.session_id) {
    handleViewSession(table.session_id);
  }
}}
            >
              {/* Table Number & Status */}
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="text-heading text-[var(--text-primary)]">Table {table.table_number}</h3>
                  <p className="text-small text-[var(--text-secondary)]">Capacity: {table.capacity} pax</p>
                </div>
                <span className={`px-2 py-1 rounded text-xs font-semibold ${STATUS_COLORS[table.current_status]}`}>
                  {STATUS_LABELS[table.current_status]}
                </span>
              </div>

              {/* Session Info (if active) */}
              {table.current_status !== 'inactive' && table.session_id && (
                <div className="space-y-2 mb-4 text-small text-[var(--text-secondary)]">
                  <div className="flex items-center gap-2">
                    <Zap size={14} /> PIN: <span className="font-mono font-bold text-[var(--accent)]">{table.current_pin}</span>
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

                {table.current_status === 'open' && (
                  <>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleLockSession(table.session_id);
                      }}
                      disabled={operatingTableId === table.session_id}
                      className="btn btn-ghost text-orange-400 text-small w-full flex items-center justify-center gap-2"
                    >
                      {operatingTableId === table.session_id ? <Loader2 size={14} className="animate-spin" /> : <Lock size={14} />}
                      End Ordering
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

                {table.current_status === 'locked' && (
                  <>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setConfirmAction({ action: 'complete', sessionId: table.session_id });
                      }}
                      className="btn btn-primary text-small w-full flex items-center justify-center gap-2"
                    >
                      <Check size={14} />
                      Complete & Bill
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
               


                {table.current_status === 'completed' && (
                  <>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setConfirmAction({ action: 'clear', sessionId: table.session_id });
                      }
                    }
                      className="btn btn-ghost text-gray-400 text-small w-full flex items-center justify-center gap-2"
                    >
                      <Trash2 size={14} />
                      Clear Table
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
            <div className="grid gap-4 md:grid-cols-2 mb-6">
              <div className="bg-[var(--surface)] p-4 rounded">
                <p className="text-small text-[var(--text-secondary)] mb-1">PIN</p>
                <p className="font-mono font-bold text-lg text-[var(--accent)]">{selectedSession.pin}</p>
              </div>
              <div className="bg-[var(--surface)] p-4 rounded">
                <p className="text-small text-[var(--text-secondary)] mb-1">Status</p>
                <span
                  className={`inline-block px-3 py-1 rounded text-small font-semibold ${STATUS_COLORS[selectedSession.status]}`}
                >
                  {STATUS_LABELS[selectedSession.status]}
                </span>
              </div>
              <div className="bg-[var(--surface)] p-4 rounded">
                <p className="text-small text-[var(--text-secondary)] mb-1">Started At</p>
                <p className="text-body">{formatDate(selectedSession.started_at)}</p>
              </div>
              <div className="bg-[var(--surface)] p-4 rounded">
                <p className="text-small text-[var(--text-secondary)] mb-1">Connected Devices</p>
                <p className="text-body font-bold">{selectedSession.connected_devices_count}</p>
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
            {selectedSession.status === 'open' && (
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    handleLockSession(selectedSession.id);
                    setShowSessionModal(false);
                  }}
                  className="flex-1 btn btn-ghost text-orange-400"
                >
                  <Lock size={16} /> End Ordering
                </button>
              </div>
            )}

            {selectedSession.status === 'locked' && (
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setConfirmAction({ action: 'complete', sessionId: selectedSession.id })}
                  className="flex-1 btn btn-primary"
                >
                  <Check size={16} /> Complete & Bill
                </button>
              </div>
            )}

            {selectedSession.status === 'completed' && (
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setConfirmAction({ action: 'clear', sessionId: selectedSession.id })}
                  className="flex-1 btn btn-ghost"
                >
                  <Trash2 size={16} /> Clear Table
                </button>
              </div>
            )}

            {(selectedSession.status === 'open' || selectedSession.status === 'locked') && (
              <div className="mt-3 flex gap-3">
                <button
                  type="button"
                  onClick={() => setConfirmAction({ action: 'cancel', sessionId: selectedSession.id })}
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
      {showAddTableModal && (
  <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
    <div className="card w-full max-w-md p-6">
      <h3 className="text-heading mb-4">Add New Table</h3>
      <div className="space-y-4">
  <input
  type="number"
  placeholder="Table Number"
  value={tableNumber}
  onChange={(e) => setTableNumber(e.target.value)}
  className="w-full p-3 rounded border bg-transparent"
/>

  <input
  type="number"
  placeholder="Capacity"
  value={capacity}
  onChange={(e) => setCapacity(e.target.value)}
  className="w-full p-3 rounded border bg-transparent"
/>

  <div className="flex gap-3">
    <button
      type="button"
      onClick={() => setShowAddTableModal(false)}
      className="btn btn-ghost flex-1"
    >
      Cancel
    </button>

    <button
  type="button"
  onClick={handleAddTable}
  className="btn btn-primary flex-1"
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
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="card w-full max-w-md p-6">
            <h3 className="text-heading mb-3">Confirm Action</h3>
            <p className="text-body text-[var(--text-secondary)] mb-6">
              {confirmAction.action === 'complete' && 'Complete this session and generate bill?'}
              {confirmAction.action === 'clear' && 'Clear the table and archive session?'}
              {confirmAction.action === 'cancel' &&
                'Emergency cancel - no bill will be generated. Proceed? This action cannot be undone.'}
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setConfirmAction(null)}
                className="flex-1 btn btn-ghost"
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
                className="flex-1 btn btn-primary"
              >
                {operatingTableId === confirmAction.sessionId ? <Loader2 size={14} className="animate-spin" /> : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
      {showManageTableModal && (
  <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
    <div className="card p-6 w-full max-w-md">
      <h2 className="text-xl font-bold mb-4">
        Manage Tables
      </h2>

      <select
  value={selectedTableId}
  onChange={(e) => {
  const id = e.target.value;
  setSelectedTableId(id);

  const table = tables.find(
  (t) => t.id === id
);

  console.log("Selected ID:", id);
  console.log("Found Table:", table);
  console.log("is_active:", table?.is_active);
  console.log("current_status:", table?.current_status);
  if (table) {
  setSelectedTable(table);
  setManageTableNumber(table.table_number);
  setManageCapacity(table.capacity);
}
}}

  className="input w-full mb-3"
>
  <option value="">Select Table</option>

  {tables.map((table) => (
    <option key={table.id} value={table.id}>
      Table {table.table_number}
    </option>
  ))}
</select>
<input
  type="number"
  value={manageTableNumber}
  onChange={(e) => setManageTableNumber(e.target.value)}
  placeholder="New Table Number"
  className="input w-full mb-3"
/>

<input
  type="number"
  value={manageCapacity}
  onChange={(e) => setManageCapacity(e.target.value)}
  placeholder="New Capacity"
  className="input w-full mb-3"
/>

      <div className="flex gap-2 mt-4">
  <button
    onClick={() => setShowManageTableModal(false)}
    className="btn btn-secondary flex-1"
  >
    Cancel
  </button>

  <button
    onClick={handleSaveTableChanges}
    className="btn btn-primary flex-1"
  >
    Save Changes
  </button>
  {selectedTable && (
  <button
    onClick={() => handleToggleTableStatus(selectedTable)}
    className="btn btn-warning flex-1"
  >
    {selectedTable.is_active
      ? 'Deactivate Table'
      : 'Activate Table'}
  </button>
)}
</div>
    </div>
  </div>
)}
    </div>
  );
}
