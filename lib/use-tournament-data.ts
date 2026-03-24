"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Tournament, Player, Match, MatchWithPlayers } from "@/lib/types";
import { calcTotalRounds } from "@/lib/bracket";

interface TournamentData {
  tournament: Tournament | null;
  players: Player[];
  matches: MatchWithPlayers[];
  totalRoundsCount: number;
  loading: boolean;
  error: string | null;
  completedCount: number;
  totalPlayableCount: number;
}

export function useTournamentData(tournamentId: string): TournamentData {
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [rawMatches, setRawMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Stable supabase client ref — never changes
  const supabaseRef = useRef(createClient());
  const supabase = supabaseRef.current;

  const loadData = useCallback(async () => {
    try {
      const [tRes, pRes, mRes] = await Promise.all([
        supabase.from("tournaments").select("*").eq("id", tournamentId).single(),
        supabase.from("players").select("*").eq("tournament_id", tournamentId),
        supabase.from("matches").select("*").eq("tournament_id", tournamentId)
          .order("round", { ascending: true })
          .order("position", { ascending: true }),
      ]);

      if (tRes.error) throw new Error(tRes.error.message);
      setTournament(tRes.data as Tournament);
      setPlayers((pRes.data || []) as Player[]);
      setRawMatches((mRes.data || []) as Match[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [tournamentId, supabase]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Subscribe to real-time updates
  useEffect(() => {
    const channel = supabase
      .channel(`tournament-${tournamentId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "tournaments", filter: `id=eq.${tournamentId}` },
        (payload) => { if (payload.new) setTournament(payload.new as Tournament); }
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "matches", filter: `tournament_id=eq.${tournamentId}` },
        (payload) => {
          if (payload.eventType === "INSERT") {
            setRawMatches((prev) => [...prev, payload.new as Match]);
          } else if (payload.eventType === "UPDATE") {
            setRawMatches((prev) => prev.map((m) => (m.id === (payload.new as Match).id ? (payload.new as Match) : m)));
          } else if (payload.eventType === "DELETE") {
            setRawMatches((prev) => prev.filter((m) => m.id !== (payload.old as { id: string }).id));
          }
        }
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "players", filter: `tournament_id=eq.${tournamentId}` },
        (payload) => {
          if (payload.eventType === "INSERT") {
            setPlayers((prev) => [...prev, payload.new as Player]);
          } else if (payload.eventType === "UPDATE") {
            setPlayers((prev) => prev.map((p) => (p.id === (payload.new as Player).id ? (payload.new as Player) : p)));
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [tournamentId, supabase]);

  // Join matches with players — memoized
  const matches: MatchWithPlayers[] = useMemo(() =>
    rawMatches.map((m) => ({
      ...m,
      player1: players.find((p) => p.id === m.player1_id) || null,
      player2: players.find((p) => p.id === m.player2_id) || null,
    })),
    [rawMatches, players]
  );

  const totalRoundsCount = players.length >= 2 ? calcTotalRounds(players.length) : 0;
  const completedCount = rawMatches.filter((m) => m.status === "completed" && !m.is_bye).length;
  const totalPlayableCount = rawMatches.filter((m) => !m.is_bye).length;

  return { tournament, players, matches, totalRoundsCount, loading, error, completedCount, totalPlayableCount };
}
