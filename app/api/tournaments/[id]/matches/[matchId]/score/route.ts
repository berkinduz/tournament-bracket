import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getNextMatchSlot, getDownstreamMatches, calcTotalRounds } from "@/lib/bracket";

/**
 * After advancing a winner, if the target match is a bye (only 1 player will ever
 * arrive), auto-complete it and cascade the advance further.
 */
async function cascadeByeAdvance(
  supabase: ReturnType<typeof createServiceClient>,
  tournamentId: string,
  round: number,
  position: number,
  numRounds: number,
) {
  // Find the match we just populated
  const { data: match } = await supabase
    .from("matches")
    .select("*")
    .eq("tournament_id", tournamentId)
    .eq("round", round)
    .eq("position", position)
    .single();

  if (!match || !match.is_bye) return;

  // This is a bye match. The player who arrived auto-wins.
  const winnerId = match.player1_id || match.player2_id;
  if (!winnerId) return;

  await supabase
    .from("matches")
    .update({
      winner_id: winnerId,
      player1_score: null,
      player2_score: null,
      status: "completed",
    })
    .eq("id", match.id);

  // Check if this is the final
  if (round === numRounds - 1) {
    const { data: winner } = await supabase
      .from("players")
      .select("name")
      .eq("id", winnerId)
      .single();
    await supabase
      .from("tournaments")
      .update({ status: "completed", champion: winner?.name || null })
      .eq("id", tournamentId);
    return;
  }

  // Advance to next round
  const next = getNextMatchSlot(round, position);
  const { data: nextMatch } = await supabase
    .from("matches")
    .select("*")
    .eq("tournament_id", tournamentId)
    .eq("round", next.round)
    .eq("position", next.position)
    .single();

  if (nextMatch) {
    const updateData: Record<string, unknown> = {};
    if (next.slot === "player1") updateData.player1_id = winnerId;
    else updateData.player2_id = winnerId;

    const p1 = next.slot === "player1" ? winnerId : nextMatch.player1_id;
    const p2 = next.slot === "player2" ? winnerId : nextMatch.player2_id;
    if (p1 && p2) updateData.status = "active";

    await supabase.from("matches").update(updateData).eq("id", nextMatch.id);

    // Recurse: if the next match is also a bye, cascade further
    await cascadeByeAdvance(supabase, tournamentId, next.round, next.position, numRounds);
  }
}

// POST — set match result
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; matchId: string }> },
) {
  const { id, matchId } = await params;
  const body = (await request.json()) as {
    player1_score: number;
    player2_score: number;
    winner_id: string;
  };

  const supabase = createServiceClient();

  const { data: match, error: mErr } = await supabase
    .from("matches")
    .select("*")
    .eq("id", matchId)
    .single();
  if (mErr || !match) return NextResponse.json({ error: "Match not found" }, { status: 404 });

  // Count players to determine total rounds
  const { data: allPlayers } = await supabase
    .from("players")
    .select("id")
    .eq("tournament_id", id);
  const numRounds = calcTotalRounds(allPlayers?.length || 0);

  // Update match
  await supabase
    .from("matches")
    .update({
      player1_score: body.player1_score,
      player2_score: body.player2_score,
      winner_id: body.winner_id,
      status: "completed",
    })
    .eq("id", matchId);

  // Final match?
  if (match.round === numRounds - 1) {
    const { data: winner } = await supabase
      .from("players")
      .select("name")
      .eq("id", body.winner_id)
      .single();
    await supabase
      .from("tournaments")
      .update({ status: "completed", champion: winner?.name || null })
      .eq("id", id);
    return NextResponse.json({ success: true, isFinal: true });
  }

  // Advance winner
  const next = getNextMatchSlot(match.round, match.position);
  const { data: nextMatch } = await supabase
    .from("matches")
    .select("*")
    .eq("tournament_id", id)
    .eq("round", next.round)
    .eq("position", next.position)
    .single();

  if (nextMatch) {
    const update: Record<string, unknown> = {};
    if (next.slot === "player1") update.player1_id = body.winner_id;
    else update.player2_id = body.winner_id;

    const p1 = next.slot === "player1" ? body.winner_id : nextMatch.player1_id;
    const p2 = next.slot === "player2" ? body.winner_id : nextMatch.player2_id;
    if (p1 && p2) update.status = "active";

    await supabase.from("matches").update(update).eq("id", nextMatch.id);

    // Cascade through any bye matches
    await cascadeByeAdvance(supabase, id, next.round, next.position, numRounds);
  }

  return NextResponse.json({ success: true, isFinal: false });
}

// DELETE — undo match result
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; matchId: string }> },
) {
  const { id, matchId } = await params;
  const supabase = createServiceClient();

  const { data: match, error: mErr } = await supabase
    .from("matches")
    .select("*")
    .eq("id", matchId)
    .single();
  if (mErr || !match) return NextResponse.json({ error: "Match not found" }, { status: 404 });

  const { data: allPlayers } = await supabase
    .from("players")
    .select("id")
    .eq("tournament_id", id);
  const numRounds = calcTotalRounds(allPlayers?.length || 0);

  const downstream = getDownstreamMatches(match.round, match.position, numRounds);

  // Clear current match
  await supabase
    .from("matches")
    .update({ player1_score: null, player2_score: null, winner_id: null, status: "active" })
    .eq("id", matchId);

  // Clear all downstream matches (including cascaded byes)
  for (const dm of downstream) {
    const { data: dmMatch } = await supabase
      .from("matches")
      .select("*")
      .eq("tournament_id", id)
      .eq("round", dm.round)
      .eq("position", dm.position)
      .single();

    if (dmMatch) {
      const feedP1From = { round: dm.round - 1, position: dm.position * 2 };
      const feedP2From = { round: dm.round - 1, position: dm.position * 2 + 1 };

      const isF1Affected =
        (feedP1From.round === match.round && feedP1From.position === match.position) ||
        downstream.some((d) => d.round === feedP1From.round && d.position === feedP1From.position);
      const isF2Affected =
        (feedP2From.round === match.round && feedP2From.position === match.position) ||
        downstream.some((d) => d.round === feedP2From.round && d.position === feedP2From.position);

      const update: Record<string, unknown> = {
        player1_score: null,
        player2_score: null,
        winner_id: null,
        status: dmMatch.is_bye ? "pending" : "pending",
      };
      if (isF1Affected) update.player1_id = null;
      if (isF2Affected) update.player2_id = null;

      await supabase.from("matches").update(update).eq("id", dmMatch.id);
    }
  }

  // Revert tournament if completed
  await supabase
    .from("tournaments")
    .update({ status: "active", champion: null })
    .eq("id", id)
    .eq("status", "completed");

  return NextResponse.json({ success: true });
}
