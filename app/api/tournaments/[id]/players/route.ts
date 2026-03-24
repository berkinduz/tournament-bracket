import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

// GET /api/tournaments/[id]/players
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("players")
    .select("*")
    .eq("tournament_id", id)
    .order("seed", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data);
}

// POST /api/tournaments/[id]/players — add player(s)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json() as {
    names: string[];
  };

  if (!body.names?.length) {
    return NextResponse.json(
      { error: "At least one name is required" },
      { status: 400 }
    );
  }

  const players = body.names
    .map((name: string) => name.trim())
    .filter((name: string) => name.length > 0)
    .map((name: string) => ({
      tournament_id: id,
      name,
      seed: null,
    }));

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("players")
    .insert(players)
    .select();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data, { status: 201 });
}

// DELETE /api/tournaments/[id]/players — delete a specific player
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { searchParams } = new URL(request.url);
  const playerId = searchParams.get("playerId");

  if (!playerId) {
    return NextResponse.json(
      { error: "playerId is required" },
      { status: 400 }
    );
  }

  const { id } = await params;
  const supabase = createServiceClient();
  const { error } = await supabase
    .from("players")
    .delete()
    .eq("id", playerId)
    .eq("tournament_id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}

// PATCH /api/tournaments/[id]/players — update seeds and/or names
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await params; // consume params
  const body = await request.json() as {
    updates: Array<{ id: string; seed?: number | null; name?: string }>;
  };

  const supabase = createServiceClient();

  for (const update of body.updates) {
    const fields: Record<string, unknown> = {};
    if ("seed" in update) fields.seed = update.seed;
    if ("name" in update && update.name) fields.name = update.name;

    if (Object.keys(fields).length === 0) continue;

    const { error } = await supabase
      .from("players")
      .update(fields)
      .eq("id", update.id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  return NextResponse.json({ success: true });
}
