import admin from 'firebase-admin';

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT))
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');
  
  const { fcmToken, parentEmail, deviceModel } = req.body;

  const payload = {
    token: fcmToken,
    data: {
      title: 'Parent Link Request ⚠️',
      message: `${parentEmail} is requesting to link from ${deviceModel}.`
    },
    android: { priority: 'high' } // CRITICAL: 'high' wakes up sleeping Android devices
  };

  try {
    await admin.messaging().send(payload);
    return res.status(200).json({ success: true });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
