import { TRPCError } from '@trpc/server';
import { AnyZodObject, ZodTypeAny, z } from 'zod';
import {
  ZodOpenApiContentObject,
  ZodOpenApiParameters,
  ZodOpenApiRequestBodyObject,
  ZodOpenApiResponseObject,
  ZodOpenApiResponsesObject,
  extendZodWithOpenApi,
} from 'zod-openapi';

import {
  HTTP_STATUS_TRPC_ERROR_CODE,
  TRPC_ERROR_CODE_HTTP_STATUS,
  TRPC_ERROR_CODE_MESSAGE,
} from '../adapters/node-http/errors';
import { OpenApiContentType } from '../types';
import {
  instanceofZodType,
  instanceofZodTypeCoercible,
  instanceofZodTypeKind,
  instanceofZodTypeLikeString,
  instanceofZodTypeLikeVoid,
  instanceofZodTypeObject,
  instanceofZodTypeOptional,
  unwrapZodType,
  zodSupportsCoerce,
} from '../utils/zod';

extendZodWithOpenApi(z);

export const getParameterObjects = (
  schema: unknown,
  pathParameters: string[],
  headersSchema: AnyZodObject | undefined,
  inType: 'all' | 'path' | 'query',
): ZodOpenApiParameters | undefined => {
  if (!instanceofZodType(schema)) {
    throw new TRPCError({
      message: 'Input parser expects a Zod validator',
      code: 'INTERNAL_SERVER_ERROR',
    });
  }

  const isRequired = !schema.isOptional();
  const unwrappedSchema = unwrapZodType(schema, true);

  if (pathParameters.length === 0 && instanceofZodTypeLikeVoid(unwrappedSchema)) {
    return undefined;
  }

  if (!instanceofZodTypeObject(unwrappedSchema)) {
    throw new TRPCError({
      message: 'Input parser must be a ZodObject',
      code: 'INTERNAL_SERVER_ERROR',
    });
  }

  const shape = unwrappedSchema.shape;
  const shapeKeys = Object.keys(shape);

  for (const pathParameter of pathParameters) {
    if (!shapeKeys.includes(pathParameter)) {
      throw new TRPCError({
        message: `Input parser expects key from path: "${pathParameter}"`,
        code: 'INTERNAL_SERVER_ERROR',
      });
    }
  }

  const { path, query } = shapeKeys
    .filter((shapeKey) => {
      const isPathParameter = pathParameters.includes(shapeKey);
      if (inType === 'path') {
        return isPathParameter;
      } else if (inType === 'query') {
        return !isPathParameter;
      }
      return true;
    })
    .map((shapeKey) => {
      let shapeSchema = shape[shapeKey]!;
      const isShapeRequired = !shapeSchema.isOptional();
      const isPathParameter = pathParameters.includes(shapeKey);

      if (!instanceofZodTypeLikeString(shapeSchema)) {
        if (zodSupportsCoerce) {
          if (!instanceofZodTypeCoercible(shapeSchema)) {
            throw new TRPCError({
              message: `Input parser key: "${shapeKey}" must be ZodString, ZodNumber, ZodBoolean, ZodBigInt or ZodDate`,
              code: 'INTERNAL_SERVER_ERROR',
            });
          }
        } else {
          throw new TRPCError({
            message: `Input parser key: "${shapeKey}" must be ZodString`,
            code: 'INTERNAL_SERVER_ERROR',
          });
        }
      }

      if (instanceofZodTypeOptional(shapeSchema)) {
        if (isPathParameter) {
          throw new TRPCError({
            message: `Path parameter: "${shapeKey}" must not be optional`,
            code: 'INTERNAL_SERVER_ERROR',
          });
        }
        shapeSchema = shapeSchema.unwrap();
      }

      return {
        name: shapeKey,
        paramType: isPathParameter ? 'path' : 'query',
        required: isPathParameter || (isRequired && isShapeRequired),
        schema: shapeSchema,
      };
    })
    .reduce(
      ({ path, query }, { name, paramType, schema, required }) =>
        paramType === 'path'
          ? { path: { ...path, [name]: required ? schema : schema.optional() }, query }
          : { path, query: { ...query, [name]: required ? schema : schema.optional() } },
      { path: {} as Record<string, ZodTypeAny>, query: {} as Record<string, ZodTypeAny> },
    );

  return { header: headersSchema, path: z.object(path), query: z.object(query) };
};

export const getRequestBodyObject = (
  schema: unknown,
  pathParameters: string[],
  contentTypes: OpenApiContentType[],
): ZodOpenApiRequestBodyObject | undefined => {
  if (!instanceofZodType(schema)) {
    throw new TRPCError({
      message: 'Input parser expects a Zod validator',
      code: 'INTERNAL_SERVER_ERROR',
    });
  }

  const isRequired = !schema.isOptional();
  const unwrappedSchema = unwrapZodType(schema, true);

  if (pathParameters.length === 0 && instanceofZodTypeLikeVoid(unwrappedSchema)) {
    return undefined;
  }

  if (!instanceofZodTypeObject(unwrappedSchema)) {
    throw new TRPCError({
      message: 'Input parser must be a ZodObject',
      code: 'INTERNAL_SERVER_ERROR',
    });
  }

  // remove path parameters
  const mask: Record<string, true> = {};
  pathParameters.forEach((pathParameter) => {
    mask[pathParameter] = true;
  });
  const dedupedSchema = unwrappedSchema.omit(mask);

  // if all keys are path parameters
  if (pathParameters.length > 0 && Object.keys(dedupedSchema.shape).length === 0) {
    return undefined;
  }

  const content: ZodOpenApiContentObject = {};
  for (const contentType of contentTypes) {
    content[contentType] = {
      schema: dedupedSchema,
    };
  }

  return {
    required: isRequired,
    content,
  };
};

export const hasInputs = (schema: unknown) =>
  instanceofZodType(schema) && !instanceofZodTypeLikeVoid(unwrapZodType(schema, true));

export const errorSchema = z
  .object({
    message: z
      .string()
      .openapi({ description: 'The error message', example: 'Internal server error' }),
    code: z.string().openapi({ description: 'The error code', example: 'INTERNAL_SERVER_ERROR' }),
    issues: z
      .array(z.object({ message: z.string() }))
      .optional()
      .openapi({
        description: 'An array of issues that were responsible for the error',
        example: [],
      }),
  })
  .openapi({ title: 'Error', description: 'The error information' });

export const errorResponseObject = (
  example?: z.infer<typeof errorSchema>,
): ZodOpenApiResponseObject => ({
  description: 'An error response',
  content: { 'application/json': { schema: errorSchema.openapi({ example }) } },
});

export const getResponsesObject = (
  schema: unknown,
  headers: AnyZodObject | undefined,
  isProtected: boolean,
  hasInputs: boolean,
  errorCodes?: number[],
): ZodOpenApiResponsesObject => {
  if (!instanceofZodType(schema)) {
    throw new TRPCError({
      message: 'Output parser expects a Zod validator',
      code: 'INTERNAL_SERVER_ERROR',
    });
  }

  const successResponseObject: ZodOpenApiResponseObject = {
    description: 'Successful response',
    headers: headers,
    content: {
      'application/json': {
        schema: instanceofZodTypeKind(schema, z.ZodFirstPartyTypeKind.ZodVoid)
          ? {}
          : instanceofZodTypeKind(schema, z.ZodFirstPartyTypeKind.ZodNever) ||
            instanceofZodTypeKind(schema, z.ZodFirstPartyTypeKind.ZodUndefined)
          ? { not: {} }
          : schema,
      },
    },
  };

  return {
    200: successResponseObject,
    ...(errorCodes !== undefined
      ? Object.fromEntries(
          errorCodes.map((x) => {
            const code = HTTP_STATUS_TRPC_ERROR_CODE[x];
            const message = code && TRPC_ERROR_CODE_MESSAGE[code];
            return [
              x,
              errorResponseObject({
                code: code ?? 'UNKNOWN_ERROR',
                message: message ?? 'Unknown error',
              }),
            ];
          }),
        )
      : {
          ...(isProtected
            ? {
                401: errorResponseObject({
                  code: 'UNAUTHORIZED',
                  message: 'Authorization not provided',
                }),
              }
            : {}),
          ...(hasInputs
            ? {
                '4XX': errorResponseObject({
                  code: 'VALIDATION_ERROR',
                  message: 'Invalid name provided',
                }),
              }
            : {}),
          '5XX': errorResponseObject({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Internal server error',
          }),
        }),
  };
};
