# PostgreSQL MCP Server

PostgreSQL 데이터베이스와 연동하여 SQL 쿼리를 실행할 수 있는 MCP(Model Context Protocol) 서버입니다. Cursor와 같은 AI 에이전트 환경에서 데이터베이스 작업을 수행할 수 있도록 해줍니다.

## MCP(Model Context Protocol)란?

MCP(Model Context Protocol)는 AI 기반 개발 환경(예: Cursor AI)에 사용자 정의 도구를 통합할 수 있게 해주는 프레임워크입니다. AI 어시스턴트가 사용자 요청에 따라 특정 도구를 호출해 외부 서비스와 상호작용할 수 있도록 합니다.

## 설치 방법

1. 필요한 패키지 설치:
```
npm install
```

2. 서버 설정 자동화 스크립트 실행:

Windows 환경:
```
powershell -ExecutionPolicy Bypass -File .\scripts\update_config.ps1
```

Linux/macOS 환경:
```
chmod +x ./scripts/update_config.sh
./scripts/update_config.sh
```

3. MCP 서버 실행:
```
npm start
```

## MCP 도구 목록

이 MCP 서버는 다음 도구를 제공합니다:

1. **mcp_postgres_setup** - 데이터베이스 연결 설정
```javascript
{
  host: "localhost",
  port: 5432,
  database: "mydb",
  user: "postgres",
  password: "password",
  ssl: false
}
```

2. **mcp_postgres_query** - SQL 쿼리 실행
```javascript
{
  sql: "SELECT * FROM users WHERE id = 1;"
}
```

3. **mcp_postgres_status** - 데이터베이스 연결 상태 확인

4. **mcp_postgres_list_tables** - 테이블 목록 조회

5. **mcp_postgres_describe_table** - 테이블 스키마 조회
```javascript
{
  tableName: "users"
}
```

## Cursor AI와의 통합

1. Cursor에서 `.cursor/mcp.json` 파일을 통해 이 MCP 서버를 자동으로 발견하고 실행합니다.
2. Agent 모드가 활성화된 Cursor Composer에서 자연어로 다음과 같은 요청을 할 수 있습니다:

```
데이터베이스 연결 설정해줘. 호스트는 localhost, 포트는 5432, 데이터베이스 이름은 mydb, 사용자는 postgres, 비밀번호는 password야.
```

또는

```
users 테이블에서 모든 데이터를 가져와줘
```

AI 에이전트는 이러한 요청을 적절한 MCP 도구 호출로 변환하여 실행합니다.

## 전역 설정하기 (옵션)

Cursor AI의 글로벌 환경에서 이 MCP 서버를 사용하려면, `.cursor` 폴더를 Cursor AI 설정 디렉토리로 이동하세요:

Windows:
```
copy .cursor\mcp.json %USERPROFILE%\.cursor\
```

macOS/Linux:
```
cp .cursor/mcp.json ~/.cursor/
```

## 참고 자료

- [Model Context Protocol 소개](https://modelcontextprotocol.org/)
- [MCP TypeScript SDK](https://github.com/model-context-protocol/typescript-sdk)