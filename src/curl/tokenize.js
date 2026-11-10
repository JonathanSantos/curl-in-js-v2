import { CurlSyntaxError } from './errors.js';

/**
 * Um pedaço do comando. `literal: true` marca um valor interpolado (`${...}`):
 * ele entra no argumento atual exatamente como é, sem passar pelas regras do shell.
 * @typedef {{ text: string, literal?: boolean }} Segment
 */

const ANSI_ESCAPES = { n: '\n', t: '\t', r: '\r', a: '\x07', b: '\b', e: '\x1b', f: '\f', v: '\v' };

const ANSI_CODE_POINTS = [
  /^x([0-9a-fA-F]{1,2})/,
  /^u([0-9a-fA-F]{1,4})/,
  /^U([0-9a-fA-F]{1,8})/,
];

/** Decodifica o escape de `$'...'` que começa em `rest` e diz quantos caracteres consumiu. */
const readAnsiEscape = (rest) => {
  for (const pattern of ANSI_CODE_POINTS) {
    const match = pattern.exec(rest);
    if (match) return { value: String.fromCodePoint(parseInt(match[1], 16)), length: match[0].length };
  }

  const octal = /^[0-7]{1,3}/.exec(rest);
  if (octal) return { value: String.fromCodePoint(parseInt(octal[0], 8)), length: octal[0].length };

  return { value: ANSI_ESCAPES[rest[0]] ?? rest[0] ?? '', length: 1 };
};

const lineBreakLength = (text, index) => {
  if (text[index] === '\n') return 1;
  if (text[index] === '\r' && text[index + 1] === '\n') return 2;
  return 0;
};

/**
 * Um leitor por contexto de aspas. Cada um recebe o cursor, consome o que
 * entender e devolve a próxima posição; trocar de contexto é trocar `cursor.mode`.
 */
const readers = {
  bare(cursor, text, index) {
    const char = text[index];

    if (/\s/.test(char)) {
      cursor.flush();
      return index + 1;
    }
    if (char === "'") return cursor.enter('single', index + 1);
    if (char === '"') return cursor.enter('double', index + 1);
    if (char === '$' && text[index + 1] === "'") return cursor.enter('ansi', index + 2);
    if (char !== '\\') return cursor.push(char, index + 1);

    // Barra no fim da linha é continuação: o comando segue na linha de baixo.
    const lineBreak = lineBreakLength(text, index + 1);
    if (lineBreak) return index + 1 + lineBreak;
    if (index + 1 >= text.length) return index + 1;
    return cursor.push(text[index + 1], index + 2);
  },

  single(cursor, text, index) {
    if (text[index] === "'") return cursor.enter('bare', index + 1);
    return cursor.push(text[index], index + 1);
  },

  double(cursor, text, index) {
    const char = text[index];
    const next = text[index + 1];

    if (char === '"') return cursor.enter('bare', index + 1);
    if (char !== '\\') return cursor.push(char, index + 1);
    if (next === '\n') return index + 2;
    if ('"\\$`'.includes(next ?? ' ')) return cursor.push(next, index + 2);
    return cursor.push(char, index + 1);
  },

  ansi(cursor, text, index) {
    if (text[index] === "'") return cursor.enter('bare', index + 1);
    if (text[index] !== '\\') return cursor.push(text[index], index + 1);

    const escape = readAnsiEscape(text.slice(index + 1, index + 10));
    return cursor.push(escape.value, index + 1 + escape.length);
  },
};

const createCursor = () => {
  const tokens = [];
  let current = null;

  const cursor = {
    mode: 'bare',
    tokens,
    push(text, nextIndex) {
      current = (current ?? '') + text;
      return nextIndex;
    },
    // Abrir aspas já começa um argumento: é o que faz `''` valer como string vazia.
    enter(mode, nextIndex) {
      cursor.mode = mode;
      return cursor.push('', nextIndex);
    },
    flush() {
      if (current === null) return;
      tokens.push(current);
      current = null;
    },
  };

  return cursor;
};

/**
 * Quebra um comando em argumentos do jeito que o shell faria: aspas simples,
 * aspas duplas, `$'...'` (o formato que o Chrome usa quando o corpo tem
 * caracteres especiais) e barra invertida no fim da linha.
 *
 * @param {string | Segment[]} input
 * @returns {string[]}
 */
export const tokenize = (input) => {
  const segments = typeof input === 'string' ? [{ text: input }] : input;
  const cursor = createCursor();

  for (const segment of segments) {
    if (segment.literal) {
      cursor.push(segment.text);
      continue;
    }

    let index = 0;
    while (index < segment.text.length) {
      index = readers[cursor.mode](cursor, segment.text, index);
    }
  }

  if (cursor.mode !== 'bare') {
    throw new CurlSyntaxError('Aspas abertas e nunca fechadas no comando cURL.');
  }

  cursor.flush();
  return cursor.tokens;
};
