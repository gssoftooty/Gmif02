/* ============================
   AUTH - API-backed with SQLite
   ============================ */

var AUTH_CONFIG = {
  maxAttempts: 5,
  lockoutMinutes: 15,
  sessionHours: 2
};

function checkRateLimit() {
  var attempts = JSON.parse(localStorage.getItem('gmif_login_attempts')) || [];
  var now = Date.now();
  attempts = attempts.filter(function(t) { return now - t < AUTH_CONFIG.lockoutMinutes * 60 * 1000; });
  localStorage.setItem('gmif_login_attempts', JSON.stringify(attempts));
  if (attempts.length >= AUTH_CONFIG.maxAttempts) {
    var waitMs = attempts[0] + AUTH_CONFIG.lockoutMinutes * 60 * 1000 - now;
    var waitMin = Math.ceil(waitMs / 60000);
    return { blocked: true, waitMinutes: waitMin };
  }
  return { blocked: false };
}

function recordAttempt() {
  var attempts = JSON.parse(localStorage.getItem('gmif_login_attempts')) || [];
  attempts.push(Date.now());
  localStorage.setItem('gmif_login_attempts', JSON.stringify(attempts));
}

function clearAttempts() {
  localStorage.removeItem('gmif_login_attempts');
}

function isLoggedIn() {
  var token = sessionStorage.getItem('gmif_token');
  if (!token) return false;
  var expiry = parseInt(sessionStorage.getItem('gmif_expiry'), 10);
  if (expiry && Date.now() > expiry) {
    sessionStorage.removeItem('gmif_token');
    sessionStorage.removeItem('gmif_user');
    sessionStorage.removeItem('gmif_expiry');
    return false;
  }
  return true;
}

function requireAuth() {
  if (!isLoggedIn()) {
    window.location.href = 'login.html';
    return null;
  }
  var user = JSON.parse(sessionStorage.getItem('gmif_user') || '{}');
  var expiry = Date.now() + AUTH_CONFIG.sessionHours * 60 * 60 * 1000;
  sessionStorage.setItem('gmif_expiry', expiry.toString());
  return user;
}

function logout() {
  var token = sessionStorage.getItem('gmif_token');
  if (token) {
    fetch('/api/logout', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + token }
    }).catch(function() {});
  }
  sessionStorage.removeItem('gmif_token');
  sessionStorage.removeItem('gmif_user');
  sessionStorage.removeItem('gmif_expiry');
  window.location.href = 'login.html';
}

var loginForm = document.getElementById('loginForm');
if (loginForm) {
  loginForm.addEventListener('submit', function(e) {
    e.preventDefault();
    var errorEl = document.getElementById('loginError');
    var username = document.getElementById('username').value.trim();
    var password = document.getElementById('password').value;
    var usernameField = document.getElementById('username');
    var passwordField = document.getElementById('password');

    var rate = checkRateLimit();
    if (rate.blocked) {
      errorEl.textContent = 'Too many attempts. Try again in ' + rate.waitMinutes + ' min.';
      return;
    }

    fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: username, password: password })
    }).then(function(r) {
      if (!r.ok) {
        if (r.status === 429) throw new Error('Too many attempts. Try again later.');
        throw new Error('Invalid username or password.');
      }
      return r.json();
    }).then(function(data) {
      clearAttempts();
      sessionStorage.setItem('gmif_token', data.token);
      sessionStorage.setItem('gmif_user', JSON.stringify({ username: data.username, role: data.role }));
      var expiry = Date.now() + AUTH_CONFIG.sessionHours * 60 * 60 * 1000;
      sessionStorage.setItem('gmif_expiry', expiry.toString());
      window.location.href = 'index.html';
    }).catch(function(err) {
      recordAttempt();
      errorEl.textContent = err.message;
      usernameField.value = '';
      passwordField.value = '';
      usernameField.focus();
    });
  });
}
