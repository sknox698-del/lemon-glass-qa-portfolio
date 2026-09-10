const root = document.querySelector('#app');
const signedIn = () => sessionStorage.getItem('demo-user') === 'steven';
const requests = () => JSON.parse(sessionStorage.getItem('demo-requests') || '[]');
const nav = '<nav aria-label="Main"><a href="#dashboard">Dashboard</a><a href="#new">New request</a><button id="logout">Sign out</button></nav>';

function render() {
  if (!location.hash) { location.hash = signedIn() ? 'dashboard' : 'login'; return; }
  const route = location.hash || '#login';
  if (!signedIn()) {
    if (route !== '#login') { location.hash = 'login'; return; }
    root.innerHTML = `<div class="eyebrow">WORKFLOW LAB</div><h1>Quality starts with clarity.</h1>
      <p>A small engineering request workflow built for repeatable QA.</p>
      <section class="card login"><h2>Sign in</h2><form id="login" novalidate>
      <label for="email">Email</label><input id="email" type="email" autocomplete="username">
      <label for="password">Password</label><input id="password" type="password" autocomplete="current-password">
      <p role="alert" class="alert"></p><button>Sign in</button></form>
      <p class="hint">Demo: steven@example.test / DemoPass123!</p></section>`;
    document.querySelector('#login').onsubmit = e => {
      e.preventDefault();
      const email = document.querySelector('#email').value.trim();
      const password = document.querySelector('#password').value;
      const alert = document.querySelector('[role=alert]');
      if (!email || !password) { alert.textContent = 'Email and password are required.'; return; }
      if (email !== 'steven@example.test' || password !== 'DemoPass123!') {
        alert.textContent = 'Email or password is incorrect.'; return;
      }
      sessionStorage.setItem('demo-user', 'steven'); location.hash = 'dashboard';
    };
    return;
  }
  root.innerHTML = '<div class="eyebrow">WORKFLOW LAB / ENGINEERING REQUESTS</div>' + nav;
  document.querySelector('#logout').onclick = () => { sessionStorage.clear(); location.hash = 'login'; };
  if (route === '#new') {
    root.insertAdjacentHTML('beforeend', `<h1>New simulation request</h1><p>Define a valid request before adding it to the review queue.</p>
      <section class="card"><form id="request" novalidate>
      <label for="name">Project name</label><input id="name" aria-describedby="name-hint"><p id="name-hint" class="hint">3-60 characters after trimming spaces.</p>
      <label for="material">Material</label><select id="material"><option value="">Select material</option><option>Aluminum</option><option>Steel</option></select>
      <label for="load">Load (N)</label><input id="load" type="number" step="any" aria-describedby="load-hint"><p id="load-hint" class="hint">A whole number from 1 to 10000 N.</p>
      <p role="alert" class="alert"></p><button>Submit request</button></form></section>`);
    document.querySelector('#request').onsubmit = e => {
      e.preventDefault();
      const name = document.querySelector('#name').value.trim();
      const material = document.querySelector('#material').value;
      const rawLoad = document.querySelector('#load').value;
      const load = Number(rawLoad);
      const errors = [];
      if (name.length < 3 || name.length > 60) errors.push('Project name must be 3-60 characters.');
      if (!['Aluminum', 'Steel'].includes(material)) errors.push('Select a material.');
      // Controlled mutation for an honest defect-detection exercise; off by default.
      const minimum = window.demoMutation ? 0 : 1;
      if (rawLoad === '' || !Number.isInteger(load) || load < minimum || load > 10000) errors.push('Load must be a whole number from 1 to 10000 N.');
      if (errors.length) { document.querySelector('[role=alert]').textContent = errors.join(' '); return; }
      const all = requests();
      all.push({ name, material, load });
      sessionStorage.setItem('demo-requests', JSON.stringify(all));
      sessionStorage.setItem('demo-notice', 'Request submitted for review.');
      location.hash = 'dashboard';
    };
  } else {
    if (route !== '#dashboard') { location.hash = 'dashboard'; return; }
    root.insertAdjacentHTML('beforeend', `<h1>Request dashboard</h1><p>Welcome, Steven. Review your engineering request queue.</p><p role="status" class="success"></p>
      <section class="card"><h2>Submitted requests</h2><p id="empty">No requests yet.</p><table aria-label="Submitted requests" hidden><thead><tr><th>Project</th><th>Material</th><th>Load</th><th>Status</th></tr></thead><tbody></tbody></table></section>`);
    document.querySelector('[role=status]').textContent = sessionStorage.getItem('demo-notice') || '';
    sessionStorage.removeItem('demo-notice');
    for (const item of requests()) {
      document.querySelector('#empty').hidden = true;
      document.querySelector('table').hidden = false;
      const row = document.createElement('tr');
      for (const value of [item.name, item.material, `${item.load} N`, 'Queued']) {
        const cell = document.createElement('td'); cell.textContent = value; row.append(cell);
      }
      document.querySelector('tbody').append(row);
    }
  }
}
window.addEventListener('hashchange', render);
render();
