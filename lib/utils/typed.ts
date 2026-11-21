/**
 * Minimal shape shared by the fetch Response and the mTLS response
 * returned when TAKAPI.fetch is called with raw=true
 */
export interface RawResponse {
    status: number;
    ok?: boolean;
    body: unknown;
    text: () => Promise<string>;
}

/**
 * Assert the type of an untyped TAK Server response without runtime validation
 */
// oxlint-disable-next-line typescript/no-unnecessary-type-parameters
export function typed<T>(value: unknown): T {
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion
    return value as T;
}
