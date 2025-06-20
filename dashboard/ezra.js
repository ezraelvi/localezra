// dashboard/ezra.js

class BioVAuth {
    constructor() {
        this.env = {
            WORKER_URL: 'https://auth-logs.ezvvel.workers.dev/',
            RATE_LIMIT_WINDOW: 5 * 60 * 1000,
            RATE_LIMIT_MAX_ATTEMPTS: 5
        };
        this.elements = {
            scanLine: document.getElementById('scanLine'),
            status: document.getElementById('status'),
            btnContainer: document.getElementById('btnContainer'),
            loginForm: document.getElementById('loginForm'),
            fallbackBtn: document.getElementById('fallbackBtn'),
            visitBtn: document.getElementById('visitBtn'),
            webauthnBtn: document.getElementById('webauthnBtn'),
            emailInput: document.getElementById('email'),
            passwordInput: document.getElementById('password'),
            submitLogin: document.getElementById('submitLogin'),
            loadingSpinner: document.getElementById('loadingSpinner'),
            errorMsg: document.getElementById('errorMsg'),
            ipDisplay: document.getElementById('ipDisplay'),
            togglePassword: document.querySelector('.toggle-password'),
            webauthnUnsupported: document.getElementById('webauthnUnsupported'),
            // Tambahkan elemen untuk popup Ezra
            ezraLink: document.getElementById('ezraLink'),
            ezraProfilePopup: document.getElementById('ezraProfilePopup'),
            biometricScan: document.querySelector('.biometric-scan'), // Mengambil elemen mix.svg

            // Elemen untuk fitur "Your" popup
            yourText: document.getElementById('yourText'),
            yourPopupContainer: document.getElementById('yourPopupContainer'),
            secretWordInput: document.getElementById('secretWordInput'),
            submitSecretWord: document.getElementById('submitSecretWord'),
            closeSecretWordPopup: document.getElementById('closeSecretWordPopup'),
            secretPhoto: document.querySelector('.secret-photo'),
            // Tombol cancel login
            cancelLoginBtn: document.getElementById('cancelLoginBtn'),
            // Overlay background
            backgroundTextOverlay: document.getElementById('backgroundTextOverlay')
        };
        this.securityConfig = {
            maxAttempts: 3,
            blockDuration: 5 * 60 * 1000,
            cookieName: 'bioVAuthSecurity',
            localStorageKey: 'isEzraLoggedIn'
        };
        this.state = {
            webauthnSupported: false,
            clientInfo: {},
            isDesktop: false // Tambahkan state untuk deteksi desktop
        };

        this.pressTimer = null; // Inisialisasi timer untuk tahan Ezra
        this.PRESS_DURATION = 500; // Durasi tahan (milidetik)
        this.SECRET_WORD = "jadi salting"; // Secret word untuk popup "Your"

        this.chatMessages = [
            "👋", "jgn buat aku penasaran lagi ya, jadi jadilah dirimu seperti sebelum aku chat km, sebelum kenal aku",
            "BTW, kalo preferensi boidata mu yg bs kusimpulakan ialah ( meskipun km gk tanya );1. km cantik cantik bgt, sampe aku tertarik, 2. km itu orgnya baik bgt, karna bisa mengedepankan ambisi org lain daripada perasaanmu sebernarnya, meskipun blkng ini mulai pudar, 3. km itu potensinya bagus, dari sikap yg km displinkan, km lebih cocoknya kian bisa jd pramugari, farmasi bagian obt, atau mgikuti impianmu (tapi berdasarkan kemampuan mu juga baik materi, atopun akdemismu dan persetujuan ortu), itu menurutku",
            "Rasa cukup ini akan menjadi tanda bahwa, kita (aku) akan menutup operasi chatan ini, aku akan menganggap km asing, sebagai upayaku melepaskan mu sebagai narasumber ku",
            "sudah saatnya aku menindaki dunia ini lebih facktual, dan mendasarinya dengan kuasa Tuhan, itu jauh lebih baik dan itu yg Tuhan minta",
            "makasi vi, jadi teman chat yg menyenangkan sih buat ku, dan aneh buatmu", "jadi",
            "bisa ajanya aku curhat sama yg lain, tapi orang lain begitu dominansi untukku, jadi disini lah aku bisa melimpahkan yg kurasakan saat ini",
            "aminn", "ya Tuhan aku harap aku lepas dari masa² sperti ini, cukup lah kegabutannku, cukupkanlah juga pemahaman ku akan dunia ini",
            "dan cukup jugalah rasa penasaran ku akan bgaimana diriku, dan prasaanmu", "okelah kurasa udah cukuplah semua info ini untukku",
            "hmmmm", "kayaknya km mmng bosan yaa", "atau disuruh", "atau bosan", "dah ngantuk kah",
            "2. mimpi ² elvi kekmana panya, perang, atu kayak lagi sekolah, atu jln² atau masa lalu?",
            "ooo", "ngk pernah kayaknya", "1. pernah gk aku hadir dimimpimu?, kalo pernah brp x",
            "pertanyaan ini agak psikologis dikit ya", "oooo", "lipat baju", "biasanya disuruh ngapain aja sih??",
            "adaaa", "wah gilak², kalo disuruh² gitu ada??", "kadang belajar dan kadang jg main tiktok",
            "5. spill kan dulu kegiatanmu, khusus km aja dimlm hri mulai dari jam 7 sampai jam 10 mlm, ngapain aja penasaran aku??, misalnya di suruh ini, belajar, atu main tiktok sampe dpt ujungnya",
            "ouh", "udahh", "4. apa km diumur segini udah serius memikirkan masa dpn?? misal, udah pernah dibahas masa depanmu di depan keluargamu pas lagi ngumpul??",
            "okey, i come back", "Iyaa", "bntar", "iyaaaa",
            "salah 1 upaya yg km lakukan apakah dengan berdandan untuk mulai mengejarnya?? (edited)",
            "salah 1 upaya yg km lakukan apakah dengan berdandan ( km kan kayknya lebih cantik kl berdanda ) sekarang sih menurutku",
            "ouhh", "Enggak jg sih", "bahkan jika km begitu menginginkannya??", "Iya lah aku nyerahh",
            "3. jadi misal ada cowok populer dan ganteng, ( km udah umur 22 thn misalnya ), trus km suka dia, hbs itu km tau ada yg lain suka samnya dan lebih agresif darimu, km nyerah aja gitu, dan lepasin?? ( ini aku mau bhs soal percintaan dulu, soal ms depan kpn kpn )",
            "oalahh", "akukan ninja", "hmpir setiap pergerakanmu aku liati", "km fine² aja gitu",
            "masa sih, aku liat km kalem aja kayk percaya diri gitunya, dan gk ada masalh yg membebanimu",
            "Iya serius", "seriusssss !?", "Iya",
            "serius km bilang km lemahh?? kamu memang merasa km itu lemah dibandingkan sekitar mu gitu??",
            "Iya aku memang lemah", "lemahnya ahh", "ngk bisaaa", "2 stengah tahun kemudian",
            "dah tua aku, pnsaran aku kekmana dirikibdari salah 1 aspek",
            "dari hati yg murniiii, lepaskan semha ktakutan mu", "jwb lah coyy", "iya coy",
            "hmpir stengah tahun coyy, nicee sih", "2. kenapa banyak pertannyaan kyk gini gk bisa km jawab??",
            "Ngk bisaa ku jawab", "itu aja lah dulu, jawab yaa bre", "tunngu agak bnyak aku maunnayk lagi",
            "1. aku tipe cowok yg kekman mnurutmu setelah berlama lama kita chatan??",
            "heheh", "blummm", "iya, trus", "apa yaa pertama", "bolehh",
            "vi aku mulai bertanya tanya boleh ya", "okey", "ngk tau lucu aja gitu", "knp mnurutmu aku lucu??",
            "hehe arigato", "iyaaaaa", "kalo lucu, kasilah dulu waktumu untuk temani aku yaa, chatan",
            "lucu banget malahan", "hehe lucu kali kurasa leh aku ini", "lah kok bingung",
            "bingung aku bree", "kan gini bree", "apanya yg bisa", "jadi, kekmana brei, bisa bre?",
            "karena aku mencintaimu elvi", "Knp", "❤️", "Iyaa", "elvi", "Iyaa", "elvi", "Iyelah tuu",
            "takpelah", "Ngk tau aku, lupaa", "siapa musik skm di warta kmrin viiii", "= begitu ya, sedih",
            "= iya", "Ngk tau", "soka, 😟", "haikk", "iya jg sih", "siapa, akuu",
            "entalah, kurang yakin aku dia mau", "eee orangnya yang ninggalin aku pas nungguin chat tdi malam",
            "iyaa", "Maaf yaaa", "Emang siapa rupanya", "Coba aja",
            "km gitulah kalo mau off gk bilang, kasian org nungguin (edited)",
            "km gitulah kalo mau off bilang, kasian org nungguin", "lalap bilangnya blum siap aku",
            "Tapi takut aku ditolaknya, kekmana itu",
            "Kek gini, sebenarnya aku dah lama suka samamu, hmm km mau ngk jadi pacar ku gituu",
            "cara nembak cewe gimana vi?", "uhh gitu", "Dia jrang da cerita",
            "apa, apa lah yg km tau kl gitu", "Yaa tau lah", "ai cemananya ko ini vi, abg mu yh terbaik gk km tau ceritanya/dia",
            "Yaa ngk tau", "knp gk tau", "Ngk tau", "abg mu jadi tes tentara dia?", "Udah",
            "kerjaan/belajar udah siap?", "Lagi ddk", "lagi ngapain", "elvi", "kalau ngk begitu, ya begitu",
            "memang begitu", "yaaa begitulah manusia", "hm", "enggak",
            "awas diculik org km nanti gara² pp mu itu daaa, nanti gk ad lagi cewekku (edited)",
            "awas diculik org km nanti gara² pp itu daaa, nanti gk ad lagi cewekku (edited)",
            "awas diculik org km nanti gara² pp itu daaa", "dan knp km gk ngasi no wa mu samaku?? kenapa",
            "for your new pp = 😍", "btw, kalo misal nanti ada cowok yg suka samamu di dunia nyata atau maya gimana tindakan km??",
            "untuk apa cintaku??, dah ku hapus kemarin cinta, malas aku main fb", "apa nama fbmu",
            "yaudah deh", "percaya kok", "malamm", "gk apaa, percaya juga km samaku?? (edited)",
            "gk apaa, percaya juga kmsamaku?? (edited)", "kalo malu knp di post??, itu namanya org lain km kasi tengok aku enggak",
            "gk apaa, percaya juga ko samaku??", "iya cubit ajaa, gpp itu", "jangan ko tengok² fbku malu aku",
            "cubit aja", "apanya", "oalahh", "jadi gimana vi?", "feeling ku aja pasti namanya mirip sam ig nya, jadi gitulah ketemu",
            "yappp", "cubit muncung nya itu vi, klo bilangnua km gk cantik", "tapi knp ko bisa tau namaku",
            "ouh ok", "ouh gitu yaa", "wkwkkw ntah, berat memang samaku vi, tapi the true mengejarmu itu adalah first time bagiku",
            "kebetulan aku perlu fb jadi ku buat, trus aku liat akun km, disitulah aku cemburu vii",
            "ohh", "emang bisaa", "kok tau, ngk bisa di hapus itu", "adaa", "biar aku aja yg jagain km"
        ].join(' '); // Gabungkan semua pesan menjadi satu string
    }

    async init() {
        this.detectDesktopSite(); // Panggil deteksi desktop site
        this.startBiometricAnimation();
        await this.collectClientInfo();
        this.setupEventListeners();
        this.setupEzraPopupEventListeners(); // Panggil method baru untuk popup Ezra
        this.setupYourPopupEventListeners(); // Panggil method baru untuk popup "Your"
        this.checkWebAuthnSupport();
        this.securitySystem = new SecuritySystem(
            this.securityConfig.maxAttempts,
            this.securityConfig.blockDuration,
            this.securityConfig.cookieName
        );
    }

    detectDesktopSite() {
        // Deteksi apakah user agent menunjukkan desktop (tidak ada indikasi mobile)
        // Ini adalah deteksi sederhana dan bisa ditingkatkan
        const userAgent = navigator.userAgent.toLowerCase();
        const mobileRegex = /(android|bb\d+|meego).+mobile|avantgo|bada\/|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(hone|od)|iris|kindle|lge |maemo|midp|mmp|mobile.+firefox|netfront|opera m(ob|in)i|palm( os)?|phone|p(ixi|rim)|plucker|pocket|psp|series(4|6)0|symbian|treo|up\.(browser|link)|vodafone|wap|windows ce|xda|xiino/i;
        const tabletRegex = /android|ipad|playbook|silk/i;

        if (!(mobileRegex.test(userAgent) || tabletRegex.test(userAgent))) {
            this.state.isDesktop = true;
            console.log("Desktop site detected.");
        } else {
            this.state.isDesktop = false;
            console.log("Mobile/Tablet site detected.");
        }
    }

    async collectClientInfo() {
        try {
            const controller = new AbortController();
            const id = setTimeout(() => controller.abort(), 3000);
            const ipResponse = await fetch('https://api.ipify.org?format=json', { signal: controller.signal });
            clearTimeout(id);
            if (!ipResponse.ok) {
                throw new Error(`HTTP error! status: ${ipResponse.status}`);
            }
            const ipData = await ipResponse.json();
            this.state.clientInfo = {
                ip: ipData.ip,
                userAgent: navigator.userAgent,
                platform: navigator.platform,
                timestamp: new Date().toISOString(),
                screenResolution: `${window.screen.width}x${window.screen.height}`,
                language: navigator.language
            };
            this.elements.ipDisplay.textContent = `IP: ${ipData.ip} • ${navigator.platform}`;
        } catch (error) {
            console.error('Error collecting client info:', error);
            this.state.clientInfo = {
                ip: 'unavailable',
                userAgent: navigator.userAgent,
                platform: navigator.platform || 'unknown',
                timestamp: new Date().toISOString(),
                screenResolution: `${window.screen.width}x${window.screen.height}`,
                language: navigator.language || 'unknown'
            };
            this.elements.ipDisplay.textContent = 'Network: Secure • Private';
        }
    }

    startBiometricAnimation() {
        this.elements.scanLine.style.opacity = '1';
        // Perubahan pesan status berdasarkan deteksi desktop
        const statusMessage = this.state.isDesktop ?
            'System ready.' :
            'System ready, for better experience, it is recommended to use desktop site.';
        this.updateStatus('Initializing security protocols...', 'info');
        setTimeout(() => {
            this.elements.scanLine.style.opacity = '0';
            this.updateStatus(statusMessage, 'success');
            this.elements.btnContainer.style.display = 'flex';
        }, 2000);
    }

    updateStatus(message, type = 'info') {
        this.elements.status.textContent = message;
        this.elements.status.className = 'status';
        if (type) this.elements.status.classList.add(type);
    }

    setupEventListeners() {
        this.elements.fallbackBtn.addEventListener('click', () => {
            this.showLoginForm();
        });
        this.elements.visitBtn.addEventListener('click', () => {
            window.location.href = 'dashboard/index.html';
        });
        this.elements.webauthnBtn.addEventListener('click', () => {
            if (this.state.webauthnSupported) {
                this.initiateWebAuthn();
            } else {
                this.elements.webauthnUnsupported.style.display = 'block';
            }
        });
        this.elements.loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleLogin();
        });
        this.elements.togglePassword.addEventListener('click', () => {
            this.togglePasswordVisibility();
        });
        // Event listener untuk tombol Cancel
        this.elements.cancelLoginBtn.addEventListener('click', () => {
            this.hideLoginForm();
        });
    }

    // --- Start of Ezra Popup Specific Methods ---
    setupEzraPopupEventListeners() {
        const { ezraLink, ezraProfilePopup, biometricScan, securityInfo } = this.elements;

        if (ezraLink && ezraProfilePopup && biometricScan && securityInfo) {
            // Fungsi untuk menampilkan popup dan memposisikannya
            const showEzraPopup = () => {
                // Dapatkan posisi elemen `security-info`
                const rect = securityInfo.getBoundingClientRect();

                // Hitung posisi popup Ezra: di bawah `security-info` dan di tengah horizontal
                // Ukuran popup Ezra: 80x80px (lebih kecil)
                const popupWidth = 80;
                const popupHeight = 80;

                // Posisi 'top' relatif terhadap `document`
                // Kita tambahkan rect.height untuk menempatkannya tepat di bawah security-info
                const topPos = rect.bottom + window.scrollY + 10; // 10px padding di bawah security-info
                // Posisi 'left' untuk menengahkan popup relatif terhadap `security-info`
                const leftPos = rect.left + window.scrollX + (rect.width / 2) - (popupWidth / 2);

                ezraProfilePopup.style.position = 'absolute';
                ezraProfilePopup.style.top = `${topPos}px`;
                ezraProfilePopup.style.left = `${leftPos}px`;
                ezraProfilePopup.style.width = `${popupWidth}px`;
                ezraProfilePopup.style.height = `${popupHeight}px`;

                ezraProfilePopup.classList.add('visible');

                // Efek blur pada mix.svg saat popup Ezra terlihat
                biometricScan.style.filter = 'blur(5px) brightness(0.5)';
            };

            // Fungsi untuk menyembunyikan popup
            const hideEzraPopup = () => {
                ezraProfilePopup.classList.remove('visible');
                // Mengembalikan filter mix.svg saat popup Ezra tersembunyi
                biometricScan.style.filter = 'drop-shadow(0 0 8px rgba(0, 255, 136, 0.3))';
            };

            ezraLink.addEventListener('click', (event) => {
                event.preventDefault();
                if (ezraProfilePopup.classList.contains('visible')) {
                    hideEzraPopup();
                } else {
                    showEzraPopup();
                }
            });

            // Menambahkan interaksi tahan (press and hold)
            ezraLink.addEventListener('mousedown', () => {
                this.pressTimer = setTimeout(showEzraPopup, this.PRESS_DURATION);
            });

            ezraLink.addEventListener('mouseup', () => {
                clearTimeout(this.pressTimer);
            });

            ezraLink.addEventListener('mouseleave', () => {
                clearTimeout(this.pressTimer);
            });

            ezraLink.addEventListener('touchstart', (event) => {
                event.preventDefault(); // Mencegah scrolling dan zoom default
                this.pressTimer = setTimeout(showEzraPopup, this.PRESS_DURATION);
            }, { passive: false }); // Mengatur passive ke false untuk mencegah default action

            ezraLink.addEventListener('touchend', () => {
                clearTimeout(this.pressTimer);
                // Biarkan popup tetap terbuka setelah touch jika sudah muncul
                // Atau bisa tambahkan logika untuk menutupnya jika disentuh lagi
            });

            ezraLink.addEventListener('touchcancel', () => {
                clearTimeout(this.pressTimer);
            });

            // Menyembunyikan popup jika klik di luar area popup atau link
            document.addEventListener('click', (event) => {
                if (ezraProfilePopup.classList.contains('visible') &&
                    !ezraLink.contains(event.target) &&
                    !ezraProfilePopup.contains(event.target)) {
                    hideEzraPopup();
                }
            });

            // Menyembunyikan popup saat esc ditekan
            document.addEventListener('keydown', (event) => {
                if (event.key === 'Escape' && ezraProfilePopup.classList.contains('visible')) {
                    hideEzraPopup();
                }
            });

            // Menangani perubahan ukuran jendela (misal saat rotasi layar atau resize browser)
            window.addEventListener('resize', () => {
                if (ezraProfilePopup.classList.contains('visible')) {
                    showEzraPopup(); // Perbarui posisi dan ukuran popup
                }
            });
        }
    }
    // --- End of Ezra Popup Specific Methods ---

    // --- Start of Your Popup Specific Methods ---
    setupYourPopupEventListeners() {
        const { yourText, yourPopupContainer, secretWordInput, submitSecretWord, closeSecretWordPopup, secretPhoto, backgroundTextOverlay } = this.elements;

        if (yourText && yourPopupContainer) {
            const showYourPopup = () => {
                const rect = yourText.getBoundingClientRect();

                // Posisi popup "Your": di sekitar kata "Your"
                const popupWidth = 250; // Lebar popup
                const popupHeight = 200; // Tinggi popup (akan disesuaikan konten)

                // Tengah horizontal relatif terhadap 'yourText'
                const leftPos = rect.left + window.scrollX + (rect.width / 2) - (popupWidth / 2);
                // Tepat di bawah 'yourText'
                const topPos = rect.bottom + window.scrollY + 5; // 5px padding di bawah "Your"

                yourPopupContainer.style.position = 'absolute';
                yourPopupContainer.style.top = `${topPos}px`;
                yourPopupContainer.style.left = `${leftPos}px`;
                yourPopupContainer.style.width = `${popupWidth}px`;
                // Tinggi akan diatur otomatis oleh konten, atau bisa diatur fixed
                // yourPopupContainer.style.height = `${popupHeight}px`;

                yourPopupContainer.classList.add('visible');
                secretWordInput.focus();
            };

            const hideYourPopup = () => {
                yourPopupContainer.classList.remove('visible');
                // Sembunyikan foto jika sebelumnya terlihat
                secretPhoto.style.display = 'none';
                // Reset input
                secretWordInput.value = '';
            };

            yourText.addEventListener('click', () => {
                if (yourPopupContainer.classList.contains('visible')) {
                    hideYourPopup();
                } else {
                    showYourPopup();
                }
            });

            submitSecretWord.addEventListener('click', () => {
                const enteredWord = secretWordInput.value.trim().toLowerCase();
                if (enteredWord === this.SECRET_WORD) {
                    this.activatePinkModeAndBackground();
                    this.updateStatus("Access Granted. Welcome to Elvii's inner world.", 'success');
                    secretPhoto.style.display = 'block'; // Tampilkan foto saat benar
                } else {
                    this.showError("Incorrect secret word.", yourPopupContainer); // Tampilkan error di popup
                }
            });

            closeSecretWordPopup.addEventListener('click', () => {
                hideYourPopup();
            });

            // Menyembunyikan popup jika klik di luar area popup atau link
            document.addEventListener('click', (event) => {
                if (yourPopupContainer.classList.contains('visible') &&
                    !yourText.contains(event.target) &&
                    !yourPopupContainer.contains(event.target)) {
                    hideYourPopup();
                }
            });

            // Menyembunyikan popup saat esc ditekan
            document.addEventListener('keydown', (event) => {
                if (event.key === 'Escape' && yourPopupContainer.classList.contains('visible')) {
                    hideYourPopup();
                }
            });

            // Menangani perubahan ukuran jendela (misal saat rotasi layar atau resize browser)
            window.addEventListener('resize', () => {
                if (yourPopupContainer.classList.contains('visible')) {
                    showYourPopup(); // Perbarui posisi dan ukuran popup
                }
            });
        }
    }

    activatePinkModeAndBackground() {
        document.body.classList.add('pink-mode');
        this.elements.backgroundTextOverlay.setAttribute('data-text', this.chatMessages);
        this.elements.backgroundTextOverlay.classList.add('active');

        // Untuk memastikan animasi dimulai dari awal setiap kali diaktifkan
        // Duplikat elemen atau paksa reflow
        const overlay = this.elements.backgroundTextOverlay;
        overlay.style.animation = 'none';
        overlay.offsetHeight; // Trigger reflow
        overlay.style.animation = null;
        overlay.querySelector('::before').style.animation = 'none';
        overlay.querySelector('::before').offsetHeight;
        overlay.querySelector('::before').style.animation = 'scroll-text 60s linear infinite';
    }
    // --- End of Your Popup Specific Methods ---

    checkWebAuthnSupport() {
        if (window.PublicKeyCredential) {
            PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
                .then((available) => {
                    this.state.webauthnSupported = available;
                    if (!available) {
                        this.elements.webauthnUnsupported.style.display = 'block';
                    }
                })
                .catch(() => {
                    this.state.webauthnSupported = false;
                    this.elements.webauthnUnsupported.style.display = 'block';
                });
        } else {
            this.state.webauthnSupported = false;
            this.elements.webauthnBtn.disabled = true;
            this.elements.webauthnUnsupported.style.display = 'block';
        }
    }

    showLoginForm() {
        this.elements.btnContainer.style.display = 'none';
        this.elements.loginForm.style.display = 'block';
        this.elements.emailInput.focus();
        this.updateStatus('Enter your credentials', 'info');
    }

    hideLoginForm() {
        this.elements.loginForm.style.display = 'none';
        this.elements.btnContainer.style.display = 'flex';
        this.updateStatus('System ready, is better if you use desktop site', 'success'); // Kembalikan status awal
        this.elements.errorMsg.textContent = ''; // Hapus pesan error
        this.elements.emailInput.value = ''; // Bersihkan input
        this.elements.passwordInput.value = '';
    }

    async handleLogin() {
        if (this.securitySystem.isBlocked()) {
            this.showBlockedMessage();
            return;
        }
        const username = this.elements.emailInput.value.trim().toLowerCase();
        const password = this.elements.passwordInput.value;

        if (!username || !password) {
            this.showError('Please fill in all fields (username and password).');
            return;
        }
        this.setLoadingState(true);
        try {
            const response = await fetch(this.env.WORKER_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Client-IP': this.state.clientInfo.ip,
                    'X-Client-UA': this.state.clientInfo.userAgent
                },
                body: JSON.stringify({ username: username, password: password })
            });
            const responseData = await response.json();
            if (responseData.authenticated) {
                localStorage.setItem(this.securityConfig.localStorageKey, 'true');
                this.securitySystem.resetAttempts();
                this.updateStatus('Authentication successful! Redirecting...', 'success');
                window.location.href = 'dashboard/index.html';
            } else {
                this.handleFailedLogin(responseData.message || 'Invalid username or password.');
            }
        } catch (error) {
            console.error('Login error (network or worker response parsing issue):', error);
            this.showError('Login failed: network issue or server error. Please try again.');
            this.securitySystem.recordFailedAttempt();
        } finally {
            this.setLoadingState(false);
        }
    }

    handleSuccessfulLogin(token, username) {
        localStorage.setItem(this.securityConfig.localStorageKey, 'true');
        this.securitySystem.resetAttempts();
        this.updateStatus('Authentication successful!', 'success');
        this.elements.errorMsg.textContent = '';
        window.location.href = 'dashboard/index.html';
    }

    handleFailedLogin(errorMessage) {
        this.securitySystem.recordFailedAttempt();
        const attemptsLeft = this.securitySystem.maxAttempts - this.securitySystem.attemptData.attempts;
        let displayMessage = `${errorMessage}`;

        if (attemptsLeft > 0) {
            displayMessage += ` (${attemptsLeft} ${attemptsLeft === 1 ? 'attempt' : 'attempts'} left)`;
        }
        this.showError(displayMessage);
        if (this.securitySystem.isBlocked()) {
            this.showBlockedMessage();
        }
        this.elements.passwordInput.value = '';
        this.elements.passwordInput.focus();
        this.elements.loginForm.classList.add('shake');
        setTimeout(() => {
            this.elements.loginForm.classList.remove('shake');
        }, 500);
    }

    showBlockedMessage() {
        const remainingTime = this.securitySystem.getRemainingBlockTime();
        const minutes = Math.floor(remainingTime / 60);
        const seconds = remainingTime % 60;
        this.showError(`Too many attempts. Please wait ${minutes}m ${seconds}s.`);
        this.setLoadingState(false);
        this.elements.submitLogin.disabled = true;
        const countdownInterval = setInterval(() => {
            const newRemainingTime = this.securitySystem.getRemainingBlockTime();
            if (newRemainingTime <= 0) {
                clearInterval(countdownInterval);
                this.elements.errorMsg.textContent = '';
                this.elements.submitLogin.disabled = false;
                return;
            }
            const newMinutes = Math.floor(newRemainingTime / 60);
            const newSeconds = newRemainingTime % 60;
            this.elements.errorMsg.textContent = `Too many attempts. Please wait ${newMinutes}m ${newSeconds}s.`;
        }, 1000);
    }

    showError(message, targetElement = null) {
        const errorElement = targetElement || this.elements.errorMsg;
        errorElement.textContent = message;
        errorElement.style.display = 'block';
        setTimeout(() => {
            if (errorElement.textContent === message) { // Hanya hapus jika pesan masih sama
                errorElement.style.display = 'none';
            }
        }, 5000);
    }

    setLoadingState(isLoading) {
        if (isLoading) {
            this.elements.submitLogin.disabled = true;
            this.elements.loadingSpinner.style.display = 'inline-block';
            this.elements.submitLogin.querySelector('.btn-text').textContent = 'Authenticating...';
        } else {
            this.elements.submitLogin.disabled = false;
            this.elements.loadingSpinner.style.display = 'none';
            this.elements.submitLogin.querySelector('.btn-text').textContent = 'Login';
        }
    }

    togglePasswordVisibility() {
        const isPassword = this.elements.passwordInput.type === 'password';
        this.elements.passwordInput.type = isPassword ? 'text' : 'password';
        this.elements.togglePassword.textContent = isPassword ? '😌' : '🙂';
        this.elements.togglePassword.setAttribute('aria-label',
            isPassword ? 'Hide password' : 'Show password');
    }

    initiateWebAuthn() {
        if (!this.state.webauthnSupported) return;
        this.updateStatus('Initiating biometric authentication...', 'info');
        setTimeout(() => {
            this.updateStatus('Please use your device biometric authenticator', 'info');
        }, 1000);
    }
}

class SecuritySystem {
    constructor(maxAttempts, blockDuration, cookieName) {
        this.maxAttempts = maxAttempts;
        this.blockDuration = blockDuration;
        this.cookieName = cookieName;
        this.attemptData = this.loadAttemptData();
    }

    loadAttemptData() {
        try {
            const cookieData = this.getCookie(this.cookieName);
            if (!cookieData) return this.getDefaultData();
            const data = JSON.parse(decodeURIComponent(cookieData));
            return this.validateData(data) ? data : this.getDefaultData();
        } catch (e) {
            console.error('Failed to parse cookie data:', e);
            return this.getDefaultData();
        }
    }

    getDefaultData() {
        return {
            attempts: 0,
            lastAttempt: null,
            blockUntil: null
        };
    }

    validateData(data) {
        return data && typeof data === 'object' &&
            'attempts' in data && 'lastAttempt' in data && 'blockUntil' in data;
    }

    saveAttemptData() {
        const expires = new Date();
        expires.setDate(expires.getDate() + 1);
        const data = encodeURIComponent(JSON.stringify(this.attemptData));
        document.cookie = `${this.cookieName}=${data}; expires=${expires.toUTCString()}; path=/; SameSite=Strict; Secure`;
    }

    getCookie(name) {
        return document.cookie.split(';')
            .map(c => c.trim())
            .find(c => c.startsWith(name + '='))
            ?.substring(name.length + 1);
    }

    recordFailedAttempt() {
        const now = new Date();
        this.attemptData.attempts++;
        this.attemptData.lastAttempt = now.toISOString();
        if (this.attemptData.attempts >= this.maxAttempts) {
            const blockUntil = new Date(now.getTime() + this.blockDuration);
            this.attemptData.blockUntil = blockUntil.toISOString();
        }
        this.saveAttemptData();
    }

    resetAttempts() {
        this.attemptData = this.getDefaultData();
        this.saveAttemptData();
    }

    isBlocked() {
        if (!this.attemptData.blockUntil) return false;
        const blockUntil = new Date(this.attemptData.blockUntil);
        const now = new Date();
        if (now > blockUntil) {
            this.resetAttempts();
            return false;
        }
        return true;
    }

    getRemainingBlockTime() {
        if (!this.isBlocked()) return 0;
        const blockUntil = new Date(this.attemptData.blockUntil);
        const now = new Date();
        return Math.round((blockUntil - now) / 1000);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new BioVAuth();
});
