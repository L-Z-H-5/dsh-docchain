---
name: docchain-upload
description: Docchain批量文档上传工具。支持单文件上传、文件夹批量上传。适用于需要批量导入文档到docchain系统的场景。关键词：批量上传、文件夹上传、docchain上传、文档导入、bulk upload、batch upload、recursive upload、文档迁移、文件批量处理。
---
# /docchain-upload — Docchain批量文档上传工具

你的任务是帮助用户将本地文件或文件夹批量上传到docchain系统。

## Trigger

用户通过以下方式调用此skill：

```
上传文件 document.pdf 到主题123
批量上传文件夹 /path/to/docs 到docchain主题456
上传 /path/to/project/docs 主题132
```

## 触发方式

```bash
# 单文件上传
node scripts/batch_upload.js upload-file document.pdf --topic_id 123

# 文件夹批量上传
node scripts/batch_upload.js upload-folder ./docs --topic_id 123
```

## 参数说明

| 参数                    | 必填 | 默认值 | 说明 |
|-----------------------|:----:|:-----:|------|
| file_path/folder_path | ✅ |   -    | 文件或文件夹路径 |
| --topic_id            | ✅ |   -    | 目标主题 ID |

## 工作流程

### 标准上传流程

1. **配置检查**：验证config.json配置是否完整
2. **路径验证**：检查文件/文件夹路径是否存在
3. **批量上传**：逐个上传文件，显示实时进度
4. **结果统计**：显示成功/失败数量、文档ID列表

## 输出示例

```
上传完成！

总计：15个文件
成功：13个文件
失败：2个文件

成功文档ID：
- document1.pdf (12345)
- report.docx (12346)
...
```

## 示例场景

### 场景1：上传单个报告
```
用户：上传这个月度报告到docchain
助手：/docchain-upload-skill upload-file monthly_report.pdf
```

### 场景2：批量导入项目文档
```
用户：把./project/docs文件夹里的所有文档都上传到docchain
助手：/docchain-upload-skill upload-folder ./project/docs
```

### 场景3：批量导入项目文档到指定主题
```
用户：把./archive目录下所有PDF和Word文档都上传到主题id为123下
助手：/docchain-upload-skill upload-recursive ./archive  --topic_id 123
```