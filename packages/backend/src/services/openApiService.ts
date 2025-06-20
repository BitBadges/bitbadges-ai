import axios from 'axios';
import * as yaml from 'js-yaml';
import * as fs from 'fs-extra';
import * as path from 'path';

export interface OpenAPIEndpoint {
    path: string;
    method: string;
    operationId?: string;
    summary?: string;
    description?: string;
    parameters?: any[];
    requestBody?: any;
    responses?: any;
    tags?: string[];
}

export interface OpenAPISpec {
    openapi: string;
    info: any;
    servers: any[];
    paths: Record<string, Record<string, any>>;
    components?: any;
}

export class OpenAPIService {
    private static instance: OpenAPIService;
    private spec: OpenAPISpec | null = null;
    private endpoints: OpenAPIEndpoint[] = [];
    private readonly specUrl: string;
    private readonly cachePath: string;
    private readonly cacheTimeout = 12 * 60 * 60 * 1000; // 12 hours

    constructor(specUrl: string) {
        this.specUrl = specUrl;
        this.cachePath = path.join(process.cwd(), 'data', 'openapi-cache.json');
    }

    static getInstance(specUrl?: string): OpenAPIService {
        if (!OpenAPIService.instance) {
            if (!specUrl) {
                throw new Error(
                    'OpenAPIService requires specUrl on first initialization'
                );
            }
            OpenAPIService.instance = new OpenAPIService(specUrl);
        }
        return OpenAPIService.instance;
    }

    static isInstanceCreated(): boolean {
        return OpenAPIService.instance !== undefined;
    }

    async initialize(): Promise<void> {
        try {
            console.log('Initializing OpenAPI service...');

            // Try to load from cache first
            const cachedSpec = await this.loadFromCache();
            if (cachedSpec) {
                console.log('Loaded OpenAPI spec from cache');
                this.spec = cachedSpec;
                this.parseEndpoints();
                console.log(
                    `Loaded cached OpenAPI spec with ${this.endpoints.length} endpoints`
                );
                return;
            }

            // Fetch fresh spec
            await this.fetchAndParseSpec();
            console.log(
                `Loaded fresh OpenAPI spec with ${this.endpoints.length} endpoints`
            );
        } catch (error) {
            console.error('Failed to initialize OpenAPI service:', error);
            console.log(
                'Continuing without OpenAPI spec - BitBadges commands will use fallback mode'
            );
            // Continue without spec - fallback to hardcoded endpoints
        }
    }

    private async fetchAndParseSpec(): Promise<void> {
        try {
            console.log(`Fetching OpenAPI spec from: ${this.specUrl}`);

            // Fetch the raw YAML content
            const response = await axios.get(this.specUrl, {
                timeout: 30000,
                headers: {
                    Accept: 'application/yaml, text/yaml, application/x-yaml, text/x-yaml',
                },
                responseType: 'text', // Ensure we get the raw text content
            });

            console.log('OpenAPI spec fetched, parsing YAML...');

            // Parse YAML directly using js-yaml (supports OpenAPI 3.1.0)
            const parsedSpec = yaml.load(response.data) as OpenAPISpec;

            if (!parsedSpec || typeof parsedSpec !== 'object') {
                throw new Error('Invalid OpenAPI spec format');
            }

            this.spec = parsedSpec;

            console.log(
                `OpenAPI spec parsed successfully. Version: ${
                    this.spec.openapi
                }, Found ${Object.keys(this.spec.paths || {}).length} paths`
            );

            // Cache the parsed spec
            await this.saveToCache(this.spec);

            // Parse endpoints
            this.parseEndpoints();
        } catch (error) {
            console.error('Error fetching/parsing OpenAPI spec:', error);
            console.error(
                'Error details:',
                error instanceof Error ? error.message : error
            );
            throw error;
        }
    }

    private parseEndpoints(): void {
        if (!this.spec || !this.spec.paths) {
            return;
        }

        this.endpoints = [];

        for (const [pathKey, pathValue] of Object.entries(this.spec.paths)) {
            if (!pathValue || typeof pathValue !== 'object') continue;

            for (const [method, operation] of Object.entries(pathValue)) {
                if (!operation || typeof operation !== 'object') continue;
                if (
                    ![
                        'get',
                        'post',
                        'put',
                        'delete',
                        'patch',
                        'head',
                        'options',
                    ].includes(method.toLowerCase())
                )
                    continue;

                this.endpoints.push({
                    path: pathKey,
                    method: method.toUpperCase(),
                    operationId: operation.operationId,
                    summary: operation.summary,
                    description: operation.description,
                    parameters: operation.parameters || [],
                    requestBody: operation.requestBody,
                    responses: operation.responses,
                    tags: operation.tags || [],
                });
            }
        }
    }

    private async loadFromCache(): Promise<OpenAPISpec | null> {
        try {
            if (!(await fs.pathExists(this.cachePath))) {
                return null;
            }

            const cacheData = await fs.readJson(this.cachePath);
            const cacheAge =
                Date.now() - new Date(cacheData.timestamp).getTime();

            if (cacheAge > this.cacheTimeout) {
                console.log('OpenAPI cache expired, fetching fresh spec');
                return null;
            }

            return cacheData.spec;
        } catch (error) {
            console.error('Error loading OpenAPI cache:', error);
            return null;
        }
    }

    private async saveToCache(spec: OpenAPISpec): Promise<void> {
        try {
            await fs.ensureDir(path.dirname(this.cachePath));
            await fs.writeJson(
                this.cachePath,
                {
                    timestamp: new Date().toISOString(),
                    spec,
                },
                { spaces: 2 }
            );
        } catch (error) {
            console.error('Error saving OpenAPI cache:', error);
        }
    }

    getEndpoints(): OpenAPIEndpoint[] {
        return this.endpoints;
    }

    getEndpointsByTag(tag: string): OpenAPIEndpoint[] {
        return this.endpoints.filter((endpoint) =>
            endpoint.tags?.some((t) =>
                t.toLowerCase().includes(tag.toLowerCase())
            )
        );
    }

    findEndpoint(operationId: string): OpenAPIEndpoint | undefined {
        return this.endpoints.find(
            (endpoint) => endpoint.operationId === operationId
        );
    }

    findEndpointsByPath(pathPattern: string): OpenAPIEndpoint[] {
        return this.endpoints.filter((endpoint) =>
            endpoint.path.toLowerCase().includes(pathPattern.toLowerCase())
        );
    }

    getBaseUrl(): string {
        // Use environment variable or fallback to spec servers or default localhost
        const envApiUrl = process.env.BITBADGES_API_URL;
        if (envApiUrl) {
            return envApiUrl;
        }

        if (
            !this.spec ||
            !this.spec.servers ||
            this.spec.servers.length === 0
        ) {
            return 'http://localhost:3001'; // Default fallback for localhost
        }
        return this.spec.servers[0].url;
    }

    buildUrl(
        endpoint: OpenAPIEndpoint,
        pathParams: Record<string, string> = {}
    ): string {
        let url = this.getBaseUrl() + endpoint.path;

        // Replace path parameters
        for (const [key, value] of Object.entries(pathParams)) {
            url = url.replace(`{${key}}`, encodeURIComponent(value));
        }

        return url;
    }

    getEndpointParameters(endpoint: OpenAPIEndpoint): {
        path: any[];
        query: any[];
        header: any[];
        body: any;
    } {
        const params = {
            path: [] as any[],
            query: [] as any[],
            header: [] as any[],
            body: null as any,
        };

        if (endpoint.parameters) {
            for (const param of endpoint.parameters) {
                switch (param.in) {
                    case 'path':
                        params.path.push(param);
                        break;
                    case 'query':
                        params.query.push(param);
                        break;
                    case 'header':
                        params.header.push(param);
                        break;
                }
            }
        }

        if (endpoint.requestBody) {
            params.body = endpoint.requestBody;
        }

        return params;
    }

    isInitialized(): boolean {
        return this.spec !== null;
    }

    getSpec(): OpenAPISpec | null {
        return this.spec;
    }

    async refreshSpec(): Promise<void> {
        // Force refresh by removing cache
        try {
            if (await fs.pathExists(this.cachePath)) {
                await fs.remove(this.cachePath);
            }
        } catch (error) {
            console.error('Error removing cache:', error);
        }

        await this.fetchAndParseSpec();
    }
}
