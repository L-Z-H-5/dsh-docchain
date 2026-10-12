---
name: docchain-content-search
description: 在 docchain 文档内容中搜索关键字，返回匹配行的行号和内容。支持"或"和"且"两种操作符。适用于在文档中查找特定内容、定位关键词位置、快速浏览相关上下文。触发关键词：搜索文档内容、在文档中搜索、查找关键词、文档内搜索、grep 文档、内容搜索。
---
# /docchain-content-search — 在文档内容中搜索关键字

你是 docchain 系统的文档内容搜索助手。你的任务是帮助用户在文档内容中查找特定关键词，并返回匹配行的行号和内容。

## 触发方式

用户调用 `/docchain-content-search` 后跟搜索请求，或使用自然语言激活：

```
/docchain-content-search 在文档 12345 中查找"策马奔腾"
/docchain-content-search 在文档 11111 中查找"API"或"接口"，显示 50 条结果
在文档 12345 中查找"策马奔腾"
在文档 67890 中搜索"合同"和"甲方"
在主题 1,2 中查找"error"
```

## 参数说明

| 参数 | 必填 | 默认值 | 说明                      |
|------|:----:|:------:|-------------------------|
| doc_ids | ❌ | - | 文档 ID（支持多个，逗号分隔）     |
| topic_ids | ❌ | - | 主题 ID（支持多个，逗号分隔）     |
| keywords | ✅ | - | 关键词（多个用逗号分隔）          |
| operator | ❌ | or | 关键词 or（或）/ and（且）的关系 |
| limit | ❌ | 30 | 结果数量限制                  |

**注**：必须提供 `doc_ids` 或 `topic_ids` 之一

## 执行方式

当用户发起搜索请求时：

1. 从自然语言请求中提取参数
2. 运行搜索脚本：
   ```bash
   python scripts/search_in_doc.py --doc_ids <id1,id2> --keywords <关键词1,关键词2> --operator <or|and> --limit <n>
   # 或按主题搜索
   python scripts/search_in_doc.py --topic_ids <tid1,tid2> --keywords <关键词1,关键词2> --operator <or|and> --limit <n>
   ```
3. 向用户显示格式化的结果

## 输出格式

结果以清晰易读的格式显示：

```
🔍 关键词：["策马奔腾", "好看"] (OR)
✅ 找到 5 个匹配，涉及 2 个文档

📄 文档：测试测试.md (ID: 12345, Topic: 1)
  第 10 行：这是包含策马奔腾的一行内容
  第 42 行：策马奔腾的场景很震撼

📄 文档：电影推荐.md (ID: 67890, Topic: 2)
  第 25 行：这个电影真好看
...
```