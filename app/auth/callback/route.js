import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  
  if (code) {
    const supabase = await createClient();
    const { data: authData, error } = await supabase.auth.exchangeCodeForSession(code);
    
    if (!error && authData?.user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', authData.user.id)
        .single();
        
      if (profile?.role === 'admin') {
        return NextResponse.redirect(`${origin}/dashboard`);
      } else if (profile?.role === 'staff') {
        return NextResponse.redirect(`${origin}/orders`);
      } else {
        // Fallback if they manage to log in but lack a valid role
        return NextResponse.redirect(`${origin}/login?error=Unauthorized account or role not assigned.`);
      }
    }
  }

  return NextResponse.redirect(`${origin}/login?error=Could not authenticate with Google.`);
}
