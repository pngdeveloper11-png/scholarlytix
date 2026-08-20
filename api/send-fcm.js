import admin from 'firebase-admin';

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT))
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });
  
  const { targetToken, targetTopic, title, message, channelId } = req.body;

  const payload = {
    data: {
      title: title || 'New Alert',
      message: message || '',
      channelId: channelId || 'security_alerts'
    },
    android: {
      priority: 'high', // Wakes Android device instantly
      ttl: 60 * 60 * 24 // 24 hours
    }
  };

  if (targetToken) {
    payload.token = targetToken;
  } else if (targetTopic) {
    payload.topic = targetTopic;
  } else {
    return res.status(400).json({ error: 'targetToken or targetTopic is required' });
  }

  try {
    const response = await admin.messaging().send(payload);
    return res.status(200).json({ success: true, messageId: response });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
