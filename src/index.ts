import { Elysia, t } from 'elysia';
import db from './db/setup';

const app = new Elysia();

app.post('/identify', async ({ body, set }) => {
  const { email, phoneNumber } = body;

  if (!email && !phoneNumber) {
    set.status = 400;
    return { error: 'Either email or phoneNumber must be provided.' };
  }

  // Find existing contacts
  const existingContactsQuery = db.query(`
    SELECT * FROM Contact
    WHERE email = ?1 OR phoneNumber = ?2
  `);
  const existingContacts = existingContactsQuery.all({ 1: email, 2: phoneNumber });

  if (existingContacts.length === 0) {
    // Create new primary contact
    const insertQuery = db.query(`
      INSERT INTO Contact (email, phoneNumber, linkPrecedence)
      VALUES (?1, ?2, 'primary')
      RETURNING id;
    `);
    const result = insertQuery.get({ 1: email, 2: phoneNumber });
    const primaryContactId = result.id;

    return {
      contact: {
        primaryContactId,
        emails: email ? [email] : [],
        phoneNumbers: phoneNumber ? [phoneNumber] : [],
        secondaryContactIds: [],
      },
    };
  }

  // Consolidate contacts
  let primaryContact = existingContacts.find(c => c.linkPrecedence === 'primary');
  if (!primaryContact) {
    // If no primary, find the oldest contact and make it primary
    existingContacts.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    primaryContact = existingContacts[0];
  }

  const primaryContactId = primaryContact.id;
  const secondaryContactIds = [];
  const emails = new Set<string>();
  const phoneNumbers = new Set<string>();

  if (primaryContact.email) emails.add(primaryContact.email);
  if (primaryContact.phoneNumber) phoneNumbers.add(primaryContact.phoneNumber);

  for (const contact of existingContacts) {
    if (contact.id !== primaryContactId) {
      if (contact.linkPrecedence === 'primary') {
        const updateQuery = db.query(`
          UPDATE Contact
          SET linkedId = ?1, linkPrecedence = 'secondary', updatedAt = CURRENT_TIMESTAMP
          WHERE id = ?2
        `);
        updateQuery.run({ 1: primaryContactId, 2: contact.id });
        secondaryContactIds.push(contact.id);
      }
      if (contact.email) emails.add(contact.email);
      if (contact.phoneNumber) phoneNumbers.add(contact.phoneNumber);
    }
  }

  // Check if a new contact needs to be created
  const newInfoProvided = (email && !emails.has(email)) || (phoneNumber && !phoneNumbers.has(phoneNumber));
  if (newInfoProvided) {
    const insertQuery = db.query(`
      INSERT INTO Contact (email, phoneNumber, linkedId, linkPrecedence)
      VALUES (?1, ?2, ?3, 'secondary')
      RETURNING id;
    `);
    const result = insertQuery.get({ 1: email, 2: phoneNumber, 3: primaryContactId });
    secondaryContactIds.push(result.id);
    if (email) emails.add(email);
    if (phoneNumber) phoneNumbers.add(phoneNumber);
  }

  return {
    contact: {
      primaryContactId,
      emails: Array.from(emails),
      phoneNumbers: Array.from(phoneNumbers),
      secondaryContactIds,
    },
  };
}, {
  body: t.Object({
    email: t.Optional(t.String()),
    phoneNumber: t.Optional(t.String()),
  })
});

app.listen(3000, () => {
  console.log('Server listening on port 3000');
});
