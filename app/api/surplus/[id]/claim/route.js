import { NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

export async function POST(request, { params }) {
  try {
    const supabase = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { id } = await params;

    // Get current surplus item
    const { data: item, error: fetchError } = await supabase
      .from("surplus_items")
      .select("*")
      .eq("id", id)
      .single();

    if (fetchError) throw fetchError;

    if (!item) {
      return NextResponse.json(
        { error: "Item not found" },
        { status: 404 }
      );
    }

    // Don't allow claiming if no portions remain
    if (item.quantity <= 0) {
      return NextResponse.json(
        { error: "Item already claimed" },
        { status: 400 }
      );
    }

    const remainingQuantity = item.quantity - 1;

    // Update the item
    const { data, error } = await supabase
      .from("surplus_items")
      .update({
        quantity: remainingQuantity,
        is_claimed: remainingQuantity === 0,
        total_given_away: (item.total_given_away || 0) + 1,
      })
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error) {
    console.error("CLAIM ERROR:", error);

    return NextResponse.json(
      {
        error: error.message || "Failed to claim surplus item",
      },
      { status: 500 }
    );
  }
}