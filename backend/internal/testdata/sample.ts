// Sample TypeScript fixture for TraceLens AST parser

export interface Config {
  apiKey: string;
  timeoutMs: number;
}

export class ServiceClient {
  private config: Config;

  constructor(config: Config) {
    this.config = config;
  }

  public async fetchData(endpoint: string): Promise<string> {
    const url = this.buildUrl(endpoint);
    return this.executeRequest(url);
  }

  private buildUrl(endpoint: string): string {
    return `https://api.example.com/${endpoint}`;
  }

  private async executeRequest(url: string): Promise<string> {
    return `Response from ${url}`;
  }
}

export const runService = async () => {
  const client = new ServiceClient({ apiKey: "secret", timeoutMs: 5000 });
  const data = await client.fetchData("v1/traces");
  console.log(data);
};

