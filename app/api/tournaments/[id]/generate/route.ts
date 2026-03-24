import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { generateBracket } from "@/lib/bracket";
import type { Player } from "@/lib/types";

// POST /api/tournaments/[id]/generate — generate bracket
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = createServiceClient();

  // Get tournament
  const { data: tournament, error: tError } = await supabase
    .from("tournaments")
    .select("*")
    .eq("id", id)
    .single();

  if (tError || !tournament) {
    return NextResponse.json(
      { error: "Tournament not found" },
      { status: 404 }
    );
  }

  if (tournament.status !== "setup") {
    return NextResponse.json(
      { error: "Tournament is already active or completed" },
      { status: 400 }
    );
  }

  // Get players
  const { data: players, error: pError } = await supabase
    .from("players")
    .select("*")
    .eq("tournament_id", id);

  if (pError) {
    return NextResponse.json({ error: pError.message }, { status: 500 });
  }

  if (!players || players.length < 2) {
    return NextResponse.json(
      { error: "Need at least 2 players" },
      { status: 400 }
    );
  }

  // Delete any existing matches (in case of re-generation)
  await supabase.from("matches").delete().eq("tournament_id", id);

  // Generate bracket
  const generatedMatches = generateBracket(players as Player[]);

  // Insert matches
  const matchInserts = generatedMatches.map((m) => ({
    tournament_id: id,
    round: m.round,
    position: m.position,
    player1_id: m.player1Id,
    player2_id: m.player2Id,
    player1_score: null,
    player2_score: null,
    winner_id: m.winnerId,
    is_bye: m.isBye,
    status: m.status,
  }));

  const { error: mError } = await supabase
    .from("matches")
    .insert(matchInserts);

  if (mError) {
    return NextResponse.json({ error: mError.message }, { status: 500 });
  }

  // Update tournament status to active
  await supabase
    .from("tournaments")
    .update({ status: "active" })
    .eq("id", id);

  return NextResponse.json({ success: true, matchCount: matchInserts.length });
}
