/** Types of the parts of check-route-budgets.mjs that TypeScript code reads (the e2e checks). */

/** The budgets, in bytes (gzip for code and HTML, the file itself for pictures). */
export declare const BUDGETS: Readonly<{ creatorPageCode: number; appFirstLoad: number; homeHtml: number; ogImage: number }>;

/** gzip size of a buffer at zlib's default level (what `next start` sends). */
export declare function gzipSize(buffer: Uint8Array): number;

/** The framework's files as the browser asks for them (`/_next/static/chunks/…`). */
export declare function frameworkFiles(appDir: string): Set<string>;
