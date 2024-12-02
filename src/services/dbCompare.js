const diff = require('deep-diff');

function compareSnapshots(snapshot1, snapshot2) {
    const differences = {
        schema: [],
        data: {}
    };

    // Compare schema
    const schemaDiffs = diff(snapshot1.schema, snapshot2.schema) || [];
    differences.schema = schemaDiffs.map(d => {
        return {
            table: d.path ? d.path[0] : 'unknown',
            type: d.kind,
            change: {
                from: d.lhs,
                to: d.rhs
            }
        };
    });

    // Compare data
    const tables = new Set([
        ...Object.keys(snapshot1.data),
        ...Object.keys(snapshot2.data)
    ]);

    for (const table of tables) {
        const tableDiffs = diff(
            snapshot1.data[table] || [],
            snapshot2.data[table] || []
        ) || [];

        if (tableDiffs.length > 0) {
            differences.data[table] = tableDiffs.map(d => {
                return {
                    type: d.kind,
                    path: d.path,
                    change: {
                        from: d.lhs,
                        to: d.rhs
                    }
                };
            });
        }
    }

    return differences;
}

module.exports = {
    compareSnapshots
};
