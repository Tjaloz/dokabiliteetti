// Korvaa alla olevat arvot omalla Firebase-projektisi asetuksilla.
// Löydät nämä: Firebase Console -> Project settings -> Your apps -> SDK setup and configuration
export const firebaseConfig = {
  apiKey: "AIzaSyA7YOCVZ4bryHd2U4CN2iN-YEpKS0OZj_k",
  authDomain: "dokabiliteetti-d8a10.firebaseapp.com",
  projectId: "dokabiliteetti-d8a10",
  storageBucket: "dokabiliteetti-d8a10.firebasestorage.app",
  messagingSenderId: "849464191592",
  appId: "1:849464191592:web:92334a56ca99760b3be9dd",
  measurementId: "G-GZHN2QSNYB" 
};

// UID-tunnuksesi Firebase Authenticationista (Authentication -> Users -> User UID).
// Vain tällä UID:lla kirjautunut näkee poistonapit ja saa poistaa rivejä
// (Firestore-säännöt vaativat saman UID:n palvelinpuolella).
export const adminUid = "9GRNVtU9PWfOY656DMYuvJ6BIcs1";

// Huom: nämä avaimet EIVÄT ole salaisia - Firebase-web-config on tarkoitettu
// näkymään julkisesti selaimen puolella. Todellinen suojaus tulee Firestoren
// Rules-säännöistä (Firebase Console -> Firestore Database -> Rules).
