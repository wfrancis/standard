import { ImapFlow } from 'imapflow';
import fs from 'fs';
import path from 'path';

export interface EmailMessage {
  uid: string;
  messageId: string | null;
  subject: string;
  from: string;
  body: string;
  attachments: { filename: string; buffer: Buffer }[];
}

function getImapConfig() {
  const host = process.env.IMAP_HOST;
  const user = process.env.IMAP_USER;
  const pass = process.env.IMAP_PASS;
  if (!host || !user || !pass) {
    throw new Error('IMAP not configured: set IMAP_HOST, IMAP_USER, IMAP_PASS');
  }
  return {
    host,
    port: parseInt(process.env.IMAP_PORT || '993'),
    secure: true,
    auth: { user, pass },
    logger: false as const,
  };
}

export async function fetchUnreadBidEmails(): Promise<EmailMessage[]> {
  const config = getImapConfig();
  const client = new ImapFlow(config);
  const messages: EmailMessage[] = [];

  try {
    await client.connect();
    const folder = process.env.IMAP_FOLDER || 'INBOX';
    const lock = await client.getMailboxLock(folder);

    try {
      const searchResults = await client.search({ seen: false });
      if (!searchResults || (Array.isArray(searchResults) && searchResults.length === 0)) return [];

      const uids = Array.isArray(searchResults) ? searchResults : [];
      for (const uid of uids) {
        const msg = await client.fetchOne(String(uid), {
          envelope: true,
          source: true,
        });

        if (!msg) continue;

        const subject = msg.envelope?.subject || '(no subject)';
        const from = msg.envelope?.from?.[0]?.address || 'unknown';
        const messageId = msg.envelope?.messageId || null;

        // Parse body and attachments from raw source
        const { simpleParser } = await import('mailparser');
        if (!msg.source) continue;
        const parsed = await simpleParser(msg.source);

        const body = parsed.text || parsed.html || '';
        const attachments: { filename: string; buffer: Buffer }[] = [];

        for (const att of parsed.attachments || []) {
          if (att.filename && (att.contentType === 'application/pdf' || att.filename.toLowerCase().endsWith('.pdf'))) {
            attachments.push({
              filename: att.filename,
              buffer: att.content,
            });
          }
        }

        messages.push({
          uid: String(uid),
          messageId,
          subject,
          from,
          body: typeof body === 'string' ? body : '',
          attachments,
        });

        // Mark as seen
        await client.messageFlagsAdd(String(uid), ['\\Seen']);
      }
    } finally {
      lock.release();
    }
  } finally {
    await client.logout();
  }

  return messages;
}

/**
 * Save attachment buffers to disk under /data/attachments/{projectId}/
 */
export function saveAttachments(
  projectId: string,
  attachments: { filename: string; buffer: Buffer }[]
): { filename: string; path: string }[] {
  const baseDir = process.env.NODE_ENV === 'production'
    ? `/data/attachments/${projectId}`
    : path.join(process.cwd(), 'data', 'attachments', projectId);

  fs.mkdirSync(baseDir, { recursive: true });

  return attachments.map((att) => {
    const filePath = path.join(baseDir, att.filename);
    fs.writeFileSync(filePath, att.buffer);
    return { filename: att.filename, path: filePath };
  });
}
