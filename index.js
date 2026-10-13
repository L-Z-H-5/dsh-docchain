// dsh-docchain — bundle skill provider for the docchain skills.
//
// Registers every `<skills>/<name>/SKILL.md` directory bundle shipped in this
// package on the host skill registry (`ctx.skills`), so the skills appear in
// the session catalog and load on demand without depending on manually placed
// user-skill roots (`~/.agents/skills` or `~/.dsh/skills`).
//
// Contract notes:
// - `list()` re-scans the shipped skills root on every catalog collect and
//   returns full candidates; `get()` re-reads the SKILL.md file fresh, so
//   body edits inside the installed package need no cache invalidation.
// - The shipped skills root is watched so added/removed skill directories
//   invalidate the catalog while the registration is live.
// - Ranks (lower wins within one layer): project-dsh 100, project-agents 200,
//   runtime 250, custom 300, user-dsh 400, user-agents 500, bundled 600.
//   SKILL_RANK sits between `custom` and the user roots, so project and
//   custom skill roots keep precedence over this bundle, while passively
//   placed copies under the user roots lose to it.
// - The docchain service endpoint/key are NOT shipped in the package. The key
//   follows the official credential pattern: the row Config names a credential
//   reference (default `DOCCHAIN_API_KEY`) whose value lives in the
//   credential store (`~/.dsh/.credentials.yaml`, editable from the
//   configuration UI) or the launch environment; the endpoint is a plain row
//   Config field. At activation — and again when `credentials/
//   reference-updated` or a `settings/document-updated` for this row fires —
//   resolved values are mirrored into `~/.dsh/storages/docchain-config.json`,
//   which the Python scripts read on every run (they also accept env vars and
//   per-skill config.json). The file is a pure projection of what the row
//   config currently resolves to: a value cleared in the UI disappears from
//   it instead of lingering, so the scripts fall through to their defaults.
import { mkdirSync, readFileSync, readdirSync, watch, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import os from "node:os";
import path from "node:path";
import z from "@deepseek-ai/schemastery";

const PROVIDER_NAME = "dsh-docchain";
const SKILL_SOURCE = "bundled";
const SKILL_RANK = 450;

const skillsRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "skills");

/** State file the Python scripts read; resolved Config values materialize into it. */
export const CONFIG_FILE = path.join(os.homedir(), ".dsh", "storages", "docchain-config.json");

/** Default credential-reference name for the docchain API key. */
export const DEFAULT_KEY_REF = "DOCCHAIN_API_KEY";

/**
 * Row config schema — a schemastery schema, the host's native config library.
 *
 * `docchain_url` carries `.volatile()` so the host settings projection
 * (`@deepseek-ai/dsh-settings`) serves it as an editable form field to the
 * web client's Plugins page; the browser half of this bundle (the `./client`
 * export in package.json) renders that form for the `dsh-docchain` row.
 * The API key is not a form field: the page writes it to the credential
 * store under `DOCCHAIN_API_KEY` through the `credentials` Remote
 * namespace, and this plugin only ever reads the resolved value here.
 *
 * The bare `@deepseek-ai/schemastery` import resolves against the host
 * installation (the loader imports plugin modules through its own loader
 * chain), not the profile directory — the same pattern dshmarket's host
 * half uses. Every documented field is optional; unknown fields pass
 * through schemastery untouched, so a row round-trip never drops data.
 */
export const Config = z.object({
  docchain_url: z.string().volatile().description("docchain 服务地址，如 http://<host>:7100/llmdoc"),
  docchain_api_key_ref: z.string().description("API Key 的凭据引用名，默认 DOCCHAIN_API_KEY"),
  docchain_api_key: z.string().description("备用：直接写死 Key（不推荐，凭据存储优先）"),
});

/** The credential-reference name the row config resolves its API key from. */
function keyRefName(config) {
  return typeof config?.docchain_api_key_ref === "string" && config.docchain_api_key_ref.trim()
    ? config.docchain_api_key_ref.trim()
    : DEFAULT_KEY_REF;
}

/**
 * Resolve the API key for the row config: the credential store wins (managed,
 * hot-reloadable), the row literal is the fallback. Returns `{ key, from }`.
 */
async function resolveApiKey(ctx, config) {
  const refName = keyRefName(config);
  try {
    const credentials = ctx.get?.("credentials");
    if (credentials?.resolve) {
      const hit = await credentials.resolve(refName); // CredentialRef is a plain string at runtime
      if (hit?.value) return { key: hit.value, from: `credential store ${refName} (${hit.source})` };
    }
  } catch (error) {
    ctx.logger?.warn?.(`dsh-docchain: cannot resolve credential ${refName}: ${error?.message ?? error}`);
  }
  const literal = typeof config?.docchain_api_key === "string" ? config.docchain_api_key.trim() : "";
  return literal ? { key: literal, from: "row config" } : { key: "", from: "" };
}

/**
 * Mirror the resolved Config values into the state file. The file is a pure
 * projection of what the row config resolves to right now — rebuilt from
 * scratch on every materialization, never merged over its previous content —
 * so a value cleared in the UI disappears from it instead of lingering, and
 * the scripts fall through to lower-priority config or their default. Writes
 * only on content change so an unchanged re-materialization stays silent.
 * Manual overrides belong in the layers the scripts read before this file
 * (env vars, per-skill config.json), which this mirror never touches.
 * @param ctx - the plugin context.
 * @param config - the resolved row config.
 */
async function materializeServiceConfig(ctx, config) {
  // `docchain_url` is volatile: its resolved value is a reference wrapper
  // (`{ get() }`) the host updates in place on settings writes, so read
  // through `.get()` to pick up the latest accepted value.
  const rawUrl = config?.docchain_url;
  const urlValue = typeof rawUrl === "string" ? rawUrl : typeof rawUrl?.get === "function" ? rawUrl.get() : undefined;
  const url = typeof urlValue === "string" ? urlValue.trim() : "";
  const { key, from } = await resolveApiKey(ctx, config);
  const next = {};
  if (url) next.docchain_url = url;
  if (key) next.docchain_api_key = key;
  const rendered = `${JSON.stringify(next, null, 2)}\n`;
  try {
    if (readFileSync(CONFIG_FILE, "utf8") === rendered) return; // unchanged; no rewrite, no log
  } catch {
    // first write
  }
  try {
    mkdirSync(path.dirname(CONFIG_FILE), { recursive: true });
    writeFileSync(CONFIG_FILE, rendered, { mode: 0o600 });
    ctx.logger?.info?.(`dsh-docchain: wrote docchain service config to ${CONFIG_FILE}${key ? ` (key from ${from})` : ""}`);
  } catch (error) {
    ctx.logger?.warn?.(`dsh-docchain: cannot write ${CONFIG_FILE}: ${error?.message ?? error}`);
  }
}

/** Split a SKILL.md into frontmatter scalars (name/description/whenToUse) and the markdown body. */
export function splitFrontmatter(text) {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/);
  if (lines[0]?.trim() !== "---") return null;
  let close = -1;
  for (let i = 1; i < lines.length; i += 1) {
    if (lines[i].trim() === "---") {
      close = i;
      break;
    }
  }
  if (close < 0) return null;
  const data = {};
  for (const line of lines.slice(1, close)) {
    const match = /^([A-Za-z][A-Za-z0-9_-]*):[ \t]*(.*)$/.exec(line);
    if (!match) continue;
    let value = match[2].trim();
    if (value.length >= 2 && ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'")))) {
      value = value.slice(1, -1);
    }
    if (value.length > 0) data[match[1]] = value;
  }
  const body = lines.slice(close + 1).join("\n").replace(/^\n+/, "");
  return { data, body };
}

/** Scan the shipped skills root; directory bundles without a valid SKILL.md are skipped with a warning. */
function scanSkillBundles(logger) {
  const skills = [];
  let entries;
  try {
    entries = readdirSync(skillsRoot, { withFileTypes: true });
  } catch (error) {
    logger.warn?.(`dsh-docchain: cannot read skills root ${skillsRoot}: ${error?.message ?? error}`);
    throw error;
  }
  for (const entry of entries.filter((item) => item.isDirectory()).map((item) => item.name).sort()) {
    const dir = path.join(skillsRoot, entry);
    const file = path.join(dir, "SKILL.md");
    let text;
    try {
      text = readFileSync(file, "utf8");
    } catch {
      continue; // plain resource directory, not a skill bundle
    }
    const parsed = splitFrontmatter(text);
    if (!parsed || typeof parsed.data.name !== "string" || !parsed.data.description) {
      logger.warn?.(`dsh-docchain: skipped ${file}: missing or invalid frontmatter (name/description required)`);
      continue;
    }
    skills.push({
      name: parsed.data.name,
      description: parsed.data.description,
      whenToUse: parsed.data.whenToUse,
      dir,
      file,
    });
  }
  return skills;
}

export const inject = ["skills"];

export function apply(ctx, config) {
  const fail = (error) => ctx.logger?.warn?.(`dsh-docchain: materialize failed: ${error?.message ?? error}`);
  materializeServiceConfig(ctx, config).catch(fail);
  const disposeProvider = ctx.skills.registerProvider((control) => {
    // Best-effort watch on the shipped skills root; coalesce invalidations.
    let dirty = false;
    let watcher = null;
    try {
      watcher = watch(skillsRoot, { persistent: false }, () => {
        dirty = true;
        queueMicrotask(() => {
          if (!dirty) return;
          dirty = false;
          control.invalidate();
        });
      });
    } catch (error) {
      ctx.logger.warn?.(`dsh-docchain: cannot watch ${skillsRoot}: ${error?.message ?? error}`);
    }
    if (watcher) {
      const close = () => {
        try {
          watcher.close();
        } catch {
          // already closed
        }
      };
      if (control.signal.aborted) close();
      else control.signal.addEventListener("abort", close, { once: true });
    }

    const candidates = () => {
      const skills = scanSkillBundles(ctx.logger);
      return skills.map((skill) => ({
        name: skill.name,
        description: skill.description,
        ...(skill.whenToUse !== undefined ? { whenToUse: skill.whenToUse } : {}),
        invocation: { modelInvocable: true, userInvocable: true },
        source: SKILL_SOURCE,
        provider: PROVIDER_NAME,
        rank: SKILL_RANK,
        locator: skill,
        path: skill.file,
        resourceBase: { kind: "directory", path: skill.dir },
      }));
    };

    return {
      name: PROVIDER_NAME,
      async list() {
        return candidates();
      },
      async get(candidate, options) {
        options?.signal?.throwIfAborted?.();
        const skill = candidate.locator;
        let text;
        try {
          text = readFileSync(skill.file, "utf8");
        } catch {
          return undefined; // no longer loadable
        }
        const parsed = splitFrontmatter(text);
        if (!parsed) return undefined;
        return {
          name: candidate.name,
          description: candidate.description,
          ...(candidate.whenToUse !== undefined ? { whenToUse: candidate.whenToUse } : {}),
          invocation: candidate.invocation,
          source: SKILL_SOURCE,
          provider: PROVIDER_NAME,
          content: parsed.body,
          path: candidate.path,
          resourceBase: { kind: "directory", path: skill.dir },
        };
      },
    };
  });
  // Re-materialize when a stored credential changes (saved, replaced, or
  // removed in the credential store / its file), so the state file follows
  // without a restart. The event carries the changed ref; re-resolving on any
  // update is cheap and a no-op write when nothing changed.
  const offCredentialUpdate = ctx.on("credentials/reference-updated", (ref) => {
    if (ref !== keyRefName(config)) return; // some other reference changed
    materializeServiceConfig(ctx, config).catch(fail);
  });
  // Re-materialize when this row's settings document changes (the Plugins
  // page saved an edit, including clearing the URL back to its default), so
  // the state file follows the accepted value in both directions.
  const offSettingsUpdate = ctx.on("settings/document-updated", (ns) => {
    if (ns !== PROVIDER_NAME) return; // some other entry's settings changed
    materializeServiceConfig(ctx, config).catch(fail);
  });
  return () => {
    try {
      offCredentialUpdate?.();
      offSettingsUpdate?.();
    } catch {
      // already disposed
    }
    disposeProvider();
  };
}
