# Database Diff Monitor

A Node.js application that monitors and compares database changes in your MSSQL ERP system. This tool helps you track both schema and data changes after performing various operations in the system.

## Features

- Take database snapshots at any time
- Compare two snapshots to see differences in:
  - Database schema changes
  - Data changes across all tables
- Modern web interface to visualize changes
- Real-time comparison results

## Prerequisites

- Node.js (v14 or higher)
- npm
- Microsoft SQL Server
- Access to your ERP system's database

## Installation

1. Clone this repository
2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file based on `.env.example`:
```bash
cp .env.example .env
```

4. Update the `.env` file with your database credentials:
```
DB_SERVER=your_server
DB_NAME=your_database
DB_USER=your_username
DB_PASSWORD=your_password
PORT=3000
```

## Usage

1. Start the application:
```bash
npm start
```

2. Open your browser and navigate to `http://localhost:3000`

3. Use the interface to:
   - Take snapshots of your database
   - Select two snapshots to compare
   - View detailed differences in schema and data

## Security Notes

- Store sensitive database credentials in the `.env` file
- Never commit the `.env` file to version control
- Ensure proper database user permissions
- Consider implementing authentication for the web interface in production

## License

MIT
