import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
    .from("menu_items")
    .select("id, name, price")
       
    .eq("is_archived", false)
      .eq("is_available", true)
      .order("name");

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { error: "Failed to load menu items" },
      { status: 500 }
    );
  }
}