export interface Tournament {
  id: string;
  name: string;
  created_at: string;
  best_of: 3 | 5;
  status: "setup" | "active" | "completed";
  champion: string | null;
}

export interface Player {
  id: string;
  tournament_id: string;
  name: string;
  seed: number | null;
  created_at: string;
}

export interface Match {
  id: string;
  tournament_id: string;
  round: number;
  position: number;
  player1_id: string | null;
  player2_id: string | null;
  player1_score: number | null;
  player2_score: number | null;
  winner_id: string | null;
  is_bye: boolean;
  status: "pending" | "active" | "completed";
  created_at: string;
}

export interface MatchWithPlayers extends Match {
  player1: Player | null;
  player2: Player | null;
}

export type BestOf = 3 | 5;

export interface BracketData {
  tournament: Tournament;
  players: Player[];
  matches: MatchWithPlayers[];
  totalRounds: number;
}
