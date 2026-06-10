/* API client for GMIF SQLite backend */
var API_BASE = '';

function apiUrl(path) {
  return API_BASE + '/api' + path;
}

function apiHeaders() {
  var headers = { 'Content-Type': 'application/json' };
  var token = sessionStorage.getItem('gmif_token');
  if (token) headers['Authorization'] = 'Bearer ' + token;
  return headers;
}

function apiGet(path) {
  return fetch(apiUrl(path), { headers: apiHeaders() }).then(function(r) {
    if (!r.ok) return r.json().then(function(e) { throw new Error(e.error || 'Request failed'); });
    return r.json();
  });
}

function apiPost(path, body) {
  return fetch(apiUrl(path), { method: 'POST', headers: apiHeaders(), body: JSON.stringify(body) }).then(function(r) {
    if (!r.ok) return r.json().then(function(e) { throw new Error(e.error || 'Request failed'); });
    return r.json();
  });
}

function apiPut(path, body) {
  return fetch(apiUrl(path), { method: 'PUT', headers: apiHeaders(), body: JSON.stringify(body) }).then(function(r) {
    if (!r.ok) return r.json().then(function(e) { throw new Error(e.error || 'Request failed'); });
    return r.json();
  });
}

function apiDelete(path) {
  return fetch(apiUrl(path), { method: 'DELETE', headers: apiHeaders() }).then(function(r) {
    if (!r.ok) return r.json().then(function(e) { throw new Error(e.error || 'Request failed'); });
    return r.json();
  });
}
