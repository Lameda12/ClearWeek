export const httpError = (status: number, message: string) => Object.assign(new Error(message), { status });
