#!/bin/bash

# 필요한 디렉터리 생성
mkdir -p .cursor

# 노드 실행 파일 경로 찾기
NODE_PATH=$(which node)

# 현재 디렉터리의 절대 경로 가져오기
SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
PROJECT_DIR=$(dirname "$SCRIPT_DIR")
SERVER_PATH="$PROJECT_DIR/mcp-postgres-server.js"

# MCP 서버 구성 파일 생성
cat > .cursor/mcp.json << EOF
{
  "mcpServers": {
    "PostgreSQL MCP Server": {
      "command": "$NODE_PATH",
      "args": ["$SERVER_PATH"],
      "env": {}
    }
  }
}
EOF

echo "MCP 설정이 업데이트되었습니다."
echo "노드 경로: $NODE_PATH"
echo "서버 스크립트 경로: $SERVER_PATH" 