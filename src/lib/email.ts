import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendVerificationEmail(email: string, token: string) {
  const verificationUrl = `${process.env.NEXTAUTH_URL}/api/auth/verify?token=${token}`;

  try {
    await resend.emails.send({
      from: process.env.EMAIL_FROM || 'Sonar <onboarding@resend.dev>',
      to: email,
      subject: 'Verify your email for Sonar',
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <style>
              body {
                font-family: Arial, sans-serif;
                line-height: 1.6;
                color: #333;
                max-width: 600px;
                margin: 0 auto;
                padding: 20px;
              }
              .container {
                background-color: #000000;
                border-radius: 10px;
                padding: 30px;
                text-align: center;
              }
              .logo {
                color: #D1F577;
                font-size: 32px;
                font-weight: bold;
                margin-bottom: 20px;
              }
              .content {
                color: #EEECFF;
                margin-bottom: 30px;
              }
              .button {
                display: inline-block;
                background-color: #4A52EB;
                color: white;
                padding: 15px 30px;
                text-decoration: none;
                border-radius: 5px;
                font-weight: bold;
              }
              .footer {
                color: #999;
                font-size: 12px;
                margin-top: 30px;
              }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="logo">🎵 Sonar</div>
              <div class="content">
                <h2 style="color: #EEECFF;">Welcome to Sonar!</h2>
                <p>Thanks for signing up. Please verify your email address to get started.</p>
              </div>
              <a href="${verificationUrl}" class="button">Verify Email</a>
              <div class="footer">
                <p>If you didn't create an account, you can safely ignore this email.</p>
                <p>This link will expire in 24 hours.</p>
              </div>
            </div>
          </body>
        </html>
      `,
    });
    return { success: true };
  } catch (error) {
    console.error('Error sending verification email:', error);
    return { success: false, error };
  }
}