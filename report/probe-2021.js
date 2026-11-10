// Roda o código de 2021, sem alterações, contra um servidor local que devolve o
// que recebe. É a fonte da tabela "O que o tempo revelou" do relatório.
//
//   cd original && npm install && cd .. && node report/probe-2021.js
import { createServer } from 'node:http';
import { curl } from '../original/src/curl/curl.js';
import { getBody, getHeaders, getURL } from '../original/src/curl/utils.js';

const server = createServer(async (request, response) => {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  const echo = { method: request.method, url: request.url, body: Buffer.concat(chunks).toString() };
  response.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify(echo));
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;

const show = async (label, run) => {
  try {
    console.log(label, '=>', JSON.stringify(await run()));
  } catch (error) {
    console.log(label, '=> LANÇA', `${error.constructor.name}: ${error.message}`);
  }
};

// Os comandos estão na forma "cozida" que a função recebia: sem a barra de continuação.
await show('POST com corpo JSON      ', () => curl([`
    curl '${origin}/users'       -H 'Content-Type: application/json'       --data-raw '{"name":"Jona"}'`]));

const id = 42;
await show('template com ${id}       ', () => curl`
    curl '${origin}/users/${id}'       -H 'X-Trace: abc'`);

await show('servidor fora do ar      ', () => curl([`
    curl 'http://127.0.0.1:1/'`]));

await show('uma linha: getURL        ', () => getURL(`curl 'https://a.dev/x' -H 'A: b'`));
await show('uma linha: getHeaders    ', () => getHeaders(`curl 'https://a.dev/x' -H 'A: b'`));
await show('cabeçalho com ": "       ', () => getHeaders(`curl 'https://a.dev'       -H 'X-Note: a: b'`));
await show('cabeçalho com 2 espaços  ', () => getHeaders(`curl 'https://a.dev'       -H 'X-Note: a  b'`));
await show('corpo que não é JSON     ', () => getBody(`curl 'https://a.dev'       --data-raw 'a=1&b=2'`));

server.close();
