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
		/** Credential reference the API key is stored under. */
		const KEY_REF = "DOCCHAIN_API_KEY";
		/** Profile entry id the bundle's patch declares; the settings namespace the form stages over. */
		const ROW_ENTRY_ID = "dsh-docchain";
		/** `plugins.row.config` key: `<package name>#<row id>`. */
		const ROW_CONFIG_KEY = "dsh-docchain#dsh-docchain";

		/** English copy. */
		const en = {
			description: "Configure the docchain document search service endpoint and its API key.",
			url: "Service URL",
			urlHint: "The docchain service endpoint, e.g. http://192.168.1.10:7100/llmdoc.",
			apiKey: "API key",
			apiKeyHint: "Saved in this machine's credential store; the stored value is never shown.",
			apiKeySet: "Configured — entering a new key replaces it",
			apiKeyUnset: "Not configured",
			overridden: "Overridden",
			reset: "Reset to default",
			invalid: "Enter a valid value, or leave blank to use the default.",
			readOnly: "This deployment stores settings read-only.",
			unavailable: "This plugin is not loaded, so it cannot be configured right now.",
			save: "Save",
			saving: "Saving…",
			saveFailed: "The deployment did not accept these values; they were left for you to correct."
		};
		/** Simplified Chinese copy. */
		const zh = {
			description: "配置 docchain 文档检索服务的地址与 API Key。",
			url: "服务地址",
			urlHint: "docchain 服务端点，例如 http://192.168.1.10:7100/llmdoc。",
			apiKey: "API Key",
			apiKeyHint: "保存在本机凭据存储中，已保存的值不会回显。",
			apiKeySet: "已配置——输入新 Key 会覆盖旧值",
			apiKeyUnset: "未配置",
			overridden: "已覆盖",
			reset: "恢复默认",
			invalid: "请填写有效内容；留空表示使用默认值。",
			readOnly: "本部署的设置为只读。",
			unavailable: "该插件当前未加载，暂时无法配置。",
			save: "保存",
			saving: "保存中…",
			saveFailed: "本部署没有接受这些值，已保留供你修改。"
		};

		/**
		 * The form frame's copy, read from this page's dictionary.
		 * @param t - the page's locale reader.
		 * @returns the labels the shared settings form renders.
		 */
		function formLabels(t) {
			return {
				unavailable: t("unavailable"),
				readOnly: t("readOnly"),
				saveFailed: t("saveFailed"),
				save: t("save"),
				saving: t("saving")
			};
		}

		/**
		 * Bridges the row's settings form and the credential store onto the
		 * page's staged form. The URL stages over the shared configuration form
		 * of the `dsh-docchain` entry; the API key is a write-only control
		 * whose `write` resolves against the credential store.
		 */
		var DocchainCardController = class {
			/** Whether the credential store holds a key for {@link KEY_REF}; unknown until the first describe settles. */
			configured = false;
			known = false;
			store;
			form;

			/**
			 * @param scope - the shared configuration form of the `dsh-docchain` entry.
			 * @param ctx - the browser plugin context, whose `remote.credentials` namespace carries the key writes.
			 */
			constructor(scope, ctx) {
				this.ctx = ctx;
				this.form = new primitives.SettingsFormModel(scope, [
					primitives.settingsTextField("docchain_url")
				], [{
					field: "docchain_api_key",
					write: (text) => this.storeKey(text)
				}]);
				this.store = this.form.bind(() => this.projection());
				this.refreshKeyState();
			}
			projection() {
				return {
					...this.form.shell(),
					docchainUrl: this.form.field("docchain_url"),
					apiKey: this.form.field("docchain_api_key"),
					apiKeyKnown: this.known,
					apiKeyConfigured: this.configured
				};
			}
			/**
			 * Build the face the page's slot registration injects.
			 * @returns the page's snapshot and its form actions.
			 */
			inject() {
				return {
					hooks: { docchainCard: this.store },
					...this.form.actions()
				};
			}
			/** Ask the Host whether a key is stored; the answer only reports presence, never the value. */
			async refreshKeyState() {
				try {
					const response = await this.ctx.remote.credentials.describe([KEY_REF]);
					if (response.ok) {
						this.known = true;
						this.configured = Boolean(response.value?.[KEY_REF]?.configured);
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
				try {
					const response = await this.ctx.remote.credentials.set(KEY_REF, text);
					if (response.ok) {
						this.known = true;
						this.configured = true;
						this.publish();
						return true;
					}
				} catch {
					// report as a refused save
				}
				return false;
			}
			/** Re-project after an out-of-form state change (credential presence). */
			publish() {
				this.store.set(this.projection());
			}
			/** Release the form subscription. */
			dispose() {
				this.form.dispose();
			}
		};

		/**
		 * Render the row's one-liner or its settings form, as the Plugins page asks.
		 * @param props - the view asked for, locale copy, the form snapshot, and its actions.
		 * @returns the one-liner, or the form.
		 */
		function DocchainCard(props) {
			const { t } = props;
			const state = props.useDocchainCard((snapshot) => snapshot);
			if (props.view === "summary") return t("description");
			const disabled = !state.writable;
			return react.createElement(primitives.SettingsForm, {
				labels: formLabels(t),
				state,
				onSave: props.save,
				onDiscard: props.discard,
				children: [
					react.createElement(primitives.SettingsValueField, {
						id: "plugin-config-docchain-url",
						label: t("url"),
						hint: t("urlHint"),
						overriddenLabel: t("overridden"),
						resetLabel: t("reset"),
						invalidLabel: t("invalid"),
						disabled,
						...state.docchainUrl,
						onEdit: (text) => {
							props.edit("docchain_url", text);
						},
						onReset: () => {
							props.resetField("docchain_url");
						}
					}),
					react.createElement(primitives.SettingsSecretField, {
						id: "plugin-config-docchain-key",
						label: t("apiKey"),
						hint: t("apiKeyHint"),
						disabled,
						text: state.apiKey.text,
						onEdit: (text) => {
							props.edit("docchain_api_key", text);
						},
						configured: state.apiKeyConfigured,
						stateLabel: t(state.apiKeyConfigured ? "apiKeySet" : "apiKeyUnset")
					})
				]
			});
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
			const controller = new DocchainCardController(ctx.configForms.get(ROW_ENTRY_ID), ctx);
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
