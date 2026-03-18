import type { Readable } from 'stream';

declare module 'sparql-http-client' {
  export interface ClientOptions {
    endpoint: URL | string;
    fetch?: typeof fetch;
    timeout?: number;
    defaultHeaders?: Record<string, string>;
  }

  export class StreamClient {
    constructor(options: ClientOptions);
    endpoint: URL;
    describe(iri: string, options?: { accept: string }): Promise<Readable>;
    query(query: string, options?: { accept: string }): Promise<Readable>;
  }

  export default StreamClient;
}
