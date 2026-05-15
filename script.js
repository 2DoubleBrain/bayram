// ============ ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ ============
let products = [];
let categories = [];
let shopConfig = {};
let cart = [];
let currentPage = 'shop';
let currentCategory = 'all';
let currentPriceRange = null;

// Переменные для модального окна
let currentProduct = null;
let selectedRange = null;
let selectedPrice = null;
let selectedVariant = null;
let selectedQuantity = 1;

// Режим менеджера
let isManagerMode = false;
let currentEditProduct = null;

// GitHub конфигурация
let githubConfig = {
    enabled: true,
    repo: "",
    path: "data.json",
    token: null
};

// ============ КОНФИГУРАЦИЯ ЦЕНОВЫХ ДИАПАЗОНОВ ============
const priceRangesConfig = [
    { key: '3000-10000', label: '3 000 - 10 000 ₽', minTotal: 3000, maxTotal: 10000 },
    { key: '10000-30000', label: '10 000 - 30 000 ₽', minTotal: 10000, maxTotal: 30000 },
    { key: '30000-50000', label: '30 000 - 50 000 ₽', minTotal: 30000, maxTotal: 50000 },
    { key: '50000-100000', label: '50 000 - 100 000 ₽', minTotal: 50000, maxTotal: 100000 },
    { key: '100000-999999', label: '100 000+ ₽', minTotal: 100000, maxTotal: 999999 }
];

function getRangeLabel(rangeKey) {
    const range = priceRangesConfig.find(r => r.key === rangeKey);
    return range ? range.label : rangeKey;
}

// ============ ПОЛУЧЕНИЕ ИНФОРМАЦИИ О ПОЛЬЗОВАТЕЛЕ ============
function getUserInfo() {
    let userName = 'Неизвестный';
    let userId = 'Неизвестно';
    let userUsername = 'Нет username';
    let userPhone = 'Не указан';
    
    if (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.initDataUnsafe) {
        const user = window.Telegram.WebApp.initDataUnsafe.user;
        if (user) {
            userName = user.first_name || '';
            if (user.last_name) userName += ' ' + user.last_name;
            if (!userName.trim()) userName = 'Пользователь';
            
            userId = user.id || 'Неизвестно';
            userUsername = user.username ? '@' + user.username : 'Нет username';
        }
    }
    
    const savedUser = localStorage.getItem('amigoopt_user_info');
    if (savedUser) {
        const parsed = JSON.parse(savedUser);
        if (parsed.userPhone) userPhone = parsed.userPhone;
        if (!userName || userName === 'Неизвестный') {
            userName = parsed.userName;
            userUsername = parsed.userUsername;
        }
    }
    
    return { userName, userId, userUsername, userPhone };
}

function saveUserInfo(phoneNumber = null) {
    if (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.initDataUnsafe) {
        const user = window.Telegram.WebApp.initDataUnsafe.user;
        if (user) {
            let userName = user.first_name || '';
            if (user.last_name) userName += ' ' + user.last_name;
            if (!userName.trim()) userName = 'Пользователь';
            
            const existing = localStorage.getItem('amigoopt_user_info');
            let existingPhone = null;
            if (existing) {
                const parsed = JSON.parse(existing);
                existingPhone = parsed.userPhone;
            }
            
            const userInfo = {
                userName: userName,
                userId: user.id,
                userUsername: user.username ? '@' + user.username : 'Нет username',
                userPhone: phoneNumber || existingPhone || 'Не указан'
            };
            localStorage.setItem('amigoopt_user_info', JSON.stringify(userInfo));
        }
    }
}

// ============ АВТОМАТИЧЕСКОЕ ОПРЕДЕЛЕНИЕ РЕПОЗИТОРИЯ ============
function getRepoInfo() {
    const hostname = window.location.hostname;
    if (hostname.includes('github.io')) {
        const username = hostname.split('.')[0];
        const pathParts = window.location.pathname.split('/');
        const reponame = pathParts[1] || '';
        return { username, reponame };
    }
    return null;
}

// ============ ЗАГРУЗКА ДАННЫХ ============
async function loadData() {
    try {
        console.log('Загрузка data.json...');
        const response = await fetch('./data.json');
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        console.log('Данные загружены, товаров:', data.products?.length || 0);
        
        products = data.products || [];
        categories = data.categories || [];
        shopConfig = {
            shopName: data.shopName || 'AmigoOPT',
            contactPhone: data.contactPhone || '+7 (968) 890-07-44',
            managerTgId: data.managerTgId || '5404907427',
            botToken: data.botToken || ''
        };
        
        // Настраиваем GitHub конфиг
        const repoInfo = getRepoInfo();
        if (repoInfo && repoInfo.reponame) {
            githubConfig.repo = `${repoInfo.username}/${repoInfo.reponame}`;
            console.log('Репозиторий определен:', githubConfig.repo);
        } else {
            githubConfig.enabled = false;
        }
        
        // Загружаем сохраненный токен
        const savedToken = localStorage.getItem('amigoopt_github_token');
        if (savedToken) {
            githubConfig.token = savedToken;
        }
        
        const savedCart = localStorage.getItem('amigoopt_cart');
        if (savedCart) {
            try {
                cart = JSON.parse(savedCart);
                if (cart.length > 0) {
                    recalcCartPrices();
                }
            } catch(e) {
                console.log('Ошибка загрузки корзины');
                cart = [];
            }
        }
        
        const savedRange = localStorage.getItem('amigoopt_price_range');
        if (savedRange && cart.length > 0) {
            currentPriceRange = savedRange;
        }
        
        if (window.Telegram && window.Telegram.WebApp) {
            window.Telegram.WebApp.expand();
        }
        
        initApp();
        
    } catch (error) {
        console.error('Ошибка загрузки:', error);
        document.getElementById('mainContent').innerHTML = `
            <div style="text-align:center; padding:50px; color:red;">
                ❌ Ошибка загрузки данных<br>
                <small style="color:#888">${error.message}</small><br><br>
                <button onclick="location.reload()" style="padding:10px 20px; background:#1a1a2e; color:white; border:none; border-radius:10px;">↻ Перезагрузить</button>
            </div>
        `;
    }
}

function initApp() {
    saveUserInfo();
    
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', () => switchPage(btn.dataset.page));
    });
    
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', () => {
            if (currentPage === 'shop') renderShopPage();
        });
    }
    
    switchPage('shop');
    updateCartBadge();
    
    // Проверяем вход по ссылке
    checkManagerLink();
}

function switchPage(page) {
    currentPage = page;
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.page === page);
    });
    
    if (page === 'shop') renderShopPage();
    else if (page === 'sales') renderSalesPage();
    else if (page === 'cart') renderCartPage();
    else if (page === 'contacts') renderContactsPage();
    
    window.scrollTo({ top: 0, behavior: 'smooth' });
    const mainContent = document.getElementById('mainContent');
    if (mainContent) mainContent.scrollTop = 0;
    
    updateCartBadge();
}

// ============ ЛОГИКА ПЕРЕСЧЕТА ЦЕН ============
function getPriceForRange(product, rangeKey) {
    if (product.priceRanges && product.priceRanges[rangeKey]) {
        return product.priceRanges[rangeKey];
    }
    if (product.priceRanges) {
        const values = Object.values(product.priceRanges);
        return values.length > 0 ? values[0] : 0;
    }
    return 0;
}

function getCartTotal() {
    return cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
}

function getRangeKeyByTotal(total) {
    for (const range of priceRangesConfig) {
        if (total >= range.minTotal && total <= range.maxTotal) {
            return range.key;
        }
    }
    return '100000-999999';
}

function recalcCartPrices() {
    if (!currentPriceRange && cart.length === 0) return;
    
    if (cart.length > 0) {
        const total = getCartTotal();
        currentPriceRange = getRangeKeyByTotal(total);
        localStorage.setItem('amigoopt_price_range', currentPriceRange);
        
        let changed = false;
        cart = cart.map(item => {
            const product = products.find(p => p.id === item.id);
            if (product) {
                const newPrice = getPriceForRange(product, currentPriceRange);
                if (item.price !== newPrice) {
                    changed = true;
                    return { ...item, price: newPrice, appliedRange: currentPriceRange };
                }
                return { ...item, appliedRange: currentPriceRange };
            }
            return item;
        });
        
        if (changed) {
            saveCart();
            if (currentPage === 'cart') renderCartPage();
            updateCartBadge();
        }
    }
}

function checkAndUpdateRangeByTotal() {
    if (cart.length === 0) {
        currentPriceRange = null;
        localStorage.removeItem('amigoopt_price_range');
        return false;
    }
    
    const total = getCartTotal();
    const newRangeKey = getRangeKeyByTotal(total);
    
    if (newRangeKey !== currentPriceRange) {
        currentPriceRange = newRangeKey;
        localStorage.setItem('amigoopt_price_range', newRangeKey);
        
        let changed = false;
        cart = cart.map(item => {
            const product = products.find(p => p.id === item.id);
            if (product) {
                const newPrice = getPriceForRange(product, currentPriceRange);
                if (item.price !== newPrice) {
                    changed = true;
                    return { ...item, price: newPrice, appliedRange: currentPriceRange };
                }
                return { ...item, appliedRange: currentPriceRange };
            }
            return item;
        });
        
        if (changed) {
            saveCart();
            if (currentPage === 'cart') renderCartPage();
            updateCartBadge();
            if (currentPage === 'shop') renderShopPage();
        }
        return true;
    }
    return false;
}

// ============ КОРЗИНА ============
function saveCart() {
    localStorage.setItem('amigoopt_cart', JSON.stringify(cart));
    updateCartBadge();
}

function updateCartBadge() {
    const badge = document.getElementById('cartBadge');
    const total = cart.reduce((sum, item) => sum + item.quantity, 0);
    if (badge) {
        badge.textContent = total;
        badge.style.display = total > 0 ? 'flex' : 'none';
    }
}

function getVariantType(product) {
    if (product.flavors && product.flavors.length) return { type: 'flavors', label: 'Выберите вкус', items: product.flavors };
    if (product.colors && product.colors.length) return { type: 'colors', label: 'Выберите цвет', items: product.colors };
    if (product.resistances && product.resistances.length) return { type: 'resistances', label: 'Выберите сопротивление', items: product.resistances };
    return null;
}

// ============ ОТПРАВКА ЗАКАЗА В TELEGRAM ============
async function sendOrderToTelegram(orderText) {
    if (!shopConfig.botToken) {
        console.log('Бот не настроен');
        alert('⚠️ Заказ создан, но бот не настроен. Сообщите менеджеру.');
        return;
    }
    
    try {
        const response = await fetch(`https://api.telegram.org/bot${shopConfig.botToken}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                chat_id: shopConfig.managerTgId, 
                text: orderText, 
                parse_mode: 'HTML' 
            })
        });
        
        const result = await response.json();
        if (result.ok) {
            console.log('Заказ отправлен');
        } else {
            console.error('Ошибка:', result.description);
        }
    } catch(error) {
        console.error('Ошибка:', error);
    }
}

// ============ ФОРМА ОФОРМЛЕНИЯ ЗАКАЗА ============
function openCheckoutForm() {
    console.log('openCheckoutForm вызвана');
    
    if (cart.length === 0) {
        alert('Корзина пуста');
        return;
    }
    
    const userInfo = getUserInfo();
    
    const modal = document.getElementById('checkoutModal');
    if (!modal) {
        console.error('checkoutModal не найден в DOM');
        return;
    }
    
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3>Оформление заказа</h3>
                <button class="close-modal" onclick="closeCheckoutModal()">×</button>
            </div>
            <div class="modal-body">
                <form id="orderForm" class="checkout-form">
                    <div class="form-group">
                        <label>ФИО *</label>
                        <input type="text" id="fullName" placeholder="Иванов Иван Иванович" required>
                    </div>
                    <div class="form-group">
                        <label>Город *</label>
                        <input type="text" id="city" placeholder="Москва" required>
                    </div>
                    <div class="form-group">
                        <label>Адрес доставки *</label>
                        <textarea id="address" placeholder="Улица, дом, квартира/офис" required></textarea>
                    </div>
                    <div class="form-group">
                        <label>Номер телефона *</label>
                        <input type="tel" id="phone" placeholder="+7 (999) 123-45-67" value="${userInfo.userPhone !== 'Не указан' ? userInfo.userPhone : ''}" required>
                    </div>
                    <div class="form-group">
                        <label>Комментарий к заказу</label>
                        <textarea id="comment" placeholder="Дополнительная информация..."></textarea>
                    </div>
                    <button type="submit" class="submit-order-btn">✅ Подтвердить заказ</button>
                </form>
            </div>
        </div>
    `;
    modal.style.display = 'block';
    
    const form = document.getElementById('orderForm');
    if (form) {
        form.onsubmit = (e) => {
            e.preventDefault();
            submitOrder();
        };
    }
}

function closeCheckoutModal() {
    const modal = document.getElementById('checkoutModal');
    if (modal) {
        modal.style.display = 'none';
        modal.innerHTML = '';
    }
}

function submitOrder() {
    const fullName = document.getElementById('fullName')?.value.trim();
    const city = document.getElementById('city')?.value.trim();
    const address = document.getElementById('address')?.value.trim();
    const phone = document.getElementById('phone')?.value.trim();
    const comment = document.getElementById('comment')?.value.trim();
    
    if (!fullName) { alert('Введите ФИО'); return; }
    if (!city) { alert('Введите город'); return; }
    if (!address) { alert('Введите адрес доставки'); return; }
    if (!phone) { alert('Введите номер телефона'); return; }
    
    const userInfo = getUserInfo();
    
    let order = '🛍️ <b>НОВЫЙ ЗАКАЗ</b>\n\n';
    order += `━━━━━━━━━━━━━━━━\n`;
    order += `<b>📋 ДАННЫЕ ПОКУПАТЕЛЯ</b>\n`;
    order += `━━━━━━━━━━━━━━━━\n`;
    order += `👤 <b>ФИО:</b> ${fullName}\n`;
    order += `🏙️ <b>Город:</b> ${city}\n`;
    order += `📍 <b>Адрес доставки:</b> ${address}\n`;
    order += `📞 <b>Телефон:</b> ${phone}\n`;
    order += `📱 <b>Telegram:</b> ${userInfo.userUsername}\n`;
    order += `🆔 <b>Telegram ID:</b> <code>${userInfo.userId}</code>\n`;
    if (comment) order += `💬 <b>Комментарий:</b> ${comment}\n`;
    order += `━━━━━━━━━━━━━━━━\n\n`;
    
    order += `<b>🛒 СОСТАВ ЗАКАЗА</b>\n`;
    order += `━━━━━━━━━━━━━━━━\n`;
    
    let total = 0;
    cart.forEach(item => {
        const itemTotal = item.price * item.quantity;
        total += itemTotal;
        order += `📦 ${item.name}\n`;
        order += `   💰 ${item.price}₽ × ${item.quantity} = ${itemTotal}₽\n`;
        if (item.selectedRange) order += `   📊 ${item.selectedRange}\n`;
        if (item.selectedVariant) order += `   🎨 ${item.selectedVariant}\n`;
        order += `\n`;
    });
    
    order += `━━━━━━━━━━━━━━━━\n`;
    order += `<b>💰 ИТОГО: ${total}₽</b>\n\n`;
    order += `📅 ${new Date().toLocaleString('ru-RU')}`;
    
    sendOrderToTelegram(order);
    
    alert('✅ Заказ оформлен! Менеджер свяжется с вами в ближайшее время.');
    
    cart = [];
    currentPriceRange = null;
    localStorage.removeItem('amigoopt_price_range');
    saveCart();
    
    closeCheckoutModal();
    if (currentPage === 'cart') renderCartPage();
    updateCartBadge();
}

// ============ РЕЖИМ МЕНЕДЖЕРА ============

function checkManagerLink() {
    const hash = window.location.hash;
    if (hash && hash.includes('manager:')) {
        const password = hash.split('manager:')[1];
        if (password === 'Amigo2025') {
            const token = prompt('🔐 Введите  токен для сохранения цен');
            if (token && token.startsWith('ghp_')) {
                localStorage.setItem('amigoopt_github_token', token);
                githubConfig.token = token;
                isManagerMode = true;
                localStorage.setItem('amigoopt_manager_mode', 'true');
                alert('✅ Режим менеджера активирован!');
                renderShopPage();
                if (currentPage === 'contacts') renderContactsPage();
            } else if (token) {
                alert('❌ Неверный токен!');
            }
            window.location.hash = '';
        }
    }
    
    if (!isManagerMode && localStorage.getItem('amigoopt_manager_mode') === 'true') {
        isManagerMode = true;
        const savedToken = localStorage.getItem('amigoopt_github_token');
        if (savedToken) {
            githubConfig.token = savedToken;
        }
        renderShopPage();
        if (currentPage === 'contacts') renderContactsPage();
    }
}

function exitManagerMode() {
    isManagerMode = false;
    localStorage.removeItem('amigoopt_manager_mode');
    localStorage.removeItem('amigoopt_github_token');
    githubConfig.token = null;
    alert('🔒 Режим менеджера выключен');
    renderShopPage();
    if (currentPage === 'contacts') renderContactsPage();
}

function openPriceEditor(product) {
    if (!isManagerMode) return;
    
    currentEditProduct = product;
    
    const ranges = {
        '3000-10000': product.priceRanges?.['3000-10000'] || 0,
        '10000-30000': product.priceRanges?.['10000-30000'] || 0,
        '30000-50000': product.priceRanges?.['30000-50000'] || 0,
        '50000-100000': product.priceRanges?.['50000-100000'] || 0,
        '100000-999999': product.priceRanges?.['100000-999999'] || 0
    };
    
    const modal = document.getElementById('modalOverlay');
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3>📊 Редактирование цен</h3>
                <button class="close-modal" onclick="closeModal()">×</button>
            </div>
            <div class="modal-body">
                <h4 style="margin-bottom:15px;">${escapeHtml(product.name)}</h4>
                
                <div class="price-edit-group">
                    <label>💰 3 000 - 10 000 ₽:</label>
                    <input type="number" id="price_3000" value="${ranges['3000-10000']}" class="price-edit-input">
                </div>
                <div class="price-edit-group">
                    <label>💰 10 000 - 30 000 ₽:</label>
                    <input type="number" id="price_10000" value="${ranges['10000-30000']}" class="price-edit-input">
                </div>
                <div class="price-edit-group">
                    <label>💰 30 000 - 50 000 ₽:</label>
                    <input type="number" id="price_30000" value="${ranges['30000-50000']}" class="price-edit-input">
                </div>
                <div class="price-edit-group">
                    <label>💰 50 000 - 100 000 ₽:</label>
                    <input type="number" id="price_50000" value="${ranges['50000-100000']}" class="price-edit-input">
                </div>
                <div class="price-edit-group">
                    <label>💰 100 000+ ₽:</label>
                    <input type="number" id="price_100000" value="${ranges['100000-999999']}" class="price-edit-input">
                </div>
                
                <div class="price-edit-buttons">
                    <button class="save-price-btn" onclick="savePriceChanges()">💾 Сохранить цены</button>
                    <button class="cancel-price-btn" onclick="closeModal()">Отмена</button>
                </div>
            </div>
        </div>
    `;
    modal.style.display = 'block';
}

function savePriceChanges() {
    if (!currentEditProduct) return;
    
    const newPrices = {
        "3000-10000": parseInt(document.getElementById('price_3000')?.value) || 0,
        "10000-30000": parseInt(document.getElementById('price_10000')?.value) || 0,
        "30000-50000": parseInt(document.getElementById('price_30000')?.value) || 0,
        "50000-100000": parseInt(document.getElementById('price_50000')?.value) || 0,
        "100000-999999": parseInt(document.getElementById('price_100000')?.value) || 0
    };
    
    currentEditProduct.priceRanges = newPrices;
    
    const index = products.findIndex(p => p.id === currentEditProduct.id);
    if (index !== -1) {
        products[index].priceRanges = newPrices;
    }
    
    const priceEdits = JSON.parse(localStorage.getItem('amigoopt_price_edits') || '{}');
    priceEdits[currentEditProduct.id] = newPrices;
    localStorage.setItem('amigoopt_price_edits', JSON.stringify(priceEdits));
    
    closeModal();
    
    if (currentPage === 'shop') renderShopPage();
    if (currentPage === 'sales') renderSalesPage();
    if (currentPage === 'cart') {
        checkAndUpdateRangeByTotal();
        renderCartPage();
    }
    
    showSaveNotification();
}

function showSaveNotification() {
    let notification = document.getElementById('managerNotification');
    if (!notification) {
        notification = document.createElement('div');
        notification.id = 'managerNotification';
        notification.className = 'manager-notification';
        document.body.appendChild(notification);
    }
    
    notification.innerHTML = `
        <div class="notification-content">
            <span>✏️ Цены изменены!</span>
            <button onclick="saveAllToGitHub()" class="save-github-btn">💾 Сохранить на GitHub</button>
            <button onclick="closeNotification()" class="close-notif-btn">×</button>
        </div>
    `;
    notification.style.display = 'block';
    
    setTimeout(() => {
        if (notification) notification.style.display = 'none';
    }, 15000);
}

function closeNotification() {
    const notification = document.getElementById('managerNotification');
    if (notification) notification.style.display = 'none';
}

async function saveAllToGitHub() {
    if (!githubConfig.token) {
        alert('❌ Нет GitHub токена. Войдите в режим менеджера заново по ссылке.');
        return;
    }
    
    if (!githubConfig.repo) {
        alert('❌ Не удалось определить репозиторий.');
        return;
    }
    
    const savedEdits = JSON.parse(localStorage.getItem('amigoopt_price_edits') || '{}');
    
    if (Object.keys(savedEdits).length === 0) {
        alert('Нет изменений для сохранения.');
        return;
    }
    
    const updatedData = {
        shopName: shopConfig.shopName,
        contactPhone: shopConfig.contactPhone,
        managerTgId: shopConfig.managerTgId,
        botToken: shopConfig.botToken,
        categories: categories,
        products: products.map(p => {
            if (savedEdits[p.id]) {
                return { ...p, priceRanges: savedEdits[p.id] };
            }
            return p;
        })
    };
    
    const url = `https://api.github.com/repos/${githubConfig.repo}/contents/data.json`;
    
    try {
        console.log('Сохраняем на GitHub:', url);
        
        const getResponse = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${githubConfig.token}`,
                'Accept': 'application/vnd.github+json'
            }
        });
        
        if (!getResponse.ok) {
            throw new Error(`HTTP ${getResponse.status}`);
        }
        
        const fileData = await getResponse.json();
        const sha = fileData.sha;
        
        const content = btoa(unescape(encodeURIComponent(JSON.stringify(updatedData, null, 2))));
        
        const updateResponse = await fetch(url, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${githubConfig.token}`,
                'Accept': 'application/vnd.github+json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                message: `Обновление цен от ${new Date().toLocaleString('ru-RU')}`,
                content: content,
                sha: sha
            })
        });
        
        if (updateResponse.ok) {
            alert('✅ Цены успешно сохранены на GitHub!');
            localStorage.removeItem('amigoopt_price_edits');
            closeNotification();
        } else {
            const result = await updateResponse.json();
            alert(`❌ Ошибка: ${result.message}`);
        }
    } catch(error) {
        console.error('Ошибка:', error);
        alert('⚠️ Ошибка соединения с GitHub. Попробуйте еще раз.');
    }
}

// ============ ОТОБРАЖЕНИЕ ============
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function renderProductCard(product) {
    let displayPrice = 0;
    if (product.priceRanges) {
        displayPrice = product.priceRanges['100000-999999'] || Object.values(product.priceRanges)[0] || 0;
    }
    
    const productJson = JSON.stringify(product).replace(/'/g, "&#39;").replace(/"/g, '&quot;');
    
    const rightContent = product.sale 
        ? '<span class="sale-badge">🔥 SALE</span>' 
        : '<span class="sale-placeholder"></span>';
    
    let managerButton = '';
    if (isManagerMode) {
        managerButton = `<button class="price-edit-btn" onclick="event.stopPropagation(); openPriceEditor(${productJson})">📊 Изменить цену</button>`;
    }
    
    return `
        <div class="product-card" onclick='openProductModal(${productJson})'>
            <img src="${product.photo || 'https://placehold.co/300x200/eee/999?text=No+Image'}" class="product-image" onerror="this.src='https://placehold.co/300x200/eee/999?text=No+Image'">
            <div class="product-info">
                <div class="product-name">${escapeHtml(product.name)}</div>
                <div class="product-price-wrapper">
                    <span class="product-price">${displayPrice}₽</span>
                    ${rightContent}
                </div>
                <div class="product-buttons">
                    <button class="open-btn">Открыть</button>
                    ${managerButton}
                </div>
            </div>
        </div>
    `;
}

function renderShopPage() {
    if (!products.length) {
        document.getElementById('mainContent').innerHTML = '<div style="text-align:center; padding:50px">Загрузка товаров...</div>';
        return;
    }
    
    const searchTerm = document.getElementById('searchInput')?.value.toLowerCase() || '';
    let filtered = currentCategory === 'all' ? products : products.filter(p => p.category === currentCategory);
    if (searchTerm) filtered = filtered.filter(p => p.name.toLowerCase().includes(searchTerm) || (p.description && p.description.toLowerCase().includes(searchTerm)));
    
    const popular = filtered.filter(p => p.popular);
    const other = filtered.filter(p => !p.popular);
    
    let html = `<div class="categories-grid"><div class="category-chip ${currentCategory === 'all' ? 'active' : ''}" data-cat="all">Все</div>`;
    if (categories && categories.length) {
        categories.forEach(cat => { 
            html += `<div class="category-chip ${currentCategory === cat ? 'active' : ''}" data-cat="${cat}">${escapeHtml(cat)}</div>`; 
        });
    }
    html += `</div>`;
    
    if (currentPriceRange && cart.length > 0) {
        html += `<div class="range-notification">📊 Ваша корзина в диапазоне: ${getRangeLabel(currentPriceRange)}</div>`;
    }
    
    if (popular.length) html += `<h2 class="section-title">⭐ Популярное</h2><div class="products-grid">${popular.map(p => renderProductCard(p)).join('')}</div>`;
    if (other.length) html += `<h2 class="section-title">📦 Все товары</h2><div class="products-grid">${other.map(p => renderProductCard(p)).join('')}</div>`;
    if (!filtered.length) html = `<div style="text-align:center;padding:50px">🔍 Ничего не найдено</div>`;
    
    document.getElementById('mainContent').innerHTML = html;
    
    document.querySelectorAll('.category-chip').forEach(el => {
        el.addEventListener('click', () => { 
            currentCategory = el.dataset.cat; 
            renderShopPage(); 
        });
    });
}

function renderSalesPage() {
    if (!products.length) {
        document.getElementById('mainContent').innerHTML = '<div style="text-align:center; padding:50px">Загрузка...</div>';
        return;
    }
    const saleProducts = products.filter(p => p.sale === true);
    let html = `<h2 class="section-title">🔥 Акции</h2><div class="products-grid">${saleProducts.length ? saleProducts.map(p => renderProductCard(p)).join('') : '<div style="text-align:center;padding:50px">Нет товаров по акции</div>'}</div>`;
    document.getElementById('mainContent').innerHTML = html;
}

function renderCartPage() {
    if (!cart.length) { 
        document.getElementById('mainContent').innerHTML = `
            <div style="min-height: 60vh; display: flex; align-items: center; justify-content: center;">
                <div class="empty-cart">🛒 Корзина пуста</div>
            </div>
        `; 
        return; 
    }
    
    let total = getCartTotal();
    const currentRangeLabel = currentPriceRange ? getRangeLabel(currentPriceRange) : 'не выбран';
    
    let html = `<h2 class="section-title">🛒 Корзина</h2>`;
    html += `<div class="range-notification">📊 Текущий ценовой диапазон корзины: <strong>${currentRangeLabel}</strong><br>💰 Сумма корзины: ${total} ₽</div>`;
    html += `<div class="cart-items-list">`;
    
    cart.forEach((item, idx) => {
        const itemTotal = item.price * item.quantity;
        const appliedRangeLabel = item.appliedRange ? getRangeLabel(item.appliedRange) : (item.priceRangeKey ? getRangeLabel(item.priceRangeKey) : currentRangeLabel);
        
        html += `
            <div class="cart-item">
                <div class="cart-item-info">
                    <div class="cart-item-title">${escapeHtml(item.name)}</div>
                    <div class="cart-item-price">${item.price}₽ × ${item.quantity} = ${itemTotal}₽</div>
                    <div class="cart-item-details">
                        ${item.selectedRange ? `Выбранный диапазон: ${item.selectedRange}<br>` : ''}
                        <small>📊 Диапазон корзины: ${appliedRangeLabel}</small>
                        ${item.selectedVariant ? `<br>🎨 ${escapeHtml(item.selectedVariant)}` : ''}
                    </div>
                </div>
                <div class="cart-item-controls">
                    <button class="quantity-btn" data-idx="${idx}" data-delta="-1">−</button>
                    <span>${item.quantity}</span>
                    <button class="quantity-btn" data-idx="${idx}" data-delta="1">+</button>
                    <button class="remove-item" data-idx="${idx}">🗑️</button>
                </div>
            </div>
        `;
    });
    html += `</div><div class="cart-total"><h3>Итого: ${total}₽</h3><button class="checkout-btn" id="checkoutBtn">✅ Оформить заказ</button></div>`;
    document.getElementById('mainContent').innerHTML = html;
    
    document.querySelectorAll('.quantity-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const idx = parseInt(btn.dataset.idx);
            const delta = parseInt(btn.dataset.delta);
            const newQty = cart[idx].quantity + delta;
            if (newQty <= 0) cart.splice(idx, 1);
            else cart[idx].quantity = newQty;
            saveCart();
            
            const wasUpdated = checkAndUpdateRangeByTotal();
            if (wasUpdated) {
                alert(`📊 Сумма корзины изменилась. Цены пересчитаны для диапазона ${getRangeLabel(currentPriceRange)}`);
            }
            renderCartPage();
            updateCartBadge();
            if (currentPage === 'shop') renderShopPage();
        });
    });
    
    document.querySelectorAll('.remove-item').forEach(btn => {
        btn.addEventListener('click', () => { 
            cart.splice(parseInt(btn.dataset.idx), 1); 
            saveCart(); 
            checkAndUpdateRangeByTotal();
            renderCartPage(); 
            updateCartBadge();
            if (currentPage === 'shop') renderShopPage();
        });
    });
    
    const checkoutBtn = document.getElementById('checkoutBtn');
    if (checkoutBtn) {
        checkoutBtn.addEventListener('click', openCheckoutForm);
    }
}

function renderContactsPage() {
    const phone = shopConfig.contactPhone || "+7 (999) 123-45-67";
    
    let managerInfo = '';
    if (isManagerMode) {
        managerInfo = `
            <div class="manager-panel">
                <div class="manager-header">🔧 Режим менеджера активен</div>
                <div class="manager-actions">
                    <button onclick="saveAllToGitHub()" class="manager-save-btn">💾 Сохранить все изменения на GitHub</button>
                    <button onclick="exitManagerMode()" class="manager-exit-btn">🔒 Выйти из режима менеджера</button>
                </div>
                <p class="manager-hint">Совет: нажмите "Сохранить" после изменения цен на товарах</p>
            </div>
        `;
    }
    
    document.getElementById('mainContent').innerHTML = `
        <div class="contacts-page">
            <h2 class="section-title">📞 Контакты</h2>
            <div class="contact-phone">${phone}</div>
            <p>Свяжитесь с нами любым удобным способом</p>
            <p style="margin-top:20px; color:#888">Работаем ежедневно 10:00-21:00</p>
            ${managerInfo}
        </div>
    `;
}

// ============ МОДАЛЬНОЕ ОКНО ТОВАРА ============
function openProductModal(product) {
    currentProduct = product;
    selectedRange = null;
    selectedPrice = null;
    selectedVariant = null;
    selectedQuantity = 1;
    
    const variantInfo = getVariantType(product);
    const rangeMap = {
        '3000-10000': '3 000 - 10 000 ₽',
        '10000-30000': '10 000 - 30 000 ₽',
        '30000-50000': '30 000 - 50 000 ₽',
        '50000-100000': '50 000 - 100 000 ₽',
        '100000-999999': '100 000+ ₽'
    };
    
    let rangesHtml = '<div class="range-options">';
    if (product.priceRanges) {
        for (const range of priceRangesConfig) {
            const price = product.priceRanges[range.key];
            if (price !== undefined && price > 0) {
                rangesHtml += `<button class="range-btn" data-range="${range.key}" data-price="${price}">${rangeMap[range.key]} — ${price}₽/шт</button>`;
            }
        }
    }
    rangesHtml += '</div>';
    
    let variantsHtml = '';
    if (variantInfo) {
        variantsHtml = `<div id="step2Container" style="display:none;">
            <div class="step-title"><span class="step-number">2</span> ${variantInfo.label}</div>
            <div class="variants-grid" id="variantsGrid">
                ${variantInfo.items.map(v => `<button class="variant-option" data-variant="${v}">${v}</button>`).join('')}
            </div>
        </div>`;
    }
    
    const modal = document.getElementById('modalOverlay');
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <button class="back-modal-btn" id="backModalBtn">← Назад</button>
                <h3 id="modalTitle">${product.name}</h3>
                <button class="close-modal" onclick="closeModal()">×</button>
            </div>
            <div class="modal-body">
                <img src="${product.photo || 'https://placehold.co/300x200/eee/999?text=No+Image'}" class="modal-image" onerror="this.src='https://placehold.co/300x200/eee/999?text=No+Image'">
                <p style="color:#666; margin-bottom:10px;">${product.description || ''}</p>
                <div id="step1Container">
                    <div class="step-title"><span class="step-number">1</span> Выберите сумму заказа</div>
                    ${rangesHtml}
                </div>
                ${variantsHtml}
                <div id="quantityContainer" style="display:none;">
                    <div class="step-title"><span class="step-number">3</span> Выберите количество</div>
                    <div class="quantity-selector">
                        <label>Количество:</label>
                        <div class="quantity-controls">
                            <button class="quantity-btn-modal" id="decreaseQty">−</button>
                            <span class="quantity-value" id="quantityValue">1</span>
                            <button class="quantity-btn-modal" id="increaseQty">+</button>
                        </div>
                    </div>
                    <div class="total-amount" id="totalAmount">
                        Итого: <span id="totalSum">0</span> ₽
                    </div>
                </div>
                <button class="add-to-cart-btn disabled" id="addToCartBtn">⬅️ Сначала выберите сумму</button>
            </div>
        </div>
    `;
    modal.style.display = 'block';
    
    const backBtn = document.getElementById('backModalBtn');
    if (backBtn) {
        backBtn.onclick = () => {
            closeModal();
        };
    }
    
    function updateTotalDisplay() {
        const totalSpan = document.getElementById('totalSum');
        if (totalSpan && selectedPrice) {
            totalSpan.textContent = selectedPrice * selectedQuantity;
        } else if (totalSpan) {
            totalSpan.textContent = '0';
        }
    }
    
    function resetVariantSelection() {
        selectedVariant = null;
        const variantBtns = document.querySelectorAll('.variant-option');
        variantBtns.forEach(btn => btn.classList.remove('selected'));
        
        const addBtn = document.getElementById('addToCartBtn');
        addBtn.textContent = '⬅️ Сначала выберите сумму';
        addBtn.classList.add('disabled');
        
        const quantityContainer = document.getElementById('quantityContainer');
        if (quantityContainer) quantityContainer.style.display = 'none';
    }
    
    function setupQuantityButtons() {
        const decreaseBtn = document.getElementById('decreaseQty');
        const increaseBtn = document.getElementById('increaseQty');
        const quantitySpan = document.getElementById('quantityValue');
        
        if (decreaseBtn && increaseBtn && quantitySpan) {
            const newDecreaseBtn = decreaseBtn.cloneNode(true);
            const newIncreaseBtn = increaseBtn.cloneNode(true);
            decreaseBtn.parentNode.replaceChild(newDecreaseBtn, decreaseBtn);
            increaseBtn.parentNode.replaceChild(newIncreaseBtn, increaseBtn);
            
            newDecreaseBtn.onclick = () => {
                if (selectedQuantity > 1) {
                    selectedQuantity--;
                    quantitySpan.textContent = selectedQuantity;
                    updateTotalDisplay();
                }
            };
            newIncreaseBtn.onclick = () => {
                selectedQuantity++;
                quantitySpan.textContent = selectedQuantity;
                updateTotalDisplay();
            };
        }
        updateTotalDisplay();
    }
    
    document.querySelectorAll('.range-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            document.querySelectorAll('.range-btn').forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
            
            const newRange = btn.dataset.range;
            const newPrice = parseInt(btn.dataset.price);
            
            if (selectedRange !== newRange) {
                selectedRange = newRange;
                selectedPrice = newPrice;
                resetVariantSelection();
            } else {
                selectedRange = newRange;
                selectedPrice = newPrice;
            }
            
            const variantInfo2 = getVariantType(product);
            if (variantInfo2) {
                document.getElementById('step1Container').style.opacity = '0.5';
                const step2Container = document.getElementById('step2Container');
                if (step2Container) {
                    step2Container.style.display = 'block';
                    step2Container.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
                document.getElementById('addToCartBtn').textContent = '⬅️ Выберите вариант';
                document.getElementById('addToCartBtn').classList.add('disabled');
            } else {
                document.getElementById('step1Container').style.opacity = '0.5';
                const quantityContainer = document.getElementById('quantityContainer');
                if (quantityContainer) quantityContainer.style.display = 'block';
                document.getElementById('addToCartBtn').textContent = '🛒 Добавить в корзину';
                document.getElementById('addToCartBtn').classList.remove('disabled');
                setupQuantityButtons();
            }
        });
    });
    
    if (variantInfo) {
        setTimeout(() => {
            document.querySelectorAll('.variant-option').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    document.querySelectorAll('.variant-option').forEach(b => b.classList.remove('selected'));
                    btn.classList.add('selected');
                    selectedVariant = btn.dataset.variant;
                    
                    const quantityContainer = document.getElementById('quantityContainer');
                    if (quantityContainer) quantityContainer.style.display = 'block';
                    
                    document.getElementById('addToCartBtn').textContent = '🛒 Добавить в корзину';
                    document.getElementById('addToCartBtn').classList.remove('disabled');
                    setupQuantityButtons();
                });
            });
        }, 50);
    }
    
    const addBtn = document.getElementById('addToCartBtn');
    addBtn.onclick = () => {
        if (!selectedRange) { 
            alert('Сначала выберите сумму заказа'); 
            return; 
        }
        const variantInfo3 = getVariantType(product);
        if (variantInfo3 && !selectedVariant) { 
            alert('Выберите вариант'); 
            return; 
        }
        
        cart.push({
            id: product.id,
            name: product.name,
            price: selectedPrice,
            selectedRange: getRangeLabel(selectedRange),
            selectedVariant: selectedVariant || null,
            quantity: selectedQuantity,
            priceRangeKey: selectedRange
        });
        
        saveCart();
        
        const wasUpdated = checkAndUpdateRangeByTotal();
        
        if (wasUpdated) {
            alert(`✅ Товар добавлен!\n\n📊 Ваша корзина теперь в диапазоне ${getRangeLabel(currentPriceRange)}. Цены пересчитаны.`);
        } else {
            alert('✅ Товар добавлен в корзину');
        }
        
        closeModal();
        if (currentPage === 'cart') renderCartPage();
        updateCartBadge();
    };
}

function closeModal() {
    const modal = document.getElementById('modalOverlay');
    if (modal) {
        modal.style.display = 'none';
        modal.innerHTML = '';
    }
}

// ============ ЗАПУСК ============
loadData();
