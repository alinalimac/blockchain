
const CONTRACT_ABIS = {
    patientRegistry: [
        "function registerPatient(string)",
        "function patientIds(address) view returns (string)",
        "function getPatientId(address) view returns (string)"
    ],
    dataAccessControl: [
        "function updateDataHash(string)",
        "function getMyDataHash() view returns (string)",
        "function grantAccess(address)",
        "function getAccessiblePatients() view returns (address[])",
        "function getPatientDataHash(address) view returns (string)"
    ],
    mcToken: [
        "function balanceOf(address) view returns (uint256)",
        "function transfer(address, uint256)"
    ]
};

// Глобальные переменные
let provider, signer, CONTRACT_ADDRESSES, PINATA_CONFIG, patientRegistry, dataAccessControl, mcToken;
let currentUserAddress = null;

// Функция для получения конфигурации с сервера
async function getConfig() {
    try {
        const response = await fetch('http://localhost:3000/get-config');
        const config = await response.json();

        // Используйте конфигурацию в вашем коде
        PINATA_CONFIG = {
            API_KEY: config.PINATA_API_KEY,
            API_SECRET: config.PINATA_API_SECRET,
            JWT: config.PINATA_JWT
        };

        CONTRACT_ADDRESSES = config.CONTRACT_ADDRESSES;
        console.log(PINATA_CONFIG, CONTRACT_ADDRESSES);

    } catch (error) {
        console.error('Ошибка при получении конфигурации:', error);
    }
}

// Вызов функции для получения данных
getConfig();

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', async () => {
    await getConfig();
    await init();
    setupEventListeners();
    
    // Проверяем, зарегистрирован ли уже пользователь
    if (currentUserAddress) {
        checkPatientRegistration();
    }
});

// Инициализация ethers.js и контрактов
async function init() {
    if (window.ethereum) {
        try {
            // Подключаемся к MegaTestnet
            provider = new ethers.providers.Web3Provider(window.ethereum);
            await provider.send("eth_requestAccounts", []);
            signer = provider.getSigner();
            currentUserAddress = await signer.getAddress();
            
            // Обновляем UI подключенного кошелька
            document.getElementById('connectWallet').textContent = `Connected: ${shortenAddress(currentUserAddress)}`;
            document.getElementById('infoWallet').textContent = shortenAddress(currentUserAddress);
            
            // Инициализируем контракты
            patientRegistry = new ethers.Contract(
                CONTRACT_ADDRESSES.patientRegistry,
                CONTRACT_ABIS.patientRegistry,
                signer
            );
            
            dataAccessControl = new ethers.Contract(
                CONTRACT_ADDRESSES.dataAccessControl,
                CONTRACT_ABIS.dataAccessControl,
                signer
            );
            
            mcToken = new ethers.Contract(
                CONTRACT_ADDRESSES.mcToken,
                CONTRACT_ABIS.mcToken,
                signer
            );
            
        } catch (error) {
            console.error("Initialization error:", error);
            showError("Error connecting to wallet. Please try again.");
        }
    } else {
        showError("Please install MetaMask to use this application.");
    }
};

// Настройка обработчиков событий
function setupEventListeners() {
    // Подключение кошелька
    document.getElementById('connectWallet').addEventListener('click', init);
    
    // Регистрация пациента
    document.getElementById('registerBtn').addEventListener('click', registerPatient);
    
    // Управление доступом
    document.getElementById('grantAccessBtn').addEventListener('click', showAccessModal);
    document.getElementById('confirmGrantBtn').addEventListener('click', grantDoctorAccess);
    
    // Просмотр записей
    document.getElementById('viewRecordsBtn').addEventListener('click', viewMedicalRecords);
    
    // Модальное окно
    document.querySelector('.close').addEventListener('click', () => {
        document.getElementById('accessModal').style.display = 'none';
    });
};

// Проверка регистрации пациента
// Проверка регистрации пациента
async function checkPatientRegistration() {
    try {
        const patientId = await patientRegistry.getPatientId(currentUserAddress);
        if (patientId && patientId.length > 0) {
            // Разделяем patientId на имя и дату рождения
            const [name, dob] = patientId.split('|');

            // Обновляем UI
            document.getElementById('infoName').textContent = name || 'Unknown';
            document.getElementById('infoDob').textContent = dob || 'Unknown';
            document.getElementById('patientName').value = name;

            // Скрываем форму регистрации
            document.querySelector('.registration-card').style.display = 'none';

            // Загружаем данные пациента
            await loadPatientData();
        }
    } catch (error) {
        console.error("Error checking registration:", error);
    }
}

// Регистрация нового пациента
async function registerPatient() {
    const name = document.getElementById('patientName').value;
    const dob = document.getElementById('patientDob').value;
    
    if (!name || !dob) {
        showError("Please fill all fields");
        return;
    }
    
    try {
        // Формируем ID пациента (имя + дата рождения)
        const patientId = `${name}|${dob}`;
        
        // Вызываем функцию контракта
        const tx = await patientRegistry.registerPatient(patientId);
        showStatus("Registering patient...");
        
        await tx.wait();
        showSuccess("Patient registered successfully!");
        
        // Обновляем UI
        document.getElementById('infoName').textContent = name;
        document.getElementById('infoDob').textContent = dob;
        document.querySelector('.registration-card').style.display = 'none';
        
    } catch (error) {
        console.error("Registration error:", error);
        showError("Failed to register patient");
    }
};

// Загрузка данных пациента
async function loadPatientData() {
    try {
        // Получаем хеш данных из IPFS
        const ipfsHash = await dataAccessControl.getMyDataHash();
        
        if (ipfsHash && ipfsHash.length > 0) {
            // Здесь можно загрузить данные из IPFS
            // Например: fetch(`https://ipfs.io/ipfs/${ipfsHash}`)
        }
    } catch (error) {
        console.error("Error loading patient data:", error);
    }
};

// Показать модальное окно для предоставления доступа
function showAccessModal() {
    document.getElementById('accessModal').style.display = 'block';
};

// Предоставить доступ врачу
async function grantDoctorAccess() {
    const doctorAddress = document.getElementById('doctorAddress').value;
    
    if (!ethers.utils.isAddress(doctorAddress)) {
        showError("Please enter a valid Ethereum address");
        return;
    }
    
    try {
        const tx = await dataAccessControl.grantAccess(doctorAddress);
        showStatus("Granting access...");
        
        await tx.wait();
        showSuccess(`Access granted to ${shortenAddress(doctorAddress)}`);
        
        // Закрываем модальное окно
        document.getElementById('accessModal').style.display = 'none';
        document.getElementById('doctorAddress').value = '';
        
    } catch (error) {
        console.error("Error granting access:", error);
        showError("Failed to grant access");
    }
};

// Просмотр медицинских записей
async function viewMedicalRecords() {
    try {
        const ipfsHash = await dataAccessControl.getMyDataHash();
        
        if (!ipfsHash || ipfsHash.length === 0) {
            showInfo("No medical records found");
            return;
        }
        
        // Загружаем данные из IPFS
        const response = await fetch(`https://ipfs.io/ipfs/${ipfsHash}`);
        const data = await response.json();
        
        // Отображаем данные
        const recordsContainer = document.getElementById('recordsDisplay');
        recordsContainer.innerHTML = '';
        
        if (Array.isArray(data)) {
            data.forEach(record => {
                const recordElement = document.createElement('div');
                recordElement.className = 'record-item';
                recordElement.innerHTML = `
                    <div class="record-date">${record.date || 'Unknown date'}</div>
                    <div class="record-diagnosis">Diagnosis: ${record.diagnosis || 'Not specified'}</div>
                    <div class="record-treatment">Treatment: ${record.treatment || 'Not specified'}</div>
                `;
                recordsContainer.appendChild(recordElement);
            });
        } else {
            recordsContainer.innerHTML = `<pre>${JSON.stringify(data, null, 2)}</pre>`;
        }
        
    } catch (error) {
        console.error("Error viewing records:", error);
        showError("Failed to load medical records");
    }
};

// Вспомогательные функции
function shortenAddress(address) {
    return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
}

function showStatus(message) {
    // Реализация показа статуса (например, через toast или статус-бар)
    console.log(message);
}

function showSuccess(message) {
    // Реализация показа успешного сообщения
    console.log(message);
}

function showError(message) {
    // Реализация показа ошибки
    console.error(message);
}

function showInfo(message) {
    // Реализация показа информационного сообщения
    console.log(message);
}

// Обработчик изменений аккаунта в MetaMask
window.ethereum.on('accountsChanged', (accounts) => {
    if (accounts.length === 0) {
        console.log('Please connect to MetaMask.');
    } else {
        window.location.reload();
    }
});