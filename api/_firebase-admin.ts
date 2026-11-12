import * as admin from 'firebase-admin';

const FIREBASE_PROJECT_ID = 'zentirog-market-2026';

let app: admin.app.App;

export function getFirebaseAdmin(): admin.firestore.Firestore {
  if (!admin.apps.length) {
    const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT;

    if (serviceAccountKey) {
      try {
        const parsedKey = typeof serviceAccountKey === 'string' && serviceAccountKey.startsWith('{')
          ? JSON.parse(serviceAccountKey)
          : JSON.parse(Buffer.from(serviceAccountKey, 'base64').toString('utf8'));

        app = admin.initializeApp({
          credential: admin.credential.cert(parsedKey),
          projectId: FIREBASE_PROJECT_ID,
        });
      } catch (err) {
        console.warn('Failed to parse FIREBASE_SERVICE_ACCOUNT, falling back to default:', err);
        app = admin.initializeApp({ projectId: FIREBASE_PROJECT_ID });
      }
    } else {
      app = admin.initializeApp({ projectId: FIREBASE_PROJECT_ID });
    }
  } else {
    app = admin.apps[0]!;
  }

  return admin.firestore(app);
}
