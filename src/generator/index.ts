import { OpenAPIObject, SecuritySchemeObject } from 'openapi3-ts/dist/oas31';
import { ZodBigInt, ZodDate, ZodEffects, ZodNumber, ZodString, ZodTypeAny, z } from 'zod';
import { ZodOpenApiObject, ZodOpenApiPathsObject, createDocument } from 'zod-openapi';

import { OpenApiRouter, OpenApiTransformers } from '../types';
import { getOpenApiPathsObject } from './paths';

export type GenerateOpenApiDocumentOptions = {
  title: string;
  description?: string;
  version: string;
  openApiVersion?: ZodOpenApiObject['openapi'];
  baseUrl: string;
  docsUrl?: string;
  tags?: string[];
  securitySchemes?: Record<string, SecuritySchemeObject>;
  paths?: ZodOpenApiPathsObject;
  transformers?: OpenApiTransformers;
};

export const generateOpenApiDocument = (
  appRouter: OpenApiRouter,
  opts: GenerateOpenApiDocumentOptions,
): OpenAPIObject => {
  const securitySchemes = opts.securitySchemes || {
    Authorization: {
      type: 'http',
      scheme: 'bearer',
    },
  };
  return createDocument({
    openapi: opts.openApiVersion ?? '3.0.3',
    info: {
      title: opts.title,
      description: opts.description,
      version: opts.version,
    },
    servers: [
      {
        url: opts.baseUrl,
      },
    ],
    paths: {
      ...getOpenApiPathsObject(appRouter, Object.keys(securitySchemes), opts.transformers),
      ...(opts.paths ?? {}),
    },
    components: {
      securitySchemes,
    },
    tags: opts.tags?.map((tag) => ({ name: tag })),
    externalDocs: opts.docsUrl ? { url: opts.docsUrl } : undefined,
  });
};
