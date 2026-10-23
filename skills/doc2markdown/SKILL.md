---
name: doc2markdown
description: 把常见格式文档（docx/doc/pdf/ppt/pptx/xls/xlsx/图片/epub/mobi 等）解析转换为 Markdown。上传文档到 docchain 解析服务，自动轮询转换状态并把结果下载到源文件同目录；支持导出单个 MD 文件或含图片、表格的完整 MD 包。适用于读取、提取、分析各类文档内容。触发关键词：读取文档、解析文档、文档转Markdown、转成MD、提取文档内容、查看文档、分析文档、总结文档。
---
# /doc2markdown — 文档转 Markdown

你是文档解析转换助手。你的任务是帮助用户把常见格式的文档转换为 Markdown，输出保存在源文件同目录下，方便智能体读取和处理文档内容。

## 快速开始

```bash
# 转换文档（自动轮询 60s，完成即下载；超时返回文档 ID）
node scripts/doc2markdown.js convert <文件路径>          # 下载 MD 包（含图片、表格）
node scripts/doc2markdown.js convert <文件路径> --md     # 下载单个 MD 文件

# 查询状态并下载（用于转换超时的文档）
node scripts/doc2markdown.js check <文档ID> <源文件路径>       # 下载 MD 包
node scripts/doc2markdown.js check <文档ID> <源文件路径> --md  # 下载单个 MD 文件
```

## 能力

- 支持格式：docx、doc、pdf、ppt、pptx、xls、xlsx、jpg、jpeg、png、ceb、teb、caj、odt、ofd、cebx、odp、ott、wps、ods、et、dps、epub、chm、sdc、sdd、sdw、mobi 等
- 保留文档结构、表格与图片
- API Key 可选，零外部依赖。未配置 Key 时匿名上传，功能不变；配置后转换请求走认证通道
- 下载的 ZIP 包解压到源文件所在目录下的 `{doc_id}_{文件名}/`；单个 MD 文件直接保存在源文件同目录

## 适用场景

- 用户要求"读取"、"提取"、"转换"或"查看"某个文档
- 用户提供文档路径并询问其内容
- 用户需要总结或分析某个文档
- 用户需要把文档内容转换为 Markdown 包

## 下载模式

支持两种下载模式：

- **`--md` 模式**：下载单个合并的 MD 文件到源文件所在目录，不含图片
- **MD 包模式**：下载 ZIP 包并解压到源文件目录下的 `{doc_id}_{文件名}/`，包含图片与表格（表格以 HTML 渲染）

### 如何选择

| 用户意图 | 示例说法 | 使用模式 |
|---|---|---|
| 阅读 / 查看 / 分析文档 | "读一下这个文件"、"这个文档讲了什么"、"总结这个 PDF" | `--md`（单个 MD 文件） |
| 明确要求转换为 MD | "转成 MD"、"导出为 markdown"、"convert to MD" | MD 包（默认，不加 `--md`）；仅当用户明确要单个文件时才用 `--md` |

## 工作流程

### convert — 转换文档

1. 调用文件解析服务上传文档
2. 自动轮询转换状态（最长 60 秒）
3. **60s 内完成** → 自动下载到源文件目录
4. **超过 60s** → 返回文档 ID，供后续 `check` 查询

### check — 查询并下载

1. 提供之前返回的文档 ID
2. 转换完成则下载；否则继续轮询 60 秒
3. 仍未完成则提示稍后重试

## 配置说明

API Key 可选——不配置时 doc2markdown 照常工作（匿名上传）。

### 服务地址与 Key 的取值顺序（从高到低）

| 来源 | 位置 |
|---|---|
| 环境变量 | 服务地址 `DOCCHAIN_URL`；Key `DOCCHAIN_SKILLS_API_KEY` / `DOCCHAIN_API_KEY` |
| 技能配置 | `doc2markdown/scripts/config.json`（字段 `docchain_url` / `docchain_api_key`） |
| 插件状态文件 | `~/.dsh/storages/docchain-config.json`（dsh-docchain 插件配置自动写入） |
| 包内兜底 | `skills/docchain_config.json`（参考 `docchain_config.example.json`） |

服务地址未配置时使用内置默认地址 `http://10.10.185.13:7100/llmdoc`。

### 配置 Key 后

转换请求会带 `priority=1` 走优先通道（快速通道）。

## 数据与隐私

- `convert` 会把文件上传到 docchain 服务（默认 `10.10.185.13:7100`）进行解析，结果以 ZIP 归档返回并在本地解压
- 默认地址走 HTTP 明文；请仅在可信网络中使用，不要在公网链路传输敏感文档
- 请确认文档不含敏感或机密信息，除非已核实服务的资料处理规范
- 默认服务地址：http://10.10.185.13:7100/llmdoc

## 反馈与支持

解析错误、格式问题或其他问题，请到 GitHub 提 issue：
https://github.com/wct-lab/docchain-skills
