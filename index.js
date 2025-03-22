require('dotenv').config();
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const qrcodeImage = require('qrcode');
const nodemailer = require('nodemailer');
const axios = require('axios');
const express = require('express');
const PORT = process.env.PORT || 3000;

const userState = {}; // Store user states

const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
        defaultViewport: null,
        headless: true,
        timeout: 60000,
    },
});

// Email Configuration
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'emmkash20@gmail.com', // Use environment variables ideally
        pass: 'mjwq oiug wfxv vexl',
    },
});

// QR Code Generation and Email Sending
client.on('qr', async (qr) => {
    qrcode.generate(qr, { small: true });
    console.log('QR Code received, scan with your WhatsApp!');
    await sendQRCodeViaEmail(qr);
});

// Send QR Code via Email (Improved)
async function sendQRCodeViaEmail(qrCode) {
    try {
        // Adjust the QR image size by setting the width (e.g., 300 pixels)
        const qrImage = await qrcodeImage.toDataURL(qrCode, { width: 300 });

        const mailOptions = {
            from: 'emmkash20@gmail.com',
            to: 'brashokish499@gmail.com',
            subject: 'WhatsApp Web QR Code for Authentication',
            text: 'Scan the QR code below to authenticate the bot.',
            html: `<p>Please scan the QR code below to authenticate the bot:</p>
                   <img src="${qrImage}" alt="QR Code"/>`,
        };

        await transporter.sendMail(mailOptions);
        console.log('QR Code sent to email successfully.');
    } catch (error) {
        console.error('Error sending QR Code via email:', error);
    }
}

// Client Ready
client.on('ready', () => console.log('WhatsApp client is ready!'));

// Handle Disconnection and Reconnection
client.on('disconnected', async (reason) => {
    console.log('Disconnected from WhatsApp:', reason);
    setTimeout(initializeClient, 5000); // Retry after 5 seconds
});

// Initialize the Client
async function initializeClient() {
    try {
        await client.initialize();
    } catch (error) {
        console.error('Error initializing client:', error);
        setTimeout(initializeClient, 5000); // Retry after 5 seconds
    }
}

initializeClient(); // Start client initialization

client.on('message', async (message) => {
    try {
        const content = message.body.toLowerCase().trim();
        const sender = message.from;

        // Reset user state if needed
        if (!userState[sender]) {
            userState[sender] = {
                categorySelected: null,
                dealSelected: false,
                selectedDeal: null,
            };
        }

        console.log('Message received:', content);

        const phoneRegex = /^(?:\+254|254|0)\d{9}$/;

        if (content.includes('buy')) {
            userState[sender] = { categorySelected: null, dealSelected: false, selectedDeal: null };

            message.reply(
                `🎉 Welcome to Bingwa Sokoni Bot! 🎉\nPlease choose a category:\n
                1️⃣ Data Deals\n2️⃣ SMS Deals\n3️⃣ Minutes Deals\n\nType the number to choose (e.g., *1* for Data).`
            );
        } else if (!userState[sender].categorySelected) {
            if (['1', '2', '3'].includes(content)) {
                const categories = { '1': 'data', '2': 'sms', '3': 'minutes' };
                userState[sender].categorySelected = categories[content];
                sendDealsMenu(message, categories[content]);
            } else {
                message.reply("Invalid selection. Type *buy* to start again.");
            }
        } else if (!userState[sender].dealSelected) {
            const selectedCategory = userState[sender].categorySelected;
            const deal = mapDeal(selectedCategory, content);
            if (deal) {
                userState[sender].dealSelected = true;
                userState[sender].selectedDeal = deal;
                message.reply(`You selected: "${deal.description}"\n\nType *yes* to confirm or *no* to cancel.`);
            } else {
                message.reply('Invalid option. Please select a valid deal.');
            }
        } else if (content === 'yes') {
            message.reply('Please enter your phone number to proceed with the payment. ✅');
        } else if (content === 'no') {
            userState[sender] = { categorySelected: null, dealSelected: false, selectedDeal: null };
            message.reply('Transaction canceled. Type *buy* to start again.');
        } else if (phoneRegex.test(content)) {
            const phoneNumber = formatPhoneNumber(content);
            const { amount, description } = userState[sender].selectedDeal;

            try {
                const stkPushResponse = await initiateStkPush(amount, phoneNumber);
                message.reply(`STK Push initiated for "${description}". Enter your M-Pesa PIN to complete.`);
            } catch (error) {
                console.error(error);
                message.reply('Error initiating payment. Please try again.');
            }
        } else {
            message.reply("I didn't understand that. Type *buy* to start over.");
        }
    } catch (error) {
        console.error('Error handling message:', error);
    }
});

// Function to send deal menus
function sendDealsMenu(message, category) {
    const menus = {
        data: `Data Deals:\n1️⃣ 1GB @ Ksh 19 (1 hour)\n2️⃣ 1.5GB @ Ksh 50 (3 hours)\n3️⃣ 1.25GB @ Ksh 55 (midnight)\n4️⃣ 250MB @ Ksh 20 (24 hours)`,
        sms: `SMS Deals:\n1️⃣ 200 SMS @ Ksh 10 (24 hours)\n2️⃣ 20 SMS @ Ksh 5 (24 hours)\n3️⃣ 1000 SMS @ Ksh 30 (7 days)`,
        minutes: `Minutes Deals:\n1️⃣ 34MIN @ Ksh 18 (midnight)\n2️⃣ 50MIN @ Ksh 51\n3️⃣ 50 CREDO @ Ksh 21\n4️⃣ 100MIN @ Ksh 102 (2 days)\n5️⃣ 200MIN @ Ksh 250`,
    };

    message.reply(menus[category] || 'Invalid category.');
}

// Map deals based on category and input
function mapDeal(category, option) {
    const deals = {
        data: [{ id: '1', description: '1GB @ Ksh 19', amount: 19 }],
        sms: [{ id: '1', description: '200 SMS @ Ksh 10', amount: 10 }],
        minutes: [{ id: '1', description: '34MIN @ Ksh 18', amount: 18 }],
    };
    return deals[category]?.find((deal) => deal.id === option);
}

// Format phone number
function formatPhoneNumber(number) {
    return number.startsWith('254') ? `+${number}` : number.startsWith('0') ? `+254${number.slice(1)}` : number;
}

// Initiate STK Push (Dummy)
async function initiateStkPush(amount, phone) {
    return { success: true, message: 'STK Push Sent' };
}
