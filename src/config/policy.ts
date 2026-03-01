import fs from "fs";
import path from "path";
import yaml from "js-yaml";

// TODO: define PolicyConfig type matching policy.yaml structure
type PolicyConfig = Record<string, unknown>;

let _policy: PolicyConfig | null = null;

export function getPolicy(): PolicyConfig {
  if (!_policy) {
    const filePath = path.resolve(__dirname, "../../config/policy.yaml");
    _policy = yaml.load(fs.readFileSync(filePath, "utf8")) as PolicyConfig;
  }
  return _policy;
}
