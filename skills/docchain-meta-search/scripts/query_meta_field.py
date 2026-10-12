#!/usr/bin/env python3
"""
Docchain 元数据字段查询脚本

根据自定义元数据字段条件查询文档
"""

import argparse
import json
import os
import sys
from typing import List, Dict, Any, Optional
import requests

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="backslashreplace")

CONFIG_MESSAGE = """请正确配置以下参数
docchain_url: 环境指向地址（必填）
docchain_api_key: 环境的账号验证方式（必填）
方式1: 环境变量 DOCCHAIN_URL, DOCCHAIN_API_KEY
方式2: 插件配置：dsh-docchain 插件的 Config（激活时自动写入
       ~/.dsh/storages/docchain-config.json，也可直接手动编辑该文件）：
       {"docchain_url": "http://<host>:7100/llmdoc", "docchain_api_key": "your-api-key"}
方式3: 配置文件 docchain-meta-search/scripts/config.json， 如下格式：
```json
{
  "docchain_url": "http://<host>:7100/llmdoc",
  "docchain_api_key": "your-api-key"
}
方式4: 包内 skills/docchain_config.json，同上json格式（分发兜底，参考 docchain_config.example.json）
**注：配置取值顺序优先级为 环境变量 > scripts/config.json > ~/.dsh/storages/docchain-config.json > 包内 docchain_config.json**
"""


STATE_CONFIG_PATH = os.path.expanduser("~/.dsh/storages/docchain-config.json")


def _load_json(path: str) -> Dict[str, Any]:
    if not os.path.exists(path):
        return {}
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def get_config() -> Dict[str, Any]:
    """仅读取 url 和 apikey"""
    current_config_path = os.path.join(os.path.dirname(__file__), "config.json")
    parent2_config_path = os.path.join(
        os.path.dirname(os.path.dirname(os.path.dirname(__file__))),
        "docchain_config.json"
    )

    config = {
        **_load_json(parent2_config_path),   # 包内兜底（可随包分发占位）
        **_load_json(STATE_CONFIG_PATH),     # 插件状态文件（插件 Config 激活时写入，可手动编辑）
        **_load_json(current_config_path),   # 技能级覆盖
    }

    env_docchain_url = os.getenv("DOCCHAIN_URL")
    env_docchain_api_key = os.getenv("DOCCHAIN_API_KEY")

    if env_docchain_url:
        config["docchain_url"] = env_docchain_url
    if env_docchain_api_key:
        config["docchain_api_key"] = env_docchain_api_key

    if not config.get("docchain_url") or not config.get("docchain_api_key"):
        error_msg = {
            "error": "配置不完整",
            "message": CONFIG_MESSAGE
        }
        print(json.dumps(error_msg, ensure_ascii=False))
        sys.exit(1)

    return config


def list_topic_metadata_fields(
    topic_id: int,
    config: Dict[str, Any],
) -> Dict[str, Any]:
    """
    查询主题的元数据字段列表
    """
    api_url = config["docchain_url"].rstrip("/")
    endpoint = f"{api_url}/v1/topic/metadata/list"

    headers = {"Content-Type": "application/json"}
    if config.get("docchain_api_key"):
        headers["X-Api-Key"] = config["docchain_api_key"]

    params = {"topic_id": topic_id}

    response = requests.get(endpoint, params=params, headers=headers, timeout=30)
    response.raise_for_status()
    return response.json()


def format_metadata_fields(fields: List[Dict[str, Any]], topic_id: int = None) -> str:
    """
    格式化元数据字段列表用于显示
    """
    lines = []

    if topic_id:
        lines.append(f"📋 主题 {topic_id} 的元数据字段：\n")

    if not fields:
        lines.append("❌ 该主题暂无元数据字段定义")
        return "\n".join(lines)

    lines.append(f"✅ 共 {len(fields)} 个字段\n")
    lines.append("| 字段名 | 类型 |")
    lines.append("|--------|------|")

    for field in fields:
        field_name = field.get("field_name", "N/A")
        field_type = field.get("field_type", "str")
        lines.append(f"| {field_name} | {field_type} |")

    return "\n".join(lines)


def parse_condition(condition_str: str) -> Optional[Dict[str, Any]]:
    """
    解析单个条件字符串

    格式: field_name,operation,value
    示例: author,eq,张三

    Returns:
        条件字典（符合 MetaFieldCondition 格式）或 None（如果解析失败）
    """
    parts = condition_str.split(",")
    if len(parts) < 3:
        return None

    field_name = parts[0].strip()
    operation = parts[1].strip()
    value = ",".join(parts[2:]).strip()

    if not field_name or not operation:
        return None

    # 验证操作符
    valid_operations = {
        "eq", "ne", "contains",  # 字符串操作符
        "time_eq", "time_ne", "time_gt", "time_gte", "time_lt", "time_lte",  # 时间操作符
        "num_eq", "num_ne", "num_gt", "num_gte", "num_lt", "num_lte",  # 数值操作符
    }
    if operation not in valid_operations:
        return None

    return {
        "field_name": field_name,
        "operation": operation,
        "value": value
    }


def query_by_meta_fields(
    conditions: List[Dict[str, Any]],
    config: Dict[str, Any],
    topic_ids: List[int] = None,
    doc_ids: List[int] = None,
    or_groups: List[List[Dict[str, Any]]] = None,
    size: int = 100,
) -> Dict[str, Any]:
    """
    根据元数据字段查询文档

    Args:
        conditions: 查询条件列表（AND关系）
        config: 配置文件
        topic_ids: 要查询的主题 ID 列表
        doc_ids: 要查询的文档 ID 列表
        or_groups: OR条件组列表
        size: 返回结果数量上限

    Returns:
        API 响应字典

    Raises:
        requests.RequestException: 如果 API 调用失败
    """

    api_url = config["docchain_url"].rstrip("/")
    endpoint = f"{api_url}/v1/doc_info/meta_field_query"

    headers = {"Content-Type": "application/json"}
    if config.get("docchain_api_key"):
        headers["X-Api-Key"] = config["docchain_api_key"]

    payload: Dict[str, Any] = {"size": size}

    if conditions:
        payload["conditions"] = conditions
    if or_groups:
        payload["or_groups"] = or_groups
    if topic_ids:
        payload["topic_ids"] = topic_ids
    if doc_ids:
        payload["doc_ids"] = doc_ids

    response = requests.post(endpoint, json=payload, headers=headers, timeout=30)
    response.raise_for_status()
    return response.json()


def format_results(data: Dict[str, Any], conditions_str: str = "") -> str:
    """
    格式化查询结果用于显示
    """
    lines = []

    if conditions_str:
        lines.append(f"🔍 查询条件：{conditions_str}\n")

    total = data.get("total", 0)
    records = data.get("records", [])

    if total == 0:
        lines.append("❌ 未找到文档")
        return "\n".join(lines)

    lines.append(f"✅ 共找到 {total} 个文档，此次返回 {len(records)} 个文档\n")

    for record in records:
        doc_id = record.get("doc_id", "N/A")
        doc_name = record.get("path", "N/A")
        topic_id = record.get("topic_id", "N/A")
        meta_fields = record.get("custom_meta_data", [])

        lines.append(f"📄 {doc_name} (doc_id: {doc_id}, topic_id: {topic_id})")

        if meta_fields:
            for field in meta_fields:
                field_name = field.get("field_name", "N/A")
                field_type = field.get("field_type", "str")
                if field_type == "str":
                    value = field.get("field_value_str", "N/A")
                elif field_type == "int":
                    value = field.get("field_value_int", "N/A")
                elif field_type == "date":
                    value = field.get("field_value_date", "N/A")
                else:
                    value = field.get("field_value_str", "N/A")
                lines.append(f"   • {field_name}: {value}")
        else:
            lines.append(f"   • 无元数据")

        lines.append("")

    return "\n".join(lines)


def main():
    """主入口函数"""
    parser = argparse.ArgumentParser(
        description="根据元数据字段查询 docchain 文档"
    )
    parser.add_argument(
        "--topic_ids",
        type=str,
        help="要查询的主题 ID（逗号分隔）"
    )
    parser.add_argument(
        "--conditions",
        type=str,
        required=False,
        help="查询条件 AND（格式：field_name,operation,value，多个用分号分隔）"
    )
    parser.add_argument(
        "--or_groups",
        type=str,
        required=False,
        help="OR条件组（格式：field_name,operation,value|field_name,operation,value，多个组用分号分隔）"
    )
    parser.add_argument(
        "--doc_ids",
        type=str,
        required=False,
        help="要查询的文档 ID（逗号分隔）"
    )
    parser.add_argument(
        "--size",
        type=int,
        default=100,
        required=False,
        help="返回结果数量上限（默认100）"
    )
    parser.add_argument(
        "--list_fields",
        action="store_true",
        help="仅列出指定主题的元数据字段结构，不执行查询"
    )

    args = parser.parse_args()

    # 解析主题 ID
    topic_ids = None
    if args.topic_ids:
        try:
            topic_ids = [int(tid.strip()) for tid in args.topic_ids.split(",") if tid.strip()]
        except ValueError:
            print("❌ 错误：主题 ID 必须是数字", file=sys.stderr)
            sys.exit(1)

    # 解析文档 ID
    doc_ids = None
    if args.doc_ids:
        try:
            doc_ids = [int(did.strip()) for did in args.doc_ids.split(",") if did.strip()]
        except ValueError:
            print("❌ 错误：文档 ID 必须是数字", file=sys.stderr)
            sys.exit(1)

    config = get_config()

    # --list_fields 模式：仅列出字段结构
    if args.list_fields:
        if not topic_ids:
            print("❌ 错误：--list_fields 需要指定主题 ID（--topic_ids）", file=sys.stderr)
            sys.exit(1)

        all_results = []
        try:
            for tid in topic_ids:
                result = list_topic_metadata_fields(tid, config)
                if result.get("success"):
                    fields = result.get("data", [])
                    all_results.append({"topic_id": tid, "fields": fields, "success": True})
                else:
                    all_results.append({"topic_id": tid, "fields": [], "success": False, "error": result.get('err', '未知错误')})

            for res in all_results:
                if res["success"]:
                    print(format_metadata_fields(res["fields"], res["topic_id"]))
                else:
                    print(f"❌ 主题 {res['topic_id']} 查询失败：{res['error']}")
                print()  # 主题之间空一行
        except Exception as e:
            print(f"❌ 错误：{e}", file=sys.stderr)
            sys.exit(1)
        sys.exit(0)

    # 解析 AND 条件
    conditions = []
    conditions_str = ""
    if args.conditions:
        condition_strs = [c.strip() for c in args.conditions.split(";") if c.strip()]
        conditions_str = " AND ".join(condition_strs)

        for cond_str in condition_strs:
            parsed = parse_condition(cond_str)
            if parsed:
                conditions.append(parsed)
            else:
                print(f"❌ 错误：条件解析失败：{cond_str}", file=sys.stderr)
                print("格式应为：field_name,operation,value，例如：author,eq,张三", file=sys.stderr)
                sys.exit(1)

    # 解析 OR 条件组
    or_groups = []
    or_groups_display = []
    if args.or_groups:
        group_strs = [g.strip() for g in args.or_groups.split(";") if g.strip()]

        for group_str in group_strs:
            condition_strs = [c.strip() for c in group_str.split("|") if c.strip()]
            group_conditions = []
            group_display_parts = []
            for cond_str in condition_strs:
                parsed = parse_condition(cond_str)
                if parsed:
                    group_conditions.append(parsed)
                    # 格式化条件显示：field_name operation value
                    group_display_parts.append(f"{parsed['field_name']} {parsed['operation']} {parsed['value']}")
                else:
                    print(f"❌ 错误：OR组内条件解析失败：{cond_str}", file=sys.stderr)
                    sys.exit(1)
            if group_conditions:
                or_groups.append(group_conditions)
                or_groups_display.append(f"({' OR '.join(group_display_parts)})")

    # 检查 topic_ids 和 doc_ids
    if not topic_ids and not doc_ids:
        print("❌ 错误：必须提供 --topic_ids 或 --doc_ids 之一", file=sys.stderr)
        sys.exit(1)

    # 构建条件描述
    full_conditions_str = conditions_str
    if or_groups_display:
        or_groups_str = " AND ".join(or_groups_display)
        full_conditions_str = f"{conditions_str} AND {or_groups_str}" if conditions_str else or_groups_str

    try:
        results = query_by_meta_fields(
            conditions=conditions,
            config=config,
            topic_ids=topic_ids,
            doc_ids=doc_ids,
            or_groups=or_groups if or_groups else None,
            size=args.size,
        )

        if results.get("success"):
            data = results.get("data", {})
            print(format_results(data, full_conditions_str))
        else:
            print(f"❌ 查询失败：{results.get('err', '未知错误')}", file=sys.stderr)
            sys.exit(1)

    except Exception as e:
        print(f"❌ 错误：{e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()