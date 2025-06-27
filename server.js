const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Database configuration
let dbConfig = {};
const configPath = path.join(__dirname, 'db-config.json');

// Check if configuration exists
const configExists = fs.existsSync(configPath);
if (configExists) {
  dbConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
}

// Pool for PostgreSQL connections
let pool = null;
if (configExists) {
  pool = new Pool(dbConfig);
}

// MCP Setup Route
app.post('/mcp/setup', (req, res) => {
  const { host, port, database, user, password } = req.body;
  
  if (!host || !database || !user) {
    return res.status(400).json({ error: 'Missing required database configuration' });
  }

  const newConfig = {
    host,
    port: port || 5432,
    database,
    user,
    password,
    // Optional connection parameters
    max: 20, // Maximum number of clients in the pool
    idleTimeoutMillis: 30000, // How long a client is allowed to remain idle before being closed
    connectionTimeoutMillis: 2000 // How long to wait for a connection
  };

  // Test the connection before saving
  const testPool = new Pool(newConfig);
  testPool.query('SELECT NOW()', (err) => {
    if (err) {
      return res.status(500).json({ error: 'Database connection failed', details: err.message });
    }

    // Save the configuration
    fs.writeFileSync(configPath, JSON.stringify(newConfig, null, 2));
    
    // Update the current pool
    if (pool) {
      pool.end(); // Close previous connections
    }
    
    pool = testPool; // Use the new connection
    
    res.json({ success: true, message: 'MCP setup completed successfully' });
  });
});

// CRUD Operations

// Execute any query (READ)
app.post('/mcp/query', async (req, res) => {
  if (!pool) {
    return res.status(500).json({ error: 'Database not configured. Please run setup first.' });
  }

  const { query, params } = req.body;
  
  if (!query) {
    return res.status(400).json({ error: 'Query is required' });
  }

  try {
    const result = await pool.query(query, params || []);
    res.json({ success: true, data: result.rows, rowCount: result.rowCount });
  } catch (error) {
    res.status(500).json({ error: 'Query execution failed', details: error.message });
  }
});

// Create record
app.post('/mcp/create', async (req, res) => {
  if (!pool) {
    return res.status(500).json({ error: 'Database not configured. Please run setup first.' });
  }

  const { table, data } = req.body;
  
  if (!table || !data) {
    return res.status(400).json({ error: 'Table name and data are required' });
  }

  const columns = Object.keys(data);
  const values = Object.values(data);
  
  const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
  const query = `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders}) RETURNING *`;

  try {
    const result = await pool.query(query, values);
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ error: 'Create operation failed', details: error.message });
  }
});

// Read records
app.post('/mcp/read', async (req, res) => {
  if (!pool) {
    return res.status(500).json({ error: 'Database not configured. Please run setup first.' });
  }

  const { table, conditions, limit, offset, orderBy } = req.body;
  
  if (!table) {
    return res.status(400).json({ error: 'Table name is required' });
  }

  let query = `SELECT * FROM ${table}`;
  const values = [];
  
  // Add WHERE conditions if provided
  if (conditions && Object.keys(conditions).length > 0) {
    const whereConditions = [];
    Object.entries(conditions).forEach(([column, value], index) => {
      whereConditions.push(`${column} = $${index + 1}`);
      values.push(value);
    });
    query += ` WHERE ${whereConditions.join(' AND ')}`;
  }
  
  // Add ORDER BY if provided
  if (orderBy) {
    query += ` ORDER BY ${orderBy}`;
  }
  
  // Add LIMIT and OFFSET if provided
  if (limit) {
    query += ` LIMIT ${limit}`;
  }
  
  if (offset) {
    query += ` OFFSET ${offset}`;
  }

  try {
    const result = await pool.query(query, values);
    res.json({ success: true, data: result.rows, rowCount: result.rowCount });
  } catch (error) {
    res.status(500).json({ error: 'Read operation failed', details: error.message });
  }
});

// Update records
app.post('/mcp/update', async (req, res) => {
  if (!pool) {
    return res.status(500).json({ error: 'Database not configured. Please run setup first.' });
  }

  const { table, data, conditions } = req.body;
  
  if (!table || !data || !conditions) {
    return res.status(400).json({ 
      error: 'Table name, data to update, and conditions are required' 
    });
  }

  const updateColumns = Object.keys(data);
  const updateValues = Object.values(data);
  
  // Prepare SET part of the query
  const setClause = updateColumns
    .map((col, i) => `${col} = $${i + 1}`)
    .join(', ');
  
  // Prepare WHERE part of the query
  const whereColumns = Object.keys(conditions);
  const whereValues = Object.values(conditions);
  
  const whereClause = whereColumns
    .map((col, i) => `${col} = $${i + updateValues.length + 1}`)
    .join(' AND ');
  
  const query = `UPDATE ${table} SET ${setClause} WHERE ${whereClause} RETURNING *`;
  const values = [...updateValues, ...whereValues];

  try {
    const result = await pool.query(query, values);
    res.json({ success: true, data: result.rows, rowCount: result.rowCount });
  } catch (error) {
    res.status(500).json({ error: 'Update operation failed', details: error.message });
  }
});

// Delete records
app.post('/mcp/delete', async (req, res) => {
  if (!pool) {
    return res.status(500).json({ error: 'Database not configured. Please run setup first.' });
  }

  const { table, conditions } = req.body;
  
  if (!table || !conditions) {
    return res.status(400).json({ error: 'Table name and conditions are required' });
  }

  const whereColumns = Object.keys(conditions);
  const whereValues = Object.values(conditions);
  
  const whereClause = whereColumns
    .map((col, i) => `${col} = $${i + 1}`)
    .join(' AND ');
  
  const query = `DELETE FROM ${table} WHERE ${whereClause} RETURNING *`;

  try {
    const result = await pool.query(query, whereValues);
    res.json({ success: true, data: result.rows, rowCount: result.rowCount });
  } catch (error) {
    res.status(500).json({ error: 'Delete operation failed', details: error.message });
  }
});

// Get database status and configuration info (without exposing password)
app.get('/mcp/status', async (req, res) => {
  if (!pool) {
    return res.status(200).json({ configured: false });
  }
  
  try {
    // Test the connection
    await pool.query('SELECT NOW()');
    
    // Return sanitized config (without password)
    const config = { ...dbConfig };
    if (config.password) {
      config.password = '********';
    }
    
    res.json({
      configured: true,
      status: 'connected',
      config
    });
  } catch (error) {
    res.json({
      configured: true,
      status: 'error',
      error: error.message
    });
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`MCP Server running on port ${PORT}`);
  
  if (configExists) {
    console.log('Database configuration found. Server is ready to handle queries.');
  } else {
    console.log('No database configuration found. Please set up the database first at /mcp/setup');
  }
}); 