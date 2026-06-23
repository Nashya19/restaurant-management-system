const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

try {
  const envPath = path.join(__dirname, '.env.local');
  if (fs.existsSync(envPath)) {
    const env = fs.readFileSync(envPath, 'utf-8');
    env.split('\n').forEach(line => {
      const parts = line.split('=');
      if (parts.length >= 2) {
        const key = parts[0].trim();
        const val = parts.slice(1).join('=').trim().replace(/^['"]|['"]$/g, '');
        process.env[key] = val;
      }
    });
  }
} catch (err) {
  console.error("Failed to parse env file:", err);
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error("Missing supabase URL or service role key in env. URL:", supabaseUrl, "Key exists:", !!serviceKey);
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey);

async function trigger() {
  try {
    // Find an open session
    const { data: openSessions, error: findErr } = await supabase
      .from('table_sessions')
      .select('id, status, table_id')
      .eq('status', 'open')
      .limit(1);

    if (findErr) {
      throw findErr;
    }

    if (!openSessions || openSessions.length === 0) {
      console.log("No open sessions found. We will create a temporary open session first.");
      // Find an active table to use
      const { data: tables, error: tableErr } = await supabase.from('tables').select('id, table_number').limit(1);
      if (tableErr || !tables || tables.length === 0) {
        throw new Error("No tables found to open a session on.");
      }

      const pin = Math.floor(1000 + Math.random() * 9000).toString();
      const { data: newSession, error: createErr } = await supabase
        .from('table_sessions')
        .insert({
          table_id: tables[0].id,
          pin,
          status: 'open',
          opened_at: new Date().toISOString()
        })
        .select()
        .single();

      if (createErr) throw createErr;

      console.log(`Created temporary open session ${newSession.id} on table ${tables[0].table_number}`);
      openSessions.push(newSession);
    }

    const targetSession = openSessions[0];
    console.log(`Updating session ${targetSession.id} to completed to trigger the notification...`);
    const { data: updated, error: updateErr } = await supabase
      .from('table_sessions')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString()
      })
      .eq('id', targetSession.id)
      .select()
      .single();

    if (updateErr) throw updateErr;

    console.log("SUCCESS: Session status updated to completed!", updated);
  } catch (err) {
    console.error("Error triggering notification:", err);
  }
}

trigger();
