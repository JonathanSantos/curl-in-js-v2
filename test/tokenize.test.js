import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CurlSyntaxError, tokenize } from '../index.js';

test('separa argumentos por espaço e respeita aspas simples', () => {
  assert.deepEqual(tokenize("curl 'https://a.dev/x y' -H 'A: b  c'"), ['curl', 'https://a.dev/x y', '-H', 'A: b  c']);
});

test('trata barra no fim da linha como continuação', () => {
  assert.deepEqual(tokenize("curl 'https://a.dev' \\\n  -H 'A: b' \\\r\n  --compressed"), [
    'curl', 'https://a.dev', '-H', 'A: b', '--compressed',
  ]);
});

test('aspas duplas só escapam o que o shell escaparia', () => {
  assert.deepEqual(tokenize(String.raw`-d "{\"a\": \"C:\dir\"}"`), ['-d', String.raw`{"a": "C:\dir"}`]);
});

test("decodifica $'...', o formato do Chrome para corpos com caracteres especiais", () => {
  assert.deepEqual(tokenize(String.raw`--data-raw $'it\'s\n\u00e9 \x41'`), ['--data-raw', "it's\né A"]);
});

test('junta pedaços colados e mantém a string vazia', () => {
  assert.deepEqual(tokenize(`-H 'A: '"b" ''`), ['-H', 'A: b', '']);
});

test('segmento literal entra no argumento atual sem ser interpretado', () => {
  const segments = [{ text: "curl 'https://a.dev/" }, { text: "it's a b", literal: true }, { text: "' -H " }, { text: 'A: x y', literal: true }];
  assert.deepEqual(tokenize(segments), ['curl', "https://a.dev/it's a b", '-H', 'A: x y']);
});

test('aspas abertas viram CurlSyntaxError', () => {
  assert.throws(() => tokenize("curl 'https://a.dev"), CurlSyntaxError);
});
