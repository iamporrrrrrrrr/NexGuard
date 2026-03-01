import { Octokit } from "@octokit/rest";

const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

// Parse "owner/repo" string
function parseRepo(repo: string): { owner: string; repo: string } {
  const [owner, repoName] = repo.split("/");
  return { owner, repo: repoName };
}

// Fetch file tree for repo context
export async function getFileTree(repo: string, ref = "main"): Promise<string[]> {
  // TODO:
  // 1. Use octokit.rest.git.getTree with recursive: true
  // 2. Return list of file paths
  throw new Error("Not implemented");
}

// Fetch file content
export async function getFileContent(repo: string, path: string, ref = "main"): Promise<string> {
  // TODO:
  // 1. Use octokit.rest.repos.getContent
  // 2. Decode base64 content and return string
  throw new Error("Not implemented");
}

// Create a new branch from main
export async function createBranch(repo: string, branchName: string): Promise<void> {
  // TODO:
  // 1. Get SHA of main ref
  // 2. Create new ref with branchName
  throw new Error("Not implemented");
}

// Apply a diff by committing file changes to a branch
export async function applyDiff(repo: string, branch: string, diff: string, message: string): Promise<void> {
  // TODO:
  // 1. Parse unified diff into file path + content pairs
  // 2. For each file: get current blob SHA, create/update file via octokit
  throw new Error("Not implemented");
}

// Open a Pull Request
export async function openPR(repo: string, branch: string, title: string, body: string): Promise<string> {
  // TODO:
  // 1. Call octokit.rest.pulls.create
  // 2. Return PR html_url
  throw new Error("Not implemented");
}
