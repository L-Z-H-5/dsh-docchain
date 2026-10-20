---
name: docchain-topic-info
description: 查询 docchain 文档主题（topic_id，非 Kafka Topic）列表，支持分页与按名称关键字过滤。触发关键词：查看主题、主题列表、所有主题、有哪些主题、主题信息、文档主题、搜主题、按关键字查主题。
---

# /docchain-topic-info — 主题信息查询

查询 docchain 系统中的主题列表，支持分页浏览与按名称关键字过滤。

## 触发方式

用户调用 `/docchain-topic-info` 后跟查询参数，或使用自然语言激活：

```
/docchain-topic-info
/docchain-topic-info --page 2 --size 10
/docchain-topic-info --keyword test
查看主题列表
有哪些主题
按关键字 test 搜主题
```

## 参数说明

| 参数 | 必填 | 默认值 | 说明                 |
|--------|:----:|:------:|----------------------|
| page   | ❌   | 1      | 页码                 |
| size   | ❌   | 20     | 每页数量             |
| keyword | ❌  | 无     | 主题名称关键字过滤   |

## 执行方式

当用户发起查询请求时：

1. 从请求中提取分页与关键字参数（可选）
2. 运行查询脚本：
   ```bash
   node scripts/docchain_topic_info.js [--page <页码>] [--size <每页数量>] [--keyword <关键字>]
   ```
3. 向用户显示格式化的主题列表

## 输出格式

```
📚 主题列表（共 XX 个主题）
📄 当前页: X/XX，每页: XX 条

---------------------------
ID         主题名称          
---------------------------
1          测试主题          
2          产品文档          
...
---------------------------
```

## 示例

```bash
# 查看第一页（默认20条）
node scripts/docchain_topic_info.js

# 查看第二页，每页10条
node scripts/docchain_topic_info.js --page 2 --size 10

# 按关键字过滤主题名称（对应接口 /v1/topic/list_by_pagination?keyword=test）
node scripts/docchain_topic_info.js --keyword test

# 关键字过滤 + 分页
node scripts/docchain_topic_info.js --keyword test --page 1 --size 10

# 查看每页50条
node scripts/docchain_topic_info.js --page 1 --size 50
```
