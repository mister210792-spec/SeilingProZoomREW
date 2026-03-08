// js/auth.js

const Auth = {
    toggleAuthForms: function() {
        const isLogin = document.getElementById('login-form').style.display !== 'none';
        document.getElementById('login-form').style.display = isLogin ? 'none' : 'block';
        document.getElementById('reg-form').style.display = isLogin ? 'block' : 'none';
    },

    selectPlan: function(plan) {
        window.selectedRegPlan = plan;
        document.getElementById('p-free').classList.toggle('active', plan === 'free');
        document.getElementById('p-pro').classList.toggle('active', plan === 'pro');
    },

    handleLogin: function() {
        const email = document.getElementById('email').value;
        const pass = document.getElementById('pass').value;

        if(!email || !pass) { 
            alert("Введите email и пароль"); 
            return; 
        }
        
        if (!window.auth) { 
            alert("Сервис входа временно недоступен. Пожалуйста, обновите страницу."); 
            console.error("❌ auth не инициализирован");
            return; 
        }

        console.log("🔄 Попытка входа...");

        window.auth.signInWithEmailAndPassword(email, pass)
            .then((userCredential) => {
                console.log("✅ Вход выполнен:", userCredential.user.email);
            })
            .catch((error) => {
                console.error("❌ Ошибка входа:", error);
                let errorMessage = "Ошибка входа: ";
                if (error.code === 'auth/user-not-found') {
                    errorMessage += "Пользователь не найден.";
                } else if (error.code === 'auth/wrong-password') {
                    errorMessage += "Неверный пароль.";
                } else if (error.code === 'auth/network-request-failed') {
                    errorMessage += "Проблема с интернет-соединением.";
                } else {
                    errorMessage += error.message;
                }
                alert(errorMessage);
            });
    },

    handleRegister: function() {
        const name = document.getElementById('reg-name').value;
        const email = document.getElementById('reg-email').value;
        const pass = document.getElementById('reg-pass').value;
        const plan = window.selectedRegPlan;

        if(!name || !email || !pass) { 
            alert("Заполните все поля"); 
            return; 
        }

        if (!window.auth || !window.db) { 
            alert("Сервис регистрации временно недоступен. Пожалуйста, обновите страницу."); 
            console.error("❌ auth или db не инициализированы");
            return; 
        }

        console.log("🔄 Регистрация...");

        window.auth.createUserWithEmailAndPassword(email, pass)
            .then((userCredential) => {
                const user = userCredential.user;
                
                return user.updateProfile({
                    displayName: name
                }).then(() => {
                    const userData = {
                        name: name,
                        email: email,
                        plan: plan === 'pro' ? 'pending' : 'free',
                        registeredAt: firebase.firestore.FieldValue.serverTimestamp()
                    };

                    if (plan === 'pro') {
                        userData.subscription = {
                            status: 'pending',
                            startDate: null,
                            endDate: null,
                            autoRenew: false,
                            createdAt: firebase.firestore.FieldValue.serverTimestamp()
                        };
                    }

                    return window.db.collection('users').doc(user.uid).set(userData);
                }).then(() => {
                    console.log("✅ Аккаунт создан");
                    
                    if (plan === 'free') {
                        console.log("✅ Вход выполнен");
                    } else if (plan === 'pro') {
                        const userId = user.uid;
                        const userEmail = email;
                        const telegramLink = `/start link_${userId}_${userEmail}`;
                        
                        // Вместо signOut, показываем уведомление поверх
                        const notification = document.createElement('div');
                        notification.style.cssText = `
                            position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
                            background: white; padding: 25px; border-radius: 15px;
                            box-shadow: 0 10px 40px rgba(0,0,0,0.3); z-index: 10001;
                            text-align: center; max-width: 350px;
                        `;
                        notification.innerHTML = `
                            <h2 style="color: var(--dark); margin-top: 0;">✅ Аккаунт создан!</h2>
                            <p style="margin: 15px 0;">Для активации PRO-тарифа отправьте эту команду боту:</p>
                            <code style="background: #f5f5f5; padding: 10px; border-radius: 8px; display: block; margin: 15px 0; word-break: break-all;">
                                ${telegramLink}
                            </code>
                            <button onclick="window.copyToClipboard('${telegramLink}')" 
                                    style="background: #4caf50; color: white; border: none; padding: 10px 20px; border-radius: 8px; cursor: pointer; margin: 5px;">
                                📋 Копировать
                            </button>
                            <button onclick="window.open('https://t.me/CeilingPlanPRO_Bot', '_blank')" 
                                    style="background: #0088cc; color: white; border: none; padding: 10px 20px; border-radius: 8px; cursor: pointer; margin: 5px;">
                                💎 Открыть Telegram
                            </button>
                            <button onclick="this.parentElement.remove()" 
                                    style="background: #eee; border: none; padding: 8px 15px; border-radius: 8px; cursor: pointer; margin-top: 15px;">
                                ✖️ Закрыть
                            </button>
                        `;
                        document.body.appendChild(notification);
                    }
                });
            })
            .catch((error) => {
                console.error("❌ Ошибка регистрации:", error);
                let errorMessage = "Ошибка регистрации: ";
                if (error.code === 'auth/email-already-in-use') {
                    errorMessage += "Этот email уже используется.";
                } else if (error.code === 'auth/weak-password') {
                    errorMessage += "Пароль слишком слабый (минимум 6 символов).";
                } else if (error.code === 'auth/network-request-failed') {
                    errorMessage += "Проблема с интернет-соединением.";
                } else {
                    errorMessage += error.message;
                }
                alert(errorMessage);
            });
    },

    handleLogout: function() {
        if(confirm("Выйти из системы?")) {
            if (window.auth) {
                window.auth.signOut().then(() => {
                    location.reload();
                }).catch(console.error);
            } else {
                localStorage.removeItem('saas_last_user');
                location.reload();
            }
        }
    },

    copyToClipboard: function(text) {
        navigator.clipboard.writeText(text).then(() => {
            const notification = document.createElement('div');
            notification.style.cssText = `
                position: fixed; top: 20px; left: 50%; transform: translateX(-50%);
                background: #4caf50; color: white; padding: 12px 24px;
                border-radius: 30px; font-weight: bold; z-index: 10001;
                box-shadow: 0 4px 15px rgba(0,0,0,0.2);
            `;
            notification.textContent = '✅ Команда скопирована!';
            document.body.appendChild(notification);
            
            setTimeout(() => notification.remove(), 2000);
        }).catch(() => {
            alert('Скопируйте команду вручную:\n\n' + text);
            
            const textarea = document.createElement('textarea');
            textarea.value = text;
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);
            
            alert('✅ Команда скопирована!');
        });
    },

    linkTelegram: function() {
        if (!window.currentUser || !window.currentUser.uid) {
            alert("Сначала войдите в систему");
            return;
        }
        
        const uid = window.currentUser.uid;
        const email = window.currentUser.email || '';
        const command = `/start link_${uid}_${email}`;
        
        navigator.clipboard.writeText(command).then(() => {
            window.open('https://t.me/CeilingPlanPRO_Bot', '_blank');
            
            const notification = document.createElement('div');
            notification.style.cssText = `
                position: fixed; top: 20px; left: 50%; transform: translateX(-50%);
                background: #4caf50; color: white; padding: 12px 24px;
                border-radius: 30px; font-weight: bold; z-index: 10000;
                box-shadow: 0 4px 15px rgba(0,0,0,0.2);
            `;
            notification.textContent = '✅ Команда скопирована! Вставьте в Telegram';
            document.body.appendChild(notification);
            
            setTimeout(() => notification.remove(), 3000);
        }).catch(() => {
            alert(`Отправьте эту команду в Telegram:\n\n${command}`);
            window.open('https://t.me/CeilingPlanPRO_Bot', '_blank');
        });
    }
};

// Экспорт в глобальную область
window.Auth = Auth;
window.copyToClipboard = Auth.copyToClipboard;