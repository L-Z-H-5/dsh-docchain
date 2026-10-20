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
//   which the search scripts read on every run (they also accept env vars and
//   per-skill config.json). The file is a pure projection of what the row
//   config currently resolves to: a value cleared in the UI disappears from
//   it instead of lingering, so the scripts fall through to their defaults.
// - `docchain_environments` holds the user's saved environments as JSON
//   (`{ version, active, items: [{ id, name, url, keyRef }] }`). An active
//   environment outranks `docchain_url` / `docchain_api_key_ref`, so switching
//   is a single settings write while every script keeps reading one projection
//   file. The list is untrusted input: an unparseable or wrongly-shaped payload
//   degrades to "no environments" (the legacy fields win) rather than to an
//   empty list that would erase the user's selection.
import { mkdirSync, readFileSync, readdirSync, watch, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import os from "node:os";
import path from "node:path";
import z from "@deepseek-ai/schemastery";

const PROVIDER_NAME = "dsh-docchain";
const SKILL_SOURCE = "bundled";
const SKILL_RANK = 450;

const skillsRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "skills");

/** State file the search scripts read; resolved Config values materialize into it. */
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
  docchain_api_key_ref: z.string().volatile().description("API Key 的凭据引用名，默认 DOCCHAIN_API_KEY"),
  docchain_api_key: z.string().description("备用：直接写死 Key（不推荐，凭据存储优先）"),
  docchain_environments: z
    .string()
    .volatile()
    .description("常用环境列表（JSON）：{version,active,items:[{id,name,url,keyRef}]}；有生效环境时优先于 docchain_url"),
});

/**
 * Read one row-config field as a trimmed string.
 *
 * `volatile` fields arrive as a reference wrapper (`{ get() }`) that the host
 * updates in place on settings writes; plain fields arrive as strings. Reading
 * both through one helper keeps the unwrapping rule in a single place — a field
 * promoted to `volatile` must not silently fall back to a default just because
 * a wrapper is not a string.
 * @param config - the row config.
 * @param name - the field name.
 * @returns the trimmed string value, or "" when absent.
 */
function readField(config, name) {
  const raw = config?.[name];
  const value = typeof raw === "string" ? raw : typeof raw?.get === "function" ? raw.get() : undefined;
  return typeof value === "string" ? value.trim() : "";
}

/** The credential-reference name the row config resolves its API key from. */
function keyRefName(config) {
  return readField(config, "docchain_api_key_ref") || DEFAULT_KEY_REF;
}

/**
 * Parse the `docchain_environments` field.
 *
 * Returns `null` when the feature is unused or the payload cannot be trusted
 * (absent, malformed JSON, wrong shape). Callers must treat `null` as "no
 * environments" and fall back to the legacy single-URL fields: a corrupted list
 * must never degrade into an empty list that would erase the user's selection.
 * @param config - the row config.
 * @param logger - plugin logger, for the degradation warning.
 * @returns `{ active, items }` or `null`.
 */
function parseEnvironments(config, logger) {
  const text = readField(config, "docchain_environments");
  if (!text) return null;
  let data;
  try {
    data = JSON.parse(text);
  } catch (error) {
    logger?.warn?.(`dsh-docchain: cannot parse docchain_environments (${error?.message ?? error}); using docchain_url`);
    return null;
  }
  if (!data || typeof data !== "object" || Array.isArray(data) || !Array.isArray(data.items)) {
    logger?.warn?.("dsh-docchain: docchain_environments is not a { version, active, items[] } object; using docchain_url");
    return null;
  }
  const items = [];
  for (const item of data.items) {
    if (!item || typeof item !== "object") continue;
    const id = typeof item.id === "string" ? item.id.trim() : "";
    const url = typeof item.url === "string" ? item.url.trim() : "";
    if (!id || !/^https?:\/\//i.test(url)) continue;
    const keyRef = typeof item.keyRef === "string" ? item.keyRef.trim() : "";
    items.push({
      id,
      name: typeof item.name === "string" && item.name.trim() ? item.name.trim() : id,
      url,
      keyRef: keyRef || DEFAULT_KEY_REF,
    });
  }
  return { active: typeof data.active === "string" ? data.active.trim() : "", items };
}

/**
 * The environment the row currently points at, or `undefined` when none is
 * active or the active id no longer exists.
 * @param config - the row config.
 * @param logger - plugin logger, for the missing-active warning.
 */
function activeEnvironment(config, logger) {
  const environments = parseEnvironments(config, logger);
  if (!environments || !environments.active) return undefined;
  const hit = environments.items.find((item) => item.id === environments.active);
  if (!hit) {
    logger?.warn?.(`dsh-docchain: active environment "${environments.active}" is missing; using docchain_url`);
    return undefined;
  }
  return hit;
}

/** Every credential reference this row may consume: the row's own plus every environment's. */
function collectRefs(config, logger) {
  const refs = new Set([keyRefName(config)]);
  const environments = parseEnvironments(config, logger);
  if (environments) for (const item of environments.items) refs.add(item.keyRef);
  return refs;
}

/**
 * Resolve one API key: the credential store wins (managed, hot-reloadable), the
 * row literal is the fallback.
 *
 * Returns `{ key, from, resolved }`. `resolved` says whether an empty `key` is
 * authoritative: `true` when the credential service answered (so an absent ref
 * genuinely means "no key") or a row literal supplied the value; `false` when
 * the credential service was unavailable or its `resolve` threw — i.e. this
 * call raced the service's async init and cannot yet distinguish "no key" from
 * "not loaded". Callers must NOT erase a previously materialized key on a
 * `resolved: false` empty result.
 * @param ctx - the plugin context.
 * @param refName - the credential reference to resolve.
 * @param literal - the row-config fallback value.
 */
async function resolveApiKey(ctx, refName, literal) {
  let credentialReady = false;
  try {
    const credentials = ctx.get?.("credentials");
    if (credentials?.resolve) {
      credentialReady = true;
      const hit = await credentials.resolve(refName); // CredentialRef is a plain string at runtime
      if (hit?.value) return { key: hit.value, from: `credential store ${refName} (${hit.source})`, resolved: true };
    }
  } catch (error) {
    credentialReady = false;
    ctx.logger?.warn?.(`dsh-docchain: cannot resolve credential ${refName}: ${error?.message ?? error}`);
  }
  // A row literal is a definite value regardless of the credential service.
  if (literal) return { key: literal, from: "row config", resolved: true };
  // No literal: authoritative only when the credential service actually answered.
  return { key: "", from: "", resolved: credentialReady };
}

/**
 * Mirror the resolved Config values into the state file. The file is a pure
 * projection of what the row config resolves to right now — rebuilt from
 * scratch on every materialization, never merged over its previous content —
 * so a value cleared in the UI disappears from it instead of lingering, and
 * the scripts fall through to lower-priority config or their default. One
 * exception guards the boot race: when the credential service was not ready to
 * answer (`resolved: false`), an empty key is not authoritative, so the
 * previously materialized `docchain_api_key` is preserved rather than erased.
 * Writes only on content change so an unchanged re-materialization stays silent.
 * Manual overrides belong in the layers the scripts read before this file
 * (env vars, per-skill config.json), which this mirror never touches.
 * @param ctx - the plugin context.
 * @param config - the resolved row config.
 */
async function materializeServiceConfig(ctx, config) {
  // An active environment outranks the legacy single-URL fields, so switching
  // environments is one settings write and nothing under skills/ has to know
  // environments exist: the skill scripts keep reading this projection file.
  const environment = activeEnvironment(config, ctx.logger);
  const url = environment ? environment.url : readField(config, "docchain_url");
  const refName = environment ? environment.keyRef : keyRefName(config);
  const literal = environment ? "" : readField(config, "docchain_api_key");
  const { key, from, resolved } = await resolveApiKey(ctx, refName, literal);

  // Read the current state file once: it feeds both the unchanged-content
  // short-circuit below and the key-preservation guard for a not-ready resolve.
  let current = "";
  try {
    current = readFileSync(CONFIG_FILE, "utf8");
  } catch {
    // first write; no prior content
  }

  const next = {};
  if (url) next.docchain_url = url;
  if (key) {
    next.docchain_api_key = key;
  } else if (!resolved) {
    // Credential service not ready → empty resolve is not authoritative; keep
    // whatever key the state file already holds instead of wiping it.
    let preserved = "";
    try {
      const parsed = JSON.parse(current);
      if (typeof parsed?.docchain_api_key === "string") preserved = parsed.docchain_api_key;
    } catch {
      // unparseable prior content; nothing to preserve
    }
    if (preserved) next.docchain_api_key = preserved;
  }
  const rendered = `${JSON.stringify(next, null, 2)}\n`;
  if (current === rendered) return; // unchanged; no rewrite, no log
  try {
    mkdirSync(path.dirname(CONFIG_FILE), { recursive: true });
    writeFileSync(CONFIG_FILE, rendered, { mode: 0o600 });
    const origin = environment ? `env ${environment.name}` : "docchain_url";
    ctx.logger?.info?.(
      `dsh-docchain: wrote docchain service config to ${CONFIG_FILE} (${origin}${next.docchain_api_key ? `, key from ${from || "preserved"}` : ""})`,
    );
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

// `credentials` is a declared dependency so cordis activates this plugin only
// after the credential service finishes its async init (loading
// `.credentials.yaml`); without it the activation-time materialization races
// the service and resolves an empty key. `resolveApiKey` still guards against
// an unready service defensively.
export const inject = ["skills", "credentials"];

export function apply(ctx, config) {
  const fail = (error) => ctx.logger?.warn?.(`dsh-docchain: materialize failed: ${error?.message ?? error}`);
  // Every skill script checks its own environment variables before this
  // projection file, so a variable set at launch silently outranks whatever the
  // settings page selects. Say so once, loudly: otherwise a working switch looks
  // broken, and the cause is a file this plugin does not own.
  for (const name of ["DOCCHAIN_URL", "DOCCHAIN_API_KEY"]) {
    if (process.env[name]) {
      ctx.logger?.warn?.(
        `dsh-docchain: ${name} is set in the launch environment and outranks the plugin config; switching environments will not change what the skill scripts use`,
      );
    }
  }
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
    // The row's own reference, or any environment's: storing a key for the
    // environment the user just switched to must reach the scripts without a
    // restart, and a silently-wrong filter here would look like a broken switch.
    if (!collectRefs(config, ctx.logger).has(ref)) return;
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
