declare module "bun:test" {
  export function describe(name: string, fn: () => void): void;
  export function test(
    name: string,
    fn: () => void | Promise<void>,
    timeout?: number,
  ): void;
  export const mock: { module(name: string, factory: () => unknown): void };
  export function expect<T>(value: T): {
    toBe(expected: T): void;
    toEqual(expected: T): void;
    toBeUndefined(): void;
    toThrow(message?: string): void;
    toContain(expected: string): void;
    toBeLessThanOrEqual(expected: number): void;
  };
}
