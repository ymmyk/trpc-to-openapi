import { createOpenApiNuxtHandler } from '@lilyrose2798/trpc-openapi';

import { appRouter, createContext } from '../router';

export default createOpenApiNuxtHandler({
  router: appRouter,
  createContext,
});
