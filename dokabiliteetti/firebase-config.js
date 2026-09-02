// Korvaa alla olevat arvot omalla Firebase-projektisi asetuksilla.
// Löydät nämä: Firebase Console -> Project settings -> Your apps -> SDK setup and configuration
export const firebaseConfig = {
  apiKey: "TÄYTÄ_TÄHÄN",
  authDomain: "TÄYTÄ_TÄHÄN.firebaseapp.com",
  projectId: "TÄYTÄ_TÄHÄN",
  storageBucket: "TÄYTÄ_TÄHÄN.appspot.com",
  messagingSenderId: "TÄYTÄ_TÄHÄN",
  appId: "TÄYTÄ_TÄHÄN"
};

// Huom: nämä avaimet EIVÄT ole salaisia - Firebase-web-config on tarkoitettu
// näkymään julkisesti selaimen puolella. Todellinen suojaus tulee Firestoren
// Rules-säännöistä (Firebase Console -> Firestore Database -> Rules).
