import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import * as fs from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import * as au from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { firebaseConfig } from "./config.js";

const app = initializeApp(firebaseConfig);
export const db = fs.getFirestore(app);
export const auth = au.getAuth(app);
export { fs, au };
export const login = () => au.signInWithPopup(auth, new au.GoogleAuthProvider());
export const logout = () => au.signOut(auth);
export const $ = s => document.querySelector(s);
export const esc = (s = "") => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// Reduz a imagem no navegador e devolve texto (guardado direto no Firestore, sem Storage pago)
export const resize = (file, max = 500, q = 0.8) => new Promise(res => {
  const img = new Image();
  img.onload = () => {
    const r = Math.min(1, max / Math.max(img.width, img.height));
    const cv = document.createElement("canvas");
    cv.width = img.width * r; cv.height = img.height * r;
    cv.getContext("2d").drawImage(img, 0, 0, cv.width, cv.height);
    res(cv.toDataURL("image/jpeg", q));
  };
  img.src = URL.createObjectURL(file);
});
