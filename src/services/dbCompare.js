const diff = require('deep-diff');

function compareSnapshots(snapshot1, snapshot2) {
    const differences = {
        schema: [],
        rowCounts: {}
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

    // Compare row counts
    const tables = new Set([
        ...Object.keys(snapshot1.rowCounts),
        ...Object.keys(snapshot2.rowCounts)
    ]);

    for (const table of tables) {
        const count1 = snapshot1.rowCounts[table] || 0;
        const count2 = snapshot2.rowCounts[table] || 0;

        if (count1 !== count2) {
            differences.rowCounts[table] = {
                from: count1,
                to: count2,
                difference: count2 - count1
            };
        }
    }

    return differences;
}

module.exports = {
    compareSnapshots
};
