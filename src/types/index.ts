export interface CodexProposal {
  summary: string;
  diff: string;
  files_to_modify: string[];
  risks: string[];
  confidence: number;
  what_i_didnt_do: string;
  test_coverage_affected: boolean;
}

export interface RiskScore {
  tier: "GREEN" | "YELLOW" | "RED";
  score: number;
  reasons: string[];
  failSafeTriggered: boolean;
}

export interface TicketInput {
  title: string;
  description: string;
  repo: string;
  reporter: string;
}

export interface IncidentInput {
  description: string;
  logs: string;
  repo: string;
  reporter: string;
}
