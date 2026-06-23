'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { validateSessionPin } from '@/lib/api/table-sessions';
import { createClient } from '@/lib/supabase/client';

export default function CustomerTablePage() {
  const params = useParams();
  const tableNumber = params.tableNumber;
  const router = useRouter();
  const supabase = createClient();

  const [pin, setPin] = useState('');
  const [message, setMessage] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [checkingActive, setCheckingActive] = useState(true);

  useEffect(() => {
    async function checkTable() {
      try {
        const { data, error } = await supabase
          .from('tables')
          .select('is_active')
          .eq('table_number', tableNumber)
          .maybeSingle();

        if (data && data.is_active === false) {
          setIsActive(false);
        }
      } catch (err) {
        console.error('Error checking table status:', err);
      } finally {
        setCheckingActive(false);
      }
    }
    checkTable();
  }, [tableNumber, supabase]);

  const handleContinue = async () => {
  console.log('Table Number:', tableNumber);
console.log('PIN:', pin);

const session = await validateSessionPin(
  tableNumber,
  pin
);

console.log('Session result:', session);
if (!session) {
  setMessage('❌ Invalid PIN');
  return;
}

if (session.status === 'locked') {
  setMessage('🔒 This session is locked. New devices cannot join.');
  return;
}

if (session.status === 'completed') {
  setMessage('✅ This session has already been completed.');
  return;
}

if (session.status === 'cleared') {
  setMessage('🧹 This session has already been cleared.');
  return;
}

const deviceFingerprint =
  localStorage.getItem('deviceFingerprint') ||
  crypto.randomUUID();

localStorage.setItem(
  'deviceFingerprint',
  deviceFingerprint
);

const { data: existingDevice } = await supabase
  .from('session_devices')
  .select('id')
  .eq('session_id', session.id)
  .eq('device_fingerprint', deviceFingerprint)
  .maybeSingle();

if (!existingDevice) {
  const { error } = await supabase
    .from('session_devices')
    .insert({
      session_id: session.id,
      device_fingerprint: deviceFingerprint,
    });

  console.log('Device insert error:', error);
}


localStorage.setItem(
  'sessionId',
  session.id
);

router.push('/menu');
};

  if (checkingActive) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-[#09090b]">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--accent)]"></div>
          <p className="mt-4 text-[var(--text-secondary)]">Checking table status…</p>
        </div>
      </div>
    );
  }

  if (!isActive) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-[#09090b]">
        <div className="card w-full max-w-md p-8 rounded-2xl border border-red-950 bg-[#2a1010]/30 text-center shadow-xl">
          <span className="text-4xl">⚠️</span>
          <h1 className="text-2xl font-bold text-[#c45a5a] mt-4 mb-2">Table {tableNumber} Inactive</h1>
          <p className="text-[var(--text-secondary)] text-sm font-semibold">
            This table is currently out of service. Please contact a staff member for assistance.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="card w-full max-w-md p-6">
        <h1 className="text-2xl font-bold mb-2">
          Table {tableNumber}
        </h1>

        <p className="mb-4 text-gray-400">
          Enter your session PIN
        </p>

        <input
          type="text"
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          placeholder="Session PIN"
          className="w-full p-3 rounded border mb-4 bg-transparent"
        />

        <button
          type="button"
          onClick={handleContinue}
          className="btn btn-primary w-full"
        >
          Continue
        </button>

        {message && (
          <p className="mt-4 text-center">
            {message}
          </p>
        )}
      </div>
    </div>
  );
}