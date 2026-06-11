(function() {
  var API_BASE = '';

  function sanitizeHtml(str) {
    if (!str) return '';
    return str
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<[\/]*script[^>]*>/gi, '')
      .replace(/\bon\w+\s*=\s*["'][^"']*["']/gi, '')
      .replace(/\bon\w+\s*=\s*[^\s>]+/gi, '')
      .replace(/javascript\s*:/gi, 'blocked:')
      .replace(/<iframe[\s\S]*?<\/iframe>/gi, '')
      .replace(/<embed[\s\S]*?<\/embed>/gi, '')
      .replace(/<object[\s\S]*?<\/object>/gi, '');
  }

  function getProgramIcon(i) {
    var icons = ['&#127858;', '&#127891;', '&#127973;', '&#128105;', '&#127795;', '&#127963;', '&#127942;', '&#128218;', '&#129309;', '&#127757;'];
    return icons[i % icons.length];
  }

  function loadContent() {
    fetch(API_BASE + '/api/page-content').then(function(r) { return r.json(); }).then(function(content) {
      var els = document.querySelectorAll('[data-editable]');
      els.forEach(function(el) {
        var key = el.getAttribute('data-editable');
        if (content[key] !== undefined) {
          el.innerHTML = sanitizeHtml(content[key]);
        }
      });
    }).catch(function() {});

    fetch(API_BASE + '/api/programs').then(function(r) { return r.json(); }).then(function(programData) {
      var container = document.querySelector('[data-editable-programs]');
      if (container && programData.length) {
        container.innerHTML = programData.map(function(p, i) {
          var tags = (p.tags || []).map(function(t) { return '<span>' + sanitizeHtml(t) + '</span>'; }).join('');
          return '<div class="program-card reveal" style="--i:' + i + '"><div class="program-icon">' + getProgramIcon(i) + '</div><h3>' + sanitizeHtml(p.title) + '</h3><p>' + sanitizeHtml(p.description) + '</p><div class="program-tags">' + tags + '</div></div>';
        }).join('');
      }
    }).catch(function() {});

    fetch(API_BASE + '/api/team').then(function(r) { return r.json(); }).then(function(teamData) {
      var teamContainer = document.querySelector('[data-editable-team]');
      if (teamContainer && teamData.length) {
        teamContainer.innerHTML = teamData.map(function(t, i) {
          var initial = (t.name || '?').charAt(0).toUpperCase();
          var fallback = "this.style.display='none';this.nextElementSibling.style.display='flex'";
          var imgSrc = '';
          if (i === 0) imgSrc = 'https://gmif.in/wp-content/uploads/2024/06/Ganesh-Ramlingam-540x620.jpg';
          else if (i === 1) imgSrc = 'https://gmif.in/wp-content/uploads/2024/06/Vijay-Kumar-540x620.jpg';
          else if (i === 2) imgSrc = 'https://gmif.in/wp-content/uploads/2024/06/New-Project-540x620.jpg';
          return '<div class="team-card reveal" style="--i:' + i + '"><div class="team-img"><img src="' + imgSrc + '" alt="' + sanitizeHtml(t.name) + '" onerror="' + fallback + '" loading="lazy"><div class="team-avatar-fallback" style="display:none;width:100%;height:100%;background:var(--green-100);border-radius:8px;align-items:center;justify-content:center;font-size:3rem;font-weight:700;color:var(--green-700)">' + initial + '</div></div><div class="team-info"><h3>' + sanitizeHtml(t.name) + '</h3><span class="team-role">' + sanitizeHtml(t.role) + '</span><p>' + (t.phone ? 'Phone: ' + sanitizeHtml(t.phone) + '<br>' : '') + (t.email ? 'Email: ' + sanitizeHtml(t.email) : '') + '</p></div></div>';
        }).join('');
      }
    }).catch(function() {});

    fetch(API_BASE + '/api/blog').then(function(r) { return r.json(); }).then(function(blogData) {
      var blogContainer = document.querySelector('[data-editable-blog]');
      if (blogContainer && blogData.length) {
        blogContainer.innerHTML = blogData.map(function(p, i) {
          var img = p.image || '';
          var imgHtml = img ? '<div class="blog-img"><img src="' + sanitizeHtml(img) + '" alt="' + sanitizeHtml(p.title) + '"></div>' : '';
          return '<div class="blog-card reveal" style="--i:' + i + '">' + imgHtml + '<div class="blog-info">' + (p.date ? '<span class="blog-date">' + sanitizeHtml(p.date) + '</span>' : '') + '<h3>' + sanitizeHtml(p.title) + '</h3><p>' + sanitizeHtml(p.excerpt) + '</p></div></div>';
        }).join('');
      }
    }).catch(function() {});

    fetch(API_BASE + '/api/gallery').then(function(r) { return r.json(); }).then(function(galleryData) {
      var galleryContainer = document.querySelector('[data-editable-gallery]');
      if (galleryContainer && galleryData.length) {
        galleryContainer.innerHTML = galleryData.map(function(g, i) {
          return '<div class="gallery-item reveal" style="--i:' + i + '"><img src="' + sanitizeHtml(g.image) + '" alt="' + sanitizeHtml(g.caption) + '"><div class="gallery-caption">' + sanitizeHtml(g.caption) + '</div></div>';
        }).join('');
      }
    }).catch(function() {});
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadContent);
  } else {
    loadContent();
  }
})();
