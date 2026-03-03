import { Resend } from 'resend';
import type { Booking } from '@shared/schema';

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

interface BookingEmailData {
  dogName: string;
  ownerName: string;
  serviceType: 'asilo' | 'pensione';
  startDate: string;
  endDate: string;
  entryTime: string;
  exitTime: string;
  exactEntryTime: string;
  exactExitTime: string;
}

export async function sendBookingNotification(booking: BookingEmailData): Promise<void> {
  const notificationEmail = process.env.NOTIFICATION_EMAIL;
  
  if (!notificationEmail || notificationEmail.trim() === '') {
    console.warn('Email notification skipped: NOTIFICATION_EMAIL not configured or empty');
    return;
  }

  if (!resend || !process.env.RESEND_API_KEY || process.env.RESEND_API_KEY.trim() === '') {
    console.warn('Email notification skipped: RESEND_API_KEY not configured or empty');
    return;
  }
  
  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(notificationEmail)) {
    console.warn('Email notification skipped: NOTIFICATION_EMAIL has invalid format:', notificationEmail);
    return;
  }

  const serviceTypeLabel = booking.serviceType === 'asilo' ? 'Asilo' : 'Pensione';
  const isSingleDay = booking.startDate === booking.endDate;
  const dateRange = isSingleDay 
    ? formatDate(booking.startDate)
    : `${formatDate(booking.startDate)} - ${formatDate(booking.endDate)}`;

  const emailHtml = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
          }
          .container {
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
          }
          .header {
            background-color: hsl(270, 60%, 50%);
            color: white;
            padding: 20px;
            text-align: center;
            border-radius: 8px 8px 0 0;
          }
          .content {
            background-color: #f9f9f9;
            padding: 30px;
            border-radius: 0 0 8px 8px;
          }
          .detail-row {
            margin: 12px 0;
            padding: 8px 0;
            border-bottom: 1px solid #e0e0e0;
          }
          .label {
            font-weight: bold;
            color: hsl(270, 60%, 40%);
          }
          .value {
            color: #333;
          }
          .time-details {
            background-color: #fff;
            padding: 15px;
            margin: 15px 0;
            border-left: 4px solid hsl(270, 60%, 50%);
            border-radius: 4px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🐕 Nuova Prenotazione</h1>
            <p>Centro Cinofilo Mai Solo</p>
          </div>
          <div class="content">
            <div class="detail-row">
              <span class="label">Servizio:</span>
              <span class="value">${serviceTypeLabel}</span>
            </div>
            <div class="detail-row">
              <span class="label">Cane:</span>
              <span class="value">${booking.dogName}</span>
            </div>
            <div class="detail-row">
              <span class="label">Proprietario:</span>
              <span class="value">${booking.ownerName}</span>
            </div>
            <div class="detail-row">
              <span class="label">${isSingleDay ? 'Data:' : 'Periodo:'}</span>
              <span class="value">${dateRange}</span>
            </div>
            
            <div class="time-details">
              <h3 style="margin-top: 0; color: hsl(270, 60%, 40%);">⏰ Orari</h3>
              <div class="detail-row" style="border: none;">
                <span class="label">Fascia Entrata:</span>
                <span class="value">${booking.entryTime}</span>
              </div>
              <div class="detail-row" style="border: none;">
                <span class="label">Orario Esatto Arrivo:</span>
                <span class="value">${booking.exactEntryTime}</span>
              </div>
              <div class="detail-row" style="border: none;">
                <span class="label">Fascia Uscita:</span>
                <span class="value">${booking.exitTime}</span>
              </div>
              <div class="detail-row" style="border: none; margin-bottom: 0;">
                <span class="label">Orario Esatto Ritiro:</span>
                <span class="value">${booking.exactExitTime}</span>
              </div>
            </div>
          </div>
        </div>
      </body>
    </html>
  `;

  try {
    // Note: Using Resend sandbox domain (onboarding@resend.dev) for testing.
    // For production, configure a verified domain in Resend dashboard and update the 'from' address
    // Example: 'Centro Cinofilo Mai Solo <notifiche@tuodominio.it>'
    await resend.emails.send({
      from: 'Centro Cinofilo Mai Solo <onboarding@resend.dev>',
      to: notificationEmail,
      subject: `🐕 Nuova Prenotazione - ${booking.dogName} (${serviceTypeLabel})`,
      html: emailHtml,
    });
    
    console.log('Email notification sent successfully');
  } catch (error) {
    console.error('Failed to send email notification:', error);
    // Non blocchiamo la prenotazione se l'email fallisce
  }
}

function formatDate(dateString: string): string {
  // Parse date string as YYYY-MM-DD in Europe/Rome timezone to avoid timezone drift
  const [year, month, day] = dateString.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  
  return new Intl.DateTimeFormat('it-IT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'Europe/Rome'
  }).format(date);
}
