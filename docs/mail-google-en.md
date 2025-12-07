Enable an App Password in Gmail
===============================

* Before you can generate an App Password, you need to have 2FA enabled on your Google account. If you haven’t done this already, follow these steps:
* Go to Google Account Settings and enable 2-Step Verification
* Generate the App Password after enabling 2FA, you can now generate an App Password.
* In the Security section of your Google Account, find App Passwords (under "Signing in to Google").
* You might be asked to log in again to verify your identity.
* Create a New App Password
* Once logged in, select Other (Custom name) from the "Select app" dropdown.
* Type a name (e.g., NodeMailer App) to identify this password later.
* Google will generate a 16-character App Password (e.g., abcd efgh ijkl mnop).
* Copy this password and keep it safe. You will use this password in your Nodemailer configuration.

```
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'your-email@gmail.com', // Your Gmail address
        pass: 'your-app-password'     // The App Password generated above
    }
});
```