import { parseCurl } from './parse.js';

/**
 * As quatro funções do projeto original (2021), com os mesmos nomes e o mesmo
 * formato de retorno. Hoje são janelas para a requisição que `parseCurl`
 * monta: uma leitura só, em vez de quebrar o comando de novo em cada uma.
 */

const parseBody = (body) => {
  if (body === null) return null;

  try {
    return JSON.parse(body);
  } catch {
    return body;
  }
};

/** @param {string} curlString */
export const getURL = (curlString) => parseCurl(curlString).url;

/** @param {string} curlString */
export const getHeaders = (curlString) => ({ ...parseCurl(curlString).headers });

/**
 * O corpo como objeto quando é JSON (como em 2021), texto quando não é, `null` quando não há.
 * @param {string} curlString
 */
export const getBody = (curlString) => parseBody(parseCurl(curlString).body);

/**
 * O método em minúsculas, como o original devolvia para o axios.
 * @param {string} curlString
 */
export const getMethod = (curlString) => parseCurl(curlString).method.toLowerCase();
