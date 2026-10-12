#!/usr/bin/env python3
"""
Docchain 文件名搜索脚本

根据关键字搜索 docchain 文档文件名
"""

import argparse
import json
import os
import sys
from typing import List, Dict, Any
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
方式3: 配置文件 docchain-filename-search/scripts/config.json， 如下格式：
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


def search_by_filename(
    keywords: List[str],
    config: Dict[str, Any],
    topic_ids: List[int] = None,
) -> Dict[str, Any]:
    """
    根据文件名关键字搜索文档

    Args:
        topic_ids: 要搜索的主题 ID 列表
        config: 配置文件
        keywords: 要搜索的关键词列表

    Returns:
        API 响应字典

    Raises:
        requests.RequestException: 如果 API 调用失败
    """

    api_url = config["docchain_url"].rstrip("/")
    endpoint = f"{api_url}/v1/skills/search_docs_by_filename"

    # 准备请求
    headers = {"Content-Type": "application/json"}
    if config.get("docchain_api_key"):
        headers["X-Api-Key"] = config['docchain_api_key']

    payload = {
        "topic_ids": topic_ids,
        "keywords": keywords
    }

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
    lines.append(f"🔍 搜索关键词：{json.dumps(data['keywords'], ensure_ascii=False)}")

    if data['total'] == 0:
        lines.append("❌ 未找到文档")
        return "\n".join(lines)

    lines.append(f"✅ 找到 {data['total']} 个文档\n")

    # 结果
    for result in data['results']:
        doc_id = result['doc_id']
        doc_name = result['doc_name']
        topic_id = result['topic_id']

        lines.append(f"📄 文档 ID: {doc_id} | {doc_name}")
        lines.append(f"   主题 ID: {topic_id})\n")

    return "\n".join(lines)


def main():
    """主入口函数"""
    parser = argparse.ArgumentParser(
        description="根据文件名关键字搜索 docchain 文档"
    )
    parser.add_argument(
        "--topic_ids",
        type=str,
        required=True,
        help="要搜索的主题 ID（逗号分隔）"
    )
    parser.add_argument(
        "--keywords",
        type=str,
        required=True,
        help="要搜索的关键词（逗号分隔）"
    )

    args = parser.parse_args()

    # 解析主题 ID
    try:
        topic_ids = [int(tid.strip()) for tid in args.topic_ids.split(",") if tid.strip()] if args.topic_ids else None
    except ValueError:
        print("❌ 错误：主题 ID 必须是数字", file=sys.stderr)
        sys.exit(1)

    # 解析关键词
    keywords = [kw.strip() for kw in args.keywords.split(",") if kw.strip()]

    if not keywords:
        print("❌ 错误：未提供关键词", file=sys.stderr)
        sys.exit(1)

    config = get_config()
    if not topic_ids:
        print("❌ 错误：必须提供 --topic_ids 参数", file=sys.stderr)
        sys.exit(1)

    try:
        # 执行搜索
        results = search_by_filename(
            topic_ids=topic_ids,
            config=config,
            keywords=keywords,
        )

        # 显示结果
        print(format_results(results))

    except requests.HTTPError as e:
        if e.response.status_code == 403:
            print(f"❌ 错误：无权限访问主题 {topic_ids}", file=sys.stderr)
        elif e.response.status_code == 404:
            print(f"❌ 错误：主题不存在", file=sys.stderr)
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
