// Turns raw "?page=2&pageSize=20" query strings into safe, bounded numbers
// for Prisma's skip/take. Bad or missing input just falls back to defaults
// instead of erroring - pagination shouldn't be a reason to fail a request.
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

export function parsePagination(query: { page?: string; pageSize?: string }) {
  const page = toPositiveInt(query.page, 1);
  const pageSize = Math.min(
    toPositiveInt(query.pageSize, DEFAULT_PAGE_SIZE),
    MAX_PAGE_SIZE,
  );

  return {
    page,
    pageSize,
    skip: (page - 1) * pageSize,
    take: pageSize,
  };
}

function toPositiveInt(value: string | undefined, fallback: number) {
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < 1) {
    return fallback;
  }

  return parsed;
}
