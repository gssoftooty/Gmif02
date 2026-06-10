var currentUser = requireAuth();
if (currentUser) {
  document.getElementById('userDisplay').textContent = currentUser.username;
  document.getElementById('topbarUser').textContent = currentUser.username;
}

var currentPage = 'dashboard';

function navigateTo(page) {
  currentPage = page;
  document.querySelectorAll('.nav-item').forEach(function(el) {
    el.classList.toggle('active', el.dataset.page === page);
  });
  var titles = { dashboard: 'Dashboard', programs: 'Manage Programs', team: 'Manage Team', pages: 'Edit Pages', blog: 'Manage Blog', gallery: 'Manage Gallery', settings: 'Settings' };
  document.getElementById('pageTitle').textContent = titles[page] || 'Dashboard';
  renderPage(page);
}

function renderPage(page) {
  var area = document.getElementById('contentArea');
  area.innerHTML = '<p class="pwd-msg">Loading...</p>';
  if (page === 'dashboard') renderDashboard(area);
  else if (page === 'programs') renderPrograms(area);
  else if (page === 'team') renderTeam(area);
  else if (page === 'pages') renderPages(area);
  else if (page === 'blog') renderBlog(area);
  else if (page === 'gallery') renderGallery(area);
  else if (page === 'settings') renderSettings(area);
}

function sanitize(str) {
  if (!str) return '';
  return str.replace(/<script[\s\S]*?<\/script>/gi, '')
            .replace(/<[\/]*script[^>]*>/gi, '')
            .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '')
            .replace(/on\w+\s*=\s*[^\s>]+/gi, '')
            .replace(/javascript\s*:/gi, 'blocked:');
}

/* ============================
   DASHBOARD
   ============================ */
function renderDashboard(area) {
  apiGet('/dashboard/stats').then(function(stats) {
    area.innerHTML = `
      <div class="stats-grid">
        <div class="stat-card"><div class="stat-num">${stats.programs}</div><div class="stat-label">Programs</div></div>
        <div class="stat-card"><div class="stat-num">${stats.team}</div><div class="stat-label">Team Members</div></div>
        <div class="stat-card"><div class="stat-num">${stats.users}</div><div class="stat-label">Admin Users</div></div>
        <div class="stat-card"><div class="stat-num">${stats.blog}</div><div class="stat-label">Blog Posts</div></div>
      </div>
    `;
  }).catch(function(err) {
    area.innerHTML = '<p class="pwd-msg">Error loading dashboard: ' + err.message + '</p>';
  });
}

function countUsers() { return 0; }

/* ============================
   PROGRAMS
   ============================ */
function renderPrograms(area) {
  apiGet('/programs').then(function(programs) {
    area.innerHTML = `
      <div class="toolbar"><button class="btn-admin" onclick="addProgram()">+ Add Program</button></div>
      <div class="table-wrap"><table class="admin-table">
        <thead><tr><th>Title</th><th>Description</th><th>Tags</th><th>Actions</th></tr></thead>
        <tbody id="progBody">${programs.map(function(p, i) { return '<tr><td>' + p.title + '</td><td>' + p.description + '</td><td>' + (p.tags || []).map(function(t) { return '<span class="tag">' + t + '</span>'; }).join('') + '</td><td><button class="btn-sm-admin" onclick="editProgram(' + p.id + ')">Edit</button> <button class="btn-sm-admin btn-danger" onclick="deleteProgram(' + p.id + ')">Del</button></td></tr>'; }).join('')}</tbody>
      </table></div>
    `;
  }).catch(function(err) {
    area.innerHTML = '<p class="pwd-msg">Error: ' + err.message + '</p>';
  });
}

function addProgram() {
  var title = sanitize(prompt('Program title:'));
  if (!title) return;
  var desc = sanitize(prompt('Description:'));
  if (!desc) return;
  var tags = sanitize(prompt('Tags (comma separated):'));
  apiPost('/programs', { title: title, description: desc, tags: tags ? tags.split(',').map(function(t) { return t.trim(); }) : [] }).then(function() {
    renderPrograms(document.getElementById('contentArea'));
  }).catch(function(err) { alert(err.message); });
}

function editProgram(id) {
  apiGet('/programs').then(function(programs) {
    var p = programs.find(function(x) { return x.id === id; });
    if (!p) return;
    var title = sanitize(prompt('Program title:', p.title));
    if (!title) return;
    var desc = sanitize(prompt('Description:', p.description));
    if (!desc) return;
    var tags = sanitize(prompt('Tags (comma separated):', (p.tags || []).join(', ')));
    apiPut('/programs/' + id, { title: title, description: desc, tags: tags ? tags.split(',').map(function(t) { return t.trim(); }) : [] }).then(function() {
      renderPrograms(document.getElementById('contentArea'));
    }).catch(function(err) { alert(err.message); });
  });
}

function deleteProgram(id) {
  if (!confirm('Delete this program?')) return;
  apiDelete('/programs/' + id).then(function() {
    renderPrograms(document.getElementById('contentArea'));
  }).catch(function(err) { alert(err.message); });
}

/* ============================
   TEAM
   ============================ */
function renderTeam(area) {
  apiGet('/team').then(function(team) {
    area.innerHTML = `
      <div class="toolbar"><button class="btn-admin" onclick="addMember()">+ Add Member</button></div>
      <div class="table-wrap"><table class="admin-table">
        <thead><tr><th>Name</th><th>Role</th><th>Phone</th><th>Email</th><th>Actions</th></tr></thead>
        <tbody id="teamBody">${team.map(function(t, i) { return '<tr><td>' + t.name + '</td><td>' + t.role + '</td><td>' + t.phone + '</td><td>' + t.email + '</td><td><button class="btn-sm-admin" onclick="editMember(' + t.id + ')">Edit</button> <button class="btn-sm-admin btn-danger" onclick="deleteMember(' + t.id + ')">Del</button></td></tr>'; }).join('')}</tbody>
      </table></div>
    `;
  }).catch(function(err) {
    area.innerHTML = '<p class="pwd-msg">Error: ' + err.message + '</p>';
  });
}

function addMember() {
  var name = sanitize(prompt('Name:'));
  if (!name) return;
  var role = sanitize(prompt('Role:'));
  var phone = sanitize(prompt('Phone:'));
  var email = sanitize(prompt('Email:'));
  apiPost('/team', { name: name, role: role || '', phone: phone || '', email: email || '' }).then(function() {
    renderTeam(document.getElementById('contentArea'));
  }).catch(function(err) { alert(err.message); });
}

function editMember(id) {
  apiGet('/team').then(function(team) {
    var t = team.find(function(x) { return x.id === id; });
    if (!t) return;
    var name = sanitize(prompt('Name:', t.name));
    if (!name) return;
    var role = sanitize(prompt('Role:', t.role));
    var phone = sanitize(prompt('Phone:', t.phone));
    var email = sanitize(prompt('Email:', t.email));
    apiPut('/team/' + id, { name: name, role: role || '', phone: phone || '', email: email || '' }).then(function() {
      renderTeam(document.getElementById('contentArea'));
    }).catch(function(err) { alert(err.message); });
  });
}

function deleteMember(id) {
  if (!confirm('Delete this member?')) return;
  apiDelete('/team/' + id).then(function() {
    renderTeam(document.getElementById('contentArea'));
  }).catch(function(err) { alert(err.message); });
}

/* ============================
   PAGES
   ============================ */
var pageGroups = [
  {
    name: 'Home Page',
    key: 'home',
    fields: [
      { k: 'home_announcement', label: 'Announcement Bar', type: 'text' },
      { k: 'home_hero_badge', label: 'Hero Badge', type: 'text' },
      { k: 'home_hero_heading', label: 'Hero Heading (use <br> for line break)', type: 'textarea' },
      { k: 'home_hero_text', label: 'Hero Text', type: 'textarea' },
      { k: 'home_about_tag', label: 'About Section Tag', type: 'text' },
      { k: 'home_about_heading', label: 'About Heading (use <span> for accent)', type: 'text' },
      { k: 'home_about_p1', label: 'About Paragraph 1', type: 'textarea' },
      { k: 'home_about_p2', label: 'About Paragraph 2', type: 'textarea' },
      { k: 'home_vision', label: 'Vision Text', type: 'textarea' },
      { k: 'home_mission', label: 'Mission Text', type: 'textarea' },
      { k: 'home_cta_heading', label: 'CTA Heading', type: 'text' },
      { k: 'home_cta_text', label: 'CTA Text', type: 'text' }
    ]
  },
  {
    name: 'About Page',
    key: 'about',
    fields: [
      { k: 'about_heading', label: 'Page Heading', type: 'text' },
      { k: 'about_p1', label: 'Paragraph 1', type: 'textarea' },
      { k: 'about_p2', label: 'Paragraph 2', type: 'textarea' },
      { k: 'about_vision', label: 'Vision Text', type: 'textarea' },
      { k: 'about_mission', label: 'Mission Text', type: 'textarea' },
      { k: 'about_cta_heading', label: 'CTA Heading', type: 'text' },
      { k: 'about_cta_text', label: 'CTA Text', type: 'text' }
    ]
  },
  {
    name: 'Contact Page',
    key: 'contact',
    fields: [
      { k: 'contact_heading', label: 'Page Heading', type: 'text' },
      { k: 'contact_address', label: 'Address', type: 'textarea' },
      { k: 'contact_phone', label: 'Phone', type: 'text' },
      { k: 'contact_email', label: 'Email', type: 'text' },
      { k: 'contact_hours_weekdays', label: 'Weekday Hours', type: 'text' },
      { k: 'contact_hours_sat', label: 'Saturday Hours', type: 'text' },
      { k: 'contact_cta_heading', label: 'CTA Heading', type: 'text' },
      { k: 'contact_cta_text', label: 'CTA Text', type: 'text' }
    ]
  },
  {
    name: 'Blog Page',
    key: 'blog',
    fields: [
      { k: 'blog_heading', label: 'Page Heading', type: 'text' },
      { k: 'blog_tag', label: 'Section Tag', type: 'text' },
      { k: 'blog_section_heading', label: 'Section Heading (use <span> for accent)', type: 'text' },
      { k: 'blog_cta_heading', label: 'CTA Heading', type: 'text' },
      { k: 'blog_cta_text', label: 'CTA Text', type: 'text' }
    ]
  },
  {
    name: 'Gallery Page',
    key: 'gallery',
    fields: [
      { k: 'gallery_heading', label: 'Page Heading', type: 'text' },
      { k: 'gallery_tag', label: 'Section Tag', type: 'text' },
      { k: 'gallery_section_heading', label: 'Section Heading (use <span> for accent)', type: 'text' },
      { k: 'gallery_cta_heading', label: 'CTA Heading', type: 'text' },
      { k: 'gallery_cta_text', label: 'CTA Text', type: 'text' }
    ]
  }
];

var currentPageTab = 'home';

function renderPages(area) {
  apiGet('/page-content').then(function(content) {
    var tabsHtml = pageGroups.map(function(g) {
      return '<button class="tab-btn" data-tab="' + g.key + '" onclick="switchPageTab(\'' + g.key + '\')">' + g.name + '</button>';
    }).join('');

    var firstKey = pageGroups[0].key;
    var panelsHtml = pageGroups.map(function(g) {
      var fieldsHtml = g.fields.map(function(f) {
        var val = content[f.k] || '';
        if (f.type === 'textarea') {
          return '<div class="page-field"><label>' + f.label + '</label><textarea id="pf-' + f.k + '" rows="3">' + val.replace(/</g, '&lt;') + '</textarea></div>';
        }
        return '<div class="page-field"><label>' + f.label + '</label><input type="text" id="pf-' + f.k + '" value="' + val.replace(/"/g, '&quot;').replace(/</g, '&lt;') + '"></div>';
      }).join('');
      var active = g.key === firstKey ? ' active' : '';
      return '<div class="tab-panel' + active + '" id="tab-' + g.key + '">' + fieldsHtml + '</div>';
    }).join('');

    area.innerHTML = `
      <div class="page-editor">
        <div class="editor-notice">Changes save to SQLite database.</div>
        <div class="tab-bar">${tabsHtml}</div>
        <div class="tab-panels">${panelsHtml}</div>
        <div class="editor-actions">
          <button class="btn-admin" onclick="saveAllPages()">Save All Changes</button>
          <button class="btn-admin btn-outline-admin" onclick="resetPages()">Reset to Defaults</button>
        </div>
        <p id="pageSaveMsg" class="pwd-msg"></p>
      </div>
    `;
  }).catch(function(err) {
    area.innerHTML = '<p class="pwd-msg">Error loading page content: ' + err.message + '</p>';
  });
}

function switchPageTab(key) {
  currentPageTab = key;
  document.querySelectorAll('.tab-btn').forEach(function(b) {
    b.classList.toggle('active', b.dataset.tab === key);
  });
  document.querySelectorAll('.tab-panel').forEach(function(p) {
    p.classList.toggle('active', p.id === 'tab-' + key);
  });
}

function saveAllPages() {
  var content = {};
  pageGroups.forEach(function(g) {
    g.fields.forEach(function(f) {
      var el = document.getElementById('pf-' + f.k);
      if (el) content[f.k] = el.value;
    });
  });
  apiPut('/page-content', content).then(function() {
    var msg = document.getElementById('pageSaveMsg');
    msg.textContent = 'All page content saved successfully!';
    msg.style.color = '#52b788';
    setTimeout(function() { msg.textContent = ''; }, 3000);
  }).catch(function(err) { alert(err.message); });
}

function resetPages() {
  if (!confirm('Reset all page content to defaults?')) return;
  apiPut('/page-content/reset').then(function() {
    renderPages(document.getElementById('contentArea'));
  }).catch(function(err) { alert(err.message); });
}

/* ============================
   BLOG
   ============================ */
function renderBlog(area) {
  apiGet('/blog').then(function(blog) {
    area.innerHTML = `
      <div class="toolbar"><button class="btn-admin" onclick="addBlogPost()">+ Add Post</button></div>
      <div class="table-wrap"><table class="admin-table">
        <thead><tr><th>Title</th><th>Date</th><th>Excerpt</th><th>Image</th><th>Actions</th></tr></thead>
        <tbody id="blogBody">${blog.map(function(p, i) { return '<tr><td>' + p.title + '</td><td>' + p.date + '</td><td>' + (p.excerpt.length > 60 ? p.excerpt.substring(0, 60) + '...' : p.excerpt) + '</td><td>' + (p.image ? '<a href="' + p.image + '" target="_blank">View</a>' : '') + '</td><td><button class="btn-sm-admin" onclick="editBlogPost(' + p.id + ')">Edit</button> <button class="btn-sm-admin btn-danger" onclick="deleteBlogPost(' + p.id + ')">Del</button></td></tr>'; }).join('')}</tbody>
      </table></div>
    `;
  }).catch(function(err) {
    area.innerHTML = '<p class="pwd-msg">Error: ' + err.message + '</p>';
  });
}

function addBlogPost() {
  var title = sanitize(prompt('Post title:'));
  if (!title) return;
  var excerpt = sanitize(prompt('Excerpt:'));
  var date = sanitize(prompt('Date (e.g. Jan 15, 2025):'));
  var image = sanitize(prompt('Image URL:'));
  apiPost('/blog', { title: title, excerpt: excerpt || '', date: date || '', image: image || '' }).then(function() {
    renderBlog(document.getElementById('contentArea'));
  }).catch(function(err) { alert(err.message); });
}

function editBlogPost(id) {
  apiGet('/blog').then(function(blog) {
    var p = blog.find(function(x) { return x.id === id; });
    if (!p) return;
    var title = sanitize(prompt('Post title:', p.title));
    if (!title) return;
    var excerpt = sanitize(prompt('Excerpt:', p.excerpt));
    var date = sanitize(prompt('Date:', p.date));
    var image = sanitize(prompt('Image URL:', p.image));
    apiPut('/blog/' + id, { title: title, excerpt: excerpt || '', date: date || '', image: image || '' }).then(function() {
      renderBlog(document.getElementById('contentArea'));
    }).catch(function(err) { alert(err.message); });
  });
}

function deleteBlogPost(id) {
  if (!confirm('Delete this post?')) return;
  apiDelete('/blog/' + id).then(function() {
    renderBlog(document.getElementById('contentArea'));
  }).catch(function(err) { alert(err.message); });
}

/* ============================
   GALLERY
   ============================ */
function renderGallery(area) {
  apiGet('/gallery').then(function(gallery) {
    area.innerHTML = `
      <div class="toolbar"><button class="btn-admin" onclick="addGalleryItem()">+ Add Photo</button></div>
      <div class="table-wrap"><table class="admin-table">
        <thead><tr><th>Preview</th><th>Caption</th><th>Actions</th></tr></thead>
        <tbody id="galleryBody">${gallery.map(function(g, i) { return '<tr><td>' + (g.image ? '<img src="' + g.image + '" style="width:80px;height:50px;object-fit:cover;border-radius:4px;">' : '') + '</td><td>' + g.caption + '</td><td><button class="btn-sm-admin" onclick="editGalleryItem(' + g.id + ')">Edit</button> <button class="btn-sm-admin btn-danger" onclick="deleteGalleryItem(' + g.id + ')">Del</button></td></tr>'; }).join('')}</tbody>
      </table></div>
    `;
  }).catch(function(err) {
    area.innerHTML = '<p class="pwd-msg">Error: ' + err.message + '</p>';
  });
}

function addGalleryItem() {
  var image = sanitize(prompt('Image URL:'));
  if (!image) return;
  var caption = sanitize(prompt('Caption:'));
  apiPost('/gallery', { image: image, caption: caption || '' }).then(function() {
    renderGallery(document.getElementById('contentArea'));
  }).catch(function(err) { alert(err.message); });
}

function editGalleryItem(id) {
  apiGet('/gallery').then(function(gallery) {
    var g = gallery.find(function(x) { return x.id === id; });
    if (!g) return;
    var image = sanitize(prompt('Image URL:', g.image));
    if (!image) return;
    var caption = sanitize(prompt('Caption:', g.caption));
    apiPut('/gallery/' + id, { image: image, caption: caption || '' }).then(function() {
      renderGallery(document.getElementById('contentArea'));
    }).catch(function(err) { alert(err.message); });
  });
}

function deleteGalleryItem(id) {
  if (!confirm('Delete this photo?')) return;
  apiDelete('/gallery/' + id).then(function() {
    renderGallery(document.getElementById('contentArea'));
  }).catch(function(err) { alert(err.message); });
}

/* ============================
   SETTINGS
   ============================ */
function renderSettings(area) {
  apiGet('/users').then(function(users) {
    area.innerHTML = `
      <div class="settings-section">
        <h3>Admin Users</h3>
        <div class="toolbar"><button class="btn-admin" onclick="addUser()">+ Add User</button></div>
        <div class="table-wrap"><table class="admin-table">
          <thead><tr><th>Username</th><th>Role</th><th>Actions</th></tr></thead>
          <tbody>${users.map(function(u, i) { return '<tr><td>' + u.username + '</td><td>' + u.role + '</td><td>' + (u.username !== 'admin' ? '<button class="btn-sm-admin btn-danger" onclick="deleteUser(' + u.id + ')">Del</button>' : '<span class="tag">Protected</span>') + '</td></tr>'; }).join('')}</tbody>
        </table></div>
      </div>
      <div class="settings-section">
        <h3>Change Password</h3>
        <form onsubmit="changePassword(event)" class="pwd-form">
          <div class="form-group"><input type="password" id="curPwd" placeholder="Current password" required></div>
          <div class="form-group"><input type="password" id="newPwd" placeholder="New password" required></div>
          <button type="submit" class="btn-admin">Update Password</button>
          <p id="pwdMsg" class="pwd-msg"></p>
        </form>
      </div>
      <div class="settings-section">
        <h3>Reset All Data</h3>
        <button class="btn-admin btn-danger" onclick="resetAll()">Reset to Defaults</button>
      </div>
    `;
  }).catch(function(err) {
    area.innerHTML = '<p class="pwd-msg">Error: ' + err.message + '</p>';
  });
}

function addUser() {
  var username = sanitize(prompt('New username:'));
  if (!username) return;
  var password = prompt('Password (min 8 chars, upper+lower+digit):');
  if (!password || password.length < 8 || !/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password)) {
    alert('Password must be at least 8 characters with uppercase, lowercase, and a digit.');
    return;
  }
  apiPost('/users', { username: username, password: password }).then(function() {
    renderSettings(document.getElementById('contentArea'));
  }).catch(function(err) { alert(err.message); });
}

function deleteUser(id) {
  apiDelete('/users/' + id).then(function() {
    renderSettings(document.getElementById('contentArea'));
  }).catch(function(err) { alert(err.message); });
}

function changePassword(e) {
  e.preventDefault();
  var cur = document.getElementById('curPwd').value;
  var newPwd = document.getElementById('newPwd').value;
  var msg = document.getElementById('pwdMsg');
  if (newPwd.length < 8 || !/[A-Z]/.test(newPwd) || !/[a-z]/.test(newPwd) || !/[0-9]/.test(newPwd)) {
    msg.textContent = 'Password must be 8+ chars with upper, lower, and a digit.';
    msg.style.color = '#ef4444';
    return;
  }
  apiPut('/users/password', { currentPassword: cur, newPassword: newPwd }).then(function() {
    msg.textContent = 'Password updated successfully.';
    msg.style.color = '#52b788';
    document.getElementById('curPwd').value = '';
    document.getElementById('newPwd').value = '';
  }).catch(function(err) {
    msg.textContent = err.message;
    msg.style.color = '#ef4444';
  });
}

function resetAll() {
  if (!confirm('Reset all data to defaults? This cannot be undone.')) return;
  if (!confirm('Are you sure?')) return;
  apiPut('/page-content/reset').then(function() {
    renderPage(currentPage);
  }).catch(function(err) { alert(err.message); });
}

/* ============================
   NAVIGATION
   ============================ */
document.querySelectorAll('.nav-item').forEach(function(el) {
  el.addEventListener('click', function(e) {
    e.preventDefault();
    navigateTo(this.dataset.page);
    document.getElementById('sidebar').classList.remove('open');
  });
});

document.getElementById('menuBtn').addEventListener('click', function() {
  document.getElementById('sidebar').classList.toggle('open');
});

document.getElementById('sidebarClose').addEventListener('click', function() {
  document.getElementById('sidebar').classList.remove('open');
});

navigateTo('dashboard');
