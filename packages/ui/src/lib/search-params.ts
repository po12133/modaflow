export const searchParam = (v: string | string[] | undefined) => (typeof v === "string" && v ? v : undefined);
