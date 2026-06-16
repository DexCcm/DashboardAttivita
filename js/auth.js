/* ============================================================
   AUTH MODULE — Firebase Auth + Microsoft provider
   ============================================================ */
(function initAuth() {
  const FB_CONFIG = {
    apiKey: "AIzaSyAfFN7HTUWjcvaRjCLYFT5Rwq_NOIPP2qU",
    authDomain: "dashboard-analisi-tasks.firebaseapp.com",
    databaseURL: "https://dashboard-analisi-tasks-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "dashboard-analisi-tasks",
    storageBucket: "dashboard-analisi-tasks.firebasestorage.app",
    messagingSenderId: "165182734148",
    appId: "1:165182734148:web:2b3b61c830f915185e2111"
  };

  /* Inizializza Firebase App (condiviso con firebase.js) */
  if (!firebase.apps.length) firebase.initializeApp(FB_CONFIG);

  const auth = firebase.auth();

  /* Microsoft provider — solo account aziendali */
  const provider = new firebase.auth.OAuthProvider('microsoft.com');
  provider.setCustomParameters({ tenant: 'organizations' });

  const overlay    = document.getElementById('loginOverlay');
  const loginBtn   = document.getElementById('loginBtn');
  const loginError = document.getElementById('loginError');
  const userDisplay = document.getElementById('userDisplay');
  const userRow    = document.getElementById('userRow');
  const logoutBtn  = document.getElementById('logoutBtn');

  /* Login */
  loginBtn.addEventListener('click', async () => {
    loginBtn.disabled = true;
    loginBtn.textContent = 'Accesso in corso…';
    loginError.textContent = '';
    try {
      await auth.signInWithPopup(provider);
    } catch (e) {
      loginError.textContent = e.code === 'auth/popup-closed-by-user'
        ? 'Finestra chiusa. Riprova.'
        : e.message;
      loginBtn.disabled = false;
      loginBtn.innerHTML = `<svg width="18" height="18" viewBox="0 0 21 21" xmlns="http://www.w3.org/2000/svg"><rect x="1" y="1" width="9" height="9" fill="#f25022"/><rect x="11" y="1" width="9" height="9" fill="#7fba00"/><rect x="1" y="11" width="9" height="9" fill="#00a4ef"/><rect x="11" y="11" width="9" height="9" fill="#ffb900"/></svg> Accedi con Microsoft`;
    }
  });

  /* Logout */
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => auth.signOut());
  }

  /* Stato auth — nasconde/mostra overlay */
  auth.onAuthStateChanged(user => {
    if (user) {
      overlay.style.display = 'none';
      if (userDisplay) userDisplay.textContent = user.displayName || user.email;
      if (userRow) userRow.style.display = '';
    } else {
      overlay.style.display = 'flex';
      if (userRow) userRow.style.display = 'none';
    }
  });

})();
