declare module 'streammark' {
  export interface MarkdownStreamOptions {
    theme?: string | object;
    output?: NodeJS.WritableStream;
  }

  export class MarkdownStream {
    constructor(opts?: MarkdownStreamOptions);
    write(chunk: string): void;
    end(): void;
    pipe(asyncIterable: AsyncIterable<string>): void;
  }

  export function render(markdown: string, opts?: MarkdownStreamOptions): string;
  export function print(markdown: string, opts?: MarkdownStreamOptions): void;
  export const themes: Record<string, object>;
}
