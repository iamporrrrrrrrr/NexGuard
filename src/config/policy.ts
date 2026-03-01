import fs from "fs";
import path from "path";
import yaml from "js-yaml";

// ---------------------------------------------------------------------------
// PolicyConfig — strongly typed to match config/policy.yaml
// ---------------------------------------------------------------------------

export interface PolicyConfig {
  risk: {
    green: {
      max_score: number;
      auto_execute: boolean;
    };
    yellow: {
      max_score: number;
      veto_window_hours: number;
    };
    red: {
      min_score: number;
      requires_explicit_approval: boolean;
    };
  };
  fail_safe: {
    always_red_patterns: string[];
  };
  incident: {
    countdown_seconds: number;
  };
}

let _policy: PolicyConfig | null = null;

function validatePolicy(raw: unknown): PolicyConfig {
  const obj = raw as Record<string, any>;

  if (!obj?.risk?.green || typeof obj.risk.green.max_score !== "number") {
    throw new Error("policy.yaml: missing or invalid risk.green.max_score");
  }
  if (!obj?.risk?.yellow || typeof obj.risk.yellow.max_score !== "number") {
    throw new Error("policy.yaml: missing or invalid risk.yellow.max_score");
  }
  if (typeof obj.risk.yellow.veto_window_hours !== "number") {
    throw new Error("policy.yaml: missing or invalid risk.yellow.veto_window_hours");
  }
  if (!obj?.risk?.red || typeof obj.risk.red.min_score !== "number") {
    throw new Error("policy.yaml: missing or invalid risk.red.min_score");
  }
  if (!Array.isArray(obj?.fail_safe?.always_red_patterns)) {
    throw new Error("policy.yaml: missing or invalid fail_safe.always_red_patterns");
  }
  if (!obj?.incident || typeof obj.incident.countdown_seconds !== "number") {
    throw new Error("policy.yaml: missing or invalid incident.countdown_seconds");
  }

  return obj as PolicyConfig;
}

export function getPolicy(): PolicyConfig {
  if (!_policy) {
    const filePath = path.resolve(__dirname, "../../config/policy.yaml");
    const raw = yaml.load(fs.readFileSync(filePath, "utf8"));
    _policy = validatePolicy(raw);
  }
  return _policy;
}
