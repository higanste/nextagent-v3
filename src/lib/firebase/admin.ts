import { initializeApp, getApps, cert, App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

let adminAppInstance: App | null = null;

function getServiceAccount() {
  const projectId = process.env.FIREBASE_PROJECT_ID || "nexta-ae2d5";
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL || "firebase-adminsdk-fbsvc@nexta-ae2d5.iam.gserviceaccount.com";
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!privateKey) {
    return null;
  }

  return {
    projectId,
    clientEmail,
    privateKey,
  };
}

function getAdminApp(): App | null {
  if (adminAppInstance) return adminAppInstance;
  
  const serviceAccount = getServiceAccount();
  if (!serviceAccount) {
    return null;
  }
  
  try {
    adminAppInstance = initializeApp({
      credential: cert(serviceAccount),
    });
    return adminAppInstance;
  } catch (error) {
    console.warn("Firebase Admin initialization failed:", error);
    return null;
  }
}

function getAdminAppSafe(): App {
  const app = getAdminApp();
  if (app) return app;
  // Return a mock app for build time
  const apps = getApps();
  if (apps.length) return apps[0];
  return initializeApp({ projectId: "nexta-ae2d5" });
}

const adminApp = getAdminAppSafe();

export const adminAuth = getAuth(adminApp);
export const adminDb = getFirestore(adminApp);
export default adminApp;