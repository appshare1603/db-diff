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
                t.name AS tableName,
                p.rows AS rowCount,
                ROUND(SUM(a.total_pages) * 8 / 1024.0, 2) AS totalSpaceMB
            FROM sys.tables t
            INNER JOIN sys.indexes i ON t.object_id = i.object_id
            INNER JOIN sys.partitions p ON i.object_id = p.object_id AND i.index_id = p.index_id
            INNER JOIN sys.allocation_units a ON p.partition_id = a.container_id
            WHERE t.is_ms_shipped = 0
            GROUP BY t.name, p.rows
            ORDER BY t.name
        `);
        return result.recordset;
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

        // Get table data
        const tables = selectedTables.length ? selectedTables : schema.recordset.reduce((acc, row) => {
            if (!acc.includes(row.TableName)) {
                acc.push(row.TableName);
            }
            return acc;
        }, []);

        const tableData = {};
        let processedTables = 0;
        const totalTables = tables.length;

        for (const table of tables) {
            processedTables++;
            const progress = {
                stage: 'data',
                table,
                processed: processedTables,
                total: totalTables,
                percentage: Math.round((processedTables / totalTables) * 100)
            };
            
            global.io.emit('snapshot-progress', progress);
            
            const data = await pool.request()
                .query(`SELECT * FROM [${table}]`);
            tableData[table] = data.recordset;
        }

        return {
            timestamp: new Date(),
            schema: schema.recordset,
            data: tableData
        };

    } catch (error) {
        console.error('Error taking database snapshot:', error);
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
