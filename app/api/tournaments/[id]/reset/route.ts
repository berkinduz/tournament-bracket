import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

// POST /api/tournaments/[id]/reset — reset bracket back to setup
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = createServiceClient();

  // Delete all matches
  await supabase.from("matches").delete().eq("tournament_id", id);

  // Reset tournament status
  await supabase
    .from("tournaments")
    .update({ status: "setup", champion: null })
    .eq("id", id);

  return NextResponse.json({ success: true });
}
