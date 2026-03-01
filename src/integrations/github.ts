import { Octokit } from "@octokit/rest";

const IS_MOCK = !process.env.GITHUB_TOKEN;

const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

// Parse "owner/repo" string
function parseRepo(repo: string): { owner: string; repo: string } {
  const [owner, repoName] = repo.split("/");
  return { owner, repo: repoName };
}

// ---------------------------------------------------------------------------
// Repo context
// ---------------------------------------------------------------------------

// Fetch file tree for repo context
export async function getFileTree(repo: string, ref = "main"): Promise<string[]> {
  if (IS_MOCK) {
    return [
      "src/index.ts",
      "src/routes/intake.ts",
      "src/services/riskEngine.ts",
      "prisma/schema.prisma",
      "package.json",
    ];
  }

  const { owner, repo: repoName } = parseRepo(repo);

  // First get the SHA of the ref
  const { data: refData } = await octokit.rest.git.getRef({
    owner,
    repo: repoName,
    ref: `heads/${ref}`,
  });
  const treeSha = refData.object.sha;

  const { data: treeData } = await octokit.rest.git.getTree({
    owner,
    repo: repoName,
    tree_sha: treeSha,
    recursive: "true",
  });

  return (treeData.tree ?? [])
    .filter((item) => item.type === "blob" && item.path)
    .map((item) => item.path as string);
}

// Fetch file content
export async function getFileContent(repo: string, path: string, ref = "main"): Promise<string> {
  if (IS_MOCK) {
    return `// Mock content for ${path}\nexport default {};\n`;
  }

  const { owner, repo: repoName } = parseRepo(repo);

  const { data } = await octokit.rest.repos.getContent({
    owner,
    repo: repoName,
    path,
    ref,
  });

  if (Array.isArray(data) || data.type !== "file") {
    throw new Error(`Path "${path}" is not a file`);
  }

  return Buffer.from(data.content, "base64").toString("utf-8");
}

// ---------------------------------------------------------------------------
// Branch management
// ---------------------------------------------------------------------------

// Create a new branch from main
export async function createBranch(repo: string, branchName: string, baseBranch = "main"): Promise<void> {
  if (IS_MOCK) {
    console.log(`[mock] Created branch "${branchName}" from "${baseBranch}" in ${repo}`);
    return;
  }

  const { owner, repo: repoName } = parseRepo(repo);

  // Get the SHA of the base branch tip
  const { data: refData } = await octokit.rest.git.getRef({
    owner,
    repo: repoName,
    ref: `heads/${baseBranch}`,
  });
  const sha = refData.object.sha;

  await octokit.rest.git.createRef({
    owner,
    repo: repoName,
    ref: `refs/heads/${branchName}`,
    sha,
  });
}

// ---------------------------------------------------------------------------
// Diff application
// ---------------------------------------------------------------------------

/**
 * Parses a unified diff and returns a map of { filePath → newContent }.
 * Supports added, modified, and deleted files.
 */
function parseDiff(diff: string): Map<string, string | null> {
  const files = new Map<string, string | null>();
  const fileBlocks = diff.split(/^diff --git /m).filter(Boolean);

  for (const block of fileBlocks) {
    const lines = block.split("\n");

    // Extract target file path from "+++ b/<path>" header
    const plusLine = lines.find((l) => l.startsWith("+++ "));
    if (!plusLine) continue;

    // Handle /dev/null (deleted file)
    if (plusLine === "+++ /dev/null") {
      const minusLine = lines.find((l) => l.startsWith("--- "));
      if (minusLine) {
        const deletedPath = minusLine.replace(/^--- (a\/)?/, "");
        files.set(deletedPath, null);
      }
      continue;
    }

    const filePath = plusLine.replace(/^\+\+\+ (b\/)?/, "");
    const contentLines: string[] = [];
    let inHunk = false;

    for (const line of lines) {
      if (line.startsWith("@@ ")) {
        inHunk = true;
        continue;
      }
      if (!inHunk) continue;
      if (line.startsWith("+")) {
        contentLines.push(line.slice(1));
      } else if (line.startsWith(" ")) {
        // Context line — kept as-is (simplified: rebuild from + and context only)
        contentLines.push(line.slice(1));
      }
      // Lines starting with "-" are removed — skip them
    }

    files.set(filePath, contentLines.join("\n"));
  }

  return files;
}

// Apply a diff by committing file changes to a branch
export async function applyDiff(
  repo: string,
  branch: string,
  diff: string,
  message: string
): Promise<void> {
  if (IS_MOCK) {
    console.log(`[mock] Applied diff to branch "${branch}" in ${repo}: ${message}`);
    return;
  }

  const { owner, repo: repoName } = parseRepo(repo);
  const fileChanges = parseDiff(diff);

  for (const [filePath, newContent] of fileChanges.entries()) {
    if (newContent === null) {
      // Deleted file — fetch current SHA and delete
      try {
        const { data } = await octokit.rest.repos.getContent({
          owner,
          repo: repoName,
          path: filePath,
          ref: branch,
        });
        if (!Array.isArray(data) && data.type === "file") {
          await octokit.rest.repos.deleteFile({
            owner,
            repo: repoName,
            path: filePath,
            message: `${message} (delete ${filePath})`,
            sha: data.sha,
            branch,
          });
        }
      } catch {
        // File may not exist; skip
      }
      continue;
    }

    // Get current file SHA if it exists (required for updates)
    let existingSha: string | undefined;
    try {
      const { data } = await octokit.rest.repos.getContent({
        owner,
        repo: repoName,
        path: filePath,
        ref: branch,
      });
      if (!Array.isArray(data) && data.type === "file") {
        existingSha = data.sha;
      }
    } catch {
      // New file — no SHA needed
    }

    await octokit.rest.repos.createOrUpdateFileContents({
      owner,
      repo: repoName,
      path: filePath,
      message: `${message} (${filePath})`,
      content: Buffer.from(newContent, "utf-8").toString("base64"),
      branch,
      ...(existingSha ? { sha: existingSha } : {}),
    });
  }
}

// ---------------------------------------------------------------------------
// Pull Requests
// ---------------------------------------------------------------------------

// Open a Pull Request
export async function openPR(
  repo: string,
  branch: string,
  title: string,
  body: string,
  base = "main"
): Promise<string> {
  if (IS_MOCK) {
    const mockUrl = `https://github.com/${repo}/pull/999`;
    console.log(`[mock] Opened PR: ${mockUrl}`);
    return mockUrl;
  }

  const { owner, repo: repoName } = parseRepo(repo);

  const { data } = await octokit.rest.pulls.create({
    owner,
    repo: repoName,
    title,
    body,
    head: branch,
    base,
  });

  return data.html_url;
}

// ---------------------------------------------------------------------------
// CI/CD — GitHub Actions
// ---------------------------------------------------------------------------

// Trigger a workflow run (workflow_dispatch)
export async function triggerWorkflow(
  repo: string,
  workflowId: string,
  ref = "main",
  inputs: Record<string, string> = {}
): Promise<void> {
  if (IS_MOCK) {
    console.log(`[mock] Triggered workflow "${workflowId}" on ${repo}@${ref}`);
    return;
  }

  const { owner, repo: repoName } = parseRepo(repo);

  await octokit.rest.actions.createWorkflowDispatch({
    owner,
    repo: repoName,
    workflow_id: workflowId,
    ref,
    inputs,
  });
}

export interface WorkflowRun {
  id: number;
  name: string | null;
  status: string | null;
  conclusion: string | null;
  html_url: string;
  created_at: string;
}

// Poll the latest workflow runs for a given workflow file
export async function getWorkflowRuns(
  repo: string,
  workflowId: string,
  limit = 5
): Promise<WorkflowRun[]> {
  if (IS_MOCK) {
    return [
      {
        id: 1,
        name: "CI",
        status: "completed",
        conclusion: "success",
        html_url: `https://github.com/${repo}/actions/runs/1`,
        created_at: new Date().toISOString(),
      },
    ];
  }

  const { owner, repo: repoName } = parseRepo(repo);

  const { data } = await octokit.rest.actions.listWorkflowRuns({
    owner,
    repo: repoName,
    workflow_id: workflowId,
    per_page: limit,
  });

  return data.workflow_runs.map((run) => ({
    id: run.id,
    name: run.name ?? null,
    status: run.status ?? null,
    conclusion: run.conclusion ?? null,
    html_url: run.html_url,
    created_at: run.created_at,
  }));
}
