import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getBody, getHeaders, getMethod, getURL } from '../index.js';

// O comando do teste original, na forma em que `curl.js` de 2021 o recebia:
// o texto "cozido" do template, em que a barra no fim da linha já sumiu.
const DITTO_2021 = `
    curl 'https://pokeapi.co/api/v2/pokemon/ditto'       -H 'sec-ch-ua: "Google Chrome";v="89", "Chromium";v="89", ";Not A Brand";v="99"'       -H 'Referer: https://pokeapi.co/'       -H 'sec-ch-ua-mobile: ?0'       -H 'User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/89.0.4389.114 Safari/537.36'       --compressed
  `;

test('as quatro funções de 2021 devolvem o mesmo para o comando do teste original', () => {
  assert.equal(getURL(DITTO_2021), 'https://pokeapi.co/api/v2/pokemon/ditto');
  assert.equal(getMethod(DITTO_2021), 'get');
  assert.equal(getBody(DITTO_2021), null);
  assert.deepEqual(getHeaders(DITTO_2021), {
    'sec-ch-ua': '"Google Chrome";v="89", "Chromium";v="89", ";Not A Brand";v="99"',
    Referer: 'https://pokeapi.co/',
    'sec-ch-ua-mobile': '?0',
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/89.0.4389.114 Safari/537.36',
  });
});

test('getBody devolve objeto para JSON e texto para o resto, sem lançar', () => {
  assert.deepEqual(getBody(`curl https://a.dev --data-raw '{"a":1}'`), { a: 1 });
  assert.equal(getBody(`curl https://a.dev --data-raw 'a=1&b=2'`), 'a=1&b=2');
});

test('getMethod infere post pelo corpo e respeita -X, em minúsculas', () => {
  assert.equal(getMethod(`curl https://a.dev --data-raw '{}'`), 'post');
  assert.equal(getMethod(`curl https://a.dev -X 'DELETE'`), 'delete');
});
