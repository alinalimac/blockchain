const CONTRACT_ABIS = {
    patientRegistry: [
        "function getPatientId(address) view returns (string)"
    ],
    dataAccessControl: [
        "function updateDataHash(string)",
        "function getAccessiblePatients() view returns (address[])",
        "function getPatientDataHash(address) view returns (string)"
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
    await init();
    setupEventListeners();
    if (currentUserAddress) {
        await loadAccessiblePatients();
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
            updateWalletUI();
            
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
            
        } catch (error) {
            console.error("Initialization error:", error);
            showError("Error connecting to wallet. Please try again.");
        }
    } else {
        showError("Please install MetaMask to use this application.");
    }
};

function updateWalletUI() {
    const connectBtn = document.getElementById('connectWallet');
    if (connectBtn) {
        connectBtn.innerHTML = `<span class="icon">🔗</span> Connected: ${shortenAddress(currentUserAddress)}`;
        connectBtn.classList.add('connected');
    }
}

// Настройка обработчиков событий
function setupEventListeners() {
    // Подключение кошелька
    document.getElementById('connectWallet').addEventListener('click', init);
    
    // Добавление медицинской записи
    document.getElementById('submitRecordBtn').addEventListener('click', submitMedicalRecord);
    
    // Поиск пациентов
    document.getElementById('patientSearch').addEventListener('input', searchPatients);
    
    // Модальное окно
    document.querySelector('.close').addEventListener('click', () => {
        document.getElementById('patientModal').style.display = 'none';
    });
};

// Загрузка данных в IPFS через Pinata
async function uploadToIPFS(data) {
    try {
        const response = await fetch('https://api.pinata.cloud/pinning/pinJSONToIPFS', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${PINATA_CONFIG.JWT}`
            },
            body: JSON.stringify({
                pinataContent: data,
                pinataMetadata: {
                    name: `medical_record_${Date.now()}.json`
                }
            })
        });
        
        if (!response.ok) {
            throw new Error(`Pinata API error: ${response.status}`);
        }
        
        const result = await response.json();
        return result.IpfsHash;
        
    } catch (error) {
        console.error("Error uploading to IPFS:", error);
        throw error;
    }
}

// Получение данных из IPFS
async function fetchFromIPFS(ipfsHash) {
    try {
        const response = await fetch(`https://gateway.pinata.cloud/ipfs/${ipfsHash}`);
        if (!response.ok) {
            throw new Error(`Failed to fetch IPFS data: ${response.status}`);
        }
        return await response.json();
    } catch (error) {
        console.error("Error fetching from IPFS:", error);
        throw error;
    }
}

// Полная реализация работы с функцией getAccessiblePatients()
async function loadAccessiblePatients() {
    try {
        showLoading('patientsList', 'Loading your patients...');
        
        // Проверяем инициализацию контракта
        if (!dataAccessControl) {
            throw new Error("Contract not initialized");
        }
        
        // Получаем список адресов пациентов
        const patientsList = await dataAccessControl.getAccessiblePatients();
        
        // Проверяем результат
        if (!patientsList || patientsList.length === 0) {
            document.getElementById('patientsList').innerHTML = `
                <div class="no-patients">
                    <img src="images/no-patients.svg" alt="No patients" class="empty-state-icon">
                    <p>No patients have shared their records with you yet.</p>
                    <p>Ask your patients to grant you access through their HealthChain portal.</p>
                </div>
            `;
            return;
        }
        
        // Обрабатываем каждого пациента
        const patientsContainer = document.getElementById('patientsList');
        patientsContainer.innerHTML = '';
        
        // Создаем элементы карточек пациентов
        await Promise.all(patientsList.map(async (patientAddress) => {
            try {
                // Получаем данные пациента
                const patientId = await patientRegistry.getPatientId(patientAddress);
                const [name, dob] = patientId ? patientId.split('|') : ['Anonymous Patient', ''];
                
                // Создаем HTML-элемент карточки
                const patientCard = document.createElement('div');
                patientCard.className = 'patient-card';
                patientCard.dataset.address = patientAddress;
                patientCard.dataset.name = name.toLowerCase();
                patientCard.dataset.dob = dob.toLowerCase();
                
                patientCard.innerHTML = `
                    <div class="patient-avatar">${name.charAt(0).toUpperCase()}</div>
                    <div class="patient-info">
                        <h3 class="patient-name">${name}</h3>
                        <div class="patient-meta">
                            <span class="patient-dob">${dob || 'DOB not specified'}</span>
                            <span class="patient-address">${shortenAddress(patientAddress)}</span>
                        </div>
                    </div>
                    <button class="btn btn-primary view-records" 
                            data-address="${patientAddress}"
                            data-name="${name}">
                        <i class="icon medical-file"></i> View Records
                    </button>
                `;
                
                // Добавляем обработчик клика
                patientCard.querySelector('.view-records').addEventListener('click', () => {
                    viewPatientRecords(patientAddress);
                });
                
                patientsContainer.appendChild(patientCard);
                
            } catch (error) {
                console.error(`Error processing patient ${patientAddress}:`, error);
                // Создаем базовую карточку даже при ошибке
                const errorCard = document.createElement('div');
                errorCard.className = 'patient-card error';
                errorCard.innerHTML = `
                    <div class="patient-avatar">?</div>
                    <div class="patient-info">
                        <h3 class="patient-name">Unknown Patient</h3>
                        <div class="patient-meta">
                            <span class="patient-address">${shortenAddress(patientAddress)}</span>
                        </div>
                    </div>
                    <button class="btn btn-primary view-records" 
                            data-address="${patientAddress}">
                        <i class="icon medical-file"></i> View Records
                    </button>
                `;
                patientsContainer.appendChild(errorCard);
            }
        }));
        
    } catch (error) {
        console.error("Error loading accessible patients:", error);
        showError("Failed to load patient list. Please try again.");
        
        document.getElementById('patientsList').innerHTML = `
            <div class="error-state">
                <i class="icon error-icon"></i>
                <h3>Error Loading Patients</h3>
                <p>We couldn't load your patient list. Please check your connection.</p>
                <button class="btn btn-retry" onclick="loadAccessiblePatients()">
                    <i class="icon refresh"></i> Try Again
                </button>
            </div>
        `;
    }
}

// Обновленная функция поиска пациентов
function searchPatients() {
    const searchTerm = document.getElementById('patientSearch').value.toLowerCase().trim();
    const patientCards = document.querySelectorAll('.patient-card');
    
    patientCards.forEach(card => {
        const matchesSearch = 
            card.dataset.name.includes(searchTerm) ||
            card.dataset.address.includes(searchTerm) ||
            (card.dataset.dob && card.dataset.dob.includes(searchTerm));
        
        card.style.display = matchesSearch ? 'flex' : 'none';
    });
    
    // Показываем сообщение, если ничего не найдено
    const visibleCards = document.querySelectorAll('.patient-card[style*="flex"]');
    const noResults = document.getElementById('no-results-message');
    
    if (visibleCards.length === 0 && searchTerm.length > 0) {
        if (!noResults) {
            const message = document.createElement('div');
            message.id = 'no-results-message';
            message.className = 'no-results';
            message.innerHTML = `
                <i class="icon search"></i>
                <p>No patients match your search "<strong>${searchTerm}</strong>"</p>
            `;
            document.getElementById('patientsList').appendChild(message);
        }
    } else if (noResults) {
        noResults.remove();
    }
}

// Добавление карточки пациента
async function addPatientCard(patientAddress) {
    try {
        const patientId = await patientRegistry.getPatientId(patientAddress);
        const [name, dob] = patientId.split('|');
        
        const patientCard = document.createElement('div');
        patientCard.className = 'patient-card';
        patientCard.innerHTML = `
            <div class="patient-info">
                <div class="patient-name">${name || 'Unknown Patient'}</div>
                <div class="patient-details">
                    <span class="patient-dob">${dob || ''}</span>
                    <span class="patient-address">${shortenAddress(patientAddress)}</span>
                </div>
            </div>
            <button class="btn btn-secondary view-records-btn" data-address="${patientAddress}">
                <span class="icon">👁️</span> View Records
            </button>
        `;
        
        patientCard.querySelector('.view-records-btn').addEventListener('click', (e) => {
            viewPatientRecords(e.target.getAttribute('data-address'));
        });
        
        document.getElementById('patientsList').appendChild(patientCard);
    } catch (error) {
        console.error("Error adding patient card:", error);
    }
};

// Добавление новой медицинской записи
async function submitMedicalRecord() {
    const patientAddress = document.getElementById('patientAddress').value;
    const diagnosis = document.getElementById('diagnosis').value;
    const treatment = document.getElementById('treatment').value;
    
    if (!ethers.utils.isAddress(patientAddress)) {
        showError("Please enter a valid patient address");
        return;
    }
    
    if (!diagnosis || !treatment) {
        showError("Please fill all fields");
        return;
    }
    
    try {
        showLoading('recordsDisplay', 'Processing medical record...');
        
        // 1. Проверяем доступ к пациенту и получаем текущие записи
        const ipfsHash = await dataAccessControl.getPatientDataHash(patientAddress);
        let records = [];
        
        if (ipfsHash && ipfsHash.length > 0) {
            records = await fetchFromIPFS(ipfsHash);
            if (!Array.isArray(records)) {
                records = [records]; // Конвертируем в массив если это одиночная запись
            }
        }
        
        // 2. Добавляем новую запись
        const newRecord = {
            date: new Date().toLocaleDateString(),
            diagnosis,
            treatment,
            doctor: currentUserAddress,
            timestamp: Math.floor(Date.now() / 1000)
        };
        
        records.push(newRecord);
        
        // 3. Загружаем обновленные записи в IPFS
        const newIpfsHash = await uploadToIPFS(records);
        
        // 4. Обновляем хеш в блокчейне (если у врача есть права на запись)
        const tx = await dataAccessControl.updateDataHash(newIpfsHash);
        await tx.wait();
        
        showSuccess("Medical record added successfully!");
        updateRecordUI(records);
        
        // Очищаем форму
        document.getElementById('diagnosis').value = '';
        document.getElementById('treatment').value = '';
        
    } catch (error) {
        console.error("Error adding medical record:", error);
        showError(`Failed to add record: ${error.message}`);
    }
};

// Обновление UI после добавления записи
function updateRecordUI(records) {
    const container = document.getElementById('recordsDisplay');
    container.innerHTML = '';
    
    records.slice().reverse().forEach(record => {
        const recordEl = document.createElement('div');
        recordEl.className = 'record-item';
        recordEl.innerHTML = `
            <div class="record-header">
                <span class="record-date">${record.date}</span>
                <span class="record-doctor">Dr. ${shortenAddress(record.doctor)}</span>
            </div>
            <div class="record-diagnosis"><strong>Diagnosis:</strong> ${record.diagnosis}</div>
            <div class="record-treatment"><strong>Treatment:</strong> ${record.treatment}</div>
        `;
        container.appendChild(recordEl);
    });
}

// Просмотр записей пациента
async function viewPatientRecords(patientAddress) {
    try {
        showLoading('patientRecords', 'Loading medical records...');
        
        const ipfsHash = await dataAccessControl.getPatientDataHash(patientAddress);
        
        if (!ipfsHash) {
            showInfo("No records found for this patient");
            return;
        }
        
        const data = await fetchFromIPFS(ipfsHash);
        const patientId = await patientRegistry.getPatientId(patientAddress);
        const [name] = patientId.split('|');
        
        document.getElementById('modalPatientName').textContent = `${name}'s Medical Records`;
        const container = document.getElementById('patientRecords');
        container.innerHTML = '';
        
        if (Array.isArray(data)) {
            data.slice().reverse().forEach(record => {
                const recordEl = document.createElement('div');
                recordEl.className = 'record-item';
                recordEl.innerHTML = `
                    <div class="record-header">
                        <span class="record-date">${record.date}</span>
                        <span class="record-doctor">Dr. ${shortenAddress(record.doctor)}</span>
                    </div>
                    <div class="record-diagnosis"><strong>Diagnosis:</strong> ${record.diagnosis}</div>
                    <div class="record-treatment"><strong>Treatment:</strong> ${record.treatment}</div>
                `;
                container.appendChild(recordEl);
            });
        } else {
            container.innerHTML = `<pre>${JSON.stringify(data, null, 2)}</pre>`;
        }
        
        document.getElementById('patientModal').style.display = 'block';
        
    } catch (error) {
        console.error("Error viewing patient records:", error);
        showError("Failed to load patient records");
    }
};

// Вспомогательные функции
function shortenAddress(address) {
    return address ? `${address.substring(0, 6)}...${address.substring(address.length - 4)}` : '';
}

function showLoading(elementId, message) {
    const element = document.getElementById(elementId);
    if (element) {
        element.innerHTML = `<div class="loading-spinner">${message}</div>`;
    }
}

function showSuccess(message) {
    const toast = document.createElement('div');
    toast.className = 'toast success';
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

function showError(message) {
    const toast = document.createElement('div');
    toast.className = 'toast error';
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

function showInfo(message) {
    console.log(message);
}

// Обработчик изменений аккаунта в MetaMask
if (window.ethereum) {
    window.ethereum.on('accountsChanged', (accounts) => {
        if (accounts.length === 0) {
            console.log('Please connect to MetaMask.');
        } else {
            window.location.reload();
        }
    });
}