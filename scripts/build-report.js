// Gera o index.html a partir de report/template.html, embutindo os arquivos
// reais do repositório. Assim o relatório nunca mostra um trecho desatualizado.
import { readFile, readdir, writeFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');
const listJs = async (directory) => (await readdir(new URL(directory, root))).filter((name) => name.endsWith('.js')).map((name) => `${directory}${name}`);

const originalFiles = ['original/package.json', ...(await listJs('original/src/curl/'))];
const newFiles = ['index.js', ...(await listJs('src/curl/'))];
const testFiles = await listJs('test/');

const sources = {};
for (const path of [...originalFiles, ...newFiles, ...testFiles]) sources[path] = await read(path);

const countLines = (paths) => paths.reduce((total, path) => total + sources[path].trimEnd().split('\n').length, 0);
const countTests = (paths) => paths.reduce((total, path) => total + (sources[path].match(/^test\(/gm) ?? []).length, 0);

const values = {
  ORIGINAL_LINES: countLines(originalFiles.filter((path) => path.endsWith('.js') && !path.endsWith('.test.js'))),
  NEW_LINES: countLines(newFiles),
  TEST_COUNT: countTests(testFiles),
};

// `<` escapado para que nenhum trecho de código feche a tag <script> por engano.
const embedded = `<script type="application/json" id="sources">${JSON.stringify(sources).replaceAll('<', '\\u003c')}</script>`;

const template = await read('report/template.html');
const html = template
  .replace('<!--SOURCES-->', () => embedded)
  .replace(/\{\{(\w+)\}\}/g, (match, name) => values[name] ?? match);

await writeFile(new URL('index.html', root), html);
console.log('index.html gerado', values);
