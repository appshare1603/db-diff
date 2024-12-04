// Initialize state
let snapshots = window.initialSnapshots || [];
let availableTables = [];
const socket = io();

// UI Elements object - globally accessible
const elements = {
    selectTablesBtn: null,
    testConnectionBtn: null,
    snapshotProgress: null,
    compareBtn: null,
    tableSelectionModal: null,
    snapshotViewModal: null,
    tableList: null,
    progressBar: null,
    progressDiv: null,
    progressStatus: null,
    tableSearch: null,
    selectAllBtn: null,
    deselectAllBtn: null,
    showTableSizes: null,
    confirmTableSelection: null
};

// Initialize UI when document is ready
document.addEventListener('DOMContentLoaded', () => {
    // Initialize UI Elements
    elements.selectTablesBtn = document.getElementById('selectTables');
    elements.testConnectionBtn = document.getElementById('testConnection');
    elements.snapshotProgress = document.getElementById('snapshotProgress');
    elements.compareBtn = document.getElementById('compareBtn');
    elements.tableSelectionModal = new bootstrap.Modal(document.getElementById('tableSelectionModal'));
    elements.snapshotViewModal = new bootstrap.Modal(document.getElementById('snapshotViewModal'));
    elements.tableList = document.getElementById('tableList');
    elements.progressBar = document.querySelector('.progress-bar');
    elements.progressDiv = document.getElementById('snapshotProgress');
    elements.progressStatus = document.getElementById('progressStatus');
    elements.tableSearch = document.getElementById('tableSearch');
    elements.selectAllBtn = document.getElementById('selectAll');
    elements.deselectAllBtn = document.getElementById('deselectAll');
    elements.showTableSizes = document.getElementById('showTableSizes');
    elements.confirmTableSelection = document.getElementById('confirmTableSelection');

    // Initialize UI
    initializeUI();
});

function initializeUI() {
    // Update snapshots and load tables
    updateSnapshotSelects();
    loadTables();

    // Add event listeners only if elements exist
    if (elements.selectTablesBtn) {
        elements.selectTablesBtn.addEventListener('click', async () => {
            await loadTables();
            elements.tableSelectionModal.show();
        });
    }

    if (elements.testConnectionBtn) {
        elements.testConnectionBtn.addEventListener('click', async () => {
            try {
                elements.testConnectionBtn.disabled = true;
                elements.testConnectionBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Testing...';
                
                const response = await fetch('/api/test-connection', {
                    method: 'POST'
                });
                
                const result = await response.json();
                if (result.success) {
                    alert('Database connection successful!');
                } else {
                    throw new Error(result.error);
                }
            } catch (error) {
                alert('Connection failed: ' + error.message);
            } finally {
                elements.testConnectionBtn.disabled = false;
                elements.testConnectionBtn.innerHTML = 'Test Connection';
            }
        });
    }

    if (elements.compareBtn) {
        elements.compareBtn.addEventListener('click', () => compareSnapshots());
    }

    if (elements.tableSearch) {
        elements.tableSearch.addEventListener('input', renderTableList);
    }

    if (elements.showTableSizes) {
        elements.showTableSizes.addEventListener('change', renderTableList);
    }

    if (elements.selectAllBtn) {
        elements.selectAllBtn.addEventListener('click', () => {
            elements.tableList.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = true);
        });
    }

    if (elements.deselectAllBtn) {
        elements.deselectAllBtn.addEventListener('click', () => {
            elements.tableList.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = false);
        });
    }

    if (elements.confirmTableSelection) {
        elements.confirmTableSelection.addEventListener('click', async () => {
            try {
                const selectedTables = getSelectedTables();
                
                if (selectedTables.length === 0) {
                    alert('Please select at least one table');
                    return;
                }

                showProgress(true);
                elements.progressBar.style.width = '0%';
                elements.progressBar.setAttribute('aria-valuenow', 0);
                elements.progressBar.textContent = '0%';
                elements.progressStatus.textContent = 'Starting snapshot...';

                const response = await fetch('/api/snapshot', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ tables: selectedTables })
                });
                const result = await response.json();
                
                if (result.success) {
                    elements.tableSelectionModal.hide();
                    snapshots.push(result.snapshot);
                    await updateSnapshotSelects();
                    alert('Snapshot taken successfully!');
                } else {
                    throw new Error(result.error);
                }
            } catch (error) {
                alert('Error taking snapshot: ' + error.message);
            } finally {
                showProgress(false);
            }
        });
    }

    // Socket event listeners
    socket.on('snapshot-progress', (progress) => {
        if (elements.snapshotProgress && elements.progressBar && elements.progressStatus) {
            updateProgress(progress, elements.snapshotProgress, elements.progressBar, elements.progressStatus);
        }
    });
}

async function loadTables() {
    try {
        const response = await fetch('/api/tables');
        const result = await response.json();
        
        if (result.success) {
            availableTables = result.tables;
            renderTableList();
        } else {
            throw new Error(result.error);
        }
    } catch (error) {
        alert('Error loading tables: ' + error.message);
    }
}

function renderTableList() {
    if (!elements.tableList || !elements.tableSearch || !elements.showTableSizes) return;

    const searchTerm = elements.tableSearch.value.toLowerCase();
    const showSizes = elements.showTableSizes.checked;
    
    elements.tableList.innerHTML = availableTables
        .filter(table => table.tableName.toLowerCase().includes(searchTerm))
        .map(table => `
            <label class="list-group-item">
                <input class="form-check-input me-1" type="checkbox" value="${table.tableName}">
                ${table.tableName}
                ${showSizes ? `<small class="text-muted">(${table.rowCount} rows, ${table.totalSpaceMb} MB)</small>` : ''}
            </label>
        `)
        .join('');
}

function getSelectedTables() {
    if (!elements.tableList) return [];
    return Array.from(elements.tableList.querySelectorAll('input[type="checkbox"]:checked'))
        .map(cb => cb.value);
}

function updateProgress(progress) {
    if (!elements.progressBar || !elements.progressStatus) return;
    
    elements.progressBar.style.width = `${progress.percentage}%`;
    elements.progressBar.setAttribute('aria-valuenow', progress.percentage);
    elements.progressBar.textContent = `${progress.percentage}%`;
    elements.progressStatus.textContent = progress.message;
}

function showProgress(show) {
    if (!elements.progressDiv || !elements.testConnectionBtn) return;
    
    elements.progressDiv.classList.toggle('d-none', !show);
    elements.testConnectionBtn.disabled = show;
}

async function updateSnapshotSelects() {
    const selects = ['snapshot1', 'snapshot2'];
    selects.forEach(selectId => {
        const select = document.getElementById(selectId);
        select.innerHTML = '<option value="">Select a snapshot...</option>';
        
        snapshots.forEach((snapshot, index) => {
            const option = document.createElement('option');
            option.value = index;
            option.textContent = new Date(snapshot.timestamp).toLocaleString();
            select.appendChild(option);
        });
    });
}

async function deleteSnapshot(timestamp) {
    try {
        const response = await fetch(`/api/snapshots/${timestamp}`, {
            method: 'DELETE'
        });
        const result = await response.json();
        
        if (result.success) {
            snapshots = result.snapshots;
            await updateSnapshotSelects();
            alert('Snapshot deleted successfully');
        } else {
            throw new Error(result.error);
        }
    } catch (error) {
        alert('Error deleting snapshot: ' + error.message);
    }
}

async function deleteSnapshotFromSelect(selectId) {
    const select = document.getElementById(selectId);
    const snapshotIndex = select.value;
    
    if (!snapshotIndex || !snapshots[snapshotIndex]) {
        alert('Please select a valid snapshot');
        return;
    }

    const snapshot = snapshots[snapshotIndex];
    if (confirm('Are you sure you want to delete this snapshot?')) {
        await deleteSnapshot(snapshot.timestamp);
    }
}

async function compareSnapshots() {
    const snapshot1Index = document.getElementById('snapshot1').value;
    const snapshot2Index = document.getElementById('snapshot2').value;

    if (!snapshot1Index || !snapshot2Index) {
        alert('Please select two snapshots to compare');
        return;
    }

    const snapshot1 = snapshots[snapshot1Index];
    const snapshot2 = snapshots[snapshot2Index];

    try {
        const response = await fetch('/api/compare', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ snapshot1, snapshot2 })
        });

        const result = await response.json();
        if (result.success) {
            displayDifferences(result.differences);
        } else {
            throw new Error(result.error);
        }
    } catch (error) {
        alert('Error comparing snapshots: ' + error.message);
    }
}

function viewSnapshot(selectId) {
    const snapshotIndex = document.getElementById(selectId).value;
    if (!snapshotIndex || !snapshots[snapshotIndex]) {
        alert('Please select a valid snapshot');
        return;
    }

    const snapshot = snapshots[snapshotIndex];
    
    // Add delete button to modal header
    const modalTitle = document.querySelector('#snapshotViewModal .modal-title');
    modalTitle.innerHTML = `
        Snapshot Details
        <button class="btn btn-sm btn-outline-danger ms-3" 
                onclick="deleteSnapshotFromSelect('${selectId}')">
            <i class="bi bi-trash"></i> Delete
        </button>
    `;
    
    // Update timestamp
    document.getElementById('snapshotTimestamp').textContent = new Date(snapshot.timestamp).toLocaleString();
    
    // Update row counts table
    const rowCountsBody = document.getElementById('snapshotRowCounts');
    rowCountsBody.innerHTML = '';
    
    Object.entries(snapshot.rowCounts)
        .sort(([a], [b]) => a.localeCompare(b))
        .forEach(([table, count]) => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${table}</td>
                <td>${count.toLocaleString()}</td>
            `;
            rowCountsBody.appendChild(row);
        });
    
    // Update schema table
    const schemaBody = document.getElementById('snapshotSchema');
    schemaBody.innerHTML = '';
    
    // Group schema by table
    const schemaByTable = snapshot.schema.reduce((acc, col) => {
        if (!acc[col.TableName]) {
            acc[col.TableName] = [];
        }
        acc[col.TableName].push(col);
        return acc;
    }, {});
    
    // Sort tables and display schema
    Object.entries(schemaByTable)
        .sort(([a], [b]) => a.localeCompare(b))
        .forEach(([table, columns]) => {
            columns.forEach((col, idx) => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${idx === 0 ? `<strong>${table}</strong>` : ''}</td>
                    <td>${col.ColumnName}</td>
                    <td>${col.DataType}${col.max_length > 0 ? `(${col.max_length})` : ''}</td>
                    <td>${col.is_nullable ? 'Yes' : 'No'}</td>
                `;
                schemaBody.appendChild(row);
            });
        });
    
    elements.snapshotViewModal.show();
}

// Make functions globally accessible for event handlers
window.deleteSnapshot = deleteSnapshot;
window.viewSnapshot = viewSnapshot;
window.compareSnapshots = compareSnapshots;
window.deleteSnapshotFromSelect = deleteSnapshotFromSelect;

function displayDifferences(differences) {
    const schemaChangesDiv = document.getElementById('schemaChanges');
    const dataChangesDiv = document.getElementById('dataChanges');
    
    // Display schema changes
    schemaChangesDiv.innerHTML = '';
    if (differences.schema.length === 0) {
        schemaChangesDiv.innerHTML = '<p>No schema changes detected</p>';
    } else {
        differences.schema.forEach(change => {
            const changeElement = document.createElement('div');
            changeElement.className = 'alert alert-info';
            changeElement.textContent = `Table: ${change.table} - ${formatSchemaChange(change)}`;
            schemaChangesDiv.appendChild(changeElement);
        });
    }
    
    // Display row count changes
    dataChangesDiv.innerHTML = '';
    const rowCountChanges = differences.rowCounts;
    const tables = Object.keys(rowCountChanges);
    
    if (tables.length === 0) {
        dataChangesDiv.innerHTML = '<p>No row count changes detected</p>';
    } else {
        tables.forEach(table => {
            const change = rowCountChanges[table];
            const changeElement = document.createElement('div');
            changeElement.className = 'alert alert-' + (change.difference > 0 ? 'success' : 'warning');
            
            const diffText = change.difference > 0 ? 
                `increased by ${change.difference}` : 
                `decreased by ${Math.abs(change.difference)}`;
            
            changeElement.innerHTML = `
                <strong>${table}</strong>: Row count ${diffText}<br>
                <small>From ${change.from} to ${change.to} rows</small>
            `;
            
            dataChangesDiv.appendChild(changeElement);
        });
    }
}

function formatSchemaChange(change) {
    switch (change.type) {
        case 'N':
            return `Added ${change.change.to}`;
        case 'D':
            return `Removed ${change.change.from}`;
        case 'E':
            return `Changed from ${change.change.from} to ${change.change.to}`;
        case 'A':
            return `Array changed`;
        default:
            return `Unknown change type`;
    }
}
