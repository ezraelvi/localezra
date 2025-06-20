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
            // Tambahan elemen untuk popup Ezra dan Secret Word
            ezraLink: document.getElementById('ezraLink'),
            ezraProfilePopup: document.getElementById('ezraProfilePopup'),
            biometricScan: document.querySelector('.biometric-scan'), // Elemen mix.svg
            cancelLoginBtn: document.getElementById('cancelLoginBtn'), // Tombol Cancel
            yourText: null, // Akan diinisialisasi setelah status berubah
            secretWordPopup: document.getElementById('secretWordPopup'),
            closeSecretPopup: document.getElementById('closeSecretPopup'),
            secretWordInput: document.getElementById('secretWordInput'),
            submitSecretWord: document.getElementById('submitSecretWord'),
            secretErrorMsg: document.getElementById('secretErrorMsg'),
            secretPhotoDisplay: document.getElementById('secretPhotoDisplay'),
            scrollingTextBackground: document.getElementById('scrollingTextBackground')
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
            isPinkModeActive: false // State untuk pink mode
        };

        this.chatMessages = [
            "Elvii Zil Feb 04, 2025 7:13 am questionviu 👋",
            "Feb 04, 2025 7:13 am questionviu jgn buat aku penasaran lagi ya, jadi jadilah dirimu seperti sebelum aku chat km, sebelum kenal aku",
            "Feb 04, 2025 7:13 am questionviu BTW, kalo preferensi boidata mu yg bs kusimpulakan ialah ( meskipun km gk tanya );1. km cantik cantik bgt, sampe aku tertarik, 2. km itu orgnya baik bgt, karna bisa mengedepankan ambisi org lain daripada perasaanmu sebernarnya, meskipun blkng ini mulai pudar, 3.km itu potensinya bagus, dari sikap yg km displinkan, km lebih cocoknya kian bisa jd pramugari, farmasi bagian obt, atau mgikuti impianmu (tapi berdasarkan kemampuan mu juga baik materi, atopun akdemismu dan persetujuan ortu), itu menurutku",
            "Feb 04, 2025 7:02 am questionviu Rasa cukup ini akan menjadi tanda bahwa, kita (aku) akan menutup operasi chatan ini, aku akan menganggap km asing, sebagai upayaku melepaskan mu sebagai narasumber ku",
            "Feb 04, 2025 6:59 am questionviu sudah saatnya aku menindaki dunia ini lebih facktual, dan mendasarinya dengan kuasa Tuhan, itu jauh lebih baik dan itu yg Tuhan minta",
            "Feb 04, 2025 6:57 am questionviu makasi vi, jadi teman chat yg menyenangkan sih buat ku, dan aneh buatmu",
            "Feb 04, 2025 6:57 am questionviu jadi",
            "Feb 04, 2025 6:56 am questionviu bisa ajanya aku curhat sama yg lain, tapi orang lain begitu dominansi untukku, jadi disini lah aku bisa melimpahkan yg kurasakan saat ini",
            "Feb 04, 2025 6:55 am questionviu aminn",
            "Feb 04, 2025 6:55 am questionviu ya Tuhan aku harap aku lepas dari masa² sperti ini, cukup lah kegabutannku, cukupkanlah juga pemahaman ku akan dunia ini",
            "Feb 04, 2025 6:53 am questionviu dan cukup jugalah rasa penasaran ku akan bgaimana diriku, dan prasaanmu",
            "Feb 04, 2025 6:51 am questionviu okelah kurasa udah cukuplah semua info ini untukku",
            "Feb 04, 2025 6:50 am questionviu hmmmm",
            "Feb 04, 2025 6:50 am questionviu kayaknya km mmng bosan yaa",
            "Feb 04, 2025 6:36 am questionviu atau disuruh",
            "Feb 04, 2025 6:36 am questionviu atau bosan",
            "Feb 04, 2025 6:36 am questionviu dah ngantuk kah",
            "Feb 04, 2025 6:28 am questionviu 2. mimpi ² elvi kekmana panya, perang, atu kayak lagi sekolah, atu jln² atau masa lalu?",
            "Feb 04, 2025 6:27 am questionviu ooo",
            "Feb 04, 2025 6:26 am Elvii Zil ngk pernah kayaknya",
            "Feb 04, 2025 6:26 am questionviu 1. pernah gk aku hadir dimimpimu?, kalo pernah brp x",
            "Feb 04, 2025 6:25 am questionviu pertanyaan ini agak psikologis dikit ya",
            "Feb 04, 2025 6:25 am questionviu oooo",
            "Feb 04, 2025 6:24 am Elvii Zil lipat baju",
            "Feb 04, 2025 6:22 am questionviu biasanya disuruh ngapain aja sih??",
            "Feb 04, 2025 6:21 am Elvii Zil adaaa",
            "Feb 04, 2025 6:20 am questionviu wah gilak², kalo disuruh² gitu ada??",
            "Feb 04, 2025 6:18 am Elvii Zil kadang belajar dan kadang jg main tiktok",
            "Feb 04, 2025 6:16 am questionviu 5. spill kan dulu kegiatanmu, khusus km aja dimlm hri mulai dari jam 7 sampai jam 10 mlm, ngapain aja penasaran aku??, misalnya di suruh ini, belajar, atu main tiktok sampe dpt ujungnya",
            "Feb 04, 2025 6:14 am questionviu ouh",
            "Feb 04, 2025 6:13 am Elvii Zil udahh",
            "Feb 04, 2025 6:08 am questionviu 4. apa km diumur segini udah serius memikirkan masa dpn?? misal, udah pernah dibahas masa depanmu di depan keluargamu pas lagi ngumpul??",
            "Feb 04, 2025 6:05 am questionviu okey, i come back",
            "Feb 04, 2025 5:41 am Elvii Zil Iyaa",
            "Feb 04, 2025 5:40 am questionviu bntar",
            "Feb 04, 2025 5:39 am Elvii Zil iyaaaa",
            "Feb 04, 2025 5:39 am questionviu salah 1 upaya yg km lakukan apakah dengan berdandan untuk mulai mengejarnya?? (edited)",
            "Feb 04, 2025 5:38 am questionviu salah 1 upaya yg km lakukan apakah dengan berdandan ( km kan kayknya lebih cantik kl berdanda ) sekarang sih menurutku",
            "Feb 04, 2025 5:38 am questionviu ouhh",
            "Feb 04, 2025 5:36 am Elvii Zil Enggak jg sih",
            "Feb 04, 2025 5:35 am questionviu bahkan jika km begitu menginginkannya??",
            "Feb 04, 2025 5:34 am Elvii Zil Iya lah aku nyerahh",
            "Feb 04, 2025 5:33 am questionviu 3. jadi misal ada cowok populer dan ganteng, ( km udah umur 22 thn misalnya ), trus km suka dia, hbs itu km tau ada yg lain suka samnya dan lebih agresif darimu, km nyerah aja gitu, dan lepasin?? ( ini aku mau bhs soal percintaan dulu, soal ms depan kpn kpn )",
            "Feb 04, 2025 5:31 am Elvii Zil oalahh",
            "Feb 04, 2025 5:30 am questionviu akukan ninja",
            "Feb 04, 2025 5:29 am questionviu hmpir setiap pergerakanmu aku liati",
            "Feb 04, 2025 5:29 am Elvii Zil jadi, selalu ya ko liat² aku",
            "Feb 04, 2025 5:28 am questionviu km fine² aja gitu",
            "Feb 04, 2025 5:27 am questionviu masa sih, aku liat km kalem aja kayk percaya diri gitunya, dan gk ada masalh yg membebanimu",
            "Feb 04, 2025 5:26 am Elvii Zil Iya serius",
            "Feb 04, 2025 5:25 am questionviu seriusssss !?",
            "Feb 04, 2025 5:24 am Elvii Zil Iya",
            "Feb 04, 2025 5:23 am questionviu serius km bilang km lemahh?? kamu memang merasa km itu lemah dibandingkan sekitar mu gitu??",
            "Feb 04, 2025 5:22 am Elvii Zil Iya aku memang lemah",
            "Feb 04, 2025 5:21 am questionviu lemahnya ahh",
            "Feb 04, 2025 5:20 am Elvii Zil ngk bisaaa",
            "Feb 04, 2025 5:20 am questionviu 2 stengah tahun kemudian",
            "Feb 04, 2025 5:18 am questionviu dah tua aku, pnsaran aku kekmana dirikibdari salah 1 aspek",
            "Feb 04, 2025 5:18 am questionviu dari hati yg murniiii, lepaskan semha ktakutan mu",
            "Feb 04, 2025 5:17 am questionviu jwb lah coyy",
            "Feb 04, 2025 5:16 am Elvii Zil iya coy",
            "Feb 04, 2025 5:16 am questionviu hmpir stengah tahun coyy, nicee sih",
            "Feb 04, 2025 5:15 am questionviu 2. kenapa banyak pertannyaan kyk gini gk bisa km jawab??",
            "Feb 04, 2025 5:14 am Elvii Zil Ngk bisaa ku jawab",
            "Feb 04, 2025 5:12 am questionviu itu aja lah dulu, jawab yaa bre",
            "Feb 04, 2025 5:11 am questionviu tunngu agak bnyak aku maunnayk lagi",
            "Feb 04, 2025 5:11 am questionviu 1. aku tipe cowok yg kekman mnurutmu setelah berlama lama kita chatan??",
            "Feb 04, 2025 5:10 am Elvii Zil heheh",
            "Feb 04, 2025 5:10 am questionviu blummm",
            "Feb 04, 2025 5:09 am Elvii Zil iya, trus",
            "Feb 04, 2025 5:09 am questionviu apa yaa pertama",
            "Feb 04, 2025 5:08 am Elvii Zil bolehh",
            "Feb 04, 2025 5:08 am questionviu vi aku mulai bertanya tanya boleh ya",
            "Feb 04, 2025 5:07 am questionviu okey",
            "Feb 04, 2025 5:06 am Elvii Zil ngk tau lucu aja gitu",
            "Feb 04, 2025 5:05 am questionviu knp mnurutmu aku lucu??",
            "Feb 04, 2025 5:05 am questionviu hehe arigato",
            "Feb 04, 2025 5:04 am Elvii Zil iyaaaaa",
            "Feb 04, 2025 4:58 am questionviu kalo lucu, kasilah dulu waktumu untuk temani aku yaa, chatan",
            "Feb 04, 2025 4:57 am Elvii Zil lucu banget malahan",
            "Feb 04, 2025 4:55 am questionviu hehe lucu kali kurasa leh aku ini",
            "Feb 04, 2025 4:54 am Elvii Zil lah kok bingung",
            "Feb 04, 2025 4:53 am questionviu bingung aku bree",
            "Feb 04, 2025 4:53 am questionviu kan gini bree",
            "Feb 04, 2025 4:49 am Elvii Zil apanya yg bisa",
            "Feb 04, 2025 4:48 am questionviu jadi, kekmana brei, bisa bre?",
            "Feb 03, 2025 4:35 pm questionviu karena aku mencintaimu elvi",
            "Feb 03, 2025 4:44 am Elvii Zil Knp",
            "Feb 03, 2025 4:19 am questionviu ❤️",
            "Feb 03, 2025 3:14 am Elvii Zil Iyaa",
            "Feb 03, 2025 3:04 am questionviu elvi",
            "Feb 02, 2025 5:15 am Elvii Zil Iyaa",
            "Feb 02, 2025 5:15 am questionviu elvi",
            "Jan 31, 2025 10:39 pm Elvii Zil Iyelah tuu",
            "Jan 31, 2025 10:22 pm questionviu takpelah",
            "Jan 31, 2025 10:01 pm Elvii Zil Ngk tau aku, lupaa",
            "Jan 31, 2025 4:34 pm questionviu siapa musik skm di warta kmrin viiii",
            "Jan 31, 2025 4:33 pm questionviu = begitu ya, sedih",
            "Jan 31, 2025 4:33 pm questionviu = iya",
            "Jan 31, 2025 4:12 pm Elvii Zil Ngk tau",
            "Jan 31, 2025 4:02 pm questionviu soka, 😟",
            "Jan 31, 2025 4:01 pm questionviu haikk",
            "Jan 31, 2025 3:25 pm Elvii Zil iya jg sih",
            "Jan 31, 2025 3:25 pm Elvii Zil siapa, akuu",
            "Jan 31, 2025 3:07 pm questionviu entalah, kurang yakin aku dia mau",
            "Jan 31, 2025 3:06 pm questionviu eee orangnya yang ninggalin aku pas nungguin chat tdi malam",
            "Jan 31, 2025 3:05 pm questionviu iyaa",
            "Jan 31, 2025 6:28 am Elvii Zil Maaf yaaa",
            "Jan 31, 2025 6:27 am Elvii Zil Emang siapa rupanya",
            "Jan 31, 2025 6:27 am Elvii Zil Coba aja",
            "Jan 31, 2025 6:09 am questionviu km gitulah kalo mau off gk bilang, kasian org nungguin (edited)",
            "Jan 31, 2025 6:09 am questionviu km gitulah kalo mau off bilang, kasian org nungguin",
            "Jan 31, 2025 6:00 am questionviu lalap bilangnya blum siap aku",
            "Jan 31, 2025 5:59 am questionviu Tapi takut aku ditolaknya, kekmana itu",
            "Jan 31, 2025 5:58 am Elvii Zil Kek gini, sebenarnya aku dah lama suka samamu, hmm km mau ngk jadi pacar ku gituu",
            "Jan 31, 2025 5:56 am questionviu cara nembak cewe gimana vi?",
            "Jan 31, 2025 5:51 am questionviu uhh gitu",
            "Jan 31, 2025 5:48 am Elvii Zil Dia jrang da cerita",
            "Jan 31, 2025 5:46 am questionviu apa, apa lah yg km tau kl gitu",
            "Jan 31, 2025 5:45 am Elvii Zil Yaa tau lah",
            "Jan 31, 2025 5:43 am questionviu ai cemananya ko ini vi, abg mu yh terbaik gk km tau ceritanya/dia",
            "Jan 31, 2025 5:41 am Elvii Zil Yaa ngk tau",
            "Jan 31, 2025 5:39 am questionviu knp gk tau",
            "Jan 31, 2025 5:37 am Elvii Zil Ngk tau",
            "Jan 31, 2025 5:36 am questionviu abg mu jadi tes tentara dia?",
            "Jan 31, 2025 5:34 am Elvii Zil Udah",
            "Jan 31, 2025 5:31 am questionviu kerjaan/belajar udah siap?",
            "Jan 31, 2025 5:30 am Elvii Zil Lagi ddk",
            "Jan 31, 2025 5:29 am questionviu lagi ngapain",
            "Jan 31, 2025 5:29 am questionviu elvi",
            "Jan 22, 2025 10:32 pm Elvii Zil kalau ngk begitu, ya begitu",
            "Jan 22, 2025 10:28 pm Elvii Zil memang begitu",
            "Jan 22, 2025 8:13 pm questionviu yaaa begitulah manusia",
            "Jan 22, 2025 5:19 pm questionviu hm",
            "Jan 22, 2025 4:17 pm Elvii Zil enggak",
            "Jan 22, 2025 2:36 pm questionviu awas diculik org km nanti gara² pp mu itu daaa, nanti gk ad lagi cewekku (edited)",
            "Jan 22, 2025 2:36 pm questionviu awas diculik org km nanti gara² pp itu daaa, nanti gk ad lagi cewekku (edited)",
            "Jan 22, 2025 2:31 pm questionviu awas diculik org km nanti gara² pp itu daaa",
            "Jan 22, 2025 2:28 pm questionviu dan knp km gk ngasi no wa mu samaku?? kenapa",
            "Jan 22, 2025 2:27 pm questionviu for your new pp = 😍",
            "Jan 22, 2025 2:25 pm questionviu btw, kalo misal nanti ada cowok yg suka samamu di dunia nyata atau maya gimana tindakan km??",
            "Jan 22, 2025 2:22 pm questionviu untuk apa cintaku??, dah ku hapus kemarin cinta, malas aku main fb",
            "Jan 22, 2025 6:22 am Elvii Zil apa nama fbmu",
            "Jan 22, 2025 6:03 am Elvii Zil yaudah deh",
            "Jan 22, 2025 6:03 am Elvii Zil percaya kok",
            "Jan 22, 2025 5:49 am questionviu malamm",
            "Jan 22, 2025 5:48 am questionviu gk apaa, percaya juga km samaku?? (edited)",
            "Jan 22, 2025 5:48 am questionviu gk apaa, percaya juga kmsamaku?? (edited)",
            "Jan 22, 2025 5:47 am questionviu kalo malu knp di post??, itu namanya org lain km kasi tengok aku enggak",
            "Jan 22, 2025 5:46 am questionviu gk apaa, percaya juga ko samaku??",
            "Jan 22, 2025 5:38 am questionviu iya cubit ajaa, gpp itu",
            "Jan 22, 2025 5:27 am Elvii Zil jangan ko tengok² fbku malu aku",
            "Jan 22, 2025 5:26 am Elvii Zil cubit aja",
            "Jan 22, 2025 5:15 am Elvii Zil apanya",
            "Jan 22, 2025 5:15 am Elvii Zil oalahh",
            "Jan 22, 2025 5:11 am questionviu jadi gimana vi?",
            "Jan 22, 2025 5:09 am questionviu feeling ku aja pasti namanya mirip sam ig nya, jadi gitulah ketemu",
            "Jan 22, 2025 5:08 am questionviu yappp",
            "Jan 22, 2025 5:08 am questionviu cubit muncung nya itu vi, klo bilangnua km gk cantik",
            "Jan 22, 2025 4:42 am Elvii Zil tapi knp ko bisa tau namaku",
            "Jan 22, 2025 4:15 am Elvii Zil ouh ok",
            "Jan 22, 2025 4:14 am Elvii Zil ouh gitu yaa",
            "Jan 22, 2025 3:52 am questionviu wkwkkw ntah, berat memang samaku vi, tapi the true mengejarmu itu adalah first time bagiku",
            "Jan 22, 2025 3:50 am questionviu kebetulan aku perlu fb jadi ku buat, trus aku liat akun km, disitulah aku cemburu vii",
            "Jan 22, 2025 3:46 am questionviu ohh",
            "Jan 22, 2025 2:29 am Elvii Zil emang bisaa",
            "Jan 22, 2025 2:29 am Elvii Zil kok tau, ngk bisa di hapus itu",
            "Jan 22, 2025 2:28 am Elvii Zil adaa",
            "Jan 22, 2025 2:17 am questionviu biar aku aja yg jagain km"
        ];
        this.init();
    }

    async init() {
        this.startBiometricAnimation();
        await this.collectClientInfo();
        this.setupEventListeners();
        this.setupEzraPopupEventListeners(); // Panggil method baru untuk popup Ezra
        this.setupSecretWordPopupEventListeners(); // Panggil method baru untuk secret word popup
        this.checkWebAuthnSupport();
        this.securitySystem = new SecuritySystem(
            this.securityConfig.maxAttempts,
            this.securityConfig.blockDuration,
            this.securityConfig.cookieName
        );
        this.populateScrollingTextBackground(); // Isi background dengan teks chat
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
        this.updateStatus('Initializing authentication system...', 'info');
        setTimeout(() => {
            this.elements.scanLine.style.opacity = '0';
            this.updateStatus('Enter <span id="yourText">your</span> credentials or choose an option below.', 'success'); // Ubah status agar 'your' menjadi span
            this.elements.yourText = document.getElementById('yourText'); // Dapatkan elemen 'yourText' setelah dibuat
            this.setupSecretWordPopupEventListeners(); // Setup ulang jika status diperbarui
            this.elements.btnContainer.style.display = 'flex';
        }, 2000);
    }

    updateStatus(message, type = 'info') {
        this.elements.status.innerHTML = message; // Gunakan innerHTML karena kita akan memasukkan span
        this.elements.status.className = 'status';
        if (type) this.elements.status.classList.add(type);
        if (this.state.isPinkModeActive) {
            this.elements.status.classList.add('pink-text');
        }
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
        this.elements.cancelLoginBtn.addEventListener('click', () => { // Event Listener untuk tombol Cancel
            this.hideLoginForm();
        });
    }

    // --- Ezra Popup Specific Methods ---
    setupEzraPopupEventListeners() {
        const { ezraLink, ezraProfilePopup, biometricScan, securityInfo } = this.elements;

        if (ezraLink && ezraProfilePopup && securityInfo) {
            const showPopup = () => {
                // Dapatkan posisi elemen .security-info
                const securityInfoRect = securityInfo.getBoundingClientRect();
                
                // Ukuran popup Ezra yang lebih kecil
                const popupSize = 100; // Misalnya 100px x 100px

                // Hitung posisi di bawah security-info, di tengah horizontal
                const popupTop = securityInfoRect.bottom + window.scrollY + 20; // 20px di bawah security-info
                const popupLeft = securityInfoRect.left + window.scrollX + (securityInfoRect.width / 2) - (popupSize / 2);

                ezraProfilePopup.style.position = 'absolute';
                ezraProfilePopup.style.top = `${popupTop}px`;
                ezraProfilePopup.style.left = `${popupLeft}px`;
                ezraProfilePopup.style.width = `${popupSize}px`;
                ezraProfilePopup.style.height = `${popupSize}px`;

                ezraProfilePopup.classList.add('visible');
                ezraProfilePopup.querySelector('.profile-image').src = 'dashboard/ezra-profile.jpg'; // Pastikan foto Ezra
            };

            const hidePopup = () => {
                ezraProfilePopup.classList.remove('visible');
            };

            ezraLink.addEventListener('click', (event) => {
                event.preventDefault();
                if (ezraProfilePopup.classList.contains('visible')) {
                    hidePopup();
                } else {
                    showPopup();
                }
            });

            // Menyembunyikan popup jika klik di luar area popup atau link
            document.addEventListener('click', (event) => {
                if (ezraProfilePopup.classList.contains('visible') &&
                    !ezraLink.contains(event.target) &&
                    !ezraProfilePopup.contains(event.target)) {
                    hidePopup();
                }
            });

            // Menyembunyikan popup saat esc ditekan
            document.addEventListener('keydown', (event) => {
                if (event.key === 'Escape' && ezraProfilePopup.classList.contains('visible')) {
                    hidePopup();
                }
            });

            // Menangani perubahan ukuran jendela
            window.addEventListener('resize', () => {
                if (ezraProfilePopup.classList.contains('visible')) {
                    showPopup(); // Perbarui posisi dan ukuran popup
                }
            });
        }
    }
    // --- End of Ezra Popup Specific Methods ---

    // --- Secret Word Popup Specific Methods ---
    setupSecretWordPopupEventListeners() {
        const { yourText, secretWordPopup, closeSecretPopup, secretWordInput, submitSecretWord, secretErrorMsg, secretPhotoDisplay } = this.elements;
        const SECRET_WORD = "jadi salting";

        if (!yourText) return; // Pastikan elemen yourText sudah ada

        const showSecretPopup = () => {
            const rect = yourText.getBoundingClientRect(); // Dapatkan posisi 'your'

            // Atur posisi popup di sekitar 'your'
            // Posisi X: tengah 'your' - setengah lebar popup
            // Posisi Y: di bawah 'your' + sedikit offset
            const popupWidth = 250; // Lebar tetap popup
            const popupTop = rect.bottom + window.scrollY + 10;
            const popupLeft = rect.left + window.scrollX + (rect.width / 2) - (popupWidth / 2);

            secretWordPopup.style.position = 'absolute';
            secretWordPopup.style.top = `${popupTop}px`;
            secretWordPopup.style.left = `${popupLeft}px`;
            secretWordPopup.classList.add('visible');
            secretWordInput.focus();
            secretErrorMsg.textContent = '';
            secretPhotoDisplay.classList.remove('visible'); // Sembunyikan foto saat popup muncul
        };

        const hideSecretPopup = () => {
            secretWordPopup.classList.remove('visible');
            secretWordInput.value = '';
            secretErrorMsg.textContent = '';
            secretPhotoDisplay.classList.remove('visible');
        };

        yourText.addEventListener('click', showSecretPopup);
        closeSecretPopup.addEventListener('click', hideSecretPopup);

        submitSecretWord.addEventListener('click', () => {
            if (secretWordInput.value.trim().toLowerCase() === SECRET_WORD) {
                secretErrorMsg.textContent = 'Correct!';
                secretErrorMsg.style.color = 'var(--primary)';
                secretPhotoDisplay.classList.add('visible'); // Tampilkan foto
                this.activatePinkMode(); // Aktifkan pink mode
            } else {
                secretErrorMsg.textContent = 'Incorrect secret word.';
                secretErrorMsg.style.color = 'var(--error)';
                secretPhotoDisplay.classList.remove('visible');
                this.deactivatePinkMode(); // Pastikan pink mode mati jika salah
            }
        });

        // Hide popup if clicked outside
        document.addEventListener('click', (event) => {
            if (secretWordPopup.classList.contains('visible') &&
                !yourText.contains(event.target) &&
                !secretWordPopup.contains(event.target)) {
                hideSecretPopup();
            }
        });
        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape' && secretWordPopup.classList.contains('visible')) {
                hideSecretPopup();
            }
        });
    }
    // --- End of Secret Word Popup Specific Methods ---

    // --- Pink Mode and Scrolling Background ---
    activatePinkMode() {
        if (this.state.isPinkModeActive) return; // Hindari aktivasi berulang

        this.state.isPinkModeActive = true;
        document.body.classList.add('pink-mode');

        // Update status text color immediately if it's visible
        if (this.elements.status) {
            this.elements.status.classList.add('pink-text');
        }

        // Generate scrolling text content
        this.populateScrollingTextBackground();
        this.elements.scrollingTextBackground.classList.add('active');
    }

    deactivatePinkMode() {
        if (!this.state.isPinkModeActive) return;

        this.state.isPinkModeActive = false;
        document.body.classList.remove('pink-mode');

        if (this.elements.status) {
            this.elements.status.classList.remove('pink-text');
        }

        this.elements.scrollingTextBackground.classList.remove('active');
        this.elements.scrollingTextBackground.innerHTML = ''; // Hapus teks yang discroll
    }

    populateScrollingTextBackground() {
        const scrollingDiv = this.elements.scrollingTextBackground;
        scrollingDiv.innerHTML = ''; // Bersihkan konten lama
        let fullText = this.chatMessages.join(" • "); // Gabungkan semua chat dengan pemisah

        // Duplikasi teks berkali-kali untuk efek scrolling tak terbatas
        let content = document.createElement('span');
        content.classList.add('scrolling-text-content');
        // Kita butuh setidaknya 2x konten agar bisa seamless loop
        content.textContent = fullText + " • " + fullText;
        scrollingDiv.appendChild(content);

        // Adjust animation duration based on content width for consistent speed
        // This is a bit tricky to get perfect without real-time font rendering,
        // but can be approximated. For now, a fixed 120s is used in CSS.
    }
    // --- End of Pink Mode and Scrolling Background ---

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
        this.updateStatus('Enter <span id="yourText">your</span> credentials or choose an option below.', 'info'); // Perbarui status
        this.elements.yourText = document.getElementById('yourText'); // Dapatkan lagi setelah update
        this.setupSecretWordPopupEventListeners(); // Pastikan listener dipasang pada elemen 'yourText' yang baru
    }

    hideLoginForm() { // Metode baru untuk menyembunyikan form login
        this.elements.loginForm.style.display = 'none';
        this.elements.btnContainer.style.display = 'flex';
        this.updateStatus('System ready, is better if you use desktop site', 'success');
        this.elements.errorMsg.textContent = ''; // Bersihkan error message
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

    showError(message) {
        this.elements.errorMsg.textContent = message;
        this.elements.errorMsg.style.display = 'block';
        setTimeout(() => {
            if (this.elements.errorMsg.textContent === message) {
                this.elements.errorMsg.style.display = 'none';
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
