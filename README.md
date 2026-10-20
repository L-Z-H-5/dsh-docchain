# dsh-docchain

English | [中文](./README.zh-CN.md)

A DSH knowledge base and document conversion plugin bundling filename/content/metadata search, topic listing, bulk document upload, document-to-Markdown conversion, plus a multi-subagent deep-research workflow: install once with `plugin_manager install_bundle` and it works on any machine — no manual copying into `~/.agents/skills` required. Built on docchain.

| Skill | Kind | Description |
|---|---|---|
| `docchain-filename-search` | SKILL.md + Node.js script | Find documents whose filename matches keywords, across topics |
| `docchain-content-search` | SKILL.md + Node.js script | Search document content by keyword; returns line numbers and content; `or`/`and` operators |
| `docchain-meta-search` | SKILL.md + Node.js script | Query documents by custom metadata fields (string/number/time, exact and range) |
| `docchain-topic-info` | SKILL.md + Node.js script | List docchain topics with pagination and name keyword filter |
| `docchain-upload` | SKILL.md + Node.js script | Upload a local file or a whole folder to a given docchain topic in bulk |
| `doc2markdown` | SKILL.md + Node.js script | Convert docx/doc/pdf/pptx/xlsx/images and many more formats to Markdown via the docchain parsing service; results land next to the source file |
| `deep-research-advanced` | SKILL.md only | Orchestrator-style multi-subagent deep research workflow (pure instructions, no scripts) |

## Installation

From the GitHub repository (recommended; pure-JS package, no build step needed):

```text
dsh plugin --profile web add github:wct-lab/dsh-docchain
```

Or from a local checkout:

```text
plugin_manager install_bundle target=<absolute path to this directory>
```

## Configuration (required)

No credentials ship in this package. Every script except `doc2markdown` (Node.js) needs a docchain service endpoint and an API key before it can run; `doc2markdown` (Node.js) works with neither — it defaults to the public parsing service and uploads anonymously, while the same config chain can point it at a custom endpoint/key.

| Field | Meaning | Required |
|---|---|---|
| `docchain_url` | docchain service address, e.g. `http://<host>:7100/llmdoc` | Yes |
| `docchain_api_key` | API authentication key | Yes |

Four ways to provide them, in **priority order** (higher wins):

1. Environment variables `DOCCHAIN_URL` and `DOCCHAIN_API_KEY`;
2. per-skill config file `<skill>/scripts/config.json`;
3. the plugin state file `~/.dsh/storages/docchain-config.json` (written by the plugin config — see below);
4. package-level `skills/docchain_config.json` (file-drop distribution fallback; the package ships only `docchain_config.example.json` as a template).

Environment variables outrank everything below them, including the environment selected on the plugin's configuration page — see [Switching between environments](#switching-between-environments).

Config file format (all JSON-based):

```json
{
  "docchain_url": "http://<host>:7100/llmdoc",
  "docchain_api_key": "your-api-key-here"
}
```

All scripts need only Node.js. Invoke them from the skill's base directory as `node scripts/<script>.js …` (see each SKILL.md for parameters).

## Plugin configuration (recommended)

The plugin ships a **configuration page** in the web client: in `dsh web`, open **Plugins** in the sidebar, find the `dsh-docchain` plugin, and use the configure control on its row. The page edits the service URL (saved to the row config and hot-reloaded through the host settings service) and writes the API key to the credential store. The key is write-only: the page never echoes a stored value, only whether one is set.

The plugin follows the official credential pattern. Its Config schema declares:

| Field | Meaning |
|---|---|
| `docchain_url` | Service endpoint; volatile, editable on the configuration page |
| `docchain_api_key_ref` | Credential reference name for the key; default `DOCCHAIN_API_KEY` |
| `docchain_api_key` | Fallback literal key (not recommended; the store wins over it) |
| `docchain_environments` | Saved environments (JSON): name, URL and credential reference per entry; the active entry outranks `docchain_url` |

The key's value lives in the **credential store** `~/.dsh/.credentials.yaml` (`refs:` section, owner-only permissions) — save it through the configuration page or edit the file directly; changes hot-reload. It can also come from the launch environment under the same variable name. On activation, whenever a stored credential changes, and whenever this row's settings are saved, the resolved values are mirrored into `~/.dsh/storages/docchain-config.json` (permissions `0600`): the file is a pure projection of the current resolution, so a cleared config entry disappears from it; the scripts read it on every run.

Key resolution order: credential store (launch env > stored file) > `docchain_api_key` row literal.

The reference name *is* configuration: **leaving `docchain_api_key_ref` unconfigured is a supported state, not a broken one.** The page reports no key and the scripts exit with a configuration error instead of falling back to another reference — a present-but-wrong key queries the wrong account silently, which is far harder to notice than a failure.

To change values, either:

- use the **configuration page** on the Plugins page — edit the service URL and save/update the API key, or
- save/update `DOCCHAIN_API_KEY` in the credential store — takes effect without touching this plugin, or
- edit `~/.dsh/storages/docchain-config.json` directly (takes effect on the next script run; the plugin rewrites it from the resolved config on activation and config changes — for durable overrides use env vars or a per-skill config.json), or
- set `docchain_url` / `docchain_api_key_ref` / `docchain_api_key` in the plugin's config row (patch `config` / preset override) and re-activate the plugin.

## Switching between environments

The configuration page keeps a list of **saved environments**, so pointing the skills at another docchain service no longer means retyping a URL and a key.

- The page shows one row with the environment currently in force. Open it to see the list: pick another, add one, or edit / delete an entry.
- Picking an entry takes effect immediately — no Save press, no restart. The `Save` button below still governs the service URL and API key fields.
- Each environment stores its own URL and its own credential reference, so switching back never asks for the key again. Keys stay in the credential store and are only ever written, never read back.
- Editing the service URL by hand switches the page to **Custom**: the saved list is left untouched, and picking an entry again returns to it.
- Deleting an entry also deletes its credential — unless another environment still uses the same reference, or it is the row's own fallback reference. The entry in force cannot be deleted; switch away first.

Where the data lives:

| What | Where |
|---|---|
| The environment list (name, URL, credential reference) | `config.docchain_environments` in the profile's `cordis.patch.yml` |
| Each environment's key | `refs:` in `~/.dsh/.credentials.yaml`, under `DOCCHAIN_API_KEY__<ID>` |
| The values in force | `~/.dsh/storages/docchain-config.json`, rewritten on every switch |

Two limits worth knowing:

- **An environment variable wins.** Every skill script reads `DOCCHAIN_URL` / `DOCCHAIN_API_KEY` before the projection file, so a value exported at launch silently outranks whatever the page selects. Do not set them if you want the page to be authoritative.
- Two browser tabs editing the same row: the last save wins.

## How it works

The bundle inserts one Host plugin (`dsh-docchain`). At activation it registers a skill provider on `ctx.skills` that serves every `<skills>/<name>/SKILL.md` directory in this package:

- Catalog entries come from each SKILL.md frontmatter (`name`, `description`); bodies are re-read on every load.
- The provider rank is **450** — project roots (`.dsh/skills` = 100, project `.agents/skills` = 200), runtime registrations (250) and `customSkillDirs` (300) keep precedence, as does `~/.dsh/skills` (400); the bundle outranks `~/.agents/skills` (500) and the bundled root (600). In practice: same-name copies in `~/.agents/skills` are shadowed by this bundle; delete them there if you want a single source.

## Skills

### docchain-filename-search — find documents by filename

Locate documents quickly by filename keywords across topics.

**How to use it** — describe the filename keywords you are looking for. You must specify the topic ID(s) when asking.

**Examples:**

- "Find documents whose filename contains 'contract' in topic 112"
- "Search for documents with 'purchase' or 'agreement' in topics 1 and 10"

### docchain-content-search — search document content

Search keywords inside document content; returns the matching line numbers and content. Supports `or` and `and` operators.

**How to use it** — specify the search scope and keywords. You must provide at least one of `doc_ids` or `topic_ids`.

**Examples:**

- "Search for 'contract' in document 123"
- "Search for content containing both 'API' and 'interface' in topics 1 and 2"

### docchain-meta-search — query by metadata fields

Filter documents by custom metadata field conditions — string, number, and time types with exact and range operators.

**How to use it** — describe the filter conditions. You must specify topic ID(s) or document ID(s).

**Examples:**

- "Find documents in topic 112 whose metadata author is Zhang San"
- "Find contracts in topic 113 whose amount field is greater than 1000"

### docchain-topic-info — list topics

Lists the topics in a docchain system with pagination, optionally filtered by a name keyword. Often a first step before other skills: get the topic IDs, then search or upload within a topic.

**How to use it** — just ask what topics exist; optionally give a page number, page size, or a name keyword.

**Examples:**

- "What topics are there?"
- "Show page 2 of the topic list, 10 per page"
- "Find topics whose name contains 'test'"

### docchain-upload — bulk document upload

Uploads a single local file or a whole folder to a given docchain topic, one file at a time, with progress and success/failure counts. Folder scans cover top-level files only (non-recursive).

**How to use it** — provide the file/folder path and the target topic ID (`--topic_id` is required).

**Examples:**

- "Upload ./report.pdf to topic 123"
- "Bulk-upload the documents in ./docs to topic 456"

### doc2markdown — convert documents to Markdown

Uploads a document (docx, doc, pdf, ppt, xlsx, images, epub, mobi and many more) to the docchain parsing service and downloads the converted Markdown next to the source file — either a single `.md` file (`--md`) or a package with images and tables.

**How to use it** — point it at a file path, e.g. "read the content of ./report.pdf" or "convert 合同.docx to Markdown".

**Examples:**

- "Summarize the content of /path/to/report.pdf"
- "Convert 合同.docx to a single Markdown file"

The service URL and API key follow the same config chain as the search scripts, but both are optional: without configuration the public service (`https://lab.hjcloud.com/llmdoc`) is used with anonymous upload.

### deep-research-advanced — multi-subagent deep research

A ReAct orchestrator-style deep-research workflow (pure instructions, no scripts): the main agent probes the topic, splits independent sub-tasks and dispatches them to parallel subagents; each subagent iterates on retrieval, close reading and deduction and returns a sub-report with its reasoning chain; the main agent cross-validates, reviews and **enforces at least two global loops** before deciding to stop. The final report is logic-closed, traceable and low-hallucination.

**When to use** — complex, open-ended questions that need external evidence and logical deduction: industry analysis, market research, competitive analysis, policy interpretation, technology research, trend forecasting. Do not use it for simple Q&A or basic computation.

## Uninstall

Removing the bundle unregisters the provider and its skills:

```text
dsh plugin remove dsh-docchain
```

(or `plugin_manager remove_bundle`).

Uninstalling does not clean up what this plugin wrote: `~/.dsh/storages/docchain-config.json` and any `DOCCHAIN_API_KEY__*` entries in `~/.dsh/.credentials.yaml` stay behind and must be removed by hand.
