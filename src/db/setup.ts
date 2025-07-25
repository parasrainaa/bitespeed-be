import { Database } from 'bun:sqlite';

const db = new Database('bitespeed.sqlite');

const createTableQuery = `
CREATE TABLE IF NOT EXISTS Contact (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  phoneNumber TEXT,
  email TEXT,
  linkedId INTEGER,
  linkPrecedence TEXT CHECK(linkPrecedence IN ('primary', 'secondary')),
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  deletedAt DATETIME
);
`;

db.run(createTableQuery);

console.log('Database setup complete.');

export default db;
