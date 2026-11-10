import { CurlRequestError } from './errors.js';
import { parseCurl } from './parse.js';

/**
 * @typedef {object} CurlResult
 * @property {unknown} data     JSON já convertido quando a resposta é JSON; texto nos outros casos.
 * @property {number} status
 * @property {boolean} ok       `true` para status 2xx.
 * @property {Record<string, string>} headers
 */

const interpolate = (value) => (value !== null && typeof value === 'object' ? JSON.stringify(value) : String(value));

/** No texto cru de um template, crase e `${` chegam escapados: `\`` e `\${`. */
const unescapeTemplate = (text) => text.replace(/\\(`|\$\{)/g, '$1');

/**
 * Transforma a chamada (template ou string comum) em segmentos para o tokenizer.
 * O texto vem de `strings.raw`, então o que foi colado chega intacto, com as
 * barras invertidas que o shell esperaria. Cada `${valor}` entra como literal:
 * ocupa um argumento só, mesmo com espaços ou aspas dentro.
 */
const toSegments = (strings, values) => {
  if (typeof strings === 'string') return [{ text: strings }];

  return strings.raw.flatMap((text, index) => {
    const segment = { text: unescapeTemplate(text) };
    return index < values.length ? [segment, { text: interpolate(values[index]), literal: true }] : [segment];
  });
};

/** @param {import('./parse.js').CurlRequest} request */
const toFetchOptions = (request) => ({
  method: request.method,
  headers: request.headers,
  body: request.body ?? undefined,
  signal: request.timeout ? AbortSignal.timeout(request.timeout) : undefined,
});

const isJson = (contentType) => /[/+]json\b/i.test(contentType ?? '');

const parseData = (text, contentType) => {
  if (!text || !isJson(contentType)) return text;

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
};

/** @returns {Promise<CurlResult>} */
const toResult = async (response) => ({
  data: parseData(await response.text(), response.headers.get('content-type')),
  status: response.status,
  ok: response.ok,
  headers: Object.fromEntries(response.headers),
});

/**
 * Cria um `curl` com o transporte que você escolher. Qualquer função com a
 * assinatura do `fetch` serve, o que deixa trocar a rede por um dublê nos testes.
 *
 * @param {{ fetch?: typeof globalThis.fetch }} [dependencies]
 */
export const createCurl = ({ fetch = globalThis.fetch } = {}) => {
  /**
   * Executa o comando. Respostas de erro (404, 500...) voltam como resultado,
   * com o `status` para você decidir; só falha de rede lança `CurlRequestError`.
   *
   * @param {TemplateStringsArray | string} strings
   * @param {...unknown} values
   * @returns {Promise<CurlResult>}
   */
  const curl = async (strings, ...values) => {
    const request = parseCurl(toSegments(strings, values));
    const response = await fetch(request.url, toFetchOptions(request)).catch((cause) => {
      throw new CurlRequestError(request, cause);
    });

    return toResult(response);
  };

  /**
   * Só interpreta o comando e devolve a requisição, sem enviar nada.
   *
   * @param {TemplateStringsArray | string} strings
   * @param {...unknown} values
   */
  curl.parse = (strings, ...values) => parseCurl(toSegments(strings, values));

  return curl;
};

/**
 * Cole aqui o "Copy as cURL" do navegador:
 *
 * ```js
 * const { data, status } = await curl`
 *   curl 'https://pokeapi.co/api/v2/pokemon/ditto' \
 *     -H 'Accept: application/json'
 * `;
 * ```
 */
export const curl = createCurl();
