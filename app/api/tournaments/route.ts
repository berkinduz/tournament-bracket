import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import type { BestOf, SportType } from "@/lib/types";

// GET /api/tournaments — list all tournaments
export async function GET() {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("tournaments")
    .select("*, players(count)")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Flatten player count
  const result = (data || []).map((t) => ({
    ...t,
    player_count: (t.players as unknown as { count: number }[])?.[0]?.count ?? 0,
    players: undefined,
  }));

  return NextResponse.json(result);
}

// POST /api/tournaments — create a new tournament
export async function POST(request: NextRequest) {
  const body = await request.json() as {
    name: string;
    best_of: BestOf;
    sport_type?: SportType;
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
  const sportType: SportType =
    body.sport_type === "backgammon" ? "backgammon" : "ping-pong";

  const insertData: Record<string, unknown> = {
    name: body.name.trim(),
    best_of: body.best_of,
    sport_type: sportType,
    status: "setup",
  };

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("tournaments")
    .insert(insertData)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data, { status: 201 });
}
