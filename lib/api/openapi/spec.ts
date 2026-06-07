/**
 * OpenAPI Specification Generator
 *
 * Generates an OpenAPI 3.1 spec from the API route definitions.
 * Can be used to serve /api/openapi.json or generate client SDKs.
 *
 * Usage:
 *   import { generateOpenApiSpec } from '@/lib/api/openapi/spec';
 *   // In a route: return NextResponse.json(generateOpenApiSpec());
 */

export interface OpenApiPathDefinition {
  description: string;
  method: 'get' | 'post' | 'put' | 'delete' | 'patch';
  summary: string;
  tags: string[];
  requestBody?: {
    description: string;
    required: boolean;
    content: Record<string, { schema: unknown }>;
  };
  responses: Record<string, { description: string; content?: Record<string, { schema: unknown }> }>;
}

const definitions: Record<string, OpenApiPathDefinition> = {};

/**
 * Register an API path for OpenAPI documentation.
 */
export function registerOpenApiPath(path: string, def: OpenApiPathDefinition): void {
  definitions[path] = def;
}

/**
 * Generate the full OpenAPI 3.1 specification.
 */
export function generateOpenApiSpec(overrides?: {
  version?: string;
  title?: string;
  description?: string;
}): Record<string, unknown> {
  const paths: Record<string, Record<string, unknown>> = {};

  for (const [path, def] of Object.entries(definitions)) {
    const methodDef: Record<string, unknown> = {
      summary: def.summary,
      description: def.description,
      tags: def.tags,
      responses: def.responses,
    };

    if (def.requestBody) {
      methodDef.requestBody = def.requestBody;
    }

    paths[path] = {
      [def.method]: methodDef,
    };
  }

  return {
    openapi: '3.1.0',
    info: {
      title: overrides?.title ?? 'OpenMAIC API',
      version: overrides?.version ?? '1.0.0',
      description: overrides?.description ?? 'OpenMAIC — Multi-Agent AI Classroom Platform API',
    },
    servers: [{ url: '/api/v1', description: 'API v1' }],
    paths,
    components: {
      schemas: {
        Error: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            errorCode: { type: 'string' },
            error: { type: 'string' },
            details: { type: 'string' },
          },
          required: ['success', 'errorCode', 'error'],
        },
        SuccessResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
          },
        },
      },
    },
  };
}

/**
 * Get the count of registered paths.
 */
export function getPathCount(): number {
  return Object.keys(definitions).length;
}

// ── Register built-in API paths ──

registerOpenApiPath('/chat', {
  description:
    'Stateless chat endpoint. Sends messages and receives SSE stream of generation events.',
  method: 'post',
  summary: 'Send message and receive SSE stream',
  tags: ['chat'],
  requestBody: {
    description: 'Chat request with messages and store state',
    required: true,
    content: {
      'application/json': {
        schema: {
          type: 'object',
          properties: {
            messages: { type: 'array', items: { type: 'object' } },
            storeState: { type: 'object' },
            config: {
              type: 'object',
              properties: { agentIds: { type: 'array', items: { type: 'string' } } },
            },
            model: { type: 'string' },
            apiKey: { type: 'string' },
            baseUrl: { type: 'string' },
          },
          required: ['messages', 'storeState', 'config', 'apiKey'],
        },
      },
    },
  },
  responses: {
    '200': { description: 'SSE stream of generation events' },
    '400': { description: 'Invalid request' },
    '429': { description: 'Rate limit exceeded' },
    '500': { description: 'Internal server error' },
  },
});

registerOpenApiPath('/generate/scene-outlines-stream', {
  description: 'Generate scene outlines for a classroom session.',
  method: 'post',
  summary: 'Generate scene outlines (SSE)',
  tags: ['generate'],
  requestBody: {
    description: 'Generation request with user requirements',
    required: true,
    content: { 'application/json': { schema: { type: 'object' } } },
  },
  responses: {
    '200': { description: 'SSE stream of scene outline events' },
    '400': { description: 'Invalid request' },
    '500': { description: 'Internal server error' },
  },
});

registerOpenApiPath('/generate/scene-content', {
  description: 'Generate content for a specific scene.',
  method: 'post',
  summary: 'Generate scene content',
  tags: ['generate'],
  requestBody: {
    description: 'Scene content generation request',
    required: true,
    content: { 'application/json': { schema: { type: 'object' } } },
  },
  responses: {
    '200': { description: 'Generated scene content' },
    '400': { description: 'Invalid request' },
    '500': { description: 'Internal server error' },
  },
});

registerOpenApiPath('/classroom', {
  description: 'Classroom CRUD operations.',
  method: 'post',
  summary: 'Classroom management',
  tags: ['classroom'],
  responses: {
    '200': { description: 'Success' },
    '400': { description: 'Invalid request' },
    '500': { description: 'Internal server error' },
  },
});

registerOpenApiPath('/health', {
  description: 'Health check endpoint.',
  method: 'get',
  summary: 'Health check',
  tags: ['system'],
  responses: {
    '200': { description: 'Service is healthy' },
    '500': { description: 'Service is unhealthy' },
  },
});

registerOpenApiPath('/parse-pdf', {
  description: 'Parse PDF document and extract content.',
  method: 'post',
  summary: 'Parse PDF',
  tags: ['document'],
  requestBody: {
    description: 'PDF file to parse',
    required: true,
    content: { 'multipart/form-data': { schema: { type: 'object' } } },
  },
  responses: {
    '200': { description: 'Parsed PDF content' },
    '400': { description: 'Invalid request' },
    '500': { description: 'Internal server error' },
  },
});
