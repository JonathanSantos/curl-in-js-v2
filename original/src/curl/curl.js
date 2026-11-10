import axios from 'axios';
import { getURL, getHeaders, getBody, getMethod } from "./utils.js";

export const curl = async ([curlString]) => {
  const url = getURL(curlString);
  const headers = getHeaders(curlString);
  const body = getBody(curlString);
  const method = getMethod(curlString, !!body);

  return axios(url, { headers, body, method })
    .then((response) => ({ data: response.data, status: response.status }))
    .catch(({ response }) => ({ data: response.data, status: response.status }));
};
