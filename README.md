# dsh-docchain

English | [中文](./README.zh-CN.md)

A DSH plugin that bundles docchain document search (filename, content, and metadata) plus a multi-subagent deep-research workflow: install once with `plugin_manager install_bundle` and it works on any machine — no manual copying into `~/.agents/skills` required. Built on docchain.

| Skill | Kind | Description |
|---|---|---|
| `docchain-filename-search` | SKILL.md + Python script | Find documents whose filename matches keywords, across topics |
| `docchain-content-search` | SKILL.md + Python script | Search document content by keyword; returns line numbers and content; `or`/`and` operators |
| `docchain-meta-search` | SKILL.md + Python script | Query documents by custom metadata fields (string/number/time, exact and range) |
| `deep-research-advanced` | SKILL.md only | Orchestrator-style multi-subagent deep research workflow (pure instructions, no scripts) |

## Installation

From the GitHub repository (recommended; pure-JS package, no build step needed):

```text
dsh plugin add github:wct-lab/dsh-docchain
```

Or from a local checkout:

```text
plugin_manager install_bundle target=<absolute path to this directory>
```

## Configuration (required)

No credentials ship in this package. Every Python script needs a docchain service endpoint and an API key before it can run.

| Field | Meaning | Required |
|---|---|---|
| `docchain_url` | docchain service address, e.g. `http://<host>:7100/llmdoc` | Yes |
| `docchain_api_key` | API authentication key | Yes |

Four ways to provide them, in **priority order** (higher wins):

1. Environment variables `DOCCHAIN_URL` and `DOCCHAIN_API_KEY`;
2. per-skill config file `<skill>/scripts/config.json`;
3. the plugin state file `~/.dsh/storages/docchain-config.json` (written by the plugin config — see below);
4. package-level `skills/docchain_config.json` (file-drop distribution fallback; the package ships only `docchain_config.example.json` as a template).

Config file format (all JSON-based):

```json
{
  "docchain_url": "http://<host>:7100/llmdoc",
  "docchain_api_key": "your-api-key-here"
}
```

Scripts require Python 3 with the `requests` package. Invoke them from the skill's base directory as `python3 scripts/<script>.py …` (see each SKILL.md for parameters).

## Plugin configuration (recommended)

The plugin ships a **configuration page** in the web client: in `dsh web`, open **Plugins** in the sidebar, find the `dsh-docchain` plugin, and use the configure control on its row. The page edits the service URL (saved to the row config and hot-reloaded through the host settings service) and writes the API key to the credential store. The key is write-only: the page never echoes a stored value, only whether one is set.

The plugin follows the official credential pattern. Its Config schema declares:

| Field | Meaning |
|---|---|
| `docchain_url` | Service endpoint; volatile, editable on the configuration page |
| `docchain_api_key_ref` | Credential reference name for the key; default `DOCCHAIN_API_KEY` |
| `docchain_api_key` | Fallback literal key (not recommended; the store wins over it) |

The key's value lives in the **credential store** `~/.dsh/.credentials.yaml` (`refs:` section, owner-only permissions) — save it through the configuration page or edit the file directly; changes hot-reload. It can also come from the launch environment under the same variable name. On activation, and again whenever a stored credential changes, the resolved values are materialized into `~/.dsh/storages/docchain-config.json` (permissions `0600`), which the scripts read on every run.

Key resolution order: credential store (launch env > stored file) > `docchain_api_key` row literal > whatever the state file already holds.

To change values, either:

- use the **configuration page** on the Plugins page — edit the service URL and save/update the API key, or
- save/update `DOCCHAIN_API_KEY` in the credential store — takes effect without touching this plugin, or
- edit `~/.dsh/storages/docchain-config.json` directly (takes effect on the next script run), or
- set `docchain_url` / `docchain_api_key_ref` / `docchain_api_key` in the plugin's config row (patch `config` / preset override) and re-activate the plugin.

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

### deep-research-advanced — multi-subagent deep research

A ReAct orchestrator-style deep-research workflow (pure instructions, no scripts): the main agent probes the topic, splits independent sub-tasks and dispatches them to parallel subagents; each subagent iterates on retrieval, close reading and deduction and returns a sub-report with its reasoning chain; the main agent cross-validates, reviews and **enforces at least two global loops** before deciding to stop. The final report is logic-closed, traceable and low-hallucination.

**When to use** — complex, open-ended questions that need external evidence and logical deduction: industry analysis, market research, competitive analysis, policy interpretation, technology research, trend forecasting. Do not use it for simple Q&A or basic computation.

## Uninstall

Removing the bundle unregisters the provider and its skills:

```text
dsh plugin remove dsh-docchain
```

(or `plugin_manager remove_bundle`).
