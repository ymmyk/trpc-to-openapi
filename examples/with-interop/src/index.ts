import { OpenApiMeta } from '@lilyrose2798/trpc-openapi';
import * as trpc from '@trpc/server';
import { z } from 'zod';

const appRouter = trpc.router<any, OpenApiMeta>().query('echo', {
  meta: { openapi: { enabled: true, method: 'GET', path: '/echo' } },
  input: z.object({ payload: z.string() }),
  output: z.object({ payload: z.string() }),
  resolve: ({ input }) => input,
});

export const trpcV10AppRouter = appRouter.interop();
export const openApiV0AppRouter = appRouter;

export type AppRouter = typeof trpcV10AppRouter;

// Now add your `@trpc/server` && `@lilyrose2798/trpc-openapi` handlers...
