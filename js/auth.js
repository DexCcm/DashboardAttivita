/* ============================================================
   AUTH MODULE — Firebase Anonymous Auth
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

  if (!firebase.apps.length) firebase.initializeApp(FB_CONFIG);

  firebase.auth().signInAnonymously().catch(e => {
    console.error("Auth anonima:", e.message);
  });

})();
