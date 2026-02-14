import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Resend } from 'resend';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // 1. Validate Method
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // 2. Validate Secret Header (Security)
  // Ensure you set WEBHOOK_SECRET in Vercel Environment Variables
  const secret = req.headers['x-webhook-secret'];
  if (secret !== process.env.WEBHOOK_SECRET) {
    return res.status(401).json({ error: 'Unauthorized: Invalid Secret' });
  }

  // 3. Parse Body (Supabase Webhook Payload)
  const payload = req.body;
  
  // Supabase sends the new record in 'record' field for INSERT events
  const record = payload?.record;

  if (!record) {
    return res.status(400).json({ error: 'Bad Request: Missing record data' });
  }

  // 4. Send Email via Resend
  const resend = new Resend(process.env.RESEND_API_KEY);

  try {
    const { data, error } = await resend.emails.send({
      from: 'Miuim App <onboarding@resend.dev>',
      to: 'idanzeman@gmail.com',
      subject: `הודעה חדשה מאת: ${record.name}`,
      html: `
        <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eaeaea; border-radius: 8px; background-color: #f9fafb;">
          <h2 style="color: #1a1a1a; text-align: center; border-bottom: 2px solid #3b82f6; padding-bottom: 10px;">הודעה חדשה בטופס צור קשר</h2>
          
          <div style="background-color: white; padding: 15px; border-radius: 6px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
            <p style="margin: 8px 0;"><strong>שם מלא:</strong> ${record.name}</p>
            <p style="margin: 8px 0;"><strong>אימייל:</strong> <a href="mailto:${record.email}">${record.email || 'לא צוין'}</a></p>
            <p style="margin: 8px 0;"><strong>טלפון:</strong> <a href="tel:${record.phone}">${record.phone || 'לא צוין'}</a></p>
            ${record.user_id ? `<p style="margin: 8px 0;"><strong>מזהה משתמש (User ID):</strong> <code style="background: #eee; padding: 2px 4px; border-radius: 4px;">${record.user_id}</code></p>` : ''}
          </div>

          <h3 style="color: #4b5563; margin-top: 20px; border-bottom: 1px solid #e5e7eb; padding-bottom: 5px;">תוכן ההודעה:</h3>
          <div style="background-color: white; padding: 15px; border-radius: 6px; border-right: 4px solid #3b82f6; margin-top: 10px;">
            <p style="white-space: pre-wrap; margin: 0; line-height: 1.6; color: #374151;">${record.message}</p>
          </div>

          ${record.image_url ? `
            <div style="margin-top: 20px;">
              <strong>תמונה מצורפת:</strong><br/>
              <img src="${record.image_url}" alt="User uploaded" style="max-width: 100%; border-radius: 6px; margin-top: 5px; border: 1px solid #e5e7eb;" />
              <br/>
              <a href="${record.image_url}" target="_blank" style="font-size: 12px; color: #3b82f6;">(פתח תמונה מקורית)</a>
            </div>
          ` : ''}

          <div style="margin-top: 30px; font-size: 12px; color: #9ca3af; text-align: center; border-top: 1px solid #e5e7eb; padding-top: 10px;">
            <p>הודעה זו נשלחה אוטומטית ממערכת Miuim.</p>
            <p><strong>מזהה רשומה:</strong> ${record.id} | <strong>זמן יצירה:</strong> ${new Date(record.created_at || new Date()).toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem' })}</p>
          </div>
        </div>
      `,
    });

    if (error) {
      console.error('Resend API Error:', error);
      return res.status(500).json({ error: 'Failed to send email via Resend', details: error });
    }

    return res.status(200).json({ message: 'Email sent successfully', id: data?.id });

  } catch (err: any) {
    console.error('Webhook Handler Error:', err);
    return res.status(500).json({ error: 'Internal Server Error', details: err.message });
  }
}
