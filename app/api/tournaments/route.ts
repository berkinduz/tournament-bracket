import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import type { BestOf } from "@/lib/types";

// GET /api/tournaments — list all tournaments
export async function GET() {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("tournaments")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data);
}

// POST /api/tournaments — create a new tournament
export async function POST(request: NextRequest) {
  const body = await request.json() as {
    name: string;
    best_of: BestOf;
  };

  if (!body.name?.trim()) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }
  if (body.best_of !== 3 && body.best_of !== 5) {
    return NextResponse.json(
      { error: "best_of must be 3 or 5" },
      { status: 400 }
    );
  }

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("tournaments")
    .insert({
      name: body.name.trim(),
      best_of: body.best_of,
      status: "setup",
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data, { status: 201 });
}
