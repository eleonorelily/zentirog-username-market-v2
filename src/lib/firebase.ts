import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyAhd2t2lx8ooUYEdlll2V0YLSCq3QgOK2k',
  authDomain: 'zentirog-market-2026.firebaseapp.com',
  projectId: 'zentirog-market-2026',
  storageBucket: 'zentirog-market-2026.firebasestorage.app',
  messagingSenderId: '1043916852490',
  appId: '1:1043916852490:web:5ba556bc3cee3a28a73ef3',
};

export const firebaseApp = initializeApp(firebaseConfig);
export const auth = getAuth(firebaseApp);
export const db = getFirestore(firebaseApp);
