import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

import { parse } from "dotenv";

const REQUIRED_KEYS = [
  "TURSO_DATABASE_URL",
  "TURSO_AUTH_TOKEN",
  "BETTER_AUTH_SECRET",
  "BETTER_AUTH_URL",
  "AUTH_GITHUB_CLIENT_ID",
  "AUTH_GITHUB_CLIENT_SECRET",
  "FACEBOOK_CLIENT_ID",
  "FACEBOOK_CLIENT_SECRET",
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
  "BREVO_SMTP_HOST",
  "BREVO_SMTP_PORT",
  "BREVO_SMTP_USER",
  "BREVO_SMTP_KEY",
  "BREVO_FROM_EMAIL",
] as const;

const VERCEL_DEFAULT_KEYS = REQUIRED_KEYS.filter(
  key => key !== "TURSO_DATABASE_URL" && key !== "TURSO_AUTH_TOKEN",
);

const GITHUB_SECRET_KEYS = [
  "TURSO_DATABASE_URL",
  "TURSO_AUTH_TOKEN",
] as const;

const VERCEL_BASE_ENVIRONMENTS = ["production", "development"] as const;

type Args = {
  githubOnly: boolean;
  vercelOnly: boolean;
  includePreview: boolean;
  includeTurso: boolean;
  repo?: string;
};

function parseArgs(): Args {
  const args = process.argv.slice(2);

  const githubOnly = args.includes("--github-only");
  const vercelOnly = args.includes("--vercel-only");
  const includePreview = args.includes("--include-preview");
  const includeTurso = args.includes("--include-turso");

  if (githubOnly && vercelOnly) {
    throw new Error("Use only one of --github-only or --vercel-only.");
  }

  const repoArg = args.find(arg => arg.startsWith("--repo="));

  return {
    githubOnly,
    vercelOnly,
    includePreview,
    includeTurso,
    repo: repoArg ? repoArg.slice("--repo=".length) : undefined,
  };
}

function run(
  command: string,
  args: string[],
  options?: { input?: string; allowFailure?: boolean },
) {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    input: options?.input,
    shell: process.platform === "win32",
  });

  if (result.status !== 0 && !options?.allowFailure) {
    const stderr = result.stderr?.trim();
    const stdout = result.stdout?.trim();
    throw new Error(
      [
        `Command failed: ${command} ${args.join(" ")}`,
        stderr || stdout || "No error output.",
      ].join("\n"),
    );
  }

  return result;
}

function parseEnvFile(filePath: string) {
  if (!existsSync(filePath)) {
    return {};
  }

  const content = readFileSync(filePath, "utf8");
  return parse(content);
}

function normalizeEnvValue(key: string, value: string) {
  let normalized = value.trim();
  const keyPrefix = `${key}=`;

  // Guard against accidental paste like: KEY=KEY=actual_value
  while (normalized.startsWith(keyPrefix)) {
    normalized = normalized.slice(keyPrefix.length).trim();
  }

  return normalized;
}

function normalizeEnvMap(values: Record<string, string>) {
  const normalized: Record<string, string> = {};

  for (const [key, value] of Object.entries(values)) {
    normalized[key] = normalizeEnvValue(key, value);
  }

  return normalized;
}

function requireValue(values: Record<string, string>, key: string) {
  const value = values[key];
  if (!value || value.trim().length === 0) {
    throw new Error(`Missing required value for ${key}.`);
  }
  return value;
}

function validateCloudSafe(values: Record<string, string>) {
  const tursoUrl = requireValue(values, "TURSO_DATABASE_URL");
  const authUrl = requireValue(values, "BETTER_AUTH_URL");

  if (/localhost|127\.0\.0\.1/i.test(tursoUrl)) {
    throw new Error("TURSO_DATABASE_URL points to local host. Put remote DB URL in .env.cloud.");
  }

  if (/localhost|127\.0\.0\.1/i.test(authUrl) || !authUrl.startsWith("https://")) {
    throw new Error("BETTER_AUTH_URL must be an https cloud URL. Put it in .env.cloud.");
  }
}

function getRepo(defaultRepo?: string) {
  if (defaultRepo) {
    return defaultRepo;
  }

  const result = run("gh", ["repo", "view", "--json", "nameWithOwner", "-q", ".nameWithOwner"]);
  const repo = result.stdout.trim();

  if (!repo) {
    throw new Error("Unable to detect GitHub repo. Pass --repo=owner/name.");
  }

  return repo;
}

function mask(value: string) {
  if (value.length <= 4) {
    return "****";
  }
  return `${value.slice(0, 2)}***${value.slice(-2)}`;
}

async function main() {
  const args = parseArgs();

  const baseEnv = parseEnvFile(".env");
  const cloudEnv = parseEnvFile(".env.cloud");

  const mergedRaw = {
    ...baseEnv,
    ...cloudEnv,
  } as Record<string, string>;
  const merged = normalizeEnvMap(mergedRaw);

  const vercelKeys = args.includeTurso ? [...REQUIRED_KEYS] : [...VERCEL_DEFAULT_KEYS];
  const vercelEnvironments = args.includePreview
    ? [...VERCEL_BASE_ENVIRONMENTS, "preview"]
    : [...VERCEL_BASE_ENVIRONMENTS];

  const keysToValidate = new Set<string>([
    ...GITHUB_SECRET_KEYS,
    ...vercelKeys,
  ]);

  for (const key of Array.from(keysToValidate)) {
    requireValue(merged, key);
  }

  validateCloudSafe(merged);

  const shouldSyncGithub = !args.vercelOnly;
  const shouldSyncVercel = !args.githubOnly;

  if (shouldSyncGithub) {
    const repo = getRepo(args.repo);
    console.log(`Syncing GitHub secrets to ${repo}...`);

    for (const key of GITHUB_SECRET_KEYS) {
      const value = requireValue(merged, key);
      run("gh", ["secret", "set", key, "--repo", repo, "--body", value]);
      console.log(`  ✓ ${key} (${mask(value)})`);
    }
  }

  if (shouldSyncVercel) {
    console.log("Syncing Vercel environment variables...");
    if (!args.includePreview) {
      console.log("  (Preview skipped by default. Use --include-preview to include it.)");
    }
    if (!args.includeTurso) {
      console.log("  (Turso keys skipped by default. Use --include-turso to include them.)");
    }

    const failures: string[] = [];

    for (const environment of vercelEnvironments) {
      console.log(`  ${environment}:`);

      for (const key of vercelKeys) {
        const value = requireValue(merged, key);

        let result = run("vercel", [
          "env",
          "update",
          key,
          environment,
          "--value",
          value,
          "--yes",
          "--non-interactive",
        ], { allowFailure: true });

        if (result.status !== 0) {
          result = run("vercel", [
            "env",
            "add",
            key,
            environment,
            "--value",
            value,
            "--yes",
            "--non-interactive",
          ], { allowFailure: true });
        }

        if (result.status === 0) {
          console.log(`    ✓ ${key} (${mask(value)})`);
          continue;
        }

        failures.push(`${environment}/${key}`);
        const errorText = result.error?.message || "";
        const message = result.stderr?.trim() || result.stdout?.trim() || errorText || "Unknown error";
        console.log(`    ⚠ ${key} failed: ${message}`);
      }
    }

    if (failures.length > 0) {
      console.log("\n⚠ Some Vercel vars failed to sync:");
      for (const item of failures) {
        console.log(`  - ${item}`);
      }
    }
  }

  console.log("\n✅ Cloud env sync complete");
  console.log("Sources used: .env + .env.cloud (override)");
}

main().catch((error) => {
  console.error("❌ Cloud env sync failed:");
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});