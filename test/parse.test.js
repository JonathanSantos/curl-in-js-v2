import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CurlSyntaxError, parseCurl } from '../index.js';

test('GET simples', () => {
  assert.deepEqual(parseCurl("curl 'https://a.dev/users'"), {
    url: 'https://a.dev/users', method: 'GET', headers: {}, body: null, timeout: null, ignored: [],
  });
});

test('comando em uma linha só, sem aspas e sem a palavra curl', () => {
  const request = parseCurl('https://a.dev -H A:b -X delete');
  assert.equal(request.url, 'https://a.dev');
  assert.equal(request.method, 'DELETE');
  assert.deepEqual(request.headers, { A: 'b' });
});

test('URL sem esquema ganha http://, como no curl', () => {
  assert.equal(parseCurl('curl localhost:3000/health').url, 'http://localhost:3000/health');
});

test('valor do cabeçalho pode conter ": " e espaços duplos', () => {
  const { headers } = parseCurl(`curl https://a.dev -H 'X-Note: a: b  c' -H 'Referer: https://a.dev/'`);
  assert.deepEqual(headers, { 'X-Note': 'a: b  c', Referer: 'https://a.dev/' });
});

test('cabeçalhos: último vence sem diferenciar maiúsculas, "Nome:" remove, "Nome;" envia vazio', () => {
  const { headers } = parseCurl(`curl https://a.dev -d x -H 'accept: a' -H 'Accept: b' -H 'Content-Type:' -H 'X-Empty;' -H ':authority: a.dev'`);
  assert.deepEqual(headers, { Accept: 'b', 'X-Empty': '' });
});

test('corpo vira POST com o content-type padrão do curl', () => {
  const request = parseCurl(`curl https://a.dev --data-raw 'a=1' -d 'b=2'`);
  assert.equal(request.method, 'POST');
  assert.equal(request.body, 'a=1&b=2');
  assert.equal(request.headers['Content-Type'], 'application/x-www-form-urlencoded');
});

test('o corpo não precisa ser JSON e é mantido como texto exato', () => {
  assert.equal(parseCurl(`curl https://a.dev --data-raw '{"a": "it is"}' -H 'content-type: application/json'`).body, '{"a": "it is"}');
  assert.equal(parseCurl(`curl https://a.dev --data-raw 'plain text'`).body, 'plain text');
});

test('-X explícito vence a inferência', () => {
  assert.equal(parseCurl(`curl -X 'PUT' https://a.dev -d x`).method, 'PUT');
  assert.equal(parseCurl('curl -XPATCH https://a.dev').method, 'PATCH');
  assert.equal(parseCurl('curl --request=options https://a.dev').method, 'OPTIONS');
});

test('--json define corpo, Content-Type e Accept', () => {
  const request = parseCurl(`curl https://a.dev --json '{"a":1}'`);
  assert.equal(request.body, '{"a":1}');
  assert.deepEqual(request.headers, { 'Content-Type': 'application/json', Accept: 'application/json' });
});

test('-G leva os dados para a query string', () => {
  const request = parseCurl(`curl -G 'https://a.dev/search?x=1' -d 'q=js' --data-urlencode 'name=João Silva'`);
  assert.equal(request.url, 'https://a.dev/search?x=1&q=js&name=Jo%C3%A3o%20Silva');
  assert.equal(request.method, 'GET');
  assert.equal(request.body, null);
});

test('atalhos de cabeçalho: -u, -A, -e, -b', () => {
  const { headers } = parseCurl(`curl https://a.dev -u 'user:sénha' -A 'agent/1' -e https://ref.dev -b 'a=1; b=2'`);
  assert.deepEqual(headers, {
    Authorization: `Basic ${Buffer.from('user:sénha').toString('base64')}`,
    'User-Agent': 'agent/1',
    Referer: 'https://ref.dev',
    Cookie: 'a=1; b=2',
  });
});

test('-I vira HEAD e --max-time vira timeout em ms', () => {
  const request = parseCurl('curl -I -m 2.5 https://a.dev');
  assert.equal(request.method, 'HEAD');
  assert.equal(request.timeout, 2500);
});

test('opções sem efeito e desconhecidas são anotadas, não confundidas com a URL', () => {
  const request = parseCurl('curl -sSL --compressed -o out.json --nova-opcao https://a.dev');
  assert.equal(request.url, 'https://a.dev');
  assert.deepEqual(request.ignored, ['--silent', '--show-error', '--location', '--compressed', '--output', '--nova-opcao']);
});

test('a requisição é imutável', () => {
  const request = parseCurl('curl https://a.dev');
  assert.throws(() => { request.url = 'x'; }, TypeError);
  assert.throws(() => { request.headers.A = 'b'; }, TypeError);
});

test('erros de sintaxe dizem o que faltou', () => {
  assert.throws(() => parseCurl("curl -H 'A: b'"), { name: 'CurlSyntaxError', message: /URL/ });
  assert.throws(() => parseCurl('curl https://a.dev -H'), { name: 'CurlSyntaxError', message: /-H espera um valor/ });
  assert.throws(() => parseCurl('curl https://a.dev -d @body.json'), CurlSyntaxError);
  assert.throws(() => parseCurl('curl https://a.dev -F a=b'), CurlSyntaxError);
  assert.throws(() => parseCurl('curl https://a.dev -m soon'), CurlSyntaxError);
});
