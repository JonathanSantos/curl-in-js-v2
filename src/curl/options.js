import { CurlSyntaxError } from './errors.js';

/**
 * Rascunho da requisição enquanto as opções são lidas. Nenhuma opção altera o
 * rascunho que recebeu: cada uma devolve um novo, como um reducer.
 *
 * @typedef {object} Draft
 * @property {string | null} url
 * @property {string | null} method
 * @property {string[]} headers   Linhas no formato do curl: `Nome: valor`.
 * @property {string[]} data      Pedaços do corpo, unidos com `&` no final.
 * @property {boolean} json
 * @property {boolean} asQuery    `-G`: o corpo vira query string.
 * @property {boolean} head       `-I`: só os cabeçalhos da resposta.
 * @property {number | null} timeout  Em milissegundos.
 * @property {string[]} ignored   Opções reconhecidas como sem efeito aqui, ou desconhecidas.
 */

/** @type {Draft} */
export const EMPTY_DRAFT = Object.freeze({
  url: null,
  method: null,
  headers: [],
  data: [],
  json: false,
  asQuery: false,
  head: false,
  timeout: null,
  ignored: [],
});

const unsupported = (name, reason) => () => {
  throw new CurlSyntaxError(`A opção ${name} não é suportada: ${reason}.`);
};

const rejectFile = (name, value) => {
  if (value.startsWith('@')) unsupported(name, 'ler o corpo de um arquivo (@arquivo) exigiria acesso a disco')();
};

const toBase64 = (text) => btoa(String.fromCharCode(...new TextEncoder().encode(text)));

export const setUrl = (draft, url) => ({ ...draft, url: draft.url ?? url });
export const ignore = (draft, name) => ({ ...draft, ignored: [...draft.ignored, name] });

const addHeader = (draft, line) => ({ ...draft, headers: [...draft.headers, line] });
const addData = (draft, chunk) => ({ ...draft, data: [...draft.data, chunk] });
const headerNamed = (name) => (draft, value) => addHeader(draft, `${name}: ${value}`);

const addDataChecked = (name) => (draft, value) => {
  rejectFile(name, value);
  return addData(draft, value);
};

const addUrlEncodedData = (draft, value) => {
  const separator = value.indexOf('=');
  if (separator === -1) {
    rejectFile('--data-urlencode', value);
    return addData(draft, encodeURIComponent(value));
  }

  const name = value.slice(0, separator);
  const encoded = encodeURIComponent(value.slice(separator + 1));
  return addData(draft, name ? `${name}=${encoded}` : encoded);
};

const setMaxTime = (draft, seconds) => {
  const timeout = Number(seconds) * 1000;
  if (!Number.isFinite(timeout) || timeout <= 0) {
    throw new CurlSyntaxError(`--max-time espera um número de segundos, recebeu "${seconds}".`);
  }
  return { ...draft, timeout };
};

const withValue = (names, apply) => ({ names, apply, takesValue: true });
const flag = (names, apply) => ({ names, apply, takesValue: false });
const noop = (names, takesValue = false) => ({ names, takesValue, apply: (draft) => ignore(draft, names.at(-1)) });

/**
 * A tabela de opções. Ensinar uma opção nova ao parser é acrescentar uma linha
 * aqui: nada mais precisa mudar.
 */
const OPTION_TABLE = [
  withValue(['--url'], setUrl),
  withValue(['-X', '--request'], (draft, method) => ({ ...draft, method: method.toUpperCase() })),
  withValue(['-H', '--header'], addHeader),
  withValue(['-A', '--user-agent'], headerNamed('User-Agent')),
  withValue(['-e', '--referer'], headerNamed('Referer')),
  withValue(['-b', '--cookie'], headerNamed('Cookie')),
  withValue(['-u', '--user'], (draft, credentials) => addHeader(draft, `Authorization: Basic ${toBase64(credentials)}`)),
  withValue(['-d', '--data', '--data-ascii'], addDataChecked('--data')),
  withValue(['--data-binary'], addDataChecked('--data-binary')),
  withValue(['--data-raw'], addData),
  withValue(['--data-urlencode'], addUrlEncodedData),
  withValue(['--json'], (draft, value) => ({ ...addDataChecked('--json')(draft, value), json: true })),
  withValue(['-m', '--max-time'], setMaxTime),
  withValue(['-F', '--form'], unsupported('--form', 'multipart ainda não foi implementado')),
  flag(['-G', '--get'], (draft) => ({ ...draft, asQuery: true })),
  flag(['-I', '--head'], (draft) => ({ ...draft, head: true })),

  // Opções que o curl aceita e que aqui não mudam a requisição: o fetch já
  // descomprime e segue redirecionamentos, e não há terminal para silenciar.
  noop(['--compressed']),
  noop(['-L', '--location']),
  noop(['-s', '--silent']),
  noop(['-S', '--show-error']),
  noop(['-k', '--insecure']),
  noop(['-i', '--include']),
  noop(['-v', '--verbose']),
  noop(['-f', '--fail']),
  noop(['-o', '--output'], true),
  noop(['-w', '--write-out'], true),
  noop(['-x', '--proxy'], true),
  noop(['-c', '--cookie-jar'], true),
  noop(['--connect-timeout'], true),
  noop(['--retry'], true),
];

/** Nome da opção (curto ou longo) para a entrada da tabela. */
export const OPTIONS = new Map(OPTION_TABLE.flatMap((option) => option.names.map((name) => [name, option])));
