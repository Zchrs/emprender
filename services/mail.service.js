import nodemailer from'nodemailer';
import dotenv from'dotenv';

const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port:,
    secure:,
    auth:{
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD,
    }
});