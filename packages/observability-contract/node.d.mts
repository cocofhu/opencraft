export function socketRequest(socketPath: string,path: string,body?: unknown,method?: string): Promise<any>;
export function nodeObserver(component: string,options?: {socketPath?: string; sourceRevision?: string | null;buildId?: string | null}): {emit(fields: Record<string,unknown>): boolean;close(): void;execution(engine: string,method: string,params: unknown): void;stats?(): unknown};
