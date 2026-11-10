import { CurlSyntaxError } from './errors.js';
import { EMPTY_DRAFT, OPTIONS, ignore, setUrl } from './options.js';
import { tokenize } from './tokenize.js';

/**
 * A requisição que o comando descreve. É só dado: nada aqui toca a rede.
 *
 * @typedef {object} CurlRequest
 * @property {string} url
 * @property {string} method                    Em maiúsculas: `GET`, `POST`...
 * @property {Record<string, string>} headers
 * @property {string | null} body               O texto exato que o curl enviaria.
 * @property {number | null} timeout            Em milissegundos (`--max-time`).
 * @property {readonly string[]} ignored        Opções que não mudaram a requisição.
 */

const isOption = (argument) => argument.startsWith('-') && argument !== '-';

/** `--header=x` vira `{ name: '--header', value: 'x' }`. */
const expandLongOption = (argument) => {
  const separator = argument.indexOf('=');
  if (separator === -1) return [{ name: argument }];
  return [{ name: argument.slice(0, separator), value: argument.slice(separator + 1) }];
};

/** `-sXPOST` vira `-s` seguido de `-X` com o valor `POST`. */
const expandShortOptions = (argument) => {
  const expanded = [];

  for (let index = 1; index < argument.length; index++) {
    const name = `-${argument[index]}`;
    const rest = argument.slice(index + 1);

    if (OPTIONS.get(name)?.takesValue && rest) {
      expanded.push({ name, value: rest });
      break;
    }
    expanded.push({ name });
  }

  return expanded;
};

const expandOption = (argument) => (argument.startsWith('--') ? expandLongOption(argument) : expandShortOptions(argument));

/**
 * Aplica cada argumento ao rascunho, consultando a tabela de opções.
 * @param {string[]} tokens
 * @returns {import('./options.js').Draft}
 */
const readArguments = (tokens) => {
  const args = tokens[0] === 'curl' ? tokens.slice(1) : tokens;
  let draft = EMPTY_DRAFT;

  for (let index = 0; index < args.length; index++) {
    if (!isOption(args[index])) {
      draft = setUrl(draft, args[index]);
      continue;
    }

    for (const { name, value: inlineValue } of expandOption(args[index])) {
      const option = OPTIONS.get(name);

      if (!option) {
        draft = ignore(draft, name);
        continue;
      }
      if (!option.takesValue) {
        draft = option.apply(draft);
        continue;
      }

      const value = inlineValue ?? args[++index];
      if (value === undefined) throw new CurlSyntaxError(`A opção ${name} espera um valor.`);
      draft = option.apply(draft, value);
    }
  }

  return draft;
};

const hasScheme = (url) => /^[a-z][a-z\d+.-]*:\/\//i.test(url);
const withScheme = (url) => (hasScheme(url) ? url : `http://${url}`);
const withQuery = (url, query) => (query ? `${url}${url.includes('?') ? '&' : '?'}${query}` : url);

/** `Nome: valor` vira `[nome, valor]`; `Nome;` é o jeito do curl de mandar um cabeçalho vazio. */
const splitHeaderLine = (line) => {
  const separator = line.indexOf(':');
  if (separator === -1) return line.endsWith(';') ? [line.slice(0, -1).trim(), ''] : null;
  return [line.slice(0, separator).trim(), line.slice(separator + 1).trim() || null];
};

/**
 * Junta as linhas num objeto. Nomes são comparados sem diferenciar maiúsculas,
 * a última linha vence e `Nome:` (sem valor) remove o cabeçalho, como no curl.
 * Pseudo-cabeçalhos do HTTP/2 (`:authority`), que versões antigas do Chrome
 * copiavam, ficam de fora.
 */
const toHeaders = (lines) => {
  const byName = new Map();

  for (const line of lines) {
    if (line.startsWith(':')) continue;

    const entry = splitHeaderLine(line);
    if (!entry || !entry[0]) continue;

    const [name, value] = entry;
    byName.delete(name.toLowerCase());
    if (value !== null) byName.set(name.toLowerCase(), [name, value]);
  }

  return Object.fromEntries(byName.values());
};

const defaultHeaderLines = (draft, hasBody) => {
  if (!hasBody) return [];
  if (draft.json) return ['Content-Type: application/json', 'Accept: application/json'];
  return ['Content-Type: application/x-www-form-urlencoded'];
};

const inferMethod = (draft, hasBody) => {
  if (draft.method) return draft.method;
  if (draft.head) return 'HEAD';
  return hasBody ? 'POST' : 'GET';
};

/**
 * Fecha o rascunho numa requisição imutável.
 * @param {import('./options.js').Draft} draft
 * @returns {CurlRequest}
 */
const toRequest = (draft) => {
  if (!draft.url) throw new CurlSyntaxError('Nenhuma URL encontrada no comando cURL.');

  const payload = draft.data.length > 0 ? draft.data.join('&') : null;
  const body = draft.asQuery ? null : payload;
  const hasBody = body !== null;

  return Object.freeze({
    url: withQuery(withScheme(draft.url), draft.asQuery ? payload : null),
    method: inferMethod(draft, hasBody),
    headers: Object.freeze(toHeaders([...defaultHeaderLines(draft, hasBody), ...draft.headers])),
    body,
    timeout: draft.timeout,
    ignored: Object.freeze([...draft.ignored]),
  });
};

/**
 * Lê um comando cURL e devolve a requisição que ele descreve, sem executar nada.
 *
 * @param {string | import('./tokenize.js').Segment[]} command
 * @returns {CurlRequest}
 */
export const parseCurl = (command) => toRequest(readArguments(tokenize(command)));
