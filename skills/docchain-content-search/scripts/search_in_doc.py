#!/usr/bin/env python3
"""
Docchain 文档内容搜索脚本

在文档内容中搜索关键字，返回匹配行的行号和内容
"""

import argparse
import json
import os
import sys
from typing import List, Dict, Any
import requests

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="backslashreplace")

# 配置文件路径
CONFIG_MESSAGE = """请正确配置以下参数
docchain_url: 环境指向地址（必填）
docchain_api_key: 环境的账号验证方式（必填）
方式1: 环境变量 DOCCHAIN_URL, DOCCHAIN_API_KEY
方式2: 插件配置：dsh-docchain 插件的 Config（激活时自动写入
       ~/.dsh/storages/docchain-config.json，也可直接手动编辑该文件）：
       {"docchain_url": "http://<host>:7100/llmdoc", "docchain_api_key": "your-api-key"}
方式3: 配置文件 docchain-content-search/scripts/config.json， 如下格式：
```json
{
  "docchain_url": "http://<host>:7100/llmdoc",
  "docchain_api_key": "your-api-key",
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


def search_in_doc(
    doc_ids: List[int] = None,
    topic_ids: List[int] = None,
    keywords: List[str] = None,
    operator: str = "or",
    limit: int = 30,
) -> Dict[str, Any]:
    """
    在文档内容中搜索关键字

    Args:
        doc_ids: 文档 ID 列表
        topic_ids: 主题 ID 列表
        keywords: 要搜索的关键词列表
        operator: "or" 或 "and" 操作符
        limit: 返回结果的最大数量

    Returns:
        API 响应字典

    Raises:
        requests.RequestException: 如果 API 调用失败
    """
    config = get_config()

    api_url = config["docchain_url"].rstrip("/")
    endpoint = f"{api_url}/v1/skills/search_in_doc_content"

    # 准备请求
    headers = {"Content-Type": "application/json"}
    if config.get("docchain_api_key"):
        headers["X-Api-Key"] = config['docchain_api_key']

    payload = {
        "keywords": keywords,
        "operator": operator,
        "limit": limit
    }

    if doc_ids:
        payload["doc_ids"] = doc_ids
    if topic_ids:
        payload["topic_ids"] = topic_ids

    # 调用 API
    response = requests.post(endpoint, json=payload, headers=headers, timeout=30)
    response.raise_for_status()
    if not response.json().get("success", True):
        print(f"API请求失败: {response.json().get('err')}")
        sys.exit(1)
    return response.json()


def format_results(data: Dict[str, Any]) -> str:
    """
    格式化搜索结果用于显示

    Args:
        data: API 响应数据

    Returns:
        格式化的显示字符串
    """
    lines = []

    # 标题
    keywords = data.get('keywords', [])
    operator = data.get('operator', 'or')
    lines.append(f"🔍 关键词：{json.dumps(keywords, ensure_ascii=False)} ({operator.upper()})")

    results = data.get('results', [])
    if not results:
        lines.append("❌ 未找到匹配")
        return "\n".join(lines)

    total_matches = sum(len(r['data']) for r in results)
    lines.append(f"✅ 找到 {total_matches} 个匹配，涉及 {len(results)} 个文档\n")

    # 按文档分组显示结果
    for result in results:
        doc_name = result.get('doc_name', '未知文档')
        doc_id = result.get('doc_id', '?')
        topic_id = result.get('topic_id', '?')
        lines.append(f"📄 文档：{doc_name} (ID: {doc_id}, Topic: {topic_id})")

        for item in result.get('data', []):
            line_num = item['line_number']
            content = item['line_content'].strip()
            lines.append(f"  第 {line_num} 行：{content}")
        lines.append("")

    return "\n".join(lines)


def main():
    """主入口函数"""
    parser = argparse.ArgumentParser(
        description="在 docchain 文档内容中搜索关键字"
    )
    parser.add_argument(
        "--doc_ids",
        type=str,
        help="要搜索的文档 ID（逗号分隔，支持多个）"
    )
    parser.add_argument(
        "--topic_ids",
        type=str,
        help="要搜索的主题 ID（逗号分隔，支持多个）"
    )
    parser.add_argument(
        "--keywords",
        type=str,
        required=True,
        help="要搜索的关键词（逗号分隔）"
    )
    parser.add_argument(
        "--operator",
        type=str,
        choices=["or", "and"],
        default="or",
        help="关键词操作符：'or'（任意关键词）或 'and'（所有关键词）"
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=30,
        help="返回结果的最大数量（默认：30）"
    )

    args = parser.parse_args()

    # 解析 doc_ids
    doc_ids = None
    if args.doc_ids:
        doc_ids = [int(d.strip()) for d in args.doc_ids.split(",") if d.strip()]

    # 解析 topic_ids
    topic_ids = None
    if args.topic_ids:
        topic_ids = [int(t.strip()) for t in args.topic_ids.split(",") if t.strip()]

    if not doc_ids and not topic_ids:
        print("❌ 错误：必须提供 doc_ids 或 topic_ids 之一", file=sys.stderr)
        sys.exit(1)

    # 解析关键词
    keywords = [kw.strip() for kw in args.keywords.split(",") if kw.strip()]

    if not keywords:
        print("❌ 错误：未提供关键词", file=sys.stderr)
        sys.exit(1)

    try:

        # 执行搜索
        results = search_in_doc(
            doc_ids=doc_ids,
            topic_ids=topic_ids,
            keywords=keywords,
            operator=args.operator,
            limit=args.limit
        )

        # 显示结果
        print(format_results(results))

    except requests.HTTPError as e:
        if e.response.status_code == 404:
            print(f"❌ 错误：文档不存在", file=sys.stderr)
        elif e.response.status_code == 403:
            print(f"❌ 错误：无权限访问文档", file=sys.stderr)
        else:
            print(f"❌ 错误：API 请求失败：{e}", file=sys.stderr)
        sys.exit(1)

    except requests.RequestException as e:
        print(f"❌ 错误：网络错误：{e}", file=sys.stderr)
        sys.exit(1)

    except Exception as e:
        print(f"❌ 错误：{e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
