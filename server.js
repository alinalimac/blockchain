require('dotenv').config();  // Загружает переменные из .env

const express = require('express');
const cors = require('cors');
const app = express();


const corsOptions = {
    origin: 'http://127.0.0.1:5500'
}

// Middleware для проверки источника запроса
const checkRequestSource = (req, res, next) => {
  const allowedDomains = [
    'http://127.0.0.1:5500',         
  ];

  const referer = req.headers.referer || req.headers.origin;
  if (!referer || !allowedDomains.some(domain => referer.startsWith(domain))) {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'Direct browser access is not allowed. Use only from trusted domain.'
    });
  }

  next();
};


app.get('/get-config', checkRequestSource, cors(corsOptions), (req, res) => {
    const config = {
        PINATA_API_KEY: process.env.PINATA_API_KEY,
        PINATA_API_SECRET: process.env.PINATA_API_SECRET,
        PINATA_JWT: process.env.PINATA_JWT,
        CONTRACT_ADDRESSES: {
            patientRegistry: process.env.PATIENT_REGISTRY_CONTRACT,
            dataAccessControl: process.env.DATA_ACCESS_CONTROL_CONTRACT,
            mcToken: process.env.MCTOKEN_CONTRACT
        }
    };
    res.json(config);  // Отправляем конфигурацию клиенту
});

app.listen(3000, () => console.log('Server running on port 3000'));