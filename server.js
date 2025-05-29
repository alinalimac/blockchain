require('dotenv').config();  // Загружает переменные из .env

const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors()); // <- разрешает все источники

app.get('/get-config', (req, res) => {
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