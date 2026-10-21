// dsh-docchain — browser half: the `dsh-docchain` row's configuration
// page on the dsh web client's Plugins page.
//
// The page renders the form registered under `plugins.row.config` keyed by
// `<package name>#<row id>` (see @deepseek-ai/dsh-client-ui-plugin-manager's
// slot contract). The URL field stages through the shared settings form over
// the host's `dsh-docchain` settings namespace (the row Config's
// `docchain_url` is volatile, which is what puts the row into the settings
// projection). The API key never rides a response: the card writes it to the
// credential store through the `credentials` Remote namespace and only learns
// whether one is configured.
//
// Saved environments live in the row's `docchain_environments` config string
// as `{ version, active, items: [{ id, name, url, keyRef }] }`. They are read
// and written through the same `ConfigFormController` the shared form sits on
// (`configForms.get(entryId)`): `getSnapshot().value` is the whole namespace
// document and `set()` / `mutate()` are the documented write paths, so this
// file never has to stage a field the shared form does not render, and every
// switch gets a boolean back saying whether the host accepted it.
//
// This file follows the compiled shape of official client bundles
// (`window.__ModuleLoader__.load({ id, factory(require) })`); dependencies
// listed in package.json `dsh.client.inject` resolve through the client
// module table at runtime, so this file needs no build step.

window.__ModuleLoader__.load({
	id: "dsh-docchain",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");
		let primitives = require("@deepseek-ai/dsh-client-ui-primitives");

		/** Dictionary namespace owned by this plugin. */
		const NS = "dsh-docchain";
		/** Credential reference the API key is stored under when no environment is active. */
		const KEY_REF = "DOCCHAIN_API_KEY";
		/** Profile entry id the bundle's patch declares; the settings namespace the form stages over. */
		const ROW_ENTRY_ID = "dsh-docchain";
		/** `plugins.row.config` key: `<package name>#<row id>`. */
		const ROW_CONFIG_KEY = "dsh-docchain#dsh-docchain";
		/** Cap on saved environments: the row config is a settings document, not a database. */
		const MAX_ENVIRONMENTS = 10;
		/** Longest accepted environment name. */
		const MAX_NAME = 40;
		/** Longest accepted service URL. */
		const MAX_URL = 500;
		/** How many topics one environment may pre-select (mirrors the host). */
		const MAX_TOPICS = 10;
		/** Topics requested per page from the host route. */
		const TOPIC_PAGE_SIZE = 20;
		/** Same-origin route the host registers for the topic list. */
		const TOPIC_ROUTE = "/plugin/dsh-docchain/topics";
		/** Typing debounce before the topic list is re-requested. */
		const TOPIC_DEBOUNCE_MS = 350;

		/** English copy. */
		const en = {
			description: "Configure the docchain document search service endpoint and its API key.",
			readOnly: "This deployment stores settings read-only.",
			url: "Service URL",
			apiKey: "API key",
			save: "Save",
			environments: "Environments",
			noEnvironment: "No environment selected",
			envConfigured: "Key set",
			envUnconfigured: "No key",
			envEdit: "Edit",
			envDelete: "Delete",
			envAdd: "＋ Add environment",
			envSaveCurrent: "Save the current address as an environment",
			envName: "Name",
			envCancel: "Cancel",
			envConfirmDelete: "The credential {ref} will be deleted too.",
			envConfirm: "Delete",
			envNamePlaceholder: "e.g. Production",
			envKeyPlaceholder: "Leave blank to keep the current key",
			envSwitched: "Switched",
			envSwitchFailed: "Switch failed — the previous environment is kept.",
			envKeyRequired: "Add an API key for this environment first.",
			envInUse: "In use by the current selection — switch to another environment first.",
			envKeySaveFailed: "The API key could not be saved.",
			envDupName: "That name already exists.",
			envTooMany: "At most {max} environments.",
			envBroken: "The environment list cannot be parsed and cannot be managed.",
			envNameRequired: "Enter a name.",
			envNameTooLong: "The name is too long.",
			envUrlInvalid: "The URL must start with http:// or https://.",
			topics: "Topics",
			topicAdd: "Choose topics",
			topicDone: "Done",
			topicEmpty: "No topics selected yet.",
			topicNoEnvironment: "Select an environment first.",
			topicSearchPlaceholder: "Topic id or name keyword…",
			topicTotal: "{total} total",
			topicPage: "Page {page}/{pages}",
			topicPrev: "Previous",
			topicNext: "Next",
			topicLoading: "Loading…",
			topicNoMatch: "No matching topics.",
			topicTooMany: "At most {max} topics.",
			topicRemove: "Remove",
			topicRetry: "Retry",
			topicUrlSuspect: "This URL does not look like the API endpoint."
		};
		/** Simplified Chinese copy. */
		const zh = {
			description: "配置 docchain 文档检索服务的地址与 API Key。",
			readOnly: "本部署的设置为只读。",
			url: "服务地址",
			apiKey: "API Key",
			save: "保存",
			environments: "当前环境",
			noEnvironment: "未选择环境",
			envConfigured: "已配置",
			envUnconfigured: "未配置",
			envEdit: "编辑",
			envDelete: "删除",
			envAdd: "＋ 新增环境",
			envSaveCurrent: "把当前地址保存为环境",
			envName: "名称",
			envCancel: "取消",
			envConfirmDelete: "将同时删除凭据 {ref}。",
			envConfirm: "确认删除",
			envNamePlaceholder: "例如：生产",
			envKeyPlaceholder: "留空则保持现有 Key 不变",
			envSwitched: "已切换",
			envSwitchFailed: "切换失败，仍停留在原来的环境。",
			envKeyRequired: "请先为该环境填写 API Key。",
			envInUse: "正在使用中，请先切换到其他环境。",
			envKeySaveFailed: "API Key 保存失败。",
			envDupName: "该名称已存在。",
			envTooMany: "最多只能保存 {max} 个环境。",
			envBroken: "环境列表无法解析，暂时无法管理。",
			envNameRequired: "请填写名称。",
			envNameTooLong: "名称过长。",
			envUrlInvalid: "地址需以 http:// 或 https:// 开头。",
			topics: "主题",
			topicAdd: "选择主题",
			topicDone: "收起",
			topicEmpty: "还没有选主题。",
			topicNoEnvironment: "请先选择一个环境。",
			topicSearchPlaceholder: "输入 topic_id 或主题名称关键词",
			topicTotal: "共 {total} 个",
			topicPage: "第 {page}/{pages} 页",
			topicPrev: "上一页",
			topicNext: "下一页",
			topicLoading: "加载中…",
			topicNoMatch: "没有匹配的主题。",
			topicTooMany: "最多只能选 {max} 个主题。",
			topicRemove: "移除",
			topicRetry: "重试",
			topicUrlSuspect: "该地址看起来不是接口地址。"
		};

		/** Component-local styles: only theme tokens, so a renamed token degrades rather than breaks. */
		const ENV_STYLES = `
			.dc-page { display: flex; flex-direction: column; gap: 14px; }
			.dc-env { display: flex; flex-direction: column; gap: 6px; }
			.dc-env-label { color: var(--dsw-alias-label-secondary); font-size: 12px; }
			.dc-env-summary { display: flex; align-items: center; gap: 10px; width: 100%;
				padding: 8px 10px; border: 1px solid var(--dsw-alias-border-l1); border-radius: 8px;
				background: var(--dsw-alias-bg-layer-2); color: var(--dsw-alias-label-primary);
				font: inherit; text-align: left; cursor: pointer; }
			.dc-env-summary:hover { border-color: var(--dsw-alias-border-l2); }
			.dc-env-list { display: flex; flex-direction: column; max-height: 260px; overflow: auto;
				border: 1px solid var(--dsw-alias-border-l1); border-radius: 8px;
				background: var(--dsw-alias-bg-layer-1); }
			.dc-env-row { display: flex; align-items: center; gap: 10px; padding: 7px 10px;
				border-bottom: 1px solid var(--dsw-alias-border-l1); }
			.dc-env-row:last-child { border-bottom: none; }
			.dc-env-row[data-active="true"] { background: var(--dsw-alias-bg-layer-2); }
			.dc-env-pick { width: 20px; height: 20px; flex: none; padding: 0; cursor: pointer;
				border: 1px solid var(--dsw-alias-border-l2); border-radius: 50%;
				background: transparent; color: var(--dsw-alias-brand-primary); font-size: 11px;
				line-height: 18px; text-align: center; }
			.dc-env-row[data-active="true"] .dc-env-pick { border-color: var(--dsw-alias-brand-primary); }
			.dc-env-name { flex: none; max-width: 30%; overflow: hidden; text-overflow: ellipsis;
				white-space: nowrap; color: var(--dsw-alias-label-primary); font-weight: 500; }
			.dc-env-url { flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis;
				white-space: nowrap; color: var(--dsw-alias-label-secondary); font-size: 12px; }
			.dc-env-muted { flex: none; color: var(--dsw-alias-label-secondary); font-size: 12px; }
			.dc-env-warn { padding: 0 10px; color: var(--dsw-alias-state-warn-primary); font-size: 12px; }
			.dc-env-ok { flex: none; color: var(--dsw-alias-state-success-primary); font-size: 12px; }
			.dc-env-caret { flex: none; color: var(--dsw-alias-label-secondary); font-size: 11px; }
			.dc-env-actions { flex: none; display: flex; gap: 6px; }
			.dc-env-btn { padding: 2px 8px; border: 1px solid var(--dsw-alias-border-l1); border-radius: 6px;
				background: transparent; color: var(--dsw-alias-label-primary); font: inherit;
				font-size: 12px; cursor: pointer; }
			.dc-env-btn:hover { border-color: var(--dsw-alias-border-l2); }
			.dc-env-primary { border-color: var(--dsw-alias-brand-primary); color: var(--dsw-alias-brand-primary); }
			.dc-env-danger { border-color: var(--dsw-alias-state-error-primary); color: var(--dsw-alias-state-error-primary); }
			.dc-env-add { margin: 8px 10px; padding: 6px 10px; border: 1px dashed var(--dsw-alias-border-l2);
				border-radius: 8px; background: transparent; color: var(--dsw-alias-label-secondary);
				font: inherit; font-size: 12px; cursor: pointer; }
			.dc-env-add:hover { color: var(--dsw-alias-brand-primary); border-color: var(--dsw-alias-brand-primary); }
			.dc-env-form { display: flex; flex-direction: column; gap: 8px; padding: 10px;
				border-bottom: 1px solid var(--dsw-alias-border-l1); }
			.dc-env-field { display: flex; align-items: center; gap: 8px; font-size: 12px;
				color: var(--dsw-alias-label-secondary); }
			.dc-env-field > span { flex: none; width: 64px; }
			.dc-env-field > input { flex: 1 1 auto; min-width: 0; padding: 4px 6px;
				border: 1px solid var(--dsw-alias-border-l1); border-radius: 6px;
				background: var(--dsw-alias-bg-base); color: var(--dsw-alias-label-primary); font: inherit; }
			.dc-env-form .dc-env-actions { justify-content: flex-end; }
			.dc-topic { display: flex; flex-direction: column; gap: 6px; margin-top: 14px; }
			.dc-topic-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
			.dc-topic-label { color: var(--dsw-alias-label-secondary); font-size: 12px; }
			.dc-topic-count { margin-left: 6px; color: var(--dsw-alias-label-secondary); font-size: 12px; }
			.dc-topic-chips { display: flex; flex-wrap: wrap; gap: 6px; }
			.dc-topic-chip { display: inline-flex; align-items: center; gap: 6px; max-width: 100%;
				padding: 3px 8px; border: 1px solid var(--dsw-alias-border-l1); border-radius: 999px;
				background: var(--dsw-alias-bg-layer-2); color: var(--dsw-alias-label-primary); font-size: 12px; }
			.dc-topic-x { padding: 0 2px; border: none; background: transparent; cursor: pointer;
				color: var(--dsw-alias-label-secondary); font: inherit; font-size: 12px; }
			.dc-topic-x:hover { color: var(--dsw-alias-state-error-primary); }
			.dc-topic-muted { color: var(--dsw-alias-label-secondary); font-size: 12px; }
			.dc-topic-picker { display: flex; flex-direction: column; gap: 6px; padding: 8px;
				border: 1px solid var(--dsw-alias-border-l1); border-radius: 8px;
				background: var(--dsw-alias-bg-layer-1); }
			.dc-topic-search { display: flex; align-items: center; gap: 8px; }
			.dc-topic-search > input { flex: 1 1 auto; min-width: 0; padding: 4px 6px;
				border: 1px solid var(--dsw-alias-border-l1); border-radius: 6px;
				background: var(--dsw-alias-bg-base); color: var(--dsw-alias-label-primary); font: inherit; }
			.dc-topic-list { display: flex; flex-direction: column; max-height: 240px; overflow: auto;
				border-top: 1px solid var(--dsw-alias-border-l1); }
			.dc-topic-pick { display: flex; flex: 1 1 auto; align-items: center; gap: 8px;
				min-width: 0; padding: 5px 2px; cursor: pointer;
				border-bottom: 1px solid var(--dsw-alias-border-l1); }
			.dc-topic-id { flex: none; width: 64px; color: var(--dsw-alias-label-secondary);
				font-size: 12px; font-variant-numeric: tabular-nums; }
			.dc-topic-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
				color: var(--dsw-alias-label-primary); font-size: 12px; }
			.dc-topic-pager { display: flex; align-items: center; justify-content: flex-end; gap: 8px; }
		`;

		/** Interpolate `{name}` placeholders in one dictionary string. */
		function fill(template, vars) {
			return String(template ?? "").replace(/\{(\w+)\}/g, (whole, key) =>
				vars && Object.prototype.hasOwnProperty.call(vars, key) ? String(vars[key]) : whole,
			);
		}

		/**
		 * Whether a service URL looks like a browser landing page rather than the
		 * API base. A pasted `/login?redirect=…` address is the most common reason
		 * a topic list comes back empty, and the failure otherwise reads like a
		 * server problem.
		 */
		function looksLikeNonApiUrl(url) {
			const text = String(url ?? "");
			return /\/login\b/i.test(text) || text.includes("?");
		}

		/**
		 * Normalize one environment's pre-selected topics.
		 *
		 * Same rules as the host: an entry needs a positive integer id and a
		 * non-empty name, duplicates and overflow are dropped rather than
		 * rejected, and a stray entry must not take the environment down with it.
		 * @param raw - the stored `topics` value.
		 * @returns `[{ id, name }]`.
		 */
		function normalizeTopics(raw) {
			if (!Array.isArray(raw)) return [];
			const seen = new Set();
			const topics = [];
			for (const item of raw) {
				if (!item || typeof item !== "object") continue;
				const id = Number(item.id);
				if (!Number.isInteger(id) || id <= 0 || seen.has(id)) continue;
				const name = typeof item.name === "string" ? item.name.trim() : "";
				if (!name) continue;
				seen.add(id);
				topics.push({ id, name });
				if (topics.length >= MAX_TOPICS) break;
			}
			return topics;
		}

		/**
		 * Parse the `docchain_environments` config string.
		 * A malformed payload reads as "no environments" plus a `broken` flag: it
		 * must never look like an empty list, which would hide the user's data.
		 * @param text - the raw config string.
		 * @returns `{ active, items, broken }`.
		 */
		function parseEnvironments(text) {
			const empty = { active: "", items: [], broken: false };
			if (!text) return empty;
			let data;
			try {
				data = JSON.parse(text);
			} catch {
				return { ...empty, broken: true };
			}
			if (!data || typeof data !== "object" || Array.isArray(data) || !Array.isArray(data.items)) {
				return { ...empty, broken: true };
			}
			const items = [];
			for (const item of data.items) {
				if (!item || typeof item !== "object") continue;
				if (typeof item.id !== "string" || !item.id) continue;
				if (typeof item.url !== "string" || !/^https?:\/\//i.test(item.url)) continue;
				items.push({
					id: item.id,
					name: typeof item.name === "string" && item.name ? item.name : item.id,
					url: item.url,
					keyRef: typeof item.keyRef === "string" && item.keyRef ? item.keyRef : KEY_REF,
					topics: normalizeTopics(item.topics),
				});
			}
			return { active: typeof data.active === "string" ? data.active : "", items, broken: false };
		}

		/** A credential-safe slug: lowercase ASCII letters, digits and single hyphens. */
		function slugify(text) {
			return String(text)
				.toLowerCase()
				.replace(/[^a-z0-9]+/g, "-")
				.replace(/^-+|-+$/g, "");
		}

		/**
		 * The readable part of an environment id.
		 *
		 * A Chinese (or otherwise non-ASCII) name has no ASCII slug, so fall back
		 * to the URL's host and port: the resulting credential reference
		 * (`DOCCHAIN_API_KEY__10_10_185_13_7100`) still says which machine it
		 * belongs to, which is what matters when it is read out of
		 * `~/.dsh/.credentials.yaml` by hand.
		 */
		function idBase(name, url) {
			const fromName = slugify(name);
			if (fromName) return fromName;
			try {
				const fromHost = slugify(new URL(url).host.replace(/:/g, "-"));
				if (fromHost) return fromHost;
			} catch {
				// not a parseable URL; fall through to the generic base
			}
			return "env";
		}

		/** A unique environment id derived from its name, or from its URL host. */
		function uniqueId(name, url, items) {
			const base = idBase(name, url);
			let candidate = base;
			let index = 2;
			while (items.some((item) => item.id === candidate)) {
				candidate = `${base}-${index}`;
				index += 1;
			}
			return candidate;
		}

		/** The credential reference an environment id owns. */
		function refForId(id) {
			return `DOCCHAIN_API_KEY__${String(id).toUpperCase().replace(/[^A-Z0-9_]/g, "_")}`;
		}

		/**
		 * Bridges the row's settings form, the saved environments, and the
		 * credential store onto the page's staged form.
		 *
		 * Config reads and environment writes go through the shared
		 * `ConfigFormController` the form already sits on, so switching is one
		 * accepted-or-refused write instead of a staged field the shared form
		 * would have to render.
		 */
		var DocchainCardController = class {
			/** Refs the credential store reports as configured; unknown until the first describe settles. */
			known = false;
			refsConfigured = new Set();
			/** View-only state: never written to the config document. */
			expanded = false;
			pending = null;
			notice = "";
			rowError = "";
			busy = false;
			noticeTimer = null;
			store;
			form;
			/** Signature of the reference set last described; guards redundant credential reads. */
			refsSignature = "";
			unsubscribeScope;
			/** Topic-list view state: view-only, never written to the config document. */
			topicPicker = false;
			topicQuery = "";
			topicPage = 1;
			topicTotal = 0;
			topicItems = [];
			topicLoading = false;
			topicError = "";
			topicLoaded = false;
			topicTimer = null;

			/**
			 * @param scope - the shared configuration form (a `ConfigFormController`) of the `dsh-docchain` entry.
			 * @param ctx - the browser plugin context, whose `remote.credentials` namespace carries the key writes.
			 * @param t - the page's locale reader.
			 */
			constructor(scope, ctx, t) {
				this.ctx = ctx;
				this.scope = scope;
				this.t = t;
				this.form = new primitives.SettingsFormModel(scope, [
					primitives.settingsTextField("docchain_url")
				], [{
					field: "docchain_api_key",
					write: (text) => this.storeKey(text)
				}]);
				this.store = this.form.bind(() => this.projection());
				this.refsSignature = "";
				this.unsubscribeScope = typeof scope?.subscribe === "function"
					? scope.subscribe(() => this.syncRefs())
					: undefined;
				this.syncRefs();
			}

			/** One dictionary string with its `{name}` placeholders filled. */
			text(key, vars) {
				return fill(this.t(key), vars);
			}

			/** The live row-config object from the settings mirror. */
			configValue() {
				const value = this.scope?.getSnapshot?.()?.value;
				return value && typeof value === "object" ? value : {};
			}

			/** One config field as a trimmed string. */
			configString(name) {
				const value = this.configValue()[name];
				return typeof value === "string" ? value.trim() : "";
			}

			/** Saved environments, parsed. */
			environments() {
				return parseEnvironments(this.configString("docchain_environments"));
			}

			/** The environment the row currently points at. */
			activeEnvironment() {
				const envs = this.environments();
				return envs.items.find((item) => item.id === envs.active);
			}

			/** The reference an API-key write should target right now. */
			targetKeyRef() {
				const active = this.activeEnvironment();
				return active ? active.keyRef : this.configString("docchain_api_key_ref") || KEY_REF;
			}

			/** The URL the skill scripts are using right now. */
			effectiveUrl() {
				const active = this.activeEnvironment();
				return active ? active.url : this.configString("docchain_url");
			}

			projection() {
				const envs = this.environments();
				const active = this.activeEnvironment();
				const envKeyStates = {};
				for (const item of envs.items) envKeyStates[item.keyRef] = this.refsConfigured.has(item.keyRef);
				return {
					...this.form.shell(),
					environments: envs.items,
					broken: envs.broken,
					activeId: active ? active.id : "",
					activeName: active ? active.name : "",
					envKeyStates,
					topics: active ? active.topics : [],
					topicPicker: this.topicPicker,
					topicQuery: this.topicQuery,
					topicPage: this.topicPage,
					topicTotal: this.topicTotal,
					topicPages: Math.max(1, Math.ceil(this.topicTotal / TOPIC_PAGE_SIZE)),
					topicItems: this.topicItems,
					topicLoading: this.topicLoading,
					topicError: this.topicError,
					effectiveUrl: active ? active.url : this.configString("docchain_url"),
					expanded: this.expanded,
					pending: this.pending,
					notice: this.notice,
					rowError: this.rowError,
					busy: this.busy
				};
			}

			/**
			 * Build the face the page's slot registration injects.
			 * @returns the page's snapshot and its actions.
			 */
			inject() {
				return {
					hooks: { docchainCard: this.store },
					...this.form.actions(),
					toggleEnvironments: () => this.toggleEnvironments(),
					beginAdd: () => this.beginAdd(),
					beginAddFromCurrent: () => this.beginAddFromCurrent(),
					beginEdit: (id) => this.beginEdit(id),
					beginDelete: (id) => this.beginDelete(id),
					cancelPending: () => this.cancelPending(),
					submitPending: (draft) => this.submitPending(draft),
					confirmDelete: (id) => this.confirmDelete(id),
					selectEnvironment: (id) => this.selectEnvironment(id),
					toggleTopics: () => this.toggleTopics(),
					setTopicQuery: (text) => this.setTopicQuery(text),
					topicPageStep: (delta) => this.topicPageStep(delta),
					toggleTopic: (id, name) => this.toggleTopic(id, name),
					reloadTopics: () => this.loadTopics(this.topicQuery, this.topicPage)
				};
			}

			/** The credential references this page currently cares about. */
			refs() {
				return [...new Set([
					this.configString("docchain_api_key_ref") || KEY_REF,
					...this.environments().items.map((item) => item.keyRef)
				])];
			}

			/**
			 * Re-describe the credentials when — and only when — the reference set
			 * changed. The environment list arrives with the settings document,
			 * after this controller is built, so without this a freshly loaded page
			 * would report every environment as having no key and then refuse to
			 * switch to a perfectly usable one.
			 */
			syncRefs() {
				const refs = this.refs();
				const signature = refs.join("|");
				if (signature === this.refsSignature) return;
				this.refsSignature = signature;
				this.refreshKeyState(refs);
			}

			/** Ask the Host which references hold a key; the answer never carries a value. */
			async refreshKeyState(refs = this.refs()) {
				const unique = [...new Set(refs)];
				this.refsSignature = unique.join("|");
				try {
					const response = await this.ctx.remote.credentials.describe(unique);
					if (response.ok) {
						this.known = true;
						this.refsConfigured = new Set(unique.filter((ref) => response.value?.[ref]?.configured));
						this.publish();
					}
				} catch {
					// keep the last known state
				}
			}

			/**
			 * Store one key in the credential store; the value crosses the wire in
			 * this direction only.
			 * @param text - the non-empty staged key.
			 * @returns whether the Host accepted the write.
			 */
			async storeKey(text) {
				return this.setKey(this.targetKeyRef(), text);
			}

			/** Store one key under an explicit reference. */
			async setKey(ref, text) {
				try {
					const response = await this.ctx.remote.credentials.set(ref, text);
					if (response.ok) {
						this.known = true;
						this.refsConfigured.add(ref);
						this.publish();
						return true;
					}
				} catch {
					// report as a refused save
				}
				return false;
			}

			/** Re-project after an out-of-form state change. */
			publish() {
				this.store.set(this.projection());
			}

			/** Show a transient success line, then clear it. */
			flash(text) {
				this.notice = text;
				if (this.noticeTimer) clearTimeout(this.noticeTimer);
				this.noticeTimer = setTimeout(() => {
					this.noticeTimer = null;
					this.notice = "";
					this.publish();
				}, 1600);
				this.publish();
			}

			toggleEnvironments() {
				this.expanded = !this.expanded;
				if (!this.expanded) this.pending = null;
				this.rowError = "";
				this.publish();
			}

			beginAdd() {
				this.pending = { kind: "add", seed: { name: "", url: "", key: "" } };
				this.rowError = "";
				this.publish();
			}

			beginAddFromCurrent() {
				this.pending = {
					kind: "add",
					seed: {
						name: "",
						url: this.configString("docchain_url"),
						key: "",
						reuseKeyRef: true
					}
				};
				this.rowError = "";
				this.publish();
			}

			beginEdit(id) {
				this.pending = { kind: "edit", id };
				this.rowError = "";
				this.publish();
			}

			beginDelete(id) {
				this.pending = { kind: "delete", id };
				this.rowError = "";
				this.publish();
			}

			cancelPending() {
				this.pending = null;
				this.rowError = "";
				this.publish();
			}

			/**
			 * Apply one ordered settings mutation.
			 *
			 * Writing the environments list and the effective URL together keeps
			 * the host's "environment wins unless the URL was hand-edited" rule and
			 * the page's own display in agreement after every action.
			 */
			async writeEnvironments(next, url) {
				// Persist only the documented shape: `broken` and any other derived
				// reader state must never leak into the config document.
				const payload = {
					version: 1,
					active: typeof next?.active === "string" ? next.active : "",
					items: Array.isArray(next?.items) ? next.items : []
				};
				const ops = [{ op: "set", path: ["docchain_environments"], value: JSON.stringify(payload) }];
				if (typeof url === "string") ops.push({ op: "set", path: ["docchain_url"], value: url });
				this.busy = true;
				this.publish();
				try {
					return Boolean(await this.scope?.mutate?.(ops));
				} catch {
					return false;
				} finally {
					this.busy = false;
					this.publish();
				}
			}

			/** Validate one draft; returns a message key or null. */
			validate(draft, envs, editingId) {
				const name = draft.name.trim();
				const url = draft.url.trim();
				if (!name) return "envNameRequired";
				if (name.length > MAX_NAME) return "envNameTooLong";
				if (!/^https?:\/\/\S+$/i.test(url) || url.length > MAX_URL) return "envUrlInvalid";
				if (envs.items.some((item) => item.id !== editingId && item.name === name)) return "envDupName";
				if (!editingId && envs.items.length >= MAX_ENVIRONMENTS) return "envTooMany";
				return null;
			}

			/** Submit whichever inline form is open. */
			async submitPending(draft) {
				if (this.busy || !this.pending) return;
				if (this.pending.kind === "add") return this.addEnvironment(draft);
				if (this.pending.kind === "edit") return this.editEnvironment(this.pending.id, draft);
			}

			async addEnvironment(draft) {
				const envs = this.environments();
				const problem = this.validate(draft, envs, "");
				if (problem) {
					this.rowError = this.text(problem, { max: MAX_ENVIRONMENTS });
					this.publish();
					return;
				}
				const name = draft.name.trim();
				const url = draft.url.trim();
				const id = uniqueId(name, url, envs.items);
				// "Save the current address as an environment" must keep working: it
				// adopts the reference the row already uses, so the stored key applies
				// to the new entry instead of showing up as unconfigured.
				const keyRef = draft.reuseKeyRef ? (this.configString("docchain_api_key_ref") || KEY_REF) : refForId(id);
				if (draft.key.trim() && !await this.setKey(keyRef, draft.key.trim())) {
					this.rowError = this.t("envKeySaveFailed");
					this.publish();
					return;
				}
				// Only take effect when the entry can actually be used: an environment
				// without a key would switch the scripts onto a broken configuration.
				const usable = Boolean(draft.key.trim()) || this.refsConfigured.has(keyRef);
				const next = {
					...envs,
					active: usable ? id : envs.active,
					items: [...envs.items, { id, name, url, keyRef }]
				};
				if (!await this.writeEnvironments(next, usable ? url : undefined)) {
					this.rowError = this.t("envSwitchFailed");
					this.publish();
					return;
				}
				this.pending = null;
				this.rowError = "";
				this.expanded = false;
				this.resetTopicState();
				if (usable) this.flash(this.t("envSwitched"));
				await this.refreshKeyState();
			}

			async editEnvironment(id, draft) {
				const envs = this.environments();
				const target = envs.items.find((item) => item.id === id);
				if (!target) return;
				const problem = this.validate(draft, envs, id);
				if (problem) {
					this.rowError = this.text(problem, { max: MAX_ENVIRONMENTS });
					this.publish();
					return;
				}
				const name = draft.name.trim();
				const url = draft.url.trim();
				if (draft.key.trim() && !await this.setKey(target.keyRef, draft.key.trim())) {
					this.rowError = this.t("envKeySaveFailed");
					this.publish();
					return;
				}
				const items = envs.items.map((item) => (item.id === id ? { ...item, name, url } : item));
				const isActive = envs.active === id;
				if (!await this.writeEnvironments({ ...envs, items }, isActive ? url : undefined)) {
					this.rowError = this.t("envSwitchFailed");
					this.publish();
					return;
				}
				this.pending = null;
				this.rowError = "";
				await this.refreshKeyState();
			}

			async confirmDelete(id) {
				if (this.busy) return;
				const envs = this.environments();
				const target = envs.items.find((item) => item.id === id);
				if (!target) return;
				const effective = this.activeEnvironment();
				if (effective && effective.id === id) {
					this.rowError = this.t("envInUse");
					this.pending = null;
					this.publish();
					return;
				}
				const items = envs.items.filter((item) => item.id !== id);
				// A stale `active` pointing at the removed id must not outlive it.
				const next = { ...envs, items, active: envs.active === id ? "" : envs.active };
				if (!await this.writeEnvironments(next)) {
					this.rowError = this.t("envSwitchFailed");
					this.publish();
					return;
				}
				// Cascade the credential, but never one still in use: another
				// environment may share the reference, and the row's own fallback
				// reference is not this environment's to delete.
				const stillUsed = items.some((item) => item.keyRef === target.keyRef);
				const fallback = this.configString("docchain_api_key_ref") || KEY_REF;
				if (!stillUsed && target.keyRef !== fallback) {
					try {
						await this.ctx.remote.credentials.unset(target.keyRef);
						this.refsConfigured.delete(target.keyRef);
					} catch {
						// a failed cleanup must not break the removal itself
					}
				}
				this.pending = null;
				this.rowError = "";
				await this.refreshKeyState();
			}

			async selectEnvironment(id) {
				if (this.busy) return;
				const envs = this.environments();
				const target = envs.items.find((item) => item.id === id);
				if (!target) return;
				if (!this.refsConfigured.has(target.keyRef)) {
					this.rowError = this.t("envKeyRequired");
					this.publish();
					return;
				}
				if (!await this.writeEnvironments({ ...envs, active: id }, target.url)) {
					this.rowError = this.t("envSwitchFailed");
					this.publish();
					return;
				}
				this.pending = null;
				this.rowError = "";
				this.expanded = false;
				this.resetTopicState();
				this.flash(this.t("envSwitched"));
			}

			/** Show or hide the topic picker. Every open starts from an empty search. */
			toggleTopics() {
				this.topicPicker = !this.topicPicker;
				// The previous query belongs to a search the user already finished;
				// reopening on that stale term looks like a filter they never set.
				this.resetTopicQuery();
				if (this.topicPicker) {
					this.loadTopics("", 1);
					return;
				}
				this.publish();
			}

			/** Forget the current search term and its results. */
			resetTopicQuery() {
				if (this.topicTimer) {
					clearTimeout(this.topicTimer);
					this.topicTimer = null;
				}
				this.topicQuery = "";
				this.topicPage = 1;
				this.topicTotal = 0;
				this.topicItems = [];
				this.topicError = "";
				this.topicLoaded = false;
			}

			/** Stage a search term and re-query once the typing settles. */
			setTopicQuery(text) {
				this.topicQuery = text;
				this.publish();
				if (this.topicTimer) clearTimeout(this.topicTimer);
				this.topicTimer = setTimeout(() => {
					this.topicTimer = null;
					this.loadTopics(this.topicQuery, 1);
				}, TOPIC_DEBOUNCE_MS);
			}

			/** Ask the host route for one page of the active environment's topics. */
			async loadTopics(keyword, page) {
				this.topicLoading = true;
				this.topicError = "";
				this.topicPage = page;
				this.publish();
				try {
					const params = new URLSearchParams({
						keyword: keyword ?? "",
						page: String(page),
						size: String(TOPIC_PAGE_SIZE),
					});
					const response = await fetch(`${TOPIC_ROUTE}?${params.toString()}`, {
						headers: { accept: "application/json" },
					});
					const body = await response.json().catch(() => null);
					if (!response.ok || !body || body.ok !== true) {
						this.topicItems = [];
						this.topicTotal = 0;
						this.topicError = body?.error || `HTTP ${response.status}`;
					} else {
						this.topicItems = Array.isArray(body.items) ? body.items : [];
						this.topicTotal = Number(body.total) || 0;
						this.topicLoaded = true;
					}
				} catch (error) {
					this.topicItems = [];
					this.topicTotal = 0;
					this.topicError = error instanceof Error ? error.message : String(error);
				} finally {
					this.topicLoading = false;
					this.publish();
				}
			}

			/** Move one page in either direction. */
			topicPageStep(delta) {
				const pages = Math.max(1, Math.ceil(this.topicTotal / TOPIC_PAGE_SIZE));
				const next = Math.min(pages, Math.max(1, this.topicPage + delta));
				if (next === this.topicPage) return;
				this.loadTopics(this.topicQuery, next);
			}

			/** Add or remove one topic on the active environment. */
			async toggleTopic(id, name) {
				if (this.busy) return;
				const envs = this.environments();
				const target = envs.items.find((item) => item.id === envs.active);
				if (!target) return;
				let topics;
				if (target.topics.some((topic) => topic.id === id)) {
					topics = target.topics.filter((topic) => topic.id !== id);
				} else {
					if (target.topics.length >= MAX_TOPICS) {
						this.rowError = this.text("topicTooMany", { max: MAX_TOPICS });
						this.publish();
						return;
					}
					topics = [...target.topics, { id, name }];
				}
				const items = envs.items.map((item) => (item.id === target.id ? { ...item, topics } : item));
				if (!await this.writeEnvironments({ ...envs, items })) {
					this.rowError = this.t("envSwitchFailed");
					this.publish();
					return;
				}
				this.rowError = "";
				this.publish();
			}

			/** Drop the topic list state: it belongs to the environment that was active. */
			resetTopicState() {
				this.resetTopicQuery();
				this.topicPicker = false;
			}

			/** Release the form subscription and the transient timer. */
			dispose() {
				if (this.noticeTimer) {
					clearTimeout(this.noticeTimer);
					this.noticeTimer = null;
				}
				if (this.topicTimer) {
					clearTimeout(this.topicTimer);
					this.topicTimer = null;
				}
				this.unsubscribeScope?.();
				this.unsubscribeScope = undefined;
				this.form.dispose();
			}
		};

		/** The environments block: one summary row that expands into the saved list. */
		function EnvironmentSection(props) {
			const { t } = props;
			const state = props.useDocchainCard((snapshot) => snapshot);
			const [draft, setDraft] = react.useState({ name: "", url: "", key: "" });
			const pendingKey = state.pending ? `${state.pending.kind}:${state.pending.id ?? ""}` : "none";

			react.useEffect(() => {
				if (!state.pending) return;
				if (state.pending.kind === "add") {
					setDraft(state.pending.seed ?? { name: "", url: "", key: "" });
					return;
				}
				if (state.pending.kind === "edit") {
					const target = state.environments.find((item) => item.id === state.pending.id);
					if (target) setDraft({ name: target.name, url: target.url, key: "" });
				}
			}, [pendingKey]);

			react.useEffect(() => {
				if (!state.expanded) return undefined;
				const onKeyDown = (event) => {
					if (event.key === "Escape") props.cancelPending();
				};
				window.addEventListener("keydown", onKeyDown);
				return () => window.removeEventListener("keydown", onKeyDown);
			}, [state.expanded, pendingKey]);

			const current = state.environments.find((item) => item.id === state.activeId);
			const summaryName = current ? current.name : t("noEnvironment");
			const summaryUrl = current ? current.url : state.effectiveUrl;
			const summaryKey = current
				? (state.envKeyStates[current.keyRef] ? t("envConfigured") : t("envUnconfigured"))
				: "";

			const summary = react.createElement("button", {
				type: "button",
				className: "dc-env-summary",
				"data-expanded": String(state.expanded),
				title: summaryUrl || "",
				onClick: () => props.toggleEnvironments()
			},
				react.createElement("span", { className: "dc-env-name" }, summaryName),
				react.createElement("span", { className: "dc-env-url" }, summaryUrl || "—"),
				looksLikeNonApiUrl(summaryUrl)
					? react.createElement("span", { className: "dc-env-warn", title: t("topicUrlSuspect") }, "⚠")
					: null,
				state.notice
					? react.createElement("span", { className: "dc-env-ok" }, `✓ ${state.notice}`)
					: (summaryKey ? react.createElement("span", { className: "dc-env-muted" }, summaryKey) : null),
				react.createElement("span", { className: "dc-env-caret" }, state.expanded ? "▴" : "▾")
			);

			const form = react.createElement("div", { className: "dc-env-form" },
				react.createElement("label", { className: "dc-env-field" },
					react.createElement("span", null, t("envName")),
					react.createElement("input", {
						value: draft.name,
						placeholder: t("envNamePlaceholder"),
						onChange: (event) => setDraft({ ...draft, name: event.target.value })
					})
				),
				react.createElement("label", { className: "dc-env-field" },
					react.createElement("span", null, t("url")),
					react.createElement("input", {
						value: draft.url,
						placeholder: "http://host:7100/llmdoc",
						onChange: (event) => setDraft({ ...draft, url: event.target.value })
					})
				),
				react.createElement("label", { className: "dc-env-field" },
					react.createElement("span", null, t("apiKey")),
					react.createElement("input", {
						type: "password",
						value: draft.key,
						placeholder: state.pending && state.pending.kind === "edit" ? t("envKeyPlaceholder") : "",
						onChange: (event) => setDraft({ ...draft, key: event.target.value })
					})
				),
				react.createElement("div", { className: "dc-env-actions" },
					react.createElement("button", {
						type: "button",
						className: "dc-env-btn",
						onClick: () => props.cancelPending()
					}, t("envCancel")),
					react.createElement("button", {
						type: "button",
						className: "dc-env-btn dc-env-primary",
						onClick: () => props.submitPending(draft)
					}, t("save"))
				)
			);

			const rows = [];
			for (const item of state.environments) {
				if (state.pending && state.pending.kind === "edit" && state.pending.id === item.id) {
					rows.push(react.createElement("div", { key: `${item.id}-form` }, form));
					continue;
				}
				if (state.pending && state.pending.kind === "delete" && state.pending.id === item.id) {
					rows.push(react.createElement("div", { key: item.id, className: "dc-env-row" },
						react.createElement("span", { className: "dc-env-name" }, item.name),
						react.createElement("span", { className: "dc-env-url" }, fill(t("envConfirmDelete"), { ref: item.keyRef })),
						react.createElement("div", { className: "dc-env-actions" },
							react.createElement("button", {
								type: "button",
								className: "dc-env-btn",
								onClick: () => props.cancelPending()
							}, t("envCancel")),
							react.createElement("button", {
								type: "button",
								className: "dc-env-btn dc-env-danger",
								onClick: () => props.confirmDelete(item.id)
							}, t("envConfirm"))
						)
					));
					continue;
				}
				const active = item.id === state.activeId;
				const keyed = Boolean(state.envKeyStates[item.keyRef]);
				rows.push(react.createElement("div", {
					key: item.id,
					className: "dc-env-row",
					"data-active": String(active)
				},
					react.createElement("button", {
						type: "button",
						className: "dc-env-pick",
						title: keyed ? item.url : t("envKeyRequired"),
						onClick: () => props.selectEnvironment(item.id)
					}, active ? "✓" : ""),
					react.createElement("span", { className: "dc-env-name" }, item.name),
					react.createElement("span", { className: "dc-env-url" }, item.url),
					looksLikeNonApiUrl(item.url)
						? react.createElement("span", { className: "dc-env-warn", title: t("topicUrlSuspect") }, "⚠")
						: null,
					react.createElement("span", { className: keyed ? "dc-env-muted" : "dc-env-warn" },
						keyed ? t("envConfigured") : t("envUnconfigured")),
					react.createElement("div", { className: "dc-env-actions" },
						react.createElement("button", {
							type: "button",
							className: "dc-env-btn",
							onClick: () => props.beginEdit(item.id)
						}, t("envEdit")),
						react.createElement("button", {
							type: "button",
							className: "dc-env-btn",
							onClick: () => props.beginDelete(item.id)
						}, t("envDelete"))
					)
				));
			}

			const list = state.expanded
				? react.createElement("div", { className: "dc-env-list" },
					state.broken ? react.createElement("div", { className: "dc-env-warn" }, t("envBroken")) : null,
					rows,
					state.pending && state.pending.kind === "add" ? form : null,
					state.rowError ? react.createElement("div", { className: "dc-env-warn" }, state.rowError) : null,
					state.pending
						? null
						: react.createElement("button", {
							type: "button",
							className: "dc-env-add",
							onClick: () => props.beginAdd()
						}, t("envAdd")),
					!state.pending && !state.environments.length && state.effectiveUrl
						? react.createElement("button", {
							type: "button",
							className: "dc-env-add",
							onClick: () => props.beginAddFromCurrent()
						}, t("envSaveCurrent"))
						: null
				)
				: null;

			return react.createElement("div", { className: "dc-env" },
				react.createElement("style", null, ENV_STYLES),
				react.createElement("div", { className: "dc-env-label" }, t("environments")),
				summary,
				list
			);
		}

		/** The topics block: selected chips plus a searchable picker for the active environment. */
		function TopicSection(props) {
			const { t } = props;
			const state = props.useDocchainCard((snapshot) => snapshot);
			const hasEnvironment = Boolean(state.activeId);
			const selected = state.topics ?? [];
			const selectedIds = new Set(selected.map((topic) => topic.id));

			const header = react.createElement("div", { className: "dc-topic-head" },
				react.createElement("span", { className: "dc-topic-label" }, t("topics"),
					react.createElement("span", { className: "dc-topic-count" }, `${selected.length}/${MAX_TOPICS}`)),
				hasEnvironment
					? react.createElement("button", {
						type: "button",
						className: "dc-env-btn",
						onClick: () => props.toggleTopics()
					}, state.topicPicker ? t("topicDone") : t("topicAdd"))
					: null
			);

			const chips = selected.length
				? react.createElement("div", { className: "dc-topic-chips" },
					selected.map((topic) => react.createElement("span", {
						key: topic.id,
						className: "dc-topic-chip",
						title: `topic_id=${topic.id}`
					},
						`${topic.id}  ${topic.name}`,
						react.createElement("button", {
							type: "button",
							className: "dc-topic-x",
							title: t("topicRemove"),
							onClick: () => props.toggleTopic(topic.id, topic.name)
						}, "×")
					)))
				: react.createElement("div", { className: "dc-topic-muted" },
					hasEnvironment ? t("topicEmpty") : t("topicNoEnvironment"));

			let picker = null;
			if (state.topicPicker && hasEnvironment) {
				const rows = state.topicItems.map((item) => react.createElement("label", {
					key: item.id,
					className: "dc-topic-pick"
				},
					react.createElement("input", {
						type: "checkbox",
						checked: selectedIds.has(item.id),
						onChange: () => props.toggleTopic(item.id, item.name)
					}),
					react.createElement("span", { className: "dc-topic-id" }, String(item.id)),
					react.createElement("span", { className: "dc-topic-name", title: item.name }, item.name)
				));
				picker = react.createElement("div", { className: "dc-topic-picker" },
					react.createElement("div", { className: "dc-topic-search" },
						react.createElement("input", {
							value: state.topicQuery,
							placeholder: t("topicSearchPlaceholder"),
							onChange: (event) => props.setTopicQuery(event.target.value)
						}),
						react.createElement("span", { className: "dc-topic-muted" },
							state.topicLoading ? t("topicLoading") : fill(t("topicTotal"), { total: state.topicTotal }))
					),
					state.topicError
						? react.createElement("div", { className: "dc-env-warn" },
							state.topicError,
							react.createElement("button", {
								type: "button",
								className: "dc-env-btn",
								style: { marginLeft: "8px" },
								onClick: () => props.reloadTopics()
							}, t("topicRetry")))
						: null,
					react.createElement("div", { className: "dc-topic-list" },
						rows.length
							? rows
							: react.createElement("div", {
								className: "dc-topic-muted",
								style: { padding: "6px 2px" }
							}, state.topicLoading ? t("topicLoading") : t("topicNoMatch"))),
					react.createElement("div", { className: "dc-topic-pager" },
						react.createElement("button", {
							type: "button",
							className: "dc-env-btn",
							disabled: state.topicPage <= 1,
							onClick: () => props.topicPageStep(-1)
						}, t("topicPrev")),
						react.createElement("span", { className: "dc-topic-muted" },
							fill(t("topicPage"), { page: state.topicPage, pages: state.topicPages })),
						react.createElement("button", {
							type: "button",
							className: "dc-env-btn",
							disabled: state.topicPage >= state.topicPages,
							onClick: () => props.topicPageStep(1)
						}, t("topicNext"))
					)
				);
			}

			return react.createElement("div", { className: "dc-topic" }, header, chips, picker);
		}

		/**
		 * Render the row's one-liner or its page, as the Plugins page asks.
		 *
		 * The page owns two blocks: the environment list, and the topics selected
		 * inside the active environment. An address and a key are properties of an
		 * environment, so there are no separate top-level fields to disagree with it.
		 * @param props - the view asked for, locale copy, the page snapshot, and its actions.
		 * @returns the one-liner, or the page.
		 */
		function DocchainCard(props) {
			const { t } = props;
			const state = props.useDocchainCard((snapshot) => snapshot);
			if (props.view === "summary") return t("description");
			if (!state.writable) {
				return react.createElement("div", { className: "dc-env" },
					react.createElement("style", null, ENV_STYLES),
					react.createElement("div", { className: "dc-env-warn" }, t("readOnly"))
				);
			}
			return react.createElement("div", { className: "dc-page" },
				react.createElement("style", null, ENV_STYLES),
				react.createElement(EnvironmentSection, { key: "environments", ...props }),
				react.createElement(TopicSection, { key: "topics", ...props })
			);
		}

		/** Required services (cordis fiber inject). */
		const inject = [
			"slots",
			"locale",
			"remote",
			"remote.credentials",
			"configForms"
		];

		/**
		 * Mount the row's configuration page: register the form under the
		 * `plugins.row.config` slot key the Plugins page addresses this row by,
		 * and keep its credential presence fresh on remounts.
		 * @param ctx - the browser plugin context.
		 */
		function apply(ctx) {
			const t = ctx.locale.bind(NS);
			ctx.effect(() => ctx.locale.register(NS, {
				zh,
				en
			}), "dsh-docchain: dictionaries");
			const controller = new DocchainCardController(ctx.configForms.get(ROW_ENTRY_ID), ctx, t);
			ctx.effect(() => () => {
				controller.dispose();
			}, "dsh-docchain: form subscription");
			ctx.slots.inject("plugins.row.config", () => ctx.slots.register({
				name: "plugins.row.config",
				key: ROW_CONFIG_KEY,
				locale: NS,
				inject: () => controller.inject()
			}, DocchainCard));
		}

		exports.NS = NS;
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});
