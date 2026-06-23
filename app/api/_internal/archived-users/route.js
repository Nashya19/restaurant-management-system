import { createClient } from '@/lib/supabase/server';

export async function GET() {
  const supabase = await createClient();

  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, phone')
      .eq('is_archived', true)
      .order('full_name', { ascending: true });

    if (error) {
      return new Response(JSON.stringify({ error: 'Failed to fetch archived users' }), { status: 500 });
    }

    return new Response(JSON.stringify({ users: data }), { status: 200 });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Unknown error' }), { status: 500 });
  }
}

