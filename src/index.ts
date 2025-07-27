import { Hono } from 'hono'

interface Env {
  DB: D1Database
}

interface ContactRow {
  id: number
  phoneNumber: string | null
  email: string | null
  linkedId: number | null
  linkPrecedence: 'primary' | 'secondary'
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}

async function fetchContactCluster(db: D1Database, email?: string | null, phoneNumber?: string | null): Promise<ContactRow[]> {
  if (!email && !phoneNumber) return []

  const visited = new Set<number>()
  const cluster: ContactRow[] = []
  
  const initialQuery = await db
    .prepare(`SELECT * FROM Contact WHERE (email = ?1 AND ?1 IS NOT NULL) OR (phoneNumber = ?2 AND ?2 IS NOT NULL)`)
    .bind(email ?? null, phoneNumber ?? null)
    .all()
  
  const queue: ContactRow[] = (initialQuery.results || []) as unknown as ContactRow[]

  while (queue.length) {
    const current = queue.pop() as ContactRow
    if (visited.has(current.id)) continue
    visited.add(current.id)
    cluster.push(current)

    const neighboursQuery = await db
      .prepare(`SELECT * FROM Contact WHERE id = ?1 OR linkedId = ?1 OR (?2 IS NOT NULL AND email = ?2) OR (?3 IS NOT NULL AND phoneNumber = ?3)`)
      .bind(current.id, current.email ?? null, current.phoneNumber ?? null)
      .all()
    
    const neighbours = (neighboursQuery.results || []) as unknown as ContactRow[]
    for (const n of neighbours) {
      if (!visited.has(n.id)) queue.push(n)
    }
  }
  return cluster
}

const app = new Hono()

app.post('/identify', async (c) => {
  const json = await c.req.json<{ email?: string; phoneNumber?: string }>()

  let email: string | null = json.email ? json.email.trim().toLowerCase() : null
  let phoneNumber: string | null = json.phoneNumber ? json.phoneNumber.trim() : null

  if (!email && !phoneNumber) {
    return c.json({ error: 'Either email or phoneNumber must be provided.' }, 400)
  }

  const db = (c.env as unknown as Env).DB
  let cluster = await fetchContactCluster(db, email, phoneNumber)

  if (cluster.length === 0) {
    const insertResult = await db
      .prepare(`INSERT INTO Contact (email, phoneNumber, linkPrecedence) VALUES (?1, ?2, 'primary') RETURNING id`)
      .bind(email ?? null, phoneNumber ?? null)
      .first()
    
    const result = insertResult as { id: number }
    return c.json({
      contact: {
        primaryContatctId: result.id,
        emails: email ? [email] : [],
        phoneNumbers: phoneNumber ? [phoneNumber] : [],
        secondaryContactIds: [] as number[],
      },
    })
  }

  let primary = cluster.reduce((oldest, curr) =>
    new Date(curr.createdAt) < new Date(oldest.createdAt) ? curr : oldest
  )

  for (const cRow of cluster) {
    if (cRow.id === primary.id) continue
    if (cRow.linkPrecedence === 'primary' || cRow.linkedId !== primary.id) {
      await db
        .prepare(`UPDATE Contact SET linkedId = ?1, linkPrecedence = 'secondary', updatedAt = CURRENT_TIMESTAMP WHERE id = ?2`)
        .bind(primary.id, cRow.id)
        .run()
      cRow.linkedId = primary.id
      cRow.linkPrecedence = 'secondary'
    }
  }

  cluster = await fetchContactCluster(db, email, phoneNumber)

  const emailSet = new Set<string>()
  const emailLowerSet = new Set<string>()
  const phoneSet = new Set<string>()
  const secondaryIds: number[] = []

  for (const r of cluster) {
    if (r.email) {
      emailSet.add(r.email)
      emailLowerSet.add(r.email.toLowerCase())
    }
    if (r.phoneNumber) phoneSet.add(r.phoneNumber)
    if (r.id !== primary.id) secondaryIds.push(r.id)
  }

  const hasNewEmail = email && !emailLowerSet.has(email)
  const hasNewPhone = phoneNumber && !phoneSet.has(phoneNumber)

  if (hasNewEmail || hasNewPhone) {
    const insertResult = await db
      .prepare(`INSERT INTO Contact (email, phoneNumber, linkedId, linkPrecedence) VALUES (?1, ?2, ?3, 'secondary') RETURNING id`)
      .bind(email ?? null, phoneNumber ?? null, primary.id)
      .first()
    
    const result = insertResult as { id: number }
    secondaryIds.push(result.id)
    if (email) {
      emailSet.add(email)
      emailLowerSet.add(email)
    }
    if (phoneNumber) phoneSet.add(phoneNumber)
  }

  const orderedEmails = primary.email ? [primary.email, ...[...emailSet].filter((e) => e !== primary.email)] : [...emailSet]
  const orderedPhones = primary.phoneNumber ? [primary.phoneNumber, ...[...phoneSet].filter((p) => p !== primary.phoneNumber)] : [...phoneSet]

  return c.json({
    contact: {
      primaryContatctId: primary.id,
      emails: orderedEmails,
      phoneNumbers: orderedPhones,
      secondaryContactIds: secondaryIds,
    },
  })
})

export default app
