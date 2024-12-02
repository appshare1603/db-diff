let snapshots = [];
const socket = io();

// UI Elements
const takeSnapshotBtn = document.getElementById('takeSnapshot');
const testConnectionBtn = document.getElementById('testConnection');
const progressBar = document.querySelector('.progress-bar');
const progressDiv = document.getElementById('snapshotProgress');
const progressStatus = document.getElementById('progressStatus');

function updateProgress(progress) {
    progressBar.style.width = `${progress.percentage}%`;
    progressBar.setAttribute('aria-valuenow', progress.percentage);
    progressBar.textContent = `${progress.percentage}%`;
    progressStatus.textContent = `Processing table ${progress.processed} of ${progress.total}: ${progress.table}`;
}

function showProgress(show) {
    progressDiv.classList.toggle('d-none', !show);
    takeSnapshotBtn.disabled = show;
    testConnectionBtn.disabled = show;
}

socket.on('snapshot-progress', (progress) => {
    showProgress(true);
    updateProgress(progress);
});

document.getElementById('testConnection').addEventListener('click', async () => {
    try {
        const response = await fetch('/api/test-connection', {
            method: 'POST'
        });
        const result = await response.json();
        
        if (result.success) {
            alert(result.message);
        } else {
            throw new Error(result.error);
        }
    } catch (error) {
        alert('Database connection failed: ' + error.message);
    }
});

document.getElementById('takeSnapshot').addEventListener('click', async () => {
    try {
        showProgress(true);
        progressBar.style.width = '0%';
        progressBar.setAttribute('aria-valuenow', 0);
        progressBar.textContent = '0%';
        progressStatus.textContent = 'Starting snapshot...';

        const response = await fetch('/api/snapshot', {
            method: 'POST'
        });
        const result = await response.json();
        
        if (result.success) {
            snapshots.push(result.snapshot);
            updateSnapshotSelects();
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

document.getElementById('compare').addEventListener('click', async () => {
    const snapshot1Index = document.getElementById('snapshot1').value;
    const snapshot2Index = document.getElementById('snapshot2').value;
    
    if (snapshot1Index === snapshot2Index) {
        alert('Please select different snapshots to compare');
        return;
    }

    try {
        const response = await fetch('/api/compare', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                snapshot1: snapshots[snapshot1Index],
                snapshot2: snapshots[snapshot2Index]
            })
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
});

function updateSnapshotSelects() {
    const selects = ['snapshot1', 'snapshot2'];
    selects.forEach(selectId => {
        const select = document.getElementById(selectId);
        select.innerHTML = '';
        snapshots.forEach((snapshot, index) => {
            const option = document.createElement('option');
            option.value = index;
            option.textContent = new Date(snapshot.timestamp).toLocaleString();
            select.appendChild(option);
        });
    });
}

function displayDifferences(differences) {
    const schemaChangesDiv = document.getElementById('schemaChanges');
    const dataChangesDiv = document.getElementById('dataChanges');
    
    // Display schema changes
    schemaChangesDiv.innerHTML = differences.schema.length === 0 
        ? '<p>No schema changes detected</p>'
        : differences.schema.map(change => createChangeElement(change)).join('');

    // Display data changes
    dataChangesDiv.innerHTML = Object.keys(differences.data).length === 0
        ? '<p>No data changes detected</p>'
        : Object.entries(differences.data).map(([table, changes]) => {
            return `
                <div class="table-changes mb-3">
                    <h6>Table: ${table}</h6>
                    ${changes.map(change => createChangeElement(change)).join('')}
                </div>
            `;
        }).join('');
}

function createChangeElement(change) {
    const changeType = change.type === 'N' ? 'added'
        : change.type === 'D' ? 'removed'
        : 'modified';
    
    return `
        <div class="change-item ${changeType}">
            <div class="change-type">${changeType.toUpperCase()}</div>
            <div class="change-details">
                <pre>${JSON.stringify(change.change || change, null, 2)}</pre>
            </div>
        </div>
    `;
}
