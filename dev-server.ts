import { Database } from 'bun:sqlite'
import app from './src/index'

const sqlite = new Database('bitespeed.sqlite')

sqlite.run(`
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
`)

const mockDB = {
  prepare: (query: string) => ({
    bind: (...params: any[]) => ({
      all: () => {
        const result = sqlite.query(query).all(...params)
        return { results: result }
      },
      first: () => sqlite.query(query).get(...params),
      run: () => sqlite.query(query).run(...params)
    })
  })
}

const mockEnv = { DB: mockDB as any }

Bun.serve({ 
  fetch: (req) => app.fetch(req, mockEnv),
  port: 3001 
})
console.log('Development server listening on http://localhost:3001') 