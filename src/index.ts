interface McpToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

interface McpToolExport {
  tools: McpToolDefinition[];
  callTool: (name: string, args: Record<string, unknown>) => Promise<unknown>;
  meter?: { credits: number };
  cost?: Record<string, unknown>;
  provider?: string;
}

/**
 * Bank of Israel public API MCP. Keyless.
 *
 * All exchange rates are quoted against the Israeli Shekel (ILS): the value is
 * the number of shekels per `unit` of the foreign currency. `unit` matters —
 * most currencies are per 1 unit, but some (e.g. JPY) are quoted per 100 units,
 * so the per-1 rate = currentExchangeRate / unit.
 *
 * Verified live against https://boi.org.il/PublicApi (2026-06):
 *   GET /GetExchangeRates?asJson=true   -> {exchangeRates:[{key,currentExchangeRate,currentChange,unit,lastUpdate}]}
 *   GET /GetExchangeRate?key=USD&asJson=true -> single {key,currentExchangeRate,currentChange,unit,lastUpdate} (404+JSON on bad key)
 *   GET /GetInterest?asJson=true        -> {currentInterest,nextInterestDate,lastPublishedDate} (BOI policy rate, %)
 */


const BASE = 'https://boi.org.il/PublicApi';
const UA = 'pipeworx-mcp-boi-il/1.0 (+https://pipeworx.io)';

const tools: McpToolExport['tools'] = [
  {
    name: 'exchange_rates',
    description:
      'All current Bank of Israel representative exchange rates vs the Israeli Shekel (ILS). Returns one entry per currency with currentExchangeRate (shekels per `unit` of the foreign currency), currentChange (% vs previous), unit (1 for most, 100 for some like JPY — per-1 rate = currentExchangeRate / unit), and lastUpdate. Use this for a snapshot of all available currencies.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'exchange_rate',
    description:
      'Current Bank of Israel representative exchange rate for a single currency vs the Israeli Shekel (ILS), by 3-letter ISO code. Returns currentExchangeRate (shekels per `unit`), currentChange (%), unit, and lastUpdate. Note `unit` (e.g. JPY is per 100). Example keys: USD, EUR, GBP, JPY, CHF, CAD, AUD.',
    inputSchema: {
      type: 'object',
      properties: { key: { type: 'string', description: '3-letter ISO currency code, e.g. "USD" or "EUR".' } },
      required: ['key'],
    },
  },
  {
    name: 'interest_rate',
    description:
      'The current Bank of Israel policy interest rate (% per annum). Returns currentInterest (the rate), nextInterestDate (date of the next rate decision), and lastPublishedDate.',
    inputSchema: { type: 'object', properties: {} },
  },
];

async function callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  switch (name) {
    case 'exchange_rates':
      return boiGet('/GetExchangeRates?asJson=true');
    case 'exchange_rate': {
      const key = reqStr(args, 'key', '"USD" or "EUR"');
      return boiGet(`/GetExchangeRate?key=${encodeURIComponent(key.trim().toUpperCase())}&asJson=true`);
    }
    case 'interest_rate':
      return boiGet('/GetInterest?asJson=true');
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

async function boiGet(path: string): Promise<unknown> {
  const res = await fetch(`${BASE}${path}`, { headers: { Accept: 'application/json', 'User-Agent': UA } });
  if (!res.ok) throw new Error(`Bank of Israel: ${res.status} ${await res.text().then((t) => t.slice(0, 200))}`);
  return res.json();
}

function reqStr(args: Record<string, unknown>, key: string, example: string): string {
  const v = args[key];
  if (typeof v !== 'string' || !v.trim()) throw new Error(`Required argument "${key}" is missing. Pass a string like ${example}.`);
  return v;
}

export default { tools, callTool, meter: { credits: 1 } } satisfies McpToolExport;
