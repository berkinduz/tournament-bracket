"use client";

import { use, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { QRCodeSVG } from "qrcode.react";
import confetti from "canvas-confetti";
import { useTournamentData } from "@/lib/use-tournament-data";
import BracketView from "@/app/components/BracketView";

export default function PublicBracketPage({
  params,
}: {
  params: Promise<{ tournamentId: string }>;
}) {
  const { tournamentId } = use(params);
  const {
    tournament,
    players,
    matches,
    totalRoundsCount,
    loading,
    error,
    completedCount,
    totalPlayableCount,
  } = useTournamentData(tournamentId);

  const [hasShownConfetti, setHasShownConfetti] = useState(false);
  const [pageUrl, setPageUrl] = useState("");

  useEffect(() => {
    setPageUrl(window.location.href);
  }, []);

  useEffect(() => {
    if (tournament?.status === "completed" && tournament.champion && !hasShownConfetti) {
      setHasShownConfetti(true);
      const end = Date.now() + 3000;
      const frame = () => {
        confetti({ particleCount: 3, angle: 60, spread: 55, origin: { x: 0 }, colors: ["#e8501a", "#ca8a04", "#1a56db"] });
        confetti({ particleCount: 3, angle: 120, spread: 55, origin: { x: 1 }, colors: ["#e8501a", "#ca8a04", "#1a56db"] });
        if (Date.now() < end) requestAnimationFrame(frame);
      };
      frame();
    }
  }, [tournament?.status, tournament?.champion, hasShownConfetti]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg-primary">
        <div className="text-accent-orange animate-pulse text-lg font-mono">Loading...</div>
      </div>
    );
  }

  if (error || !tournament) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg-primary">
        <div className="text-red-500 text-lg">{error || "Tournament not found"}</div>
      </div>
    );
  }

  if (tournament.status === "setup") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg-primary">
        <div className="card p-8 text-center max-w-md">
          <img src="/epam.png" alt="EPAM" className="h-6 mx-auto mb-4 opacity-40" />
          <h1 className="text-2xl font-bold mb-2">{tournament.name}</h1>
          <p className="text-text-secondary">Bracket will appear here when ready.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg-primary">
      {/* Header */}
      <header className="bg-[#111] border-b border-[#333] sticky top-0 z-40">
        <div className="px-5 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <img src="/epam.png" alt="EPAM" className="h-4 invert brightness-200" />
            <div className="w-px h-4 bg-[#444]" />
            <div>
              <h1 className="text-sm font-semibold text-white">{tournament.name}</h1>
              <p className="text-[10px] text-gray-400 font-mono">
                {tournament.sport_type === "backgammon" ? "🎲 Backgammon" : `Bo${tournament.best_of}`} — {completedCount}/{totalPlayableCount} matches
              </p>
            </div>
          </div>
          {tournament.status === "active" && (
            <span className="flex items-center gap-1.5 text-xs font-mono text-green-400 font-bold">
              <span className="w-2 h-2 rounded-full bg-green-400 live-pulse" />
              LIVE
            </span>
          )}
        </div>
      </header>

      {/* Champion banner */}
      <AnimatePresence>
        {tournament.status === "completed" && tournament.champion && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            className="bg-amber-50 border-b border-amber-200"
          >
            <div className="px-4 py-4 text-center">
              <span className="text-3xl">🏆</span>
              <h2 className="text-2xl font-bold text-amber-700 mt-1">{tournament.champion}</h2>
              <p className="text-amber-600/70 text-sm">Champion</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bracket */}
      <div className="overflow-auto">
        <BracketView matches={matches} totalRounds={totalRoundsCount} playerCount={players.length} />
      </div>

      {/* QR code — always visible bottom-right */}
      {pageUrl && (
        <div className="hidden md:block fixed bottom-4 right-4 z-50 bg-white rounded-2xl shadow-xl border border-border-subtle p-3">
          <QRCodeSVG value={pageUrl} size={140} level="M" />
          <p className="text-[10px] text-text-muted text-center mt-1.5 font-mono">Scan to follow live</p>
        </div>
      )}
    </div>
  );
}
