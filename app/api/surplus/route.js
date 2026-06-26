import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createClient();
    const now = new Date().toISOString();

const { data, error } = await supabase
  .from("surplus_items")
  .select(`
    *,
    menu_items (
      name,
      price
    )
  `)
  //.gt("quantity", 0)
  //.eq("is_claimed", false)
  .gt("pickup_window_end", now)
  .order("pickup_window_end", {
    ascending: true,
  });

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error) {
    console.error("SURPLUS ERROR:", error);

    return NextResponse.json(
      { error: "Failed to fetch surplus items" },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const supabase = await createClient();

    const body = await request.json();

    const {
      menu_item_id,
      quantity,
      discounted_price,
      pickup_window_start,
      pickup_window_end,
    } = body;

    const {
      data: { user },
    } = await supabase.auth.getUser();

    console.log("USER:", user?.id);

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user?.id)
      .single();

    console.log("ROLE:", profile);

    const { data, error } = await supabase
      .from("surplus_items")
      .insert([
        {
          menu_item_id,
          quantity: Number(quantity),
         discounted_price:
  discounted_price !== null &&
  discounted_price !== undefined &&
  discounted_price !== ""
    ? Number(discounted_price)
    : 0,
          pickup_window_start,
          pickup_window_end,
          is_claimed: false,
          total_given_away: 0,
        },
      ])
      .select()
      .single();

    if (error) {
      console.error("SUPABASE INSERT ERROR:", error);
      throw error;
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("CREATE SURPLUS ERROR:", error);

    return NextResponse.json(
      { error: error.message || "Failed to create surplus item" },
      { status: 500 }
    );
  }
}