export class ConnectionError extends Error {
  constructor(kind, message, status=0) {super(message);this.name='ConnectionError';this.kind=kind;this.status=status;}
}
export async function requestJSON(fetchImpl, url, options={}) {
  const method=options.method||'GET';
  // Avoid stale API responses from the previous, local-only app's service worker.
  const target=method==='GET'?`${url}${url.includes('?')?'&':'?'}_connect=${Date.now()}`:url;
  let response;
  try {
    response=await fetchImpl(target,{credentials:'same-origin',cache:'no-store',redirect:'manual',signal:AbortSignal.timeout(15000),...options});
  } catch(error) {
    throw new ConnectionError(error?.name==='TimeoutError'||error?.name==='AbortError'?'timeout':'network','The connection could not finish.');
  }
  if(response.type==='opaqueredirect'||response.status>=300&&response.status<400||response.redirected)
    throw new ConnectionError('session','Sign in again to open your account.',response.status);
  const type=response.headers.get('Content-Type')||'';
  if(!type.toLowerCase().includes('application/json'))
    throw new ConnectionError(response.ok||response.status===401||response.status===403?'session':'server','The account service did not return a valid response.',response.status);
  let data;
  try {data=await response.json();} catch {throw new ConnectionError('server','The account service could not finish its response.',response.status);}
  return {response,data};
}
