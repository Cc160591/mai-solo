import { Resend } from 'resend';
import type { Booking } from '@shared/schema';

const FROM_ADDRESS = 'Centro Cinofilo Mai Solo <onboarding@resend.dev>';

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
    // For production, configure a verified domain in Resend dashboard and update FROM_ADDRESS
    // Example: 'Centro Cinofilo Mai Solo <notifiche@tuodominio.it>'
    await resend.emails.send({
      from: FROM_ADDRESS,
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

export async function sendBookingConfirmation(booking: BookingEmailData & { customerEmail: string }): Promise<void> {
  if (!resend || !process.env.RESEND_API_KEY || process.env.RESEND_API_KEY.trim() === '') {
    console.warn('Customer confirmation email skipped: RESEND_API_KEY not configured');
    return;
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(booking.customerEmail)) {
    console.warn('Customer confirmation email skipped: invalid customer email');
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
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: hsl(270, 60%, 50%); color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background-color: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
          .detail-row { margin: 12px 0; padding: 8px 0; border-bottom: 1px solid #e0e0e0; }
          .label { font-weight: bold; color: hsl(270, 60%, 40%); }
          .time-details { background-color: #fff; padding: 15px; margin: 15px 0; border-left: 4px solid hsl(270, 60%, 50%); border-radius: 4px; }
          .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #888; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🐕 Prenotazione Confermata!</h1>
            <p>Centro Cinofilo Mai Solo</p>
          </div>
          <div class="content">
            <p>Ciao <strong>${booking.ownerName}</strong>,</p>
            <p>La tua prenotazione per <strong>${booking.dogName}</strong> è stata confermata con successo.</p>
            <div class="detail-row">
              <span class="label">Servizio:</span> ${serviceTypeLabel}
            </div>
            <div class="detail-row">
              <span class="label">Cane:</span> ${booking.dogName}
            </div>
            <div class="detail-row">
              <span class="label">${isSingleDay ? 'Data:' : 'Periodo:'}</span> ${dateRange}
            </div>
            <div class="time-details">
              <h3 style="margin-top:0;color:hsl(270,60%,40%);">⏰ Orari</h3>
              <div class="detail-row" style="border:none;">
                <span class="label">Fascia Entrata:</span> ${booking.entryTime}
                &nbsp;—&nbsp;<span class="label">Arrivo previsto:</span> ${booking.exactEntryTime}
              </div>
              <div class="detail-row" style="border:none;margin-bottom:0;">
                <span class="label">Fascia Uscita:</span> ${booking.exitTime}
                &nbsp;—&nbsp;<span class="label">Ritiro previsto:</span> ${booking.exactExitTime}
              </div>
            </div>
            <p style="margin-top:20px;">Puoi visualizzare e modificare le tue prenotazioni visitando il sito e cercando le tue prenotazioni con questa email.</p>
            <p>A presto! 🐾</p>
          </div>
          <div class="footer">
            <p>Via Alessandro Volta 51, Casnate 22070 — Lun-Dom 8:00-18:00</p>
          </div>
        </div>
      </body>
    </html>
  `;

  try {
    await resend.emails.send({
      from: FROM_ADDRESS,
      to: booking.customerEmail,
      subject: `🐾 Prenotazione confermata — ${booking.dogName} (${serviceTypeLabel})`,
      html: emailHtml,
    });
    console.log('Customer confirmation email sent successfully');
  } catch (error) {
    console.error('Failed to send customer confirmation email:', error);
  }
}

export async function sendBatchBookingConfirmation(createdBookings: Booking[], customerEmail: string): Promise<void> {
  if (!resend || !process.env.RESEND_API_KEY || process.env.RESEND_API_KEY.trim() === '') {
    console.warn('Batch confirmation email skipped: RESEND_API_KEY not configured');
    return;
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(customerEmail) || createdBookings.length === 0) return;

  const first = createdBookings[0];
  const serviceTypeLabel = first.serviceType === 'asilo' ? 'Asilo' : 'Pensione';

  const datesHtml = createdBookings.map(b => `
    <li style="margin: 6px 0; padding: 6px 0; border-bottom: 1px solid #eee;">
      <strong>${formatDate(b.startDate)}</strong> — ${b.entryTime} → ${b.exitTime}
      (arrivo: ${b.exactEntryTime}, ritiro: ${b.exactExitTime})
    </li>
  `).join('');

  const emailHtml = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: hsl(270, 60%, 50%); color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background-color: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
          .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #888; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🐕 ${createdBookings.length} Prenotazioni Confermate!</h1>
            <p>Centro Cinofilo Mai Solo</p>
          </div>
          <div class="content">
            <p>Ciao <strong>${first.ownerName}</strong>,</p>
            <p>Le tue <strong>${createdBookings.length} prenotazioni</strong> per <strong>${first.dogName}</strong> (${serviceTypeLabel}) sono state confermate.</p>
            <ul style="list-style:none;padding:0;margin:16px 0;">
              ${datesHtml}
            </ul>
            <p>Puoi visualizzare e modificare le tue prenotazioni visitando il sito e cercando le tue prenotazioni con questa email.</p>
            <p>A presto! 🐾</p>
          </div>
          <div class="footer">
            <p>Via Alessandro Volta 51, Casnate 22070 — Lun-Dom 8:00-18:00</p>
          </div>
        </div>
      </body>
    </html>
  `;

  try {
    await resend.emails.send({
      from: FROM_ADDRESS,
      to: customerEmail,
      subject: `🐾 ${createdBookings.length} prenotazioni confermate — ${first.dogName} (${serviceTypeLabel})`,
      html: emailHtml,
    });
    console.log('Batch confirmation email sent successfully');
  } catch (error) {
    console.error('Failed to send batch confirmation email:', error);
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
