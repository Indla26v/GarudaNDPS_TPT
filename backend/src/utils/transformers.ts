export function convertBigIntsToNumbers(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === 'bigint') return Number(obj);
  if (Array.isArray(obj)) return obj.map(convertBigIntsToNumbers);
  if (typeof obj === 'object') {
    if (obj instanceof Date) return obj;
    return Object.fromEntries(
      Object.entries(obj).map(([k, v]) => [k, convertBigIntsToNumbers(v)])
    );
  }
  return obj;
}

export function successResponse(data: any, message: string = 'Success') {
  return {
    success: true,
    message,
    data: convertBigIntsToNumbers(data),
    timestamp: new Date().toISOString()
  };
}
