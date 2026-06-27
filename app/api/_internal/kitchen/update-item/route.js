import { NextResponse } from 'next/server';
import { updateOrderItemStatusAction } from '@/lib/actions/kitchen';

export async function POST(req) {
  try {
    const { itemId, status } = await req.json();
    
    if (!itemId || !status) {
      return NextResponse.json(
        { error: 'Missing itemId or status' },
        { status: 400 }
      );
    }

    const result = await updateOrderItemStatusAction(itemId, status);
    
    return NextResponse.json({ 
      success: true, 
      data: result.data || result
    });
  } catch (err) {
    console.error('[KITCHEN API ERROR]', err);
    return NextResponse.json(
      { 
        error: err.message || 'Server error',
        success: false
      },
      { status: 500 }
    );
  }
}
