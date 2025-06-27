import { McpServer, McpTool, StdioServerTransport } from '@modelcontextprotocol/sdk';
import { z } from 'zod';
import pg from 'pg';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// __dirname 설정 (ES 모듈에서는 __dirname이 없음)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 환경 변수 로드
dotenv.config();

// 데이터베이스 설정 파일 경로
const configPath = path.join(__dirname, 'db-config.json');
let dbConfig = {};
let pool = null;

// 설정 파일이 존재하는지 확인
if (fs.existsSync(configPath)) {
  try {
    dbConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    pool = new pg.Pool(dbConfig);
    console.log('Database configuration loaded');
  } catch (error) {
    console.error('Failed to load database configuration:', error);
  }
}

// SQL 쿼리 실행 도구
const sqlQueryTool = new McpTool({
  name: 'mcp_postgres_query',
  description: 'Run a read-only SQL query',
  schema: {
    parameters: z.object({
      sql: z.string().describe('SQL query to execute')
    }),
    returns: z.any().describe('Query results')
  },
  handler: async ({ sql }) => {
    if (!pool) {
      throw new Error('Database not configured. Please set up the database first using mcp_postgres_setup.');
    }

    try {
      const result = await pool.query(sql);
      return {
        rows: result.rows,
        rowCount: result.rowCount,
        command: result.command
      };
    } catch (error) {
      throw new Error(`Query execution failed: ${error.message}`);
    }
  }
});

// 데이터베이스 설정 도구
const setupDatabaseTool = new McpTool({
  name: 'mcp_postgres_setup',
  description: 'Set up PostgreSQL database connection',
  schema: {
    parameters: z.object({
      host: z.string().describe('Database host'),
      port: z.number().optional().default(5432).describe('Database port'),
      database: z.string().describe('Database name'),
      user: z.string().describe('Database user'),
      password: z.string().optional().describe('Database password'),
      ssl: z.boolean().optional().default(false).describe('Use SSL connection')
    }),
    returns: z.object({
      success: z.boolean(),
      message: z.string()
    }).describe('Setup result')
  },
  handler: async ({ host, port, database, user, password, ssl }) => {
    // 기존 연결 종료
    if (pool) {
      await pool.end();
      pool = null;
    }

    // 새 설정 생성
    const newConfig = {
      host,
      port: port || 5432,
      database,
      user,
      password,
      ssl: ssl || false,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000
    };

    try {
      // 연결 테스트
      const testPool = new pg.Pool(newConfig);
      await testPool.query('SELECT NOW()');
      
      // 설정 저장
      fs.writeFileSync(configPath, JSON.stringify(newConfig, null, 2));
      
      // 풀 업데이트
      pool = testPool;
      dbConfig = newConfig;
      
      return {
        success: true,
        message: 'PostgreSQL connection established successfully'
      };
    } catch (error) {
      throw new Error(`Failed to connect to PostgreSQL database: ${error.message}`);
    }
  }
});

// 데이터베이스 상태 확인 도구
const checkDatabaseStatusTool = new McpTool({
  name: 'mcp_postgres_status',
  description: 'Check PostgreSQL database connection status',
  schema: {
    parameters: z.object({}),
    returns: z.object({
      configured: z.boolean(),
      status: z.string().optional(),
      connection: z.object({
        host: z.string(),
        port: z.number(),
        database: z.string(),
        user: z.string()
      }).optional(),
      error: z.string().optional()
    }).describe('Database status')
  },
  handler: async () => {
    if (!pool) {
      return {
        configured: false,
        status: 'not_configured'
      };
    }
    
    try {
      const result = await pool.query('SELECT NOW() as current_time');
      
      // 민감 정보 제외
      const safeConfig = { ...dbConfig };
      delete safeConfig.password;
      
      return {
        configured: true,
        status: 'connected',
        connection: {
          host: safeConfig.host,
          port: safeConfig.port,
          database: safeConfig.database,
          user: safeConfig.user
        }
      };
    } catch (error) {
      return {
        configured: true,
        status: 'error',
        error: error.message
      };
    }
  }
});

// 테이블 목록 조회 도구
const listTablesTool = new McpTool({
  name: 'mcp_postgres_list_tables',
  description: 'List all tables in the database',
  schema: {
    parameters: z.object({}),
    returns: z.array(z.string()).describe('List of table names')
  },
  handler: async () => {
    if (!pool) {
      throw new Error('Database not configured. Please set up the database first using mcp_postgres_setup.');
    }
    
    try {
      const result = await pool.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        ORDER BY table_name
      `);
      
      return result.rows.map(row => row.table_name);
    } catch (error) {
      throw new Error(`Failed to list tables: ${error.message}`);
    }
  }
});

// 테이블 스키마 조회 도구
const describeTableTool = new McpTool({
  name: 'mcp_postgres_describe_table',
  description: 'Get detailed information about a table',
  schema: {
    parameters: z.object({
      tableName: z.string().describe('Name of the table to describe')
    }),
    returns: z.array(z.object({
      column_name: z.string(),
      data_type: z.string(),
      is_nullable: z.string(),
      column_default: z.string().nullable()
    })).describe('Table schema information')
  },
  handler: async ({ tableName }) => {
    if (!pool) {
      throw new Error('Database not configured. Please set up the database first using mcp_postgres_setup.');
    }
    
    try {
      const result = await pool.query(`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = $1
        ORDER BY ordinal_position
      `, [tableName]);
      
      return result.rows;
    } catch (error) {
      throw new Error(`Failed to describe table: ${error.message}`);
    }
  }
});

// MCP 서버 생성 및 도구 등록
const server = new McpServer({
  tools: [
    sqlQueryTool,
    setupDatabaseTool,
    checkDatabaseStatusTool,
    listTablesTool,
    describeTableTool
  ],
  serverInfo: {
    name: 'PostgreSQL MCP Server',
    version: '1.0.0',
    supportedTools: ['mcp_postgres_query', 'mcp_postgres_setup', 'mcp_postgres_status', 
                     'mcp_postgres_list_tables', 'mcp_postgres_describe_table']
  }
});

// 서버 시작
const transport = new StdioServerTransport();
server.listen(transport).then(() => {
  console.log('PostgreSQL MCP Server is running');
}).catch(err => {
  console.error('Failed to start PostgreSQL MCP Server:', err);
});

// 프로세스 종료 처리
process.on('SIGINT', async () => {
  if (pool) {
    await pool.end();
  }
  process.exit(0);
});

process.on('SIGTERM', async () => {
  if (pool) {
    await pool.end();
  }
  process.exit(0);
}); 