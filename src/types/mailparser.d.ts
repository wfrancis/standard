declare module 'mailparser' {
  export function simpleParser(source: Buffer | string | NodeJS.ReadableStream): Promise<{
    text?: string;
    html?: string;
    attachments: Array<{
      filename?: string;
      contentType: string;
      content: Buffer;
    }>;
  }>;
}
