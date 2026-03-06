import { z } from 'zod';
import { insertCompanySchema } from './schema';

export const errorSchemas = {
  validation: z.object({
    message: z.string(),
    field: z.string().optional(),
  }),
  notFound: z.object({
    message: z.string(),
  }),
  internal: z.object({
    message: z.string(),
  }),
};

export const api = {
  company: {
    get: {
      method: 'GET' as const,
      path: '/api/company/:id',
      responses: {
        200: z.any(),
        404: errorSchemas.notFound,
      },
    },
    expandWarehouse: {
      method: 'POST' as const,
      path: '/api/company/:id/expand-warehouse',
      responses: {
        200: z.any(),
        400: errorSchemas.validation,
        404: errorSchemas.notFound,
      },
    },
    upgrade: {
      method: 'POST' as const,
      path: '/api/company/:id/upgrade',
      responses: {
        200: z.any(),
        400: errorSchemas.validation,
        404: errorSchemas.notFound,
      },
    },
  },
};

export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}
