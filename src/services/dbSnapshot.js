const sql = require('mssql');

const config = {
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    server: process.env.DB_SERVER,
    database: process.env.DB_NAME,
    options: {
        encrypt: true,
        trustServerCertificate: true
    }
};

async function getTables() {
    try {
        const pool = await sql.connect(config);
        const result = await pool.request().query(`
            SELECT 
                t.[name] as [table_name],
                (SELECT SUM(p2.rows) 
                 FROM sys.partitions p2 
                 WHERE p2.object_id = t.object_id) as [row_count],
                CAST(
                    (SELECT SUM(a2.total_pages) * 8 / 1024.0
                     FROM sys.indexes i2
                     JOIN sys.partitions p2 ON i2.object_id = p2.object_id AND i2.index_id = p2.index_id
                     JOIN sys.allocation_units a2 ON p2.partition_id = a2.container_id
                     WHERE i2.object_id = t.object_id)
                AS DECIMAL(10,2)) as [total_space_mb]
            FROM sys.tables t
            WHERE t.is_ms_shipped = 0
            ORDER BY t.[name];
        `);

        // Map the results to match the expected property names
        return result.recordset.map(record => ({
            tableName: record.table_name,
            rowCount: record.row_count || 0,
            totalSpaceMB: record.total_space_mb || 0
        }));
    } catch (error) {
        console.error('Error getting tables:', error);
        throw error;
    } finally {
        sql.close();
    }
}

async function takeSnapshot(selectedTables = []) {
    try {
        const pool = await sql.connect(config);
        
        // Get table structure only for selected tables
        const schema = await pool.request().query(`
            SELECT 
                t.name AS TableName,
                c.name AS ColumnName,
                ty.name AS DataType,
                c.max_length,
                c.is_nullable
            FROM sys.tables t
            INNER JOIN sys.columns c ON t.object_id = c.object_id
            INNER JOIN sys.types ty ON c.user_type_id = ty.user_type_id
            ${selectedTables.length ? `WHERE t.name IN (${selectedTables.map(t => `'${t}'`).join(',')})` : ''}
            ORDER BY t.name, c.column_id
        `);

        // Get table row counts
        const tables = selectedTables.length ? selectedTables : schema.recordset.reduce((acc, row) => {
            if (!acc.includes(row.TableName)) {
                acc.push(row.TableName);
            }
            return acc;
        }, []);

        const tableRowCounts = {};
        let processedTables = 0;
        const totalTables = tables.length;

        for (const table of tables) {
            processedTables++;
            const progress = {
                stage: 'counting',
                table,
                processed: processedTables,
                total: totalTables,
                percentage: Math.round((processedTables / totalTables) * 100)
            };
            
            global.io.emit('snapshot-progress', progress);
            
            const result = await pool.request()
                .query(`SELECT COUNT(*) as count FROM [${table}]`);
            tableRowCounts[table] = result.recordset[0].count;
        }

        return {
            timestamp: new Date(),
            schema: schema.recordset,
            rowCounts: tableRowCounts
        };
    } catch (error) {
        console.error('Error taking snapshot:', error);
        throw error;
    } finally {
        sql.close();
    }
}

async function testConnection() {
    try {
        const pool = await sql.connect(config);
        await pool.request().query('SELECT 1');
        return true;
    } catch (error) {
        console.error('Database connection test failed:', error);
        throw error;
    } finally {
        sql.close();
    }
}

module.exports = {
    getTables,
    takeSnapshot,
    testConnection
};
