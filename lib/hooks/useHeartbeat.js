import { useEffect } from 'react';
import { sendHeartbeatAction } from '@/lib/actions/orders';

export function useHeartbeat() {
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const devRole = localStorage.getItem('dev-role') || 'admin';
    if (devRole !== 'customer') return;

    const sessionId = localStorage.getItem('sessionId');
    const deviceFingerprint = localStorage.getItem('deviceFingerprint');
    if (!sessionId || !deviceFingerprint) return;

    const sendHeartbeat = async () => {
      try {
        await sendHeartbeatAction(sessionId, deviceFingerprint);
      } catch (err) {
        console.error('Heartbeat failed:', err);
      }
    };

    // Send immediately on mount
    sendHeartbeat();

    // Send every 10 seconds
    const interval = setInterval(sendHeartbeat, 10000);

    return () => clearInterval(interval);
  }, []);
}
