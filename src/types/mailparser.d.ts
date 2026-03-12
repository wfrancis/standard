declare module 'mailparser' {
  export function simpleParser(source: any): Promise<{
    text?: string;
    html?: string;
    attachments: Array<{
      filename?: string;
      contentType: string;
      content: Buffer;
    }>;
  }>;
}
