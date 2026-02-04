export interface ServiceResponse<T> {
  data: T | null;
  error: Error | null;
}

export type ServicePromise<T> = Promise<ServiceResponse<T>>;
