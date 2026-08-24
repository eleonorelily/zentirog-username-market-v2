# Zentirog Username Market Admin

Private admin route:

```text
/vault-nddx1x2m1dTp9ZgfBJkvzcVy1SE3
```

Firebase project:

```text
zentirog-market-2026
```

Admin account:

```text
UID: nddx1x2m1dTp9ZgfBJkvzcVy1SE3
Email: zormogo@gmail.com
```

## One-Time Firebase Setup

1. Enable Firebase Authentication with Email/Password.
2. Make sure `zormogo@gmail.com` exists as a Firebase Auth user with UID `nddx1x2m1dTp9ZgfBJkvzcVy1SE3`.
3. Deploy Firestore rules:

```bash
firebase deploy --only firestore:rules
```

If Firebase CLI is not already logged in, run:

```bash
npx firebase-tools login
npx firebase-tools deploy --only firestore:rules --project zentirog-market-2026
```

You can also open Firebase Console, go to Firestore Database > Rules, paste the contents of `firestore.rules`, and publish it. Until these rules are published, the admin panel can sign in but Firestore imports/saves will show a permissions error.

## Seed GitHub Usernames Into Firebase

Run this locally with the Firebase account password:

```bash
$env:FIREBASE_ADMIN_EMAIL="zormogo@gmail.com"
$env:FIREBASE_ADMIN_PASSWORD="YOUR_FIREBASE_PASSWORD"
npm run seed:firebase
```

After seeding, the public website reads from Firestore only.

## Admin Panel Usage

1. Open `/vault-nddx1x2m1dTp9ZgfBJkvzcVy1SE3`.
2. Sign in with the Firebase Auth email/password.
3. Type usernames and prices without symbols, for example `antispam` and `10000`. The app formats them for the storefront automatically.
4. Use `Edit` to update a listing.
5. Use the trash button to delete a listing.
6. Use `Show publicly` to control whether a username appears on the storefront.
7. Use `Import Legacy List` only when you want to copy new names from the old GitHub source into Firestore.
