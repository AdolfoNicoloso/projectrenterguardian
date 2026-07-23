/**
 * One-shot: purge Firestore data for app_profiles whose Firebase Auth
 * user no longer exists (orphans from incomplete account deletion).
 *
 * From functions/: npx tsx scripts/purgeOrphanAccounts.ts
 */

import * as admin from "firebase-admin";
import {deleteAccountCompletely} from "../src/firestore/accountDeletion";

if (admin.apps.length === 0) {
  admin.initializeApp({
    storageBucket: "project-renter-guardian-media",
  });
}

async function main() {
  const db = admin.firestore();
  const profiles = await db.collection("app_profiles").limit(200).get();
  console.log(`Found ${profiles.size} app_profiles`);

  let purged = 0;
  for (const doc of profiles.docs) {
    const data = doc.data() || {};
    const uid = String(data.firebase_uid || "");
    if (!uid) {
      console.log(`- ${doc.id}: no firebase_uid — skipping`);
      continue;
    }
    try {
      await admin.auth().getUser(uid);
      console.log(`- ${doc.id}: Auth user ${uid} still exists — keep`);
    } catch (err: unknown) {
      const code =
        err && typeof err === "object" && "code" in err ?
          String((err as {code: string}).code) :
          "";
      if (code !== "auth/user-not-found") {
        console.error(`- ${doc.id}: Auth lookup failed`, err);
        continue;
      }
      console.log(`- ${doc.id}: orphan (Auth gone) — purging…`);
      const result = await deleteAccountCompletely(uid, doc.id);
      console.log("  purged", result);
      purged += 1;
    }
  }
  console.log(`Done. Purged ${purged} orphan account(s).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
