declare module 'node:fs' {
  export function readFileSync(path: string, encoding: string): string
  export function existsSync(path: string): boolean
}

declare module 'node:path' {
  export function resolve(...paths: string[]): string
}

declare module 'node:http' {
  export function createServer(
    listener: (
      req: IncomingMessage,
      res: ServerResponse,
    ) => void,
  ): Server

  export interface IncomingMessage {
    method?: string
    url?: string
    headers: Record<string, string | string[] | undefined>
    [Symbol.asyncIterator](): AsyncIterator<Uint8Array>
  }

  export interface ServerResponse {
    writeHead(status: number, headers: Record<string, string>): void
    end(body?: string): void
  }

  export interface Server {
    listen(port: number, host: string, cb?: () => void): void
  }
}

declare const process: {
  cwd(): string
  env: Record<string, string | undefined>
}

declare const Buffer: {
  concat(chunks: Uint8Array[]): { toString(encoding: string): string }
}
