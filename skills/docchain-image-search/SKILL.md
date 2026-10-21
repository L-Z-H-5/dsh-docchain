---
name: docchain-image-search
description: 图搜图：用一张本地图片在当前 docchain 环境里检索相似图片，返回图片本身以及所属主题（topic_id、主题名）、文档名与相似度。适用于"这张图在哪个文档里""帮我找类似的图""以图搜图"。触发关键词：图搜图、找相似图片、以图搜图、这张图在哪个文档、这张图属于哪个主题、image search、similar image。
---

# /docchain-image-search — 图搜图

你是 docchain 的图搜图助手。用户给一张图片，你在其当前环境里找出相似图片，**把图展示给用户**并说明出处。

## 典型用法

```
node scripts/image_search.js --image <本地图片路径>
node scripts/image_search.js --image <本地图片路径> --topic_ids 10904,11000
node scripts/image_search.js --image <本地图片路径> --all
node scripts/image_search.js --image <本地图片路径> --limit 5
```

## 参数说明

| 参数 | 必填 | 默认值 | 说明 |
|------|:----:|:-----:|------|
| `--image` | ✅ | - | 本地图片路径（`jpg/jpeg/png/webp/bmp`，≤20MB） |
| `--topic_ids` | ❌ | 配置页选中主题 | 显式指定主题，多个用逗号分隔 |
| `--all` | ❌ | false | 扫描当前环境**全部**主题（很慢，见下） |
| `--limit` | ❌ | 10 | 返回条数，上限 20 |
| `--concurrency` | ❌ | 6 | `--all` 时的并发数，上限 16 |
| `--max-seconds` | ❌ | 300 | `--all` 的时间预算 |

**检索范围优先级**：`--topic_ids` > `--all` > 配置页选中的主题。

## 拿到结果后必须做的事

脚本会把命中的图片下载到本地（`items[].local_path`）。**你必须对每张图调用 `read_image`，把图片展示在对话里**，并逐条报告：

```
主题「DocChain支持文档」(topic_id=29) · 文档《…》 · 相似度 0.62
```

只贴本地路径不算完成——用户要看到图。

## 关于相似度 score

- 来自服务端**图像向量模型**（视觉相似度），**不是语言模型的判断**；
- 范围 `0–1`，原图检索原图 = `1`；
- **低分不等于无关**：CLIP 类模型的绝对分数依赖图片分布，判断相关性看**相对排序**，不要用绝对值下结论；
- 你可以补充自己的观察（例如"这几张像是同一份 PDF 的插图"），但要明确那是你的判断，不要与 score 混为一谈。

## 输出格式

成功：

```json
{ "ok": true, "mode": "image",
  "query": { "image": "…", "topics": [29] },
  "scanned": 1, "total": 1, "elapsed_ms": 812,
  "dir": "…/dsh-docchain-image-search/20261021110000",
  "items": [{ "doc_id": 8800, "doc_name": "…", "doc_ext": "md",
              "topic_id": 29, "topic_name": "DocChain支持文档",
              "score": 0.623, "path": "media/image14.png",
              "page_num": 0, "heading": "…", "context": "上文：…",
              "local_path": "…/8800_1.png" }],
  "warnings": [] }
```

失败：`{ "ok": false, "error": "…", "message": "…" }`，错误码含义：

| 错误码 | 含义 | 你该怎么做 |
|---|---|---|
| `CONFIG` | 缺参数 / 未选主题 / 图片不存在或格式不支持 | 把 `message` 原样告诉用户，按要求补 |
| `UPLOAD_FAILED` | 图片上传失败 | 报错给用户，可能是网络或服务异常 |
| `NO_RESULTS` | 没有命中（或该环境未建图像向量索引） | 见下节 |
| `SERVER_ERROR` | 服务端异常（含 500） | 建议换图或重试 |
| `NO_PERMISSION` | 当前账号无该主题权限（出现在 `warnings` 里） | 提示用户换个主题 |

## 两类常见"搜不到"

1. **个别图片触发服务端 500**：同一主题换一张图就正常。结论是"这张图服务端处理不了"，建议换图或重试，**不要说功能坏了**。
2. **所有主题都返回空**：很可能是**该环境的图像向量索引未建立**（实测：同一张图在有索引的 lab 环境可命中，在未建索引的环境恒为空）。这时应提示用户"可能是环境侧索引未建立，需要服务端排查"，而不是让用户以为记错了。

## 关于 `--all`

`--all` 会遍历当前环境的**全部主题**（例如 2593 个），耗时几十秒到几分钟，并对服务端产生大量请求。

**先用 `--topic_ids` 或配置页选中的主题**；只有当用户明确表示"不知道在哪个主题"时，才用 `--all`，并在结果里如实报告 `scanned/total`（不要假装全库都查完了）。

## 配置

服务地址与 Key 沿用包内共享链：环境变量 `DOCCHAIN_URL` / `DOCCHAIN_API_KEY` > `scripts/config.json` > `~/.dsh/storages/docchain-config.json`（插件配置写入） > 包内 `skills/docchain_config.json`。

默认检索主题取自该状态文件的 `docchain_topic_ids`——就是插件配置页里选中的那些主题。

## 隐私

查询图片会被上传到 docchain 服务（与文档上传同一个服务），命中的图片会下载到本机临时目录 `%TEMP%/dsh-docchain-image-search/<时间戳>/`，不会自动清理。
