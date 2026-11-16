export {};

declare global {
  interface Window {
    mermaid: {
      initialize(config: Record<string, unknown>): void;
      parse(source: string): Promise<unknown>;
      render(
        id: string,
        source: string,
      ): Promise<{ svg: string; bindFunctions?: (element: Element) => void }>;
    };
  }
}
