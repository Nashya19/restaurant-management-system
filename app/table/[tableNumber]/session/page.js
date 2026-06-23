'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { getSessionDetails } from '@/lib/api/table-sessions';

export default function CustomerSessionPage() {
  const params = useParams();

  const [session, setSession] = useState(null);

  useEffect(() => {
    loadSession();
  }, []);

  async function loadSession() {
    const sessionId =
      localStorage.getItem('sessionId');

    if (!sessionId) return;

    const data =
      await getSessionDetails(sessionId);

    setSession(data);
  }

  if (!session) {
    return (
      <div className="p-6">
        Loading...
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6">
      <div className="card p-6">

        <h1 className="text-3xl font-bold mb-6">
          Table {session.tables.table_number}
        </h1>

        <p>PIN: {session.pin}</p>

        <p>Status: {session.status}</p>

        <p>
          Total Amount: ₹
          {session.running_total}
        </p>

        <p>
          Connected Devices:
          {session.connected_devices_count}
        </p>

        <p>
          Orders:
          {session.orders_count}
        </p>

      </div>
    </div>
  );
}