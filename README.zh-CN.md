# dsh-docchain

[English](./README.md) | 中文

一个 DSH 插件，内置 docchain 文档检索（文件名/内容/元数据）与多子智能体深度研究工作流：任意机器上用 `plugin_manager install_bundle` 安装即可生效，无需手动拷贝到 `~/.agents/skills`。

| 技能 | 形态 | 说明 |
|---|---|---|
| `docchain-filename-search` | SKILL.md + Python 脚本 | 按文件名关键词跨主题查找文档 |
| `docchain-content-search` | SKILL.md + Python 脚本 | 在文档内容中搜索关键词，返回行号和内容，支持"或/且" |
| `docchain-meta-search` | SKILL.md + Python 脚本 | 按自定义元数据字段查询文档（字符串/数值/时间，精确与范围） |
| `deep-research-advanced` | 仅 SKILL.md | 主控式多子智能体深度研究工作流（纯指令，无脚本） |

## 安装

从 GitHub 仓库安装（推荐；纯 JS 包，无需构建步骤）：

```text
dsh plugin add github:wct-lab/dsh-docchain
```

或从本地目录安装：

```text
plugin_manager install_bundle target=<本目录绝对路径>
```

## 配置说明（必读）

包内不携带任何凭据。每个 Python 脚本运行前都需要 docchain 服务地址与 API Key。

| 配置项 | 说明 | 必填 |
|---|---|---|
| `docchain_url` | docchain 服务地址，如 `http://<host>:7100/llmdoc` | 是 |
| `docchain_api_key` | API 认证密钥 | 是 |

四种配置方式，按**优先级**从高到低：

1. 环境变量 `DOCCHAIN_URL`、`DOCCHAIN_API_KEY`；
2. 技能目录下的配置文件 `<skill>/scripts/config.json`；
3. 插件状态文件 `~/.dsh/storages/docchain-config.json`（插件配置写入，见下）；
4. 包内 `skills/docchain_config.json`（文件分发兜底；包内只带模板 `docchain_config.example.json`）。

配置文件格式（均为 JSON）：

```json
{
  "docchain_url": "http://<host>:7100/llmdoc",
  "docchain_api_key": "your-api-key-here"
}
```

脚本依赖 Python 3 与 `requests` 包，在技能根目录下以 `python3 scripts/<脚本>.py …` 方式运行（参数见各 SKILL.md）。

## 插件配置（推荐）

插件自带 Web 客户端的**配置页**：在 `dsh web` 中打开侧栏的「插件」，找到 `dsh-docchain` 插件，点击其行上的配置控件即可打开。页面可编辑服务地址（保存到插件 config 行，经宿主 settings 服务热重载）并把 API Key 写入凭据存储。Key 只写不读：页面不会回显已保存的值，只提示是否已配置。

插件遵循官方凭据模式，Config schema 包含：

| 字段 | 含义 |
|---|---|
| `docchain_url` | 服务地址；volatile 字段，可在配置页编辑 |
| `docchain_api_key_ref` | API Key 的凭据引用名，默认 `DOCCHAIN_API_KEY` |
| `docchain_api_key` | 备用：直接写死 Key（不推荐；凭据存储优先） |

Key 的实际值保存在**凭据存储** `~/.dsh/.credentials.yaml`（`refs:` 段，仅本用户可读）——可通过配置页写入或直接编辑文件，改动热生效；也可以用同名启动环境变量提供。激活时、以及任一存储凭据变化时，解析出的值会被落盘到 `~/.dsh/storages/docchain-config.json`（权限 `0600`），脚本每次运行读取该文件。

Key 解析顺序：凭据存储（启动环境 > 存储文件）> `docchain_api_key` 行内字面值 > 状态文件已有值。

修改配置的方式：

- 使用插件页上的**配置页**——编辑服务地址、保存/更新 API Key；或
- 在凭据存储中保存/更新 `DOCCHAIN_API_KEY`——无需触碰本插件即生效；或
- 直接编辑 `~/.dsh/storages/docchain-config.json`（下一次脚本运行即生效）；或
- 在插件 config 行（patch `config` / preset override）设置 `docchain_url` / `docchain_api_key_ref` / `docchain_api_key` 后重新激活插件。

## 工作机制

Bundle 插入一个 Host 插件（`dsh-docchain`），激活时在 `ctx.skills` 上注册技能提供者，服务本包 `<skills>/<name>/SKILL.md` 下的每个技能目录：

- 目录条目来自各 SKILL.md 的 frontmatter（`name`、`description`）；每次加载都重新读文件。
- 提供者 rank 为 **450**：项目根（`.dsh/skills` = 100、项目 `.agents/skills` = 200）、runtime 注册（250）与 `customSkillDirs`（300）优先级更高，`~/.dsh/skills`（400）同样优先；本 Bundle 高于 `~/.agents/skills`（500）与 bundled 根（600）。也就是说：`~/.agents/skills` 里的同名旧副本会被本 Bundle 覆盖；确认无误后可删除旧副本，只保留单一来源。

## 技能详解

### docchain-filename-search（按文件名搜索）

通过文件名关键词快速定位文档，支持跨主题搜索。

**交互方式**：描述要查找的文件名关键词。提问时必须指定主题 ID。

**示例**：

- "帮我在主题112中找文档名包含'合同'的文件"
- "在主题1,10里搜索'采购'或'协议'的文档"

### docchain-content-search（文档内容搜索）

在文档内容中搜索关键词，返回匹配行的行号和内容，支持"或/且"两种操作符。

**交互方式**：指定搜索范围和关键词。必须提供 `doc_ids` 和 `topic_ids` 至少其一。

**示例**：

- "在文档123里搜索'合同'"
- "在主题1,2里搜索同时包含'API'和'接口'的内容"

### docchain-meta-search（元数据查询）

通过自定义元数据字段条件筛选文档，支持字符串、数值、时间类型的精确匹配与范围查询。

**交互方式**：描述筛选条件。必须指定主题 ID 或文档 ID。

**示例**：

- "在主题112中查找元数据中作者是张三的文档"
- "在主题113中查找金额字段大于1000的合同"

### deep-research-advanced（高级深度研究）

面向 ReAct 单智能体的主控式多子智能体深度研究工作流（纯指令，无脚本）：主智能体试探摸底、拆分独立任务并行下发；子智能体自主迭代检索、精读、推导，输出带推导链路的子报告；主智能体汇总交叉推演、复盘深化，**强制保底 2 轮全局循环**后自主判定终止。最终生成逻辑闭环、推导清晰、低幻觉、可溯源的研究报告。

**适用场景**：复杂、开放性、需外部资料佐证、需逻辑推演的研究问题——行业分析、市场调研、竞品剖析、政策解读、技术调研、趋势预测。简单问答、闲聊、基础计算禁止使用。

## 卸载

移除 Bundle 后，提供者与技能一并注销：

```text
dsh plugin remove dsh-docchain
```

（或 `plugin_manager remove_bundle`）。
