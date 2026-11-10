const breakLines = (curlString = '') => curlString.split(/\s{2,}/g).map(line => line.trim());

export const getURL = (curlString) => {
  const lines = breakLines(curlString);
  const matchURL = (line) => line.startsWith('curl');
  const clearLineURL = (line) => line.replace(/^curl '?([^']*)'?$/, '$1');

  return lines
    .filter(matchURL)
    .map(clearLineURL)[0];
};

export const getHeaders = (curlString) => {
  const lines = breakLines(curlString);
  const matchHeader = (line) => line.startsWith('-H');
  const clearLineHeader = (line) => line.replace(/^-H '(.*)'$/, '$1');
  const splitLineHeader = (line) => line.split(': ');
  const createObjectHeader = ([key, value]) => ({ [key]: value });
  const reducerToObjectHeader = (header, line) => ({ ...header, ...createObjectHeader(line) });

  return lines
    .filter(matchHeader)
    .map(clearLineHeader)
    .map(splitLineHeader)
    .reduce(reducerToObjectHeader, {});
};

export const getBody = (curlString) => {
  const lines = breakLines(curlString);
  const matchBody = (line) => ['--data-raw'].some((value) => line.startsWith(value));
  const clearLineBody = (line) => line.replace(/^.*'(.*)'$/, '$1');
  const body = lines.filter(matchBody).map(clearLineBody)[0];

  return body ? JSON.parse(body) : null;
};

export const getMethod = (curlString, hasBody) => {
  const lines = breakLines(curlString);
  const matchMethod = (line) => line.startsWith('-X');
  const clearLineMethod = (line) => line.replace(/^-X '(.*)'$/, '$1');
  const normalizeLineMethood = (line) => line.toLowerCase();
  let method = 'get';

  const methodsSearched = lines.filter(matchMethod);

  if (methodsSearched && methodsSearched.length > 0) {
    method = methodsSearched.map(clearLineMethod).map(normalizeLineMethood)[0];
  } else {
    if (hasBody) {
      method = 'post';
    }
  }

  return method;
};
