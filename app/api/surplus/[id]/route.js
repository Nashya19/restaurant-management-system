import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

export async function PATCH(request, { params }) {
  try {
    const { id } = await params;
    const clientSupabase = await createClient();

    // Authenticate the user and get their role
    const {
      data: { user },
    } = await clientSupabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile } = await clientSupabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (!profile || (profile.role !== "admin" && profile.role !== "staff")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const updates = {};

    const supabaseAdmin = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    if (profile.role === "staff") {
      // Staff can ONLY mark as done (claimed = true, quantity = 0)
      if (body.is_claimed !== undefined) {
        updates.is_claimed = !!body.is_claimed;
        if (updates.is_claimed) {
          updates.quantity = 0;
        }
      } else if (body.quantity !== undefined && Number(body.quantity) === 0) {
        updates.quantity = 0;
        updates.is_claimed = true;
      } else {
        return NextResponse.json(
          { error: "Staff can only mark surplus listings as done/claimed." },
          { status: 403 }
        );
      }
    } else {
      // Admin has full control
      if (body.menu_item_id !== undefined) updates.menu_item_id = body.menu_item_id;
      if (body.quantity !== undefined) {
        updates.quantity = Number(body.quantity);
        if (updates.quantity === 0) {
          updates.is_claimed = true;
        }
      }
      if (body.discounted_price !== undefined) {
        updates.discounted_price = Number(body.discounted_price);
      }
      if (body.pickup_window_start !== undefined) {
        updates.pickup_window_start = body.pickup_window_start;
      }
      if (body.pickup_window_end !== undefined) {
        updates.pickup_window_end = body.pickup_window_end;
      }
      if (body.is_claimed !== undefined) {
        updates.is_claimed = !!body.is_claimed;
        if (updates.is_claimed) {
          updates.quantity = 0;
        }
      }
    }

    const { data, error } = await supabaseAdmin
      .from("surplus_items")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error) {
    console.error("PATCH SURPLUS ERROR:", error);
    return NextResponse.json(
      { error: error.message || "Failed to update surplus item" },
      { status: 500 }
    );
  }
}

export async function DELETE(request, { params }) {
  try {
    const { id } = await params;
    const clientSupabase = await createClient();

    // Authenticate the user and check for admin role
    const {
      data: { user },
    } = await clientSupabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile } = await clientSupabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (!profile || profile.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const supabaseAdmin = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { error } = await supabaseAdmin
      .from("surplus_items")
      .delete()
      .eq("id", id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE SURPLUS ERROR:", error);
    return NextResponse.json(
      { error: error.message || "Failed to delete surplus item" },
      { status: 500 }
    );
  }
}
