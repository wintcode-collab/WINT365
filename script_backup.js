// 전역 변수
let isSignUpMode = false;
let isCodeMode = false;
let isCodeRegistrationMode = false;
let isAnimationRunning = false;
let currentAnimationTimer = null;

// 텔레그램 인증 관련 변수
let telegramClient = null;
let telegramClientId = null;
let isTelegramAuthRequested = false;
let telegramAuthState = 'idle'; // 'idle', 'requesting', 'code_sent', 'authenticated'
let telegramApiId = null;
let telegramApiHash = null;

// DOM 요소들
const elements = {
    // 화면들
    loginScreen: document.getElementById('loginScreen'),
    mainAppScreen: document.getElementById('mainAppScreen'),
    
    // 타이틀 요소들
    titleText: document.getElementById('titleText'),
    signupTitle: document.getElementById('signupTitle'),
    codeTitle: document.getElementById('codeTitle'),
    
    // 입력 필드들
    emailInput: document.getElementById('emailInput'),
    passwordInput: document.getElementById('passwordInput'),
    confirmPasswordInput: document.getElementById('confirmPasswordInput'),
    codeInput: document.getElementById('codeInput'),
    codeRegistrationInput: document.getElementById('codeRegistrationInput'),
    
    // 플레이스홀더들
    emailPlaceholder: document.getElementById('emailPlaceholder'),
    passwordPlaceholder: document.getElementById('passwordPlaceholder'),
    confirmPasswordPlaceholder: document.getElementById('confirmPasswordPlaceholder'),
    codePlaceholder: document.getElementById('codePlaceholder'),
    codeRegistrationPlaceholder: document.getElementById('codeRegistrationPlaceholder'),
    
    // 그룹들
    passwordGroup: document.getElementById('passwordGroup'),
    confirmPasswordGroup: document.getElementById('confirmPasswordGroup'),
    codeGroup: document.getElementById('codeGroup'),
    codeRegistrationGroup: document.getElementById('codeRegistrationGroup'),
    
    // 버튼과 링크들
    loginBtn: document.getElementById('loginBtn'),
    signUpLink: document.getElementById('signUpLink'),
    // codeLink 제거됨
    closeBtn: document.getElementById('closeBtn'),
    // rememberCheckbox 제거됨
    
    // 메시지
    errorMessage: document.getElementById('errorMessage'),
    
    // 메인 앱 요소들
    lastLogin: document.getElementById('lastLogin'),
    codeExpiry: document.getElementById('codeExpiry'),
    codeRegistered: document.getElementById('codeRegistered'),
    currentTime: document.getElementById('currentTime'),
    logoutBtn: document.getElementById('logoutBtn'),
    
    // 텔레그램 API 요소들
    telegramApiId: document.getElementById('telegramApiId'),
    telegramApiHash: document.getElementById('telegramApiHash'),
    telegramPhone: document.getElementById('telegramPhone'),
    telegramVerificationCode: document.getElementById('telegramVerificationCode'),
    telegramApiIdPlaceholder: document.getElementById('telegramApiIdPlaceholder'),
    telegramApiHashPlaceholder: document.getElementById('telegramApiHashPlaceholder'),
    telegramPhonePlaceholder: document.getElementById('telegramPhonePlaceholder'),
    telegramVerificationCodePlaceholder: document.getElementById('telegramVerificationCodePlaceholder'),
    verificationCodeGroup: document.getElementById('verificationCodeGroup'),
    saveTelegramBtn: document.getElementById('saveTelegramBtn'),
    testTelegramBtn: document.getElementById('testTelegramBtn'),
    
    // 컨테이너
    container: document.querySelector('.container')
};

// 초기화
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
    setupEventListeners();
    startTypingAnimation();
});

function initializeApp() {
    // 로컬 스토리지에서 설정 로드
    loadUserSettings();
    
    // 저장된 이메일 로드
    loadSavedEmail();
    
    // 모든 입력 필드 초기화 (이메일 제외)
    clearAllInputsExceptEmail();
    
    // 에러 메시지 숨기기
    hideErrorMessage();
}

function setupEventListeners() {
    // 로그인 버튼
    elements.loginBtn.addEventListener('click', handleLogin);
    
    // SIGN UP 링크
    elements.signUpLink.addEventListener('click', toggleSignUpMode);
    
    // 닫기 버튼
    elements.closeBtn.addEventListener('click', closeWindow);
    
    // 로그아웃 버튼
    if (elements.logoutBtn) {
        elements.logoutBtn.addEventListener('click', handleLogout);
    }
    
    
    // 텔레그램 API 버튼들
    if (elements.saveTelegramBtn) {
        elements.saveTelegramBtn.addEventListener('click', handleSaveTelegramSettings);
    }
    if (elements.testTelegramBtn) {
        elements.testTelegramBtn.addEventListener('click', handleTestTelegramConnection);
    }
    
    // 텔레그램 그룹 관리 창 이벤트 리스너들
    setupTelegramGroupsEventListeners();
    
    // Enter 키 이벤트
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
            handleLogin();
        }
    });
    
    // 입력 필드 이벤트들
    setupInputFieldEvents();
    
    // 텔레그램 API 입력 필드 이벤트 설정
    setupTelegramInputEvents();
    
    // Remember me 체크박스 제거됨
}

function setupInputFieldEvents() {
    // 모든 입력 필드에 포커스 테두리 제거 이벤트 추가
    const allInputs = [
        elements.emailInput,
        elements.passwordInput,
        elements.confirmPasswordInput,
        elements.codeInput,
        elements.codeRegistrationInput
    ];
    
    allInputs.forEach(input => {
        // 포커스 시 테두리 제거
        input.addEventListener('focus', (e) => {
            e.target.style.outline = 'none';
            e.target.style.border = 'none';
            e.target.style.boxShadow = 'none';
        });
        
        // 클릭 시 테두리 제거
        input.addEventListener('click', (e) => {
            e.target.style.outline = 'none';
            e.target.style.border = 'none';
            e.target.style.boxShadow = 'none';
        });
        
        // 키보드 이벤트 시 테두리 제거
        input.addEventListener('keydown', (e) => {
            e.target.style.outline = 'none';
            e.target.style.border = 'none';
            e.target.style.boxShadow = 'none';
        });
    });
    
    // 이메일 입력 필드
    elements.emailInput.addEventListener('focus', () => hidePlaceholder('emailPlaceholder'));
    elements.emailInput.addEventListener('blur', () => showPlaceholderIfEmpty('emailInput', 'emailPlaceholder'));
    elements.emailInput.addEventListener('input', () => hidePlaceholder('emailPlaceholder'));
    
    // 비밀번호 입력 필드
    elements.passwordInput.addEventListener('focus', () => hidePlaceholder('passwordPlaceholder'));
    elements.passwordInput.addEventListener('blur', () => showPlaceholderIfEmpty('passwordInput', 'passwordPlaceholder'));
    elements.passwordInput.addEventListener('input', () => hidePlaceholder('passwordPlaceholder'));
    
    // 비밀번호 확인 입력 필드
    elements.confirmPasswordInput.addEventListener('focus', () => hidePlaceholder('confirmPasswordPlaceholder'));
    elements.confirmPasswordInput.addEventListener('blur', () => showPlaceholderIfEmpty('confirmPasswordInput', 'confirmPasswordPlaceholder'));
    elements.confirmPasswordInput.addEventListener('input', () => hidePlaceholder('confirmPasswordPlaceholder'));
    
    // 코드 입력 필드
    elements.codeInput.addEventListener('focus', () => hidePlaceholder('codePlaceholder'));
    elements.codeInput.addEventListener('blur', () => showPlaceholderIfEmpty('codeInput', 'codePlaceholder'));
    elements.codeInput.addEventListener('input', () => hidePlaceholder('codePlaceholder'));
    
    // 코드 등록 입력 필드
    elements.codeRegistrationInput.addEventListener('focus', () => hidePlaceholder('codeRegistrationPlaceholder'));
    elements.codeRegistrationInput.addEventListener('blur', () => showPlaceholderIfEmpty('codeRegistrationInput', 'codeRegistrationPlaceholder'));
    elements.codeRegistrationInput.addEventListener('input', () => hidePlaceholder('codeRegistrationPlaceholder'));
}

// 플레이스홀더 관리
function hidePlaceholder(placeholderId) {
    const placeholder = document.getElementById(placeholderId);
    if (placeholder) {
        placeholder.style.opacity = '0';
        placeholder.style.visibility = 'hidden';
        placeholder.style.display = 'none';
    }
}

function showPlaceholderIfEmpty(inputId, placeholderId) {
    const input = document.getElementById(inputId);
    const placeholder = document.getElementById(placeholderId);
    
    if (input && placeholder) {
        if (input.value.trim() === '') {
            placeholder.style.opacity = '1';
            placeholder.style.visibility = 'visible';
            placeholder.style.display = 'block';
        } else {
            placeholder.style.opacity = '0';
            placeholder.style.visibility = 'hidden';
            placeholder.style.display = 'none';
        }
    }
}

// 타이핑 애니메이션
function startTypingAnimation() {
    if (isAnimationRunning) return;
    
    isAnimationRunning = true;
    stopAllAnimations();
    
    // @WINT365 애니메이션
    const characters = ['@', 'W', 'I', 'N', 'T', '3', '6', '5'];
    const charElements = ['char1', 'char2', 'char3', 'char4', 'char5', 'char6', 'char7', 'char8'];
    
    showNextCharacter(characters, charElements, 0, () => {
        startBlinkingAnimation(charElements);
    });
}

function startSignUpTypingAnimation() {
    if (isAnimationRunning) return;
    
    isAnimationRunning = true;
    stopAllAnimations();
    
    // SIGN UP 애니메이션
    const characters = ['S', 'I', 'G', 'N', ' ', 'U', 'P'];
    const charElements = ['signChar1', 'signChar2', 'signChar3', 'signChar4', 'signChar5', 'signChar6', 'signChar7'];
    
    showNextCharacter(characters, charElements, 0, () => {
        startBlinkingAnimation(charElements);
    });
}

function startCodeTypingAnimation() {
    if (isAnimationRunning) return;
    
    isAnimationRunning = true;
    stopAllAnimations();
    
    // CODE INJECTION 애니메이션
    const characters = ['C', 'O', 'D', 'E', ' ', 'I', 'N', 'J', 'E', 'C', 'T', 'I', 'O', 'N'];
    const charElements = ['codeChar1', 'codeChar2', 'codeChar3', 'codeChar4', 'codeChar5', 'codeChar6', 'codeChar7', 'codeChar8', 'codeChar9', 'codeChar10', 'codeChar11', 'codeChar12', 'codeChar13', 'codeChar14'];
    
    showNextCharacter(characters, charElements, 0, () => {
        startBlinkingAnimation(charElements);
    });
}

function showNextCharacter(characters, charElements, index, callback) {
    if (index < characters.length) {
        const charElement = document.getElementById(charElements[index]);
        charElement.textContent = characters[index];
        charElement.style.opacity = '1';
        
        setTimeout(() => {
            showNextCharacter(characters, charElements, index + 1, callback);
        }, 200);
    } else {
        setTimeout(callback, 1000);
    }
}

function startBlinkingAnimation(charElements) {
    isAnimationRunning = false;
    
    charElements.forEach(charId => {
        const charElement = document.getElementById(charId);
        charElement.classList.add('blink');
    });
}

function stopAllAnimations() {
    // 모든 타이머 정리
    if (currentAnimationTimer) {
        clearTimeout(currentAnimationTimer);
        currentAnimationTimer = null;
    }
    
    // 모든 문자 요소 초기화
    const allCharElements = [
        'char1', 'char2', 'char3', 'char4', 'char5', 'char6', 'char7', 'char8',
        'signChar1', 'signChar2', 'signChar3', 'signChar4', 'signChar5', 'signChar6', 'signChar7',
        'codeChar1', 'codeChar2', 'codeChar3', 'codeChar4', 'codeChar5', 'codeChar6', 'codeChar7', 'codeChar8', 'codeChar9', 'codeChar10', 'codeChar11', 'codeChar12', 'codeChar13', 'codeChar14'
    ];
    
    allCharElements.forEach(charId => {
        const charElement = document.getElementById(charId);
        if (charElement) {
            charElement.textContent = '';
            charElement.style.opacity = '0';
            charElement.classList.remove('blink');
        }
    });
    
    isAnimationRunning = false;
}

// 모드 전환
function toggleSignUpMode() {
    isSignUpMode = !isSignUpMode;
    
    if (isSignUpMode) {
        // 회원가입 모드
        elements.container.classList.add('signup-mode');
        elements.confirmPasswordGroup.style.display = 'block';
        elements.codeGroup.style.display = 'none';
        elements.codeRegistrationGroup.style.display = 'none';
        elements.passwordGroup.style.display = 'block';
        elements.loginBtn.textContent = 'COMPLETE';
        elements.signUpLink.textContent = 'CANCEL';
        
        // 타이틀 전환
        elements.titleText.style.display = 'none';
        elements.signupTitle.style.display = 'flex';
        elements.codeTitle.style.display = 'none';
        
        // 애니메이션 시작
        stopAllAnimations();
        setTimeout(() => startSignUpTypingAnimation(), 100);
        
        // 입력 필드 초기화
        clearAllInputs();
        hideErrorMessage();
    } else {
        // 로그인 모드로 복원
        elements.container.classList.remove('signup-mode');
        elements.confirmPasswordGroup.style.display = 'none';
        elements.codeGroup.style.display = 'none';
        elements.codeRegistrationGroup.style.display = 'none';
        elements.passwordGroup.style.display = 'block';
        elements.loginBtn.textContent = 'LOGIN';
        elements.signUpLink.textContent = 'SIGN UP';
        
        // 타이틀 전환
        elements.titleText.style.display = 'flex';
        elements.signupTitle.style.display = 'none';
        elements.codeTitle.style.display = 'none';
        
        // 애니메이션 시작
        stopAllAnimations();
        setTimeout(() => startTypingAnimation(), 100);
        
        // 입력 필드 초기화
        clearAllInputs();
        hideErrorMessage();
    }
}

function toggleCodeMode() {
    if (isSignUpMode) {
        toggleSignUpMode();
        setTimeout(() => toggleCodeRegistrationMode(), 300);
        return;
    }
    
    if (isCodeMode) {
        toggleCodeRegistrationMode();
        return;
    }
    
    toggleCodeRegistrationMode();
}

function toggleCodeRegistrationMode() {
    isCodeRegistrationMode = !isCodeRegistrationMode;
    
    if (isCodeRegistrationMode) {
        // 코드 등록 모드
        elements.container.classList.add('code-registration-mode');
        elements.codeRegistrationGroup.style.display = 'block';
        elements.codeGroup.style.display = 'none';
        elements.confirmPasswordGroup.style.display = 'none';
        elements.passwordGroup.style.display = 'block';
        elements.loginBtn.textContent = 'REGISTER';
        // codeLink 제거됨
        elements.signUpLink.textContent = '';
        
        // 타이틀 전환
        elements.titleText.style.display = 'none';
        elements.signupTitle.style.display = 'none';
        elements.codeTitle.style.display = 'flex';
        
        // 애니메이션 시작
        stopAllAnimations();
        setTimeout(() => startCodeTypingAnimation(), 100);
        
        // 입력 필드 초기화
        clearAllInputs();
        hideErrorMessage();
    } else {
        // 일반 모드로 복원
        elements.container.classList.remove('code-registration-mode');
        elements.codeRegistrationGroup.style.display = 'none';
        elements.codeGroup.style.display = 'none';
        elements.confirmPasswordGroup.style.display = 'none';
        elements.passwordGroup.style.display = 'block';
        elements.loginBtn.textContent = 'LOGIN';
        // codeLink 제거됨
        elements.signUpLink.textContent = 'SIGN UP';
        
        // 타이틀 전환
        elements.titleText.style.display = 'flex';
        elements.signupTitle.style.display = 'none';
        elements.codeTitle.style.display = 'none';
        
        // 애니메이션 시작
        stopAllAnimations();
        setTimeout(() => startTypingAnimation(), 100);
        
        // 입력 필드 초기화
        clearAllInputs();
        hideErrorMessage();
    }
}

// 로그인 처리
function handleLogin() {
    if (isSignUpMode) {
        handleSignUp();
    } else {
        handleNormalLogin();
    }
}

async function handleNormalLogin() {
    const email = elements.emailInput.value.trim();
    const password = elements.passwordInput.value.trim();
    
    // 입력 검증
    if (!email || !password) {
        showError('Please enter both email and password.');
        return;
    }
    
    // Firebase를 통한 로그인
    const isValidUser = await validateCredentials(email, password);
    if (isValidUser) {
        // 코드 등록 확인 제거됨 - 바로 로그인 허용
        
        hideErrorMessage();
        saveUserSettings();
        
        // 로그인 성공 시 이메일 저장
        saveUserEmail(email);
        
        // 성공 애니메이션
        elements.loginBtn.textContent = '✓ SUCCESS';
        elements.loginBtn.classList.add('success');
        
        // 즉시 메인 앱 화면으로 전환
        showMainApp(email);
    } else {
        showError('Invalid email or password.');
    }
}

async function handleSignUp() {
    const email = elements.emailInput.value.trim();
    const password = elements.passwordInput.value.trim();
    const confirmPassword = elements.confirmPasswordInput.value.trim();
    
    // 입력 검증
    if (!email || !password || !confirmPassword) {
        showError('Please fill in all fields.');
        return;
    }
    
    if (password !== confirmPassword) {
        showError('Passwords do not match.');
        return;
    }
    
    if (password.length < 6) {
        showError('Password must be at least 6 characters.');
        return;
    }
    
    // 이메일 형식 검증
    if (!isValidEmail(email)) {
        showError('Please enter a valid email address.');
        return;
    }
    
    // Firebase를 통한 회원가입
    const success = await registerUser(email, password);
    if (success) {
        showSuccess('Sign up successful!');
        
        // 성공 애니메이션
        elements.loginBtn.textContent = '✓ SUCCESS';
        elements.loginBtn.classList.add('success');
        
        // 2초 후 로그인 모드로 전환
        setTimeout(() => {
            toggleSignUpMode();
        }, 2000);
    } else {
        showError('This email is already registered. Please use a different email.');
    }
}

// 코드 등록 기능 제거됨

// 유틸리티 함수들 - Firebase 연동
async function validateCredentials(email, password) {
    try {
        // Firebase에서 사용자 정보 확인
        const signUps = await window.firebaseService.getAllSignUps();
        
        for (const signUp of signUps) {
            if (signUp.email === email && signUp.password === password) {
                console.log(`사용자 인증 성공: ${email}`);
                return true;
            }
        }
        
        console.log(`사용자 인증 실패: ${email}`);
        return false;
    } catch (error) {
        console.error('사용자 인증 오류:', error);
        return false;
    }
}

async function registerUser(email, password) {
    try {
        // Firebase에서 중복 이메일 확인
        const isRegistered = await window.firebaseService.isUserRegistered(email);
        
        if (isRegistered) {
            console.log(`이미 등록된 이메일: ${email}`);
            return false;
        }
        
        // Firebase에 회원가입 정보 저장
        const success = await window.firebaseService.saveSignUp(email, password);
        
        if (success) {
            console.log(`회원가입 성공: ${email}`);
            return true;
        } else {
            console.log(`회원가입 실패: ${email}`);
            return false;
        }
    } catch (error) {
        console.error('회원가입 오류:', error);
        return false;
    }
}

// registerCode 함수 제거됨

function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

// 메시지 표시
function showError(message) {
    elements.errorMessage.textContent = message;
    elements.errorMessage.style.color = '#FF6666';
    elements.errorMessage.style.display = 'block';
    
    // 창 높이 조정
    adjustWindowHeight();
}

function showSuccess(message) {
    elements.errorMessage.textContent = message;
    elements.errorMessage.style.color = '#10B981';
    elements.errorMessage.style.display = 'block';
    
    // 창 높이 조정
    adjustWindowHeight();
    
    // 2초 후 메시지 숨기기
    setTimeout(() => {
        hideErrorMessage();
    }, 2000);
}

function hideErrorMessage() {
    elements.errorMessage.style.display = 'none';
    restoreWindowHeight();
}

function adjustWindowHeight() {
    const loginWindow = document.querySelector('.login-window');
    if (isSignUpMode) {
        loginWindow.style.height = '350px';
    } else {
        loginWindow.style.height = '310px';
    }
}

function restoreWindowHeight() {
    const loginWindow = document.querySelector('.login-window');
    if (isSignUpMode) {
        loginWindow.style.height = '350px';
    } else {
        loginWindow.style.height = '300px';
    }
}

// 입력 필드 초기화
function clearAllInputs() {
    elements.emailInput.value = '';
    elements.passwordInput.value = '';
    elements.confirmPasswordInput.value = '';
    elements.codeInput.value = '';
    elements.codeRegistrationInput.value = '';
    
    // 플레이스홀더 표시
    showPlaceholderIfEmpty('emailInput', 'emailPlaceholder');
    showPlaceholderIfEmpty('passwordInput', 'passwordPlaceholder');
    showPlaceholderIfEmpty('confirmPasswordInput', 'confirmPasswordPlaceholder');
    showPlaceholderIfEmpty('codeInput', 'codePlaceholder');
    showPlaceholderIfEmpty('codeRegistrationInput', 'codeRegistrationPlaceholder');
}

// 이메일을 제외한 입력 필드 초기화
function clearAllInputsExceptEmail() {
    elements.passwordInput.value = '';
    elements.confirmPasswordInput.value = '';
    elements.codeInput.value = '';
    elements.codeRegistrationInput.value = '';
    
    // 이메일 제외한 플레이스홀더 표시
    showPlaceholderIfEmpty('passwordInput', 'passwordPlaceholder');
    showPlaceholderIfEmpty('confirmPasswordInput', 'confirmPasswordPlaceholder');
    showPlaceholderIfEmpty('codeInput', 'codePlaceholder');
    showPlaceholderIfEmpty('codeRegistrationInput', 'codeRegistrationPlaceholder');
}

// 사용자 설정 관리 (Remember me 제거됨)
function loadUserSettings() {
    // Remember me 기능 제거됨
}

function saveUserSettings() {
    // Remember me 기능 제거됨
}

// 이메일 저장/로드 함수들
function saveUserEmail(email) {
    try {
        localStorage.setItem('savedEmail', email);
        console.log('이메일 저장됨:', email);
    } catch (error) {
        console.error('이메일 저장 실패:', error);
    }
}

function loadSavedEmail() {
    try {
        const savedEmail = localStorage.getItem('savedEmail');
        if (savedEmail && elements.emailInput) {
            elements.emailInput.value = savedEmail;
            // 이메일이 있으면 플레이스홀더 숨기기
            if (savedEmail.trim()) {
                hidePlaceholder('emailPlaceholder');
            }
        }
    } catch (error) {
        console.error('저장된 이메일 로드 실패:', error);
    }
}

function clearSavedEmail() {
    try {
        localStorage.removeItem('savedEmail');
        console.log('저장된 이메일 삭제됨');
    } catch (error) {
        console.error('이메일 삭제 실패:', error);
    }
}

// 화면 전환 함수들
function showMainApp(userEmail) {
    // 로그인 화면 숨기기
    elements.loginScreen.style.display = 'none';
    
    // 메인 앱 화면 표시
    elements.mainAppScreen.style.display = 'flex';
    
    // 사용자 정보 업데이트
    updateUserInfo(userEmail);
    
    // 텔레그램 설정 로드
    loadTelegramSettings();
    
    // 시간 업데이트 시작
    startTimeUpdate();
}

function showLoginScreen() {
    // 메인 앱 화면 숨기기
    elements.mainAppScreen.style.display = 'none';
    
    // 로그인 화면 표시
    elements.loginScreen.style.display = 'block';
    
    // 입력 필드 초기화
    clearAllInputs();
    
    // 애니메이션 다시 시작
    stopAllAnimations();
    setTimeout(() => startTypingAnimation(), 100);
}

function updateUserInfo(userEmail) {
    // 마지막 로그인 시간만 업데이트
    if (elements.lastLogin) {
        elements.lastLogin.textContent = new Date().toLocaleString();
    }
    
    // 코드 정보 업데이트 (Firebase에서 가져오기)
    updateCodeInfo(userEmail);
}

async function updateCodeInfo(userEmail) {
    try {
        const remainingDaysMessage = await window.firebaseService.getUserCodeRemainingDays(userEmail);
        
        if (elements.codeExpiry) {
            // 메시지에서 만료일 추출
            const lines = remainingDaysMessage.split('\n');
            const expiryLine = lines.find(line => line.includes('Expires:'));
            if (expiryLine) {
                elements.codeExpiry.textContent = expiryLine.replace('Expires: ', '');
            } else {
                elements.codeExpiry.textContent = '30 days remaining';
            }
        }
        
        if (elements.codeRegistered) {
            const lines = remainingDaysMessage.split('\n');
            const registeredLine = lines.find(line => line.includes('Registered:'));
            if (registeredLine) {
                elements.codeRegistered.textContent = registeredLine.replace('Registered: ', '');
            } else {
                elements.codeRegistered.textContent = 'Today';
            }
        }
    } catch (error) {
        console.error('코드 정보 업데이트 실패:', error);
        if (elements.codeExpiry) {
            elements.codeExpiry.textContent = '30 days remaining';
        }
        if (elements.codeRegistered) {
            elements.codeRegistered.textContent = 'Today';
        }
    }
}

function startTimeUpdate() {
    if (elements.currentTime) {
        updateCurrentTime();
        // 1초마다 시간 업데이트
        setInterval(updateCurrentTime, 1000);
    }
}

function updateCurrentTime() {
    if (elements.currentTime) {
        const now = new Date();
        elements.currentTime.textContent = now.toLocaleString();
    }
}

// 텔레그램 API 입력 필드 이벤트 설정
function setupTelegramInputEvents() {
    const telegramInputs = [
        { input: elements.telegramApiId, placeholder: elements.telegramApiIdPlaceholder },
        { input: elements.telegramApiHash, placeholder: elements.telegramApiHashPlaceholder },
        { input: elements.telegramPhone, placeholder: elements.telegramPhonePlaceholder },
        { input: elements.telegramVerificationCode, placeholder: elements.telegramVerificationCodePlaceholder }
    ];
    
    telegramInputs.forEach(({ input, placeholder }) => {
        if (input && placeholder) {
            // 포커스 이벤트
            input.addEventListener('focus', () => {
                hideTelegramPlaceholder(input, placeholder);
            });
            
            // 블러 이벤트
            input.addEventListener('blur', () => {
                showTelegramPlaceholderIfEmpty(input, placeholder);
            });
            
            // 입력 이벤트
            input.addEventListener('input', () => {
                if (input.value.trim()) {
                    hideTelegramPlaceholder(input, placeholder);
                } else {
                    showTelegramPlaceholderIfEmpty(input, placeholder);
                }
            });
            
            // 핸드폰번호 자동 + 추가
            if (input.id === 'telegramPhone') {
                input.addEventListener('input', (e) => {
                    let value = e.target.value.replace(/\D/g, ''); // 숫자만 추출
                    if (value && !value.startsWith('+')) {
                        if (value.startsWith('82')) {
                            value = '+' + value;
                        } else if (value.startsWith('0')) {
                            value = '+82' + value.substring(1);
                        } else {
                            value = '+82' + value;
                        }
                    }
                    e.target.value = value;
                });
                
                // 포커스 시 + 자동 추가
                input.addEventListener('focus', () => {
                    if (!input.value.startsWith('+')) {
                        if (input.value.startsWith('82')) {
                            input.value = '+' + input.value;
                        } else if (input.value.startsWith('0')) {
                            input.value = '+82' + input.value.substring(1);
                        } else if (input.value) {
                            input.value = '+82' + input.value;
                        }
                    }
                });
            }
        }
    });
}

// 텔레그램 플레이스홀더 숨기기
function hideTelegramPlaceholder(input, placeholder) {
    if (placeholder) {
        placeholder.style.opacity = '0';
        placeholder.style.visibility = 'hidden';
        placeholder.style.transform = 'translateY(-50%) translateY(-10px)';
    }
}

// 텔레그램 플레이스홀더 표시 (빈 경우)
function showTelegramPlaceholderIfEmpty(input, placeholder) {
    if (placeholder && !input.value.trim()) {
        placeholder.style.opacity = '1';
        placeholder.style.visibility = 'visible';
        placeholder.style.transform = 'translateY(-50%)';
    }
}

// 텔레그램 설정 저장
async function handleSaveTelegramSettings() {
    const apiId = elements.telegramApiId?.value.trim();
    const apiHash = elements.telegramApiHash?.value.trim();
    const phone = elements.telegramPhone?.value.trim();
    const verificationCode = elements.telegramVerificationCode?.value.trim();
    const password = document.getElementById('telegramPassword')?.value.trim();
    
    // 유효성 검사
    if (!apiId || !apiHash || !phone) {
        alert('모든 필드를 입력해주세요.');
        return;
    }
    
    // API ID 숫자 검사
    if (!/^\d+$/.test(apiId)) {
        alert('API ID는 숫자만 입력 가능합니다.');
        return;
    }
    
    // 전화번호 형식 검사 (한국 번호 기준)
    if (!/^\+82\d{9,10}$/.test(phone)) {
        alert('올바른 한국 전화번호 형식을 입력해주세요. (예: +821012345678)');
        return;
    }
    
    // 인증 상태에 따른 처리
    console.log('현재 인증 상태:', telegramAuthState);
    console.log('입력된 인증코드:', verificationCode);
    
    if (telegramAuthState === 'idle') {
        // 첫 번째 Register 버튼 클릭 - 인증코드 요청
        console.log('인증코드 요청 시작...');
        await requestTelegramAuthCode(apiId, apiHash, phone);
    } else if (telegramAuthState === 'code_sent' && verificationCode) {
        // 인증코드 입력 후 - 인증 완료
        console.log('인증코드 검증 시작...');
        await completeTelegramAuth(verificationCode);
    } else if (telegramAuthState === 'password_needed' && password) {
        // 2단계 인증 비밀번호 입력 후 - 비밀번호 검증
        console.log('2단계 인증 비밀번호 검증 시작...');
        await completePasswordAuth(password);
    } else if (telegramAuthState === 'code_sent' && !verificationCode) {
        alert('인증코드를 입력해주세요.');
        return;
    } else if (telegramAuthState === 'password_needed' && !password) {
        alert('2단계 인증 비밀번호를 입력해주세요.');
        return;
    } else {
        console.log('알 수 없는 인증 상태:', telegramAuthState);
        alert('인증 상태를 확인할 수 없습니다. 페이지를 새로고침해주세요.');
    }
}

// 텔레그램 인증코드 요청
async function requestTelegramAuthCode(apiId, apiHash, phone) {
    try {
        telegramAuthState = 'requesting';
        elements.saveTelegramBtn.textContent = 'Requesting...';
        elements.saveTelegramBtn.disabled = true;
        
        // API ID와 Hash 저장
        telegramApiId = parseInt(apiId);
        telegramApiHash = apiHash;
        
        // 서버 연결 상태 확인 (선택적)
            console.log('텔레그램 API 서버에 직접 연결 시도 (Python Flask)');

        // Render Web Service의 텔레그램 API 서버 호출
        try {
            console.log('텔레그램 API 서버에 인증코드 요청 중...', {
                apiId: telegramApiId,
                apiHash: telegramApiHash ? '***' : 'undefined',
                phoneNumber: phone
            });
            
            console.log('실제 서버 요청 시작...');
            const response = await fetch('/api/telegram/send-code', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    apiId: telegramApiId,
                    apiHash: telegramApiHash,
                    phoneNumber: phone
                })
            });
            console.log('서버 요청 완료, 응답 받음');
            
            console.log('서버 응답 상태:', response.status);
            console.log('서버 응답 헤더:', response.headers);
            
            if (response.ok) {
                const result = await response.json();
                console.log('서버 응답 결과:', result);
                
                if (result.success && result.phoneCodeHash) {
                    // 인증코드 발송 성공
                    telegramAuthState = 'code_sent';
                    telegramClientId = result.clientId; // clientId 저장
                    telegramClient = {
                        phoneCodeHash: result.phoneCodeHash,
                        clientId: result.clientId,
                        apiId: telegramApiId,
                        apiHash: telegramApiHash,
                        phoneNumber: phone
                    };
                    
                    // 인증코드 입력칸 표시
                    showVerificationCodeInput();
                    
                    // 버튼 상태 변경
                    elements.saveTelegramBtn.textContent = 'Verify Code';
                    elements.saveTelegramBtn.disabled = false;
                    
                    // 인증코드 입력칸에 포커스
                    setTimeout(() => {
                        elements.telegramVerificationCode.focus();
                    }, 300);
                    
                    // 사용자에게 알림
                    alert('✅ 인증코드가 텔레그램 앱으로 발송되었습니다!\n\n📱 텔레그램 앱 확인 방법:\n1. 텔레그램 앱 열기\n2. 설정 → 개인정보 보호 및 보안 → 활성 세션\n3. "WINT365" 또는 "Telegram API" 세션 찾기\n4. 5자리 인증코드 확인\n\n⏰ 인증코드는 5분간 유효합니다.\n\n💡 인증코드가 보이지 않으면:\n- 텔레그램 앱을 완전히 종료 후 재시작\n- 다른 기기에서 텔레그램 앱 확인\n- 잠시 후 다시 시도');
                    
                    console.log('인증코드가 텔레그램 앱으로 발송되었습니다:', result);
                    
                } else {
                    console.error('서버 응답 실패:', result);
                    throw new Error(result.error || '인증코드 발송 실패');
                }
            } else {
                console.error('서버 응답 오류:', response.status, response.statusText);
                const errorResult = await response.json().catch(() => ({ error: '서버 오류' }));
                console.error('에러 상세:', errorResult);
                throw new Error(errorResult.error || `서버 요청 실패 (${response.status})`);
            }
            
        } catch (error) {
            console.error('❌ 텔레그램 API 서버 호출 실패:', error);
            console.error('상세 에러 정보:', {
                name: error.name,
                message: error.message,
                stack: error.stack
            });
            
            // 구체적인 에러 메시지 표시
            let errorMessage = error.message;
            let errorDetails = '';
            
            if (error.message.includes('Failed to fetch')) {
                errorMessage = '서버에 연결할 수 없습니다.';
                errorDetails = '서버가 실행 중인지 확인해주세요.';
            } else if (error.message.includes('API_ID_INVALID')) {
                errorMessage = 'API ID가 올바르지 않습니다.';
                errorDetails = '텔레그램 개발자 계정에서 API ID를 확인해주세요.';
            } else if (error.message.includes('API_HASH_INVALID')) {
                errorMessage = 'API Hash가 올바르지 않습니다.';
                errorDetails = '텔레그램 개발자 계정에서 API Hash를 확인해주세요.';
            } else if (error.message.includes('PHONE_NUMBER_INVALID')) {
                errorMessage = '전화번호 형식이 올바르지 않습니다.';
                errorDetails = '+82로 시작하는 형식으로 입력해주세요.';
            } else if (error.message.includes('PHONE_NUMBER_BANNED')) {
                errorMessage = '해당 전화번호는 사용할 수 없습니다.';
                errorDetails = '다른 전화번호를 사용해주세요.';
            } else if (error.message.includes('FLOOD_WAIT')) {
                errorMessage = '요청이 너무 많습니다.';
                errorDetails = '잠시 후 다시 시도해주세요.';
            }
            
            const fullErrorMessage = errorDetails ? 
                `❌ 인증코드 요청에 실패했습니다:\n\n${errorMessage}\n\n${errorDetails}` :
                `❌ 인증코드 요청에 실패했습니다:\n\n${errorMessage}`;
            
            alert(fullErrorMessage);
            
            telegramAuthState = 'idle';
            elements.saveTelegramBtn.textContent = 'Register';
            elements.saveTelegramBtn.disabled = false;
        }
        
    } catch (error) {
        console.error('인증코드 요청 실패:', error);
        
        // 에러 메시지에 따라 다른 안내
        let errorMessage = '인증코드 요청에 실패했습니다.';
        if (error.message.includes('PHONE_NUMBER_INVALID')) {
            errorMessage = '전화번호 형식이 올바르지 않습니다.';
        } else if (error.message.includes('PHONE_NUMBER_BANNED')) {
            errorMessage = '해당 전화번호는 사용할 수 없습니다.';
        } else if (error.message.includes('API_ID_INVALID')) {
            errorMessage = 'API ID가 올바르지 않습니다.';
        } else if (error.message.includes('API_HASH_INVALID')) {
            errorMessage = 'API Hash가 올바르지 않습니다.';
        }
        
        alert(errorMessage + ' 다시 시도해주세요.');
        
        telegramAuthState = 'idle';
        elements.saveTelegramBtn.textContent = 'Register';
        elements.saveTelegramBtn.disabled = false;
    }
}


// 인증코드 입력칸 표시
function showVerificationCodeInput() {
    const verificationGroup = elements.verificationCodeGroup;
    
    // 애니메이션으로 입력칸 표시
    verificationGroup.style.display = 'block';
    verificationGroup.classList.add('show');
    
    // 카드 높이 자동 조정
    const telegramCard = verificationGroup.closest('.telegram-card');
    if (telegramCard) {
        telegramCard.style.height = 'auto';
    }
    
    // 인증코드 입력칸에 포커스 및 플레이스홀더 설정
    setTimeout(() => {
        if (elements.telegramVerificationCode) {
            elements.telegramVerificationCode.focus();
            elements.telegramVerificationCode.placeholder = '텔레그램 앱에서 받은 5자리 코드';
        }
    }, 300);
    
    // 인증코드 입력 시 자동 포맷팅
    if (elements.telegramVerificationCode) {
        elements.telegramVerificationCode.addEventListener('input', (e) => {
            let value = e.target.value.replace(/\D/g, ''); // 숫자만 추출
            if (value.length > 5) {
                value = value.substring(0, 5); // 5자리로 제한
            }
            e.target.value = value;
            
            // 5자리가 입력되면 자동으로 검증 시도
            if (value.length === 5) {
                console.log('5자리 인증코드 입력 완료:', value);
                // 자동 검증은 하지 않고 사용자가 버튼을 누르도록 함
            }
        });
        
        // 키보드 이벤트로 숫자만 입력 허용
        elements.telegramVerificationCode.addEventListener('keypress', (e) => {
            // 숫자(0-9)만 허용
            if (!/[0-9]/.test(e.key) && !['Backspace', 'Delete', 'Tab', 'Enter'].includes(e.key)) {
                e.preventDefault();
            }
        });
    }
}

// 2단계 인증 비밀번호 입력칸 표시 (같은 칸에서 인증코드 → 비밀번호로 변경)
function showPasswordInput() {
    const verificationGroup = elements.verificationCodeGroup;
    const verificationInput = elements.telegramVerificationCode;
    const passwordInput = document.getElementById('telegramPassword');
    
    if (verificationGroup && verificationInput && passwordInput) {
        console.log('🔄 인증코드 입력칸을 비밀번호 입력칸으로 변경 중...');
        
        // 인증코드 입력칸을 비밀번호 입력칸으로 변경
        verificationInput.style.display = 'none';
        passwordInput.style.display = 'block';
        
        // 플레이스홀더와 아이콘 업데이트
        const placeholder = document.getElementById('telegramVerificationCodePlaceholder');
        const icon = verificationGroup.querySelector('.telegram-input-icon');
        
        if (placeholder) {
            placeholder.textContent = '2단계 인증 비밀번호';
        }
        if (icon) {
            icon.textContent = '🔐';
        }
        
        // 비밀번호 입력 필드에 포커스 및 Enter 키 이벤트 추가
        setTimeout(() => {
            passwordInput.focus();
            
            // Enter 키 이벤트 추가
            passwordInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    const saveBtn = document.getElementById('saveTelegramBtn');
                    if (saveBtn && !saveBtn.disabled) {
                        saveBtn.click();
                    }
                }
            });
        }, 100);
        
        // 버튼 텍스트 변경
        const saveBtn = document.getElementById('saveTelegramBtn');
        if (saveBtn) {
            saveBtn.textContent = 'Enter Password';
        }
        
        // 버튼 상태 초기화 (에러 상태에서 정상 상태로)
        if (saveBtn) {
            saveBtn.disabled = false;
        }
        
        console.log('✅ 비밀번호 입력칸으로 변경 완료');
    }
}

// 2단계 인증 비밀번호 처리
async function completePasswordAuth(password) {
    try {
        telegramAuthState = 'requesting';
        elements.saveTelegramBtn.textContent = 'Verifying Password...';
        elements.saveTelegramBtn.disabled = true;
        
        console.log('🔐 2단계 인증 비밀번호 전송 중...', {
            client_id: telegramClientId,
            password_length: password.length
        });
        
        const response = await fetch('/api/telegram/verify-password', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                client_id: telegramClientId,
                password: password
            })
        });
        
        const result = await response.json();
        console.log('🔐 2단계 인증 응답:', result);
        
        if (response.ok && result.success) {
            console.log('✅ 2단계 인증 성공!');
            
            // 입력 필드 초기화 (안전하게)
            if (elements.telegramApiId) elements.telegramApiId.value = '';
            if (elements.telegramApiHash) elements.telegramApiHash.value = '';
            if (elements.telegramPhone) elements.telegramPhone.value = '';
            if (elements.telegramVerificationCode) elements.telegramVerificationCode.value = '';
            
            const passwordInput = document.getElementById('telegramPassword');
            if (passwordInput) passwordInput.value = '';
            
            // 입력칸 숨기기
            document.getElementById('verificationCodeGroup').style.display = 'none';
            
            // 버튼 상태 초기화
            elements.saveTelegramBtn.textContent = 'Register';
            elements.saveTelegramBtn.disabled = false;
            telegramAuthState = 'idle';
            
            // status-bar 내리기 애니메이션 후 계정 목록 표시
            console.log('🎬 2단계 인증 성공! status-bar 애니메이션 시작');
            hideStatusBarAndShowAccounts();
            
        } else {
            console.error('❌ 2단계 인증 실패:', result);
            throw new Error(result.error || '2단계 인증에 실패했습니다.');
        }
        
    } catch (error) {
        console.error('❌ 2단계 인증 실패:', error);
        alert(`❌ 2단계 인증에 실패했습니다:\n\n${error.message}`);
        
        telegramAuthState = 'idle';
        elements.saveTelegramBtn.textContent = 'Enter Password';
        elements.saveTelegramBtn.disabled = false;
    }
}

// 텔레그램 인증 완료
async function completeTelegramAuth(verificationCode) {
    try {
        telegramAuthState = 'requesting';
        elements.saveTelegramBtn.textContent = 'Verifying...';
        elements.saveTelegramBtn.disabled = true;
        
        if (!telegramClient) {
            throw new Error('텔레그램 클라이언트가 초기화되지 않았습니다.');
        }
        
        // Render Web Service의 텔레그램 API 서버를 통한 인증
        let authResult;
        
        try {
            console.log('인증코드 검증 요청 중...', {
                clientId: telegramClient.clientId,
                phoneCode: verificationCode,
                phoneCodeLength: verificationCode ? verificationCode.length : 0,
                phoneCodeHash: telegramClient.phoneCodeHash ? '***' : 'undefined'
            });
            
            // 인증코드 형식 검증
            if (!verificationCode || verificationCode.length !== 5 || !/^\d{5}$/.test(verificationCode)) {
                throw new Error('인증코드는 5자리 숫자여야 합니다.');
            }
            
            const response = await fetch('/api/telegram/verify-code', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    phoneCode: verificationCode,
                    clientId: telegramClient.clientId
                })
            });
            
            console.log('인증 응답 상태:', response.status);
            
            if (response.ok) {
                const result = await response.json();
                console.log('인증 응답 결과:', result);
                
                if (result.success && result.user) {
                    authResult = result;
                } else {
                    console.error('인증 실패:', result);
                    throw new Error(result.error || '인증 실패');
                }
            } else {
                const errorResult = await response.json().catch(() => ({ error: '서버 오류' }));
                console.error('인증 서버 오류:', errorResult);
                
                // 2단계 인증이 필요한 경우 특별 처리
                if (errorResult.error && errorResult.error.includes('SESSION_PASSWORD_NEEDED')) {
                    console.log('🔐 2단계 인증이 필요합니다. 비밀번호 입력칸을 표시합니다.');
                    
                    // 2단계 인증 비밀번호 입력칸 표시
                    showPasswordInput();
                    
                    // 인증 상태를 password_needed로 변경
                    telegramAuthState = 'password_needed';
                    
                    // 버튼 상태 초기화
                    elements.saveTelegramBtn.disabled = false;
                    
                    // 에러를 던지지 않고 정상 종료
                    return;
                }
                
                throw new Error(errorResult.error || `서버 요청 실패 (${response.status})`);
            }
            
        } catch (error) {
            console.error('텔레그램 인증 실패:', error);
            throw error;
        }
        
        if (authResult && authResult.user) {
            // 인증 성공
            telegramAuthState = 'authenticated';
            
            // 로컬 스토리지에 저장
            const telegramSettings = {
                apiId: elements.telegramApiId.value.trim(),
                apiHash: elements.telegramApiHash.value.trim(),
                phone: elements.telegramPhone.value.trim(),
                isAuthenticated: true,
                authenticatedAt: new Date().toISOString(),
                userId: authResult.user.id,
                username: authResult.user.username || '',
                firstName: authResult.user.first_name || '',
                lastName: authResult.user.last_name || ''
            };
            
            localStorage.setItem('telegramSettings', JSON.stringify(telegramSettings));
            
            // 성공 메시지
            elements.saveTelegramBtn.textContent = '✓ Authenticated';
            elements.saveTelegramBtn.style.background = '#10B981';
            elements.saveTelegramBtn.style.borderColor = '#10B981';
            
            // 입력 필드들 비활성화
            elements.telegramApiId.disabled = true;
            elements.telegramApiHash.disabled = true;
            elements.telegramPhone.disabled = true;
            elements.telegramVerificationCode.disabled = true;
            
            console.log('텔레그램 인증 완료:', telegramSettings);
            
            // status-bar 내리기 애니메이션 후 계정 목록 표시
            console.log('🎬 일반 인증 성공! status-bar 애니메이션 시작');
            hideStatusBarAndShowAccounts();
            
        } else {
            throw new Error('인증 결과가 올바르지 않습니다.');
        }
        
        } catch (error) {
            console.error('❌ 인증 실패:', error);
            console.error('상세 에러 정보:', {
                name: error.name,
                message: error.message,
                stack: error.stack
            });
            
            // 에러 메시지에 따라 다른 안내
            let errorMessage = '인증에 실패했습니다.';
            let errorDetails = '';
            
            console.error('인증 실패 상세 정보:', error);
            
            if (error.message.includes('PHONE_CODE_INVALID')) {
                errorMessage = '인증코드가 올바르지 않습니다.';
                errorDetails = '텔레그램 앱에서 받은 5자리 코드를 정확히 입력해주세요.\n\n💡 팁: 인증코드는 보통 5자리 숫자입니다.';
            } else if (error.message.includes('PHONE_CODE_EXPIRED')) {
                errorMessage = '인증코드가 만료되었습니다.';
                errorDetails = '인증코드는 5분간만 유효합니다.\n새로운 인증코드를 요청해주세요.';
            } else if (error.message.includes('SESSION_PASSWORD_NEEDED')) {
                // 2단계 인증이 필요한 경우 - 메시지박스 없이 바로 입력칸 표시
                console.log('🔐 2단계 인증이 필요합니다. 비밀번호 입력칸을 표시합니다.');
                
                // 2단계 인증 비밀번호 입력칸 표시
                showPasswordInput();
                
                // 인증 상태를 password_needed로 변경
                telegramAuthState = 'password_needed';
                
                // 버튼 상태 초기화 (에러 상태에서 정상 상태로)
                elements.saveTelegramBtn.disabled = false;
                
                // 메시지박스 표시하지 않고 바로 return
                return;
            } else if (error.message.includes('PHONE_NUMBER_UNOCCUPIED')) {
                errorMessage = '등록되지 않은 전화번호입니다.';
                errorDetails = '텔레그램에 등록된 전화번호를 사용해주세요.';
            } else if (error.message.includes('FLOOD_WAIT')) {
                errorMessage = '🚫 Flood Control: 요청이 너무 많습니다.';
                errorDetails = '같은 전화번호로 너무 자주 인증코드를 요청했습니다.\n텔레그램의 보안 정책에 따라 일정 시간 대기해야 합니다.\n\n⏰ 보통 5-10분 정도 기다린 후 다시 시도해주세요.';
            } else if (error.message.includes('클라이언트 데이터를 찾을 수 없습니다')) {
                errorMessage = '세션이 만료되었습니다.';
                errorDetails = '인증코드를 다시 요청해주세요.';
            } else {
                errorMessage = `인증 실패: ${error.message}`;
                errorDetails = '서버 로그를 확인하거나 다시 시도해주세요.';
            }
            
            const fullErrorMessage = errorDetails ? 
                `❌ ${errorMessage}\n\n${errorDetails}\n\n다시 시도해주세요.` :
                `❌ ${errorMessage}\n\n다시 시도해주세요.`;
            
            alert(fullErrorMessage);
            
            telegramAuthState = 'code_sent';
            elements.saveTelegramBtn.textContent = 'Verify Code';
            elements.saveTelegramBtn.disabled = false;
        }
}

// 성공 메시지 표시
function showSuccessMessage(user) {
    const message = `🎉 텔레그램 인증 완료!\n\n👤 사용자: ${user.first_name || 'Unknown'} ${user.last_name || ''}\n🆔 ID: ${user.id}\n📱 Username: @${user.username || 'N/A'}\n\n✅ 시스템이 활성화되었습니다!`;
    
    // 커스텀 모달 창 생성
    const modal = document.createElement('div');
    modal.className = 'success-modal';
    modal.innerHTML = `
        <div class="success-modal-content">
            <div class="success-icon">✅</div>
            <h2>인증 완료!</h2>
            <p>${message.replace(/\n/g, '<br>')}</p>
            <button class="success-btn" onclick="this.parentElement.parentElement.remove()">확인</button>
        </div>
    `;
    
    // 스타일 추가
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.8);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 10000;
    `;
    
    const content = modal.querySelector('.success-modal-content');
    content.style.cssText = `
        background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%);
        border: 2px solid #10B981;
        border-radius: 15px;
        padding: 30px;
        text-align: center;
        color: white;
        max-width: 500px;
        box-shadow: 0 20px 40px rgba(0, 0, 0, 0.5);
    `;
    
    const icon = modal.querySelector('.success-icon');
    icon.style.cssText = `
        font-size: 48px;
        margin-bottom: 20px;
    `;
    
    const btn = modal.querySelector('.success-btn');
    btn.style.cssText = `
        background: linear-gradient(135deg, #10B981 0%, #059669 100%);
        color: white;
        border: none;
        padding: 12px 30px;
        border-radius: 8px;
        font-size: 16px;
        font-weight: 600;
        cursor: pointer;
        margin-top: 20px;
        transition: all 0.3s ease;
    `;
    
    btn.addEventListener('mouseenter', () => {
        btn.style.transform = 'translateY(-2px)';
        btn.style.boxShadow = '0 10px 20px rgba(16, 185, 129, 0.3)';
    });
    
    btn.addEventListener('mouseleave', () => {
        btn.style.transform = 'translateY(0)';
        btn.style.boxShadow = 'none';
    });
    
    document.body.appendChild(modal);
    
    // 3초 후 자동으로 닫기
    setTimeout(() => {
        if (modal.parentElement) {
            modal.remove();
        }
    }, 5000);
}

// 그룹 목록 기능은 Flood Control 때문에 일단 비활성화

// 텔레그램 연결 테스트 (계정 목록 로드)
async function handleTestTelegramConnection() {
    // 로드 버튼 상태 변경
    elements.testTelegramBtn.textContent = 'Loading...';
    elements.testTelegramBtn.disabled = true;
    
    try {
        console.log('🔍 Firebase에서 연동된 계정 목록 로딩 중...');
        
        const response = await fetch('/api/telegram/load-accounts', {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            }
        });
        
        const result = await response.json();
        console.log('🔍 계정 목록 응답:', result);
        
        if (response.ok && result.success) {
            if (result.accounts && result.accounts.length > 0) {
                console.log(`✅ ${result.accounts.length}개의 연동된 계정을 찾았습니다.`);
                
                // 계정 목록 표시 (그룹 선택창으로)
                showAccountSelectionModal(result.accounts);
                
                elements.testTelegramBtn.textContent = 'Load';
                elements.testTelegramBtn.disabled = false;
            } else {
                console.log('📭 연동된 계정이 없습니다.');
                
                
                alert('연동된 계정이 없습니다.\n먼저 텔레그램 계정을 연동해주세요.');
                
                elements.testTelegramBtn.textContent = 'No Accounts';
                elements.testTelegramBtn.style.background = 'linear-gradient(135deg, #6c757d 0%, #5a6268 100%)';
                
                setTimeout(() => {
                    elements.testTelegramBtn.textContent = 'Load';
                    elements.testTelegramBtn.style.background = 'linear-gradient(135deg, #28a745 0%, #1e7e34 100%)';
                    elements.testTelegramBtn.disabled = false;
                }, 3000);
            }
        } else {
            throw new Error(result.error || '계정 목록 로딩 실패');
        }
        
    } catch (error) {
        console.error('❌ 계정 목록 로딩 실패:', error);
        
        
        elements.testTelegramBtn.textContent = '✗ Failed';
        elements.testTelegramBtn.style.background = 'linear-gradient(135deg, #dc3545 0%, #c82333 100%)';
        alert(`계정 목록 로딩 실패:\n\n${error.message}`);
        
        setTimeout(() => {
            elements.testTelegramBtn.textContent = 'Load';
            elements.testTelegramBtn.style.background = 'linear-gradient(135deg, #28a745 0%, #1e7e34 100%)';
            elements.testTelegramBtn.disabled = false;
        }, 3000);
    }
}


// 계정 선택 모달 표시 (그룹 선택 포함)
function showAccountSelectionModal(accounts) {
    console.log('📋 계정 및 그룹 선택 모달 표시 중...', accounts);
    
    // 계정 목록을 표시할 모달 생성
    const modal = document.createElement('div');
    modal.id = 'accountListModal';
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.8);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 10000;
        backdrop-filter: blur(5px);
    `;
    
    const modalContent = document.createElement('div');
    modalContent.style.cssText = `
        background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%);
        border-radius: 20px;
        padding: 30px;
        max-width: 500px;
        width: 90%;
        max-height: 80vh;
        overflow-y: auto;
        border: 2px solid #10B981;
        box-shadow: 0 20px 40px rgba(0, 0, 0, 0.5);
    `;
    
    modalContent.innerHTML = `
        <div style="text-align: center; margin-bottom: 25px;">
            <h2 style="color: #10B981; margin: 0 0 10px 0; font-size: 24px; font-weight: 600;">
                📱 연동된 텔레그램 계정
            </h2>
            <p style="color: #888; margin: 0; font-size: 14px;">
                ${accounts.length}개의 계정이 연동되어 있습니다
            </p>
        </div>
        
        <div id="accountList" style="margin-bottom: 25px;">
            ${accounts.map((account, index) => `
                <div class="account-item" style="
                    background: linear-gradient(135deg, #2a2a2a 0%, #3a3a3a 100%);
                    border: 1px solid #444;
                    border-radius: 12px;
                    padding: 15px;
                    margin-bottom: 10px;
                    cursor: pointer;
                    transition: all 0.3s ease;
                    position: relative;
                " data-user-id="${account.user_id}">
                    <div style="display: flex; align-items: center; justify-content: space-between;">
                        <div style="flex: 1;">
                            <div style="color: #10B981; font-weight: 600; font-size: 16px; margin-bottom: 5px;">
                                ${account.first_name} ${account.last_name || ''}
                            </div>
                            <div style="color: #888; font-size: 14px; margin-bottom: 3px;">
                                📱 ${account.phone_number}
                            </div>
                            ${account.username ? `
                                <div style="color: #888; font-size: 14px;">
                                    @${account.username}
                                </div>
                            ` : ''}
                        </div>
                        <div style="color: #10B981; font-size: 20px;">
                            ▶
                        </div>
                    </div>
                </div>
            `).join('')}
        </div>
        
        <div style="text-align: center;">
            <button id="closeAccountList" style="
                background: linear-gradient(135deg, #6c757d 0%, #5a6268 100%);
                color: white;
                border: none;
                padding: 12px 30px;
                border-radius: 8px;
                font-size: 14px;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.3s ease;
            ">닫기</button>
        </div>
    `;
    
    modal.appendChild(modalContent);
    document.body.appendChild(modal);
    
    // 계정 클릭 이벤트
    const accountItems = modal.querySelectorAll('.account-item');
    accountItems.forEach(item => {
        item.addEventListener('mouseenter', () => {
            item.style.borderColor = '#10B981';
            item.style.transform = 'translateY(-2px)';
            item.style.boxShadow = '0 5px 15px rgba(16, 185, 129, 0.3)';
        });
        
        item.addEventListener('mouseleave', () => {
            item.style.borderColor = '#444';
            item.style.transform = 'translateY(0)';
            item.style.boxShadow = 'none';
        });
        
        item.addEventListener('click', () => {
            const accountData = item.dataset.account;
            const account = JSON.parse(accountData);
            
            console.log('📱 선택된 계정:', account);
            
            // 선택된 계정 표시
            item.style.borderColor = '#10B981';
            item.style.background = 'linear-gradient(135deg, #1a4d3a 0%, #2a5d4a 100%)';
            
            // 다른 계정들 선택 해제
            accountItems.forEach(otherItem => {
                if (otherItem !== item) {
                    otherItem.style.borderColor = '#444';
                    otherItem.style.background = 'linear-gradient(135deg, #2a2a2a 0%, #3a3a3a 100%)';
                }
            });
            
            // 그룹 선택 섹션 표시
            const groupSelection = modal.querySelector('#groupSelection');
            const confirmBtn = modal.querySelector('#confirmSelection');
            
            if (groupSelection && confirmBtn) {
                groupSelection.style.display = 'block';
                confirmBtn.style.display = 'inline-block';
                
                // 그룹 목록 로드
                loadGroupsForSelection(account, modal);
            }
        });
    });
    
    // 확인 버튼 이벤트
    modal.querySelector('#confirmSelection').addEventListener('click', () => {
        const selectedAccountItem = modal.querySelector('.account-item[style*="1a4d3a"]');
        if (selectedAccountItem) {
            const accountData = selectedAccountItem.dataset.account;
            const account = JSON.parse(accountData);
            
            console.log('📱 최종 선택된 계정:', account);
            
            // 모달 닫기
            document.body.removeChild(modal);
            
            // 선택된 계정으로 그룹 로드
            loadGroupsForAccount(account);
        }
    });
    
    // 닫기 버튼 이벤트
    modal.querySelector('#closeAccountList').addEventListener('click', () => {
        document.body.removeChild(modal);
    });
    
    // 모달 배경 클릭 시 닫기
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            document.body.removeChild(modal);
        }
    });
}

// 모달 내에서 그룹 목록 로드
async function loadGroupsForSelection(account, modal) {
    console.log('📱 모달 내에서 그룹 목록 로드:', account);
    
    const groupList = modal.querySelector('#groupList');
    if (!groupList) return;
    
    // 로딩 표시
    groupList.innerHTML = `
        <div style="text-align: center; color: #888; padding: 20px;">
            그룹 목록을 불러오는 중...
        </div>
    `;
    
    try {
        // 그룹 목록 API 호출
        const response = await fetch('/api/telegram/groups', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                userId: account.user_id
            })
        });
        
        const result = await response.json();
        console.log('📱 그룹 목록 응답:', result);
        
        if (response.ok && result.success) {
            const groups = result.groups || [];
            console.log('📱 로드된 그룹들:', groups);
            
            if (groups.length > 0) {
                groupList.innerHTML = groups.map(group => `
                    <div style="
                        background: #2a2a2a;
                        border: 1px solid #444;
                        border-radius: 8px;
                        padding: 10px;
                        margin-bottom: 8px;
                        display: flex;
                        align-items: center;
                        justify-content: space-between;
                    ">
                        <div style="flex: 1;">
                            <div style="color: #fff; font-weight: 500; font-size: 14px;">
                                ${group.title || 'Unknown Group'}
                            </div>
                            <div style="color: #888; font-size: 12px;">
                                ${group.username ? '@' + group.username : 'No username'}
                            </div>
                        </div>
                        <div style="color: #10B981; font-size: 12px;">
                            ${group.member_count || 0}명
                        </div>
                    </div>
                `).join('');
            } else {
                groupList.innerHTML = `
                    <div style="text-align: center; color: #888; padding: 20px;">
                        그룹이 없습니다.
                    </div>
                `;
            }
        } else {
            throw new Error(result.error || '그룹 목록 로딩 실패');
        }
        
    } catch (error) {
        console.error('❌ 그룹 목록 로딩 실패:', error);
        groupList.innerHTML = `
            <div style="text-align: center; color: #dc3545; padding: 20px;">
                그룹 목록 로딩 실패<br>
                ${error.message}
            </div>
        `;
    }
}

// 선택된 계정으로 그룹 로드
async function loadGroupsForAccount(account) {
    try {
        console.log('🔍 선택된 계정으로 그룹 로딩 중...', account);
        
        const response = await fetch('/api/telegram/load-groups', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                userId: account.user_id
            })
        });
        
        const result = await response.json();
        console.log('🔍 그룹 로딩 응답:', result);
        
        if (response.ok && result.success) {
            console.log('✅ 그룹 로딩 성공:', result.groups);
            
            // 그룹 목록 표시
            if (result.groups && result.groups.length > 0) {
                showGroupList(result.groups, account);
            } else {
                alert(`✅ 텔레그램 연결 완료!\n\n👤 계정: ${account.first_name} ${account.last_name || ''}\n📱 전화번호: ${account.phone_number}\n🆔 사용자 ID: ${account.user_id}\n\n📭 참여한 그룹이 없습니다.`);
            }
        } else {
            throw new Error(result.error || '그룹 로딩 실패');
        }
        
    } catch (error) {
        console.error('❌ 그룹 로딩 실패:', error);
        alert(`❌ 그룹 로딩 실패:\n\n${error.message}`);
    }
}

// 그룹 목록 표시 (새로운 그룹 관리 창 사용)
function showGroupList(groups, account) {
    console.log('📋 그룹 목록 표시 중...', groups);
    
    // status-bar 애니메이션과 그룹 관리 창 표시
    showTelegramGroupsWindow(groups, account);
}

// 텔레그램 그룹 관리 창 표시
function showTelegramGroupsWindow(groups, account) {
    console.log('🎬 텔레그램 그룹 관리 창 표시 시작');
    
    // status-bar 내리기 애니메이션
    const statusBar = document.querySelector('.status-bar');
    if (statusBar) {
        statusBar.style.transition = 'transform 0.5s ease-in-out';
        statusBar.style.transform = 'translateY(100%)';
        console.log('🎬 status-bar 내리기 애니메이션 시작');
    }
    
    // 그룹 관리 창 표시
    const groupsWindow = document.getElementById('telegramGroupsWindow');
    if (groupsWindow) {
        // 계정 정보 설정
        document.getElementById('selectedAccountName').textContent = `${account.first_name} ${account.last_name || ''}`;
        document.getElementById('selectedAccountPhone').textContent = `📱 ${account.phone_number}`;
        
        // 그룹 개수 설정
        document.getElementById('groupsCount').textContent = `${groups.length}개의 그룹`;
        
        // 그룹 목록 렌더링
        renderGroupsList(groups);
        
        // 창 표시 (제일 위로 올라오기)
        groupsWindow.style.display = 'flex';
        setTimeout(() => {
            groupsWindow.classList.add('show');
        }, 100);
        
        console.log('✅ 텔레그램 그룹 관리 창 표시 완료');
    }
}

// 그룹 목록 렌더링
function renderGroupsList(groups) {
    const groupsList = document.getElementById('groupsList');
    if (!groupsList) return;
    
    groupsList.innerHTML = groups.map((group, index) => `
        <div class="group-item" data-group-id="${group.id}" data-group-index="${index}">
            <div class="group-checkbox-container">
                <input type="checkbox" class="group-checkbox" id="group-${group.id}" data-group-id="${group.id}">
                <label for="group-${group.id}" class="group-label">
                    <div class="group-name">${group.title}</div>
                    <div class="group-info">
                        <div class="group-type">
                            ${group.type === 'supergroup' ? '슈퍼그룹' : '채널'}
                        </div>
                    </div>
                </label>
            </div>
        </div>
    `).join('');
    
    // 체크박스 이벤트 추가
    const groupCheckboxes = groupsList.querySelectorAll('.group-checkbox');
    groupCheckboxes.forEach(checkbox => {
        checkbox.addEventListener('change', updateSelectedGroupsCount);
    });
    
    // 초기 선택된 그룹 수 업데이트
    updateSelectedGroupsCount();
}

// 선택된 그룹 수 업데이트
function updateSelectedGroupsCount() {
    const checkedBoxes = document.querySelectorAll('.group-checkbox:checked');
    const count = checkedBoxes.length;
    
    const countElement = document.getElementById('selectedGroupsCount');
    if (countElement) {
        countElement.textContent = `선택된 그룹: ${count}개`;
        
        // 선택된 그룹이 있으면 초록색, 없으면 회색
        if (count > 0) {
            countElement.style.color = '#10B981';
        } else {
            countElement.style.color = '#888';
        }
    }
    
    // 전송 버튼 활성화/비활성화
    const sendBtn = document.getElementById('sendMessageBtn');
    if (sendBtn) {
        if (count > 0) {
            sendBtn.disabled = false;
            sendBtn.style.opacity = '1';
        } else {
            sendBtn.disabled = true;
            sendBtn.style.opacity = '0.5';
        }
    }
}


// 텔레그램 그룹 관리 창 이벤트 리스너 설정
function setupTelegramGroupsEventListeners() {
    // 그룹 관리 창 닫기 버튼
    const groupsCloseBtn = document.getElementById('groupsCloseBtn');
    if (groupsCloseBtn) {
        groupsCloseBtn.addEventListener('click', closeTelegramGroupsWindow);
    }
    
    // 새로고침 버튼
    const refreshGroupsBtn = document.getElementById('refreshGroupsBtn');
    if (refreshGroupsBtn) {
        refreshGroupsBtn.addEventListener('click', refreshGroups);
    }
    
    // 메시지 전송 버튼
    const sendMessageBtn = document.getElementById('sendMessageBtn');
    if (sendMessageBtn) {
        sendMessageBtn.addEventListener('click', sendMessageToGroup);
    }
    
    // 메시지 지우기 버튼
    const clearMessageBtn = document.getElementById('clearMessageBtn');
    if (clearMessageBtn) {
        clearMessageBtn.addEventListener('click', clearMessage);
    }
    
    // 무한 전송 토글 스위치
    const infiniteSendToggle = document.getElementById('infiniteSendToggle');
    if (infiniteSendToggle) {
        infiniteSendToggle.addEventListener('change', toggleInfiniteSend);
    }
    
    // 무한 전송 설정 모달 닫기 버튼
    const closeInfiniteSendBtn = document.getElementById('closeInfiniteSendBtn');
    if (closeInfiniteSendBtn) {
        closeInfiniteSendBtn.addEventListener('click', closeInfiniteSendModal);
    }
    
    // 설정 저장 버튼
    const saveSettingsBtn = document.getElementById('saveSettingsBtn');
    if (saveSettingsBtn) {
        saveSettingsBtn.addEventListener('click', saveInfiniteSendSettings);
    }
    
    // 저장된 메시지 버튼
    const savedMessagesBtn = document.getElementById('savedMessagesBtn');
    if (savedMessagesBtn) {
        savedMessagesBtn.addEventListener('click', showSavedMessages);
    }
    
    // 저장된 메시지 모달 닫기 버튼
    const closeSavedMessagesBtn = document.getElementById('closeSavedMessagesBtn');
    if (closeSavedMessagesBtn) {
        closeSavedMessagesBtn.addEventListener('click', closeSavedMessages);
    }
}

// 그룹 관리 창 닫기
function closeTelegramGroupsWindow() {
    console.log('🎬 텔레그램 그룹 관리 창 닫기');
    
    const groupsWindow = document.getElementById('telegramGroupsWindow');
    const statusBar = document.querySelector('.status-bar');
    
    if (groupsWindow) {
        groupsWindow.classList.remove('show');
        setTimeout(() => {
            groupsWindow.style.display = 'none';
        }, 500);
    }
    
    if (statusBar) {
        statusBar.style.transform = 'translateY(0)';
    }
    
    // 메시지 입력 필드 초기화
    const messageInput = document.querySelector('.message-input');
    if (messageInput) {
        messageInput.value = '';
    }
    
    // 미디어 정보 초기화
    window.selectedMediaInfo = null;
    
    // 선택된 그룹 체크박스 초기화
    const groupCheckboxes = document.querySelectorAll('.group-checkbox');
    groupCheckboxes.forEach(checkbox => {
        checkbox.checked = false;
    });
    
    // 선택된 그룹 수 업데이트
    updateSelectedGroupsCount();
}

// 그룹 목록 새로고침
async function refreshGroups() {
    console.log('🔄 그룹 목록 새로고침');
    
    const refreshBtn = document.getElementById('refreshGroupsBtn');
    if (refreshBtn) {
        refreshBtn.textContent = '🔄 새로고침 중...';
        refreshBtn.disabled = true;
    }
    
    try {
        // 현재 선택된 계정 정보 가져오기
        const accountName = document.getElementById('selectedAccountName').textContent;
        const accountPhone = document.getElementById('selectedAccountPhone').textContent;
        
        if (!accountName || !accountPhone) {
            throw new Error('계정 정보를 찾을 수 없습니다.');
        }
        
        // 계정 목록에서 해당 계정 찾기
        const response = await fetch('/api/telegram/load-accounts', {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            }
        });
        
        const result = await response.json();
        if (response.ok && result.success && result.accounts) {
            const account = result.accounts.find(acc => 
                `${acc.first_name} ${acc.last_name || ''}`.trim() === accountName.trim()
            );
            
            if (account) {
                // 그룹 다시 로드
                await loadGroupsForAccount(account);
            } else {
                throw new Error('계정을 찾을 수 없습니다.');
            }
        } else {
            throw new Error(result.error || '계정 목록 로딩 실패');
        }
        
    } catch (error) {
        console.error('❌ 그룹 새로고침 실패:', error);
        alert(`❌ 그룹 새로고침 실패:\n\n${error.message}`);
    } finally {
        if (refreshBtn) {
            refreshBtn.textContent = '🔄 새로고침';
            refreshBtn.disabled = false;
        }
    }
}

// 선택된 그룹들에 메시지 전송
async function sendMessageToGroup() {
    console.log('📤 선택된 그룹들에 메시지 전송');
    
    // 무한 전송이 활성화되어 있으면 무한 전송 시작
    if (window.infiniteSendEnabled && !window.isInfiniteSending) {
        console.log('🔄 무한 전송 모드로 전환');
        startInfiniteSend();
        return;
    }
    
    const messageInput = document.querySelector('.message-input');
    const sendBtn = document.getElementById('sendMessageBtn');
    
    // 메시지 확인 (저장된 메시지가 선택되어 있으면 입력칸이 비어있어도 OK)
    const hasSavedMessage = window.selectedMediaInfo && window.selectedMediaInfo.raw_message_data;
    
    if (!messageInput || (!messageInput.value.trim() && !hasSavedMessage)) {
        alert('전송할 메시지를 입력하거나 저장된 메시지를 선택해주세요.');
        messageInput?.focus();
        return;
    }
    
    // 선택된 그룹들 확인
    const checkedBoxes = document.querySelectorAll('.group-checkbox:checked');
    if (checkedBoxes.length === 0) {
        alert('전송할 그룹을 선택해주세요.');
        return;
    }
    
    // 원본 메시지 데이터가 있으면 우선 사용, 없으면 입력칸의 텍스트 사용
    let message;
    let mediaInfo = null;
    
    if (window.selectedMediaInfo) {
        // 저장된 메시지가 선택된 경우 - 원본 메시지 객체 전체를 그대로 전송
        mediaInfo = window.selectedMediaInfo;
        
        // 커스텀 이모지가 있는 경우 원본 메시지 객체 전체를 전송
        if (mediaInfo.has_custom_emoji) {
            // 텍스트 처리를 완전히 우회하고 원본 메시지 객체를 그대로 전송
            message = null; // 텍스트는 null로 설정
            console.log('📤 커스텀 이모지 원본 객체 전체 전송 모드');
            console.log('📤 원본 메시지 객체:', mediaInfo.raw_message_data);
        } else {
            message = mediaInfo.text || messageInput.value.trim();
            console.log('📤 일반 저장된 메시지 사용:', message);
        }
        
        console.log('📤 최종 전송 메시지:', message);
        console.log('📤 미디어 정보:', mediaInfo);
        console.log('📤 커스텀 이모지 여부:', mediaInfo.has_custom_emoji);
    } else {
        message = messageInput.value.trim();
        console.log('📤 입력칸 텍스트 사용:', message);
    }
    const selectedGroupIds = Array.from(checkedBoxes).map(checkbox => checkbox.dataset.groupId);
    
    console.log('🔍 선택된 그룹 ID들:', selectedGroupIds);
    console.log('🔍 체크된 체크박스들:', checkedBoxes);
    
    // 그룹 ID 유효성 검사
    const validGroupIds = selectedGroupIds.filter(id => id && id !== 'undefined');
    if (validGroupIds.length === 0) {
        alert('선택된 그룹의 ID를 찾을 수 없습니다. 페이지를 새로고침하고 다시 시도해주세요.');
        return;
    }
    
    console.log('🔍 유효한 그룹 ID들:', validGroupIds);
    
    // 버튼 상태 변경
    if (sendBtn) {
        sendBtn.textContent = '📤 전송 중...';
        sendBtn.disabled = true;
    }
    
    try {
        // 현재 계정 정보 가져오기
        const accountName = document.getElementById('selectedAccountName').textContent;
        const accountPhone = document.getElementById('selectedAccountPhone').textContent;
        
        // 계정 목록에서 해당 계정 찾기
        const response = await fetch('/api/telegram/load-accounts', {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            }
        });
        
        const result = await response.json();
        if (!response.ok || !result.success || !result.accounts) {
            throw new Error(result.error || '계정 목록 로딩 실패');
        }
        
        const account = result.accounts.find(acc => 
            `${acc.first_name} ${acc.last_name || ''}`.trim() === accountName.trim()
        );
        
        if (!account) {
            throw new Error('계정을 찾을 수 없습니다.');
        }
        
        // 선택된 그룹들에 메시지 전송
        let successCount = 0;
        let failCount = 0;
        
        for (let i = 0; i < validGroupIds.length; i++) {
            const groupId = validGroupIds[i];
            
            console.log(`🔍 그룹 ${i + 1} 전송 시도: ${groupId}`);
            
            try {
                // 서버로 전송할 데이터 준비
                const sendData = {
                    userId: account.user_id,
                    groupId: groupId,
                    message: message,
                    mediaInfo: mediaInfo
                };
                
                // 커스텀 이모지가 있는 경우 원본 메시지 객체 전체를 전송
                if (mediaInfo && mediaInfo.has_custom_emoji) {
                    // 원본 메시지 객체 전체를 그대로 전송
                    sendData.original_message_object = mediaInfo.original_message_object || mediaInfo.raw_message_data || mediaInfo;
                    sendData.is_original_message = true;
                    sendData.bypass_text_processing = true;
                    sendData.message = null; // 텍스트 처리를 우회
                    sendData.send_as_original = true; // 서버에서 원본 객체로 처리하라는 플래그
                    
                    console.log('📤 원본 메시지 객체 전체 전송:', {
                        original_message_object: sendData.original_message_object,
                        is_original_message: sendData.is_original_message,
                        bypass_text_processing: sendData.bypass_text_processing,
                        send_as_original: sendData.send_as_original
                    });
                }
                
                // 원본 메시지 객체가 있는 경우 우선 사용
                if (mediaInfo && mediaInfo.original_message_object) {
                    sendData.original_message_object = mediaInfo.original_message_object;
                    sendData.is_original_message = true;
                    sendData.bypass_text_processing = true;
                    sendData.message = null; // 텍스트 처리를 우회
                    sendData.send_as_original = true;
                    
                    console.log('📤 원본 메시지 객체 우선 전송:', {
                        original_message_object: sendData.original_message_object,
                        is_original_message: sendData.is_original_message,
                        bypass_text_processing: sendData.bypass_text_processing,
                        send_as_original: sendData.send_as_original
                    });
                }
                
                console.log('📤 서버로 전송할 데이터:', sendData);
                console.log('📤 전송 메시지 텍스트:', message);
                console.log('📤 미디어 정보 상세:', {
                    has_custom_emoji: mediaInfo?.has_custom_emoji,
                    custom_emoji_entities: mediaInfo?.custom_emoji_entities,
                    raw_message_data: mediaInfo?.raw_message_data,
                    text: mediaInfo?.text
                });
                
                const sendResponse = await fetch('/api/telegram/send-message', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(sendData)
                });
                
                const sendResult = await sendResponse.json();
                
                console.log(`🔍 그룹 ${i + 1} 전송 응답:`, sendResult);
                
                if (sendResponse.ok && sendResult.success) {
                    successCount++;
                    console.log(`✅ 그룹 ${i + 1} 전송 성공: ${groupId}`);
                } else {
                    failCount++;
                    console.error(`❌ 그룹 ${i + 1} 전송 실패:`, sendResult);
                    console.error(`❌ 응답 상태: ${sendResponse.status}`);
                }
                
                // 그룹 간 간격 (1초)
                if (i < validGroupIds.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
                
            } catch (error) {
                failCount++;
                console.error(`❌ 그룹 ${i + 1} 전송 에러: ${error.message}`);
            }
        }
        
        // 결과 알림
        if (successCount > 0 && failCount === 0) {
            alert(`✅ 모든 그룹에 메시지 전송 성공!\n\n전송된 그룹: ${successCount}개\n메시지: ${message.substring(0, 50)}${message.length > 50 ? '...' : ''}`);
        } else if (successCount > 0 && failCount > 0) {
            alert(`⚠️ 부분 전송 완료\n\n성공: ${successCount}개 그룹\n실패: ${failCount}개 그룹\n메시지: ${message.substring(0, 50)}${message.length > 50 ? '...' : ''}`);
        } else {
            throw new Error('모든 그룹 전송 실패');
        }
        
        // 메시지 입력 필드 초기화
        if (messageInput) {
            messageInput.value = '';
        }
        
    } catch (error) {
        console.error('❌ 메시지 전송 실패:', error);
        console.error('❌ 에러 상세:', error);
        alert(`❌ 메시지 전송 실패:\n\n${error.message}`);
    } finally {
        if (sendBtn) {
            sendBtn.textContent = '📤 전송';
            sendBtn.disabled = false;
        }
    }
}

// 메시지 지우기
function clearMessage() {
    console.log('🗑️ 메시지 지우기');
    
    const messageInput = document.querySelector('.message-input');
    if (messageInput) {
        messageInput.value = '';
        messageInput.focus();
    }
    
    // 미디어 정보도 초기화
    window.selectedMediaInfo = null;
    console.log('🗑️ 미디어 정보 초기화');
}

// 저장된 메시지 표시
async function showSavedMessages() {
    console.log('💾 텔레그램 저장된 메시지 표시');
    
    const modal = document.getElementById('savedMessagesModal');
    if (!modal) return;
    
    // 모달 표시
    modal.style.display = 'flex';
    
    // 로딩 표시
    const messagesList = document.getElementById('savedMessagesList');
    if (messagesList) {
        messagesList.innerHTML = `
            <div style="text-align: center; color: #888; padding: 20px;">
                텔레그램 저장된 메시지를 불러오는 중...
            </div>
        `;
    }
    
    // 텔레그램 저장된 메시지 로드
    await loadTelegramSavedMessages();
    
    // 모달 배경 클릭 시 닫기
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeSavedMessages();
        }
    });
}

// 텔레그램 저장된 메시지 로드
async function loadTelegramSavedMessages() {
    console.log('💾 텔레그램 저장된 메시지 로드');
    
    try {
        // 현재 계정 정보 가져오기
        const accountName = document.getElementById('selectedAccountName').textContent;
        const accountPhone = document.getElementById('selectedAccountPhone').textContent;
        
        // 계정 목록에서 해당 계정 찾기
        const response = await fetch('/api/telegram/load-accounts', {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            }
        });
        
        const result = await response.json();
        if (!response.ok || !result.success || !result.accounts) {
            throw new Error(result.error || '계정 목록 로딩 실패');
        }
        
        const account = result.accounts.find(acc =>
            `${acc.first_name} ${acc.last_name || ''}`.trim() === accountName.trim()
        );
        
        if (!account) {
            throw new Error('계정을 찾을 수 없습니다.');
        }
        
        // 텔레그램 저장된 메시지 가져오기
        const savedResponse = await fetch('/api/telegram/saved-messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                userId: account.user_id
            })
        });
        
        const savedResult = await savedResponse.json();
        console.log('💾 저장된 메시지 응답:', savedResult);
        
        if (savedResponse.ok && savedResult.success) {
            console.log('💾 저장된 메시지 로딩 성공:', savedResult.saved_messages);
            
            // 커스텀 이모지가 있는 메시지들 디버깅
            savedResult.saved_messages.forEach((msg, index) => {
                if (msg.has_custom_emoji) {
                    console.log(`💾 커스텀 이모지 메시지 ${index}:`, {
                        text: msg.text,
                        has_custom_emoji: msg.has_custom_emoji,
                        custom_emoji_entities: msg.custom_emoji_entities,
                        raw_message_data: msg.raw_message_data,
                        entities: msg.entities
                    });
                }
            });
            
            displayTelegramSavedMessages(savedResult.saved_messages);
        } else {
            console.error('💾 저장된 메시지 로딩 실패:', savedResult);
            throw new Error(savedResult.error || '저장된 메시지 로딩 실패');
        }
        
    } catch (error) {
        console.error('❌ 텔레그램 저장된 메시지 로딩 실패:', error);
        
        const messagesList = document.getElementById('savedMessagesList');
        if (messagesList) {
            messagesList.innerHTML = `
                <div style="text-align: center; color: #dc3545; padding: 20px;">
                    저장된 메시지 로딩 실패<br>
                    ${error.message}
                </div>
            `;
        }
    }
}

// 텔레그램 저장된 메시지 표시
function displayTelegramSavedMessages(savedMessages) {
    console.log('💾 텔레그램 저장된 메시지 표시:', savedMessages);
    
    const messagesList = document.getElementById('savedMessagesList');
    if (!messagesList) return;
    
    if (savedMessages.length === 0) {
        messagesList.innerHTML = `
            <div style="text-align: center; color: #888; padding: 20px;">
                텔레그램에 저장된 메시지가 없습니다.<br><br>
                <strong>저장된 메시지 사용법:</strong><br>
                1. 텔레그램 앱에서 메시지를 길게 누르세요<br>
                2. "저장" 또는 "북마크" 버튼을 누르세요<br>
                3. 메시지가 "저장된 메시지"에 추가됩니다<br><br>
                <small>저장된 메시지가 있다면 페이지를 새로고침해보세요.</small>
            </div>
        `;
        return;
    }
    
    messagesList.innerHTML = savedMessages.map((message, index) => {
        const date = new Date(message.date).toLocaleString('ko-KR');
        const mediaIcon = message.media_type ? getMediaIcon(message.media_type) : '';
        
        // 커스텀 이모지가 있는 경우 원본 텍스트 표시
        let displayText = message.text || '';
        if (message.has_custom_emoji) {
            console.log('💾 커스텀 이모지 메시지 표시:', {
                text: displayText,
                custom_emoji_entities: message.custom_emoji_entities,
                has_custom_emoji: message.has_custom_emoji,
                raw_message_data: message.raw_message_data,
                entities: message.entities
            });
            
            // 원본 메시지 데이터가 있으면 그것을 우선 사용
            if (message.raw_message_data && message.raw_message_data.text) {
                displayText = message.raw_message_data.text;
                console.log('💾 원본 메시지 데이터 사용:', displayText);
            }
            
            // 커스텀 이모지 엔티티가 있는 경우 강조 표시
            if (message.custom_emoji_entities && message.custom_emoji_entities.length > 0) {
                console.log('💾 커스텀 이모지 엔티티 발견:', message.custom_emoji_entities);
            }
        }
        
        // 미디어 미리보기 생성
        let mediaPreview = '';
        if (message.media_type && message.media_url) {
            if (message.media_type === 'photo') {
                mediaPreview = `
                    <div style="margin-top: 8px;">
                        <img src="${message.media_url}" alt="사진" style="max-width: 200px; max-height: 150px; border-radius: 8px; border: 1px solid #333;">
                    </div>
                `;
            } else if (message.media_type === 'video') {
                mediaPreview = `
                    <div style="margin-top: 8px;">
                        <video controls style="max-width: 200px; max-height: 150px; border-radius: 8px; border: 1px solid #333;">
                            <source src="${message.media_url}" type="video/mp4">
                        </video>
                    </div>
                `;
            } else {
                mediaPreview = `
                    <div style="margin-top: 8px; color: #10B981; padding: 8px; background: rgba(16, 185, 129, 0.1); border-radius: 6px; border: 1px solid #10B981;">
                        ${mediaIcon} ${message.media_type}
                    </div>
                `;
            }
        }
        
        // 커스텀 이모지 표시를 위한 스타일 추가
        const customEmojiStyle = message.has_custom_emoji ? 'style="font-family: \'Segoe UI Emoji\', \'Apple Color Emoji\', \'Noto Color Emoji\', sans-serif;"' : '';
        
        // 커스텀 이모지 엔티티 정보를 data 속성에 저장
        const customEmojiData = message.has_custom_emoji ? 
            `data-custom-emoji-entities='${JSON.stringify(message.custom_emoji_entities || [])}' 
             data-entities='${JSON.stringify(message.entities || [])}' 
             data-raw-message='${JSON.stringify(message.raw_message_data || {})}'` : '';
        
        return `
            <div class="saved-message-item" data-message-index="${index}" ${customEmojiData}>
                <div class="saved-message-content" ${customEmojiStyle}>
                    ${displayText}
                    ${mediaPreview}
                    ${message.has_custom_emoji ? '<div style="margin-top: 5px; font-size: 12px; color: #10B981;">🎨 커스텀 이모지 포함 (원본 객체 전체 전송 모드)</div>' : ''}
                </div>
                <div class="saved-message-meta">
                    <span>${date}</span>
                </div>
            </div>
        `;
    }).join('');
    
    // 메시지 아이템 클릭 이벤트 추가
    const messageItems = messagesList.querySelectorAll('.saved-message-item');
    console.log('💾 저장된 메시지 아이템 개수:', messageItems.length);
    
    messageItems.forEach((item, index) => {
        console.log(`💾 메시지 아이템 ${index} 이벤트 리스너 추가`);
        item.addEventListener('click', () => {
            const messageIndex = parseInt(item.dataset.messageIndex);
            console.log('💾 저장된 메시지 클릭됨:', messageIndex);
            selectTelegramSavedMessage(messageIndex, savedMessages);
        });
    });
}

// 미디어 타입 아이콘 가져오기
function getMediaIcon(mediaType) {
    switch (mediaType) {
        case 'photo': return '📷';
        case 'video': return '🎥';
        case 'document': return '📄';
        case 'voice': return '🎤';
        default: return '📎';
    }
}

// 텔레그램 저장된 메시지 선택
function selectTelegramSavedMessage(messageIndex, savedMessages) {
    console.log('💾 텔레그램 저장된 메시지 선택 함수 호출됨:', messageIndex);
    console.log('💾 저장된 메시지 배열:', savedMessages);
    
    if (messageIndex >= 0 && messageIndex < savedMessages.length) {
        const message = savedMessages[messageIndex];
        const messageInput = document.querySelector('.message-input');
        
        console.log('💾 선택된 메시지 정보:', {
            text: message.text,
            has_custom_emoji: message.has_custom_emoji,
            custom_emoji_entities: message.custom_emoji_entities,
            entities: message.entities,
            media_type: message.media_type,
            raw_message_data: message.raw_message_data
        });
        
        // 커스텀 이모지가 있는 경우 원본 데이터 확인
        if (message.has_custom_emoji) {
            console.log('💾 커스텀 이모지 원본 데이터 확인:', {
                original_text: message.text,
                raw_text: message.raw_message_data?.text,
                custom_emoji_entities: message.custom_emoji_entities,
                entities: message.entities
            });
        }
        
        console.log('💾 입력칸 요소 찾기:', messageInput);
        
        // 입력칸에는 아무것도 표시하지 않음 (원본 데이터만 저장)
        if (messageInput) {
            messageInput.value = '';
            messageInput.placeholder = '💾 저장된 메시지가 선택되었습니다. 해제 후 입력하세요.';
            messageInput.disabled = true;
            messageInput.style.backgroundColor = '#f0f0f0';
            messageInput.style.cursor = 'not-allowed';
        }
        
        // 저장된 메시지 버튼을 해제 버튼으로 변경
        const savedMessagesBtn = document.getElementById('savedMessagesBtn');
        console.log('💾 저장된 메시지 버튼 요소 찾기:', savedMessagesBtn);
        
        if (savedMessagesBtn) {
            console.log('💾 버튼 변경 전:', savedMessagesBtn.textContent);
            savedMessagesBtn.textContent = '❌ 저장된 메시지 해제';
            savedMessagesBtn.style.backgroundColor = '#ff4444';
            savedMessagesBtn.style.borderColor = '#ff4444';
            savedMessagesBtn.onclick = clearSavedMessage;
            console.log('💾 버튼 변경 후:', savedMessagesBtn.textContent);
            console.log('💾 저장된 메시지 버튼이 해제 버튼으로 변경됨');
        } else {
            console.error('❌ 저장된 메시지 버튼을 찾을 수 없습니다!');
        }
        
        // 미디어 정보 및 커스텀 이모지 정보 저장 (전역 변수에)
        // 원본 메시지 객체 전체를 그대로 보존
        window.selectedMediaInfo = {
            media_type: message.media_type || null,
            media_path: message.media_path || null,
            media_url: message.media_url || null,
            has_custom_emoji: message.has_custom_emoji || false,
            custom_emoji_entities: message.custom_emoji_entities || [],
            entities: message.entities || [],
            raw_message_data: message.raw_message_data || message, // 원본 메시지 전체를 저장
            original_message_object: message.original_message_object || message.raw_message_data || message, // 원본 메시지 객체 저장
            text: message.text || '',
            message_id: message.message_id || null,
            date: message.date || null
        };
        
        // 커스텀 이모지가 있는 경우 원본 객체 전체 보존
        if (message.has_custom_emoji) {
            console.log('💾 커스텀 이모지 원본 객체 전체 보존:', {
                original_message_object: window.selectedMediaInfo.original_message_object,
                has_custom_emoji: message.has_custom_emoji,
                bypass_text_processing: true
            });
        }
        
        console.log('💾 최종 저장된 메시지 정보:', window.selectedMediaInfo);
        
        // 모달 닫기
        closeSavedMessages();
        
        console.log('✅ 텔레그램 저장된 메시지 선택 완료:', message.text?.substring(0, 50) + '...');
    }
}

// 무한 전송 토글 함수
function toggleInfiniteSend(event) {
    console.log('🔄 무한 전송 토글:', event.target.checked);
    
    const toggleLabel = document.querySelector('.toggle-label');
    
    if (event.target.checked) {
        // 설정 모달 열기
        showInfiniteSendModal();
    } else {
        // 무한 전송 중단
        stopInfiniteSend();
    }
}

// 무한 전송 설정 모달 표시
function showInfiniteSendModal() {
    console.log('🔄 무한 전송 설정 모달 표시');
    
    const modal = document.getElementById('infiniteSendModal');
    if (!modal) return;
    
    // 모달 표시
    modal.style.display = 'flex';
    
    // 모달 배경 클릭 시 닫기
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeInfiniteSendModal();
        }
    });
}

// 무한 전송 설정 모달 닫기
function closeInfiniteSendModal() {
    console.log('🔄 무한 전송 설정 모달 닫기');
    
    const modal = document.getElementById('infiniteSendModal');
    if (modal) {
        modal.style.display = 'none';
    }
    
    // 토글 스위치를 OFF로 되돌리기 (설정 저장하지 않고 닫은 경우)
    const infiniteSendToggle = document.getElementById('infiniteSendToggle');
    const toggleLabel = document.querySelector('.toggle-label');
    
    if (infiniteSendToggle && !window.infiniteSendEnabled) {
        infiniteSendToggle.checked = false;
        if (toggleLabel) {
            toggleLabel.textContent = '무한 전송';
        }
    }
}

// 무한 전송 설정 저장
function saveInfiniteSendSettings() {
    console.log('🔄 무한 전송 설정 저장');
    
    const groupIntervalInput = document.getElementById('groupInterval');
    const cycleIntervalInput = document.getElementById('cycleInterval');
    const minNewMessagesInput = document.getElementById('minNewMessages');
    
    // 그룹간 전송 간격 확인
    const groupInterval = parseInt(groupIntervalInput.value);
    if (!groupInterval || groupInterval < 1 || groupInterval > 300) {
        alert('그룹간 전송 간격을 1초~300초(5분) 사이로 설정해주세요.');
        groupIntervalInput.focus();
        return;
    }
    
    // 전체 사이클 대기 시간 확인
    const cycleInterval = parseInt(cycleIntervalInput.value);
    if (!cycleInterval || cycleInterval < 1 || cycleInterval > 60) {
        alert('전체 대기 시간을 1분~60분 사이로 설정해주세요.');
        cycleIntervalInput.focus();
        return;
    }
    
    // 최소 새 메시지 수 확인
    const minNewMessages = parseInt(minNewMessagesInput.value);
    if (!minNewMessages || minNewMessages < 1 || minNewMessages > 1000) {
        alert('최소 새 메시지 수를 1개~1000개 사이로 설정해주세요.');
        minNewMessagesInput.focus();
        return;
    }
    
    // 설정을 전역 변수에 저장
    window.infiniteGroupInterval = groupInterval;
    window.infiniteCycleInterval = cycleInterval;
    window.infiniteMinNewMessages = minNewMessages;
    window.infiniteSendEnabled = true;
    
    console.log('🔄 무한 전송 설정 저장됨:', {
        groupInterval: groupInterval,
        cycleInterval: cycleInterval,
        minNewMessages: minNewMessages
    });
    
    // 모달 닫기
    closeInfiniteSendModal();
    
    // 토글 스위치를 ON으로 유지
    const infiniteSendToggle = document.getElementById('infiniteSendToggle');
    if (infiniteSendToggle) {
        infiniteSendToggle.checked = true;
    }
    
    // 라벨은 그대로 유지 (무한 전송)
    
    // 저장된 설정 표시
    const savedSettings = document.getElementById('savedSettings');
    const savedGroupInterval = document.getElementById('savedGroupInterval');
    const savedCycleInterval = document.getElementById('savedCycleInterval');
    const savedMinMessages = document.getElementById('savedMinMessages');
    
    if (savedSettings && savedGroupInterval && savedCycleInterval && savedMinMessages) {
        savedGroupInterval.textContent = `${groupInterval}초`;
        savedCycleInterval.textContent = `${cycleInterval}분`;
        savedMinMessages.textContent = `${minNewMessages}개`;
        savedSettings.style.display = 'flex';
    }
    
    // 성공 알림
    showNotification(`✅ 무한 전송 설정이 저장되었습니다!\n• 그룹간격: ${groupInterval}초\n• 전체대기: ${cycleInterval}분\n• 최소메시지: ${minNewMessages}개`, 'success');
}

// 무한 전송 시작 (실제 전송 시작)
function startInfiniteSend() {
    console.log('🔄 무한 전송 시작');
    
    // 무한 전송이 활성화되어 있는지 확인
    if (!window.infiniteSendEnabled) {
        console.log('🔄 무한 전송이 활성화되지 않음');
        return;
    }
    
    const messageInput = document.querySelector('.message-input');
    
    // 메시지 확인 (저장된 메시지가 선택되어 있으면 입력칸이 비어있어도 OK)
    const hasSavedMessage = window.selectedMediaInfo && window.selectedMediaInfo.raw_message_data;
    
    if (!messageInput || (!messageInput.value.trim() && !hasSavedMessage)) {
        alert('전송할 메시지를 입력하거나 저장된 메시지를 선택해주세요.');
        messageInput?.focus();
        return;
    }
    
    // 선택된 그룹들 확인
    const selectedGroups = document.querySelectorAll('.group-item.selected');
    if (selectedGroups.length === 0) {
        alert('전송할 그룹을 선택해주세요.');
        return;
    }
    
    // 원본 메시지 데이터가 있으면 우선 사용, 없으면 입력칸의 텍스트 사용
    let message;
    let mediaInfo = null;
    
    if (window.selectedMediaInfo) {
        // 저장된 메시지가 선택된 경우 - 원본 메시지 객체 전체를 그대로 전송
        mediaInfo = window.selectedMediaInfo;
        
        // 커스텀 이모지가 있는 경우 원본 메시지 객체 전체를 전송
        if (mediaInfo.has_custom_emoji) {
            // 텍스트 처리를 완전히 우회하고 원본 메시지 객체를 그대로 전송
            message = null; // 텍스트는 null로 설정
            console.log('🔄 커스텀 이모지 원본 객체 전체 전송 모드 (무한)');
            console.log('🔄 원본 메시지 객체:', mediaInfo.raw_message_data);
        } else {
            message = mediaInfo.text || messageInput.value.trim();
            console.log('🔄 일반 저장된 메시지 사용 (무한):', message);
        }
        
        console.log('🔄 최종 전송 메시지 (무한):', message);
        console.log('🔄 미디어 정보 (무한):', mediaInfo);
        console.log('🔄 커스텀 이모지 여부 (무한):', mediaInfo.has_custom_emoji);
    } else {
        // 일반 텍스트 메시지
        message = messageInput.value.trim();
        console.log('🔄 일반 텍스트 메시지 (무한):', message);
    }
    
    // 선택된 그룹들의 정보 수집
    const groupsToSend = Array.from(selectedGroups).map(group => ({
        id: group.dataset.groupId,
        title: group.dataset.groupTitle,
        username: group.dataset.groupUsername
    }));
    
    console.log('🔄 무한 전송할 그룹들:', groupsToSend);
    console.log('🔄 그룹간 전송 간격:', window.infiniteGroupInterval, '초');
    console.log('🔄 전체 사이클 대기 시간:', window.infiniteCycleInterval, '분');
    
    // 전역 변수 설정
    window.isInfiniteSending = true;
    window.infiniteMessage = message;
    window.infiniteMediaInfo = mediaInfo;
    window.infiniteGroups = groupsToSend;
    window.infiniteSendCount = 0;
    window.infiniteCycleCount = 0;
    window.infiniteCurrentGroupIndex = 0;
    
    // 첫 번째 사이클 시작
    startInfiniteCycle();
    
    showNotification(`🔄 무한 전송이 시작되었습니다! (그룹간격: ${window.infiniteGroupInterval}초, 전체대기: ${window.infiniteCycleInterval}분)`, 'success');
}

// 무한 전송 사이클 시작
function startInfiniteCycle() {
    if (!window.isInfiniteSending) return;
    
    window.infiniteCycleCount++;
    window.infiniteCurrentGroupIndex = 0;
    
    console.log(`🔄 무한 전송 사이클 ${window.infiniteCycleCount} 시작`);
    
    // 첫 번째 그룹부터 순차적으로 전송
    sendToNextGroup();
}

// 그룹의 새 메시지 수 체크
async function checkGroupNewMessages(groupId) {
    try {
        // 현재 계정 정보 가져오기
        const accountName = document.getElementById('selectedAccountName').textContent;
        const accountPhone = document.getElementById('selectedAccountPhone').textContent;
        
        // 계정 정보에서 user_id 찾기
        const accounts = JSON.parse(localStorage.getItem('telegramAccounts') || '[]');
        const account = accounts.find(acc => 
            acc.name === accountName && acc.phone === accountPhone
        );
        
        if (!account) {
            throw new Error('계정을 찾을 수 없습니다.');
        }
        
        // 그룹의 새 메시지 수 조회 API 호출
        const response = await fetch('/api/telegram/group-new-messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                userId: account.user_id,
                groupId: groupId
            })
        });
        
        const result = await response.json();
        
        if (response.ok && result.success) {
            return result.newMessageCount || 0;
        } else {
            console.error('🔄 새 메시지 수 조회 실패:', result);
            return 0;
        }
        
    } catch (error) {
        console.error('❌ 새 메시지 수 조회 중 오류:', error);
        return 0;
    }
}

// 다음 그룹으로 전송
async function sendToNextGroup() {
    if (!window.isInfiniteSending) return;
    
    // 모든 그룹을 전송했으면 사이클 완료
    if (window.infiniteCurrentGroupIndex >= window.infiniteGroups.length) {
        console.log(`🔄 사이클 ${window.infiniteCycleCount} 완료, ${window.infiniteCycleInterval}분 대기`);
        
    // 토글 스위치에 상태 표시 (라벨 업데이트)
    const toggleLabel = document.querySelector('.toggle-label');
    if (toggleLabel) {
        toggleLabel.textContent = `무한 전송 (사이클 ${window.infiniteCycleCount} 완료, ${window.infiniteCycleInterval}분 대기)`;
    }
        
        // 전체 사이클 대기 시간 후 다음 사이클 시작
        setTimeout(() => {
            if (window.isInfiniteSending) {
                startInfiniteCycle();
            }
        }, window.infiniteCycleInterval * 60 * 1000); // 분을 밀리초로 변환
        
        return;
    }
    
    const currentGroup = window.infiniteGroups[window.infiniteCurrentGroupIndex];
    console.log(`🔄 그룹 ${window.infiniteCurrentGroupIndex + 1}/${window.infiniteGroups.length} 전송:`, currentGroup.title);
    
    // 새 메시지 수 체크
    const newMessageCount = await checkGroupNewMessages(currentGroup.id);
    console.log(`🔄 그룹 "${currentGroup.title}" 새 메시지 수: ${newMessageCount}개 (최소: ${window.infiniteMinNewMessages}개)`);
    
    // 최소 새 메시지 수 미만이면 전송 보류
    if (newMessageCount < window.infiniteMinNewMessages) {
        console.log(`⏸️ 그룹 "${currentGroup.title}" 전송 보류 (새 메시지 ${newMessageCount}개 < 최소 ${window.infiniteMinNewMessages}개)`);
        
        // 토글 스위치에 상태 표시
        const toggleLabel = document.querySelector('.toggle-label');
        if (toggleLabel) {
            toggleLabel.textContent = `무한 전송 (${currentGroup.title} 보류: ${newMessageCount}/${window.infiniteMinNewMessages}개)`;
        }
        
        // 다음 그룹으로 이동
        window.infiniteCurrentGroupIndex++;
        
        // 그룹간 간격 대기 후 다음 그룹 체크
        setTimeout(() => {
            if (window.isInfiniteSending) {
                sendToNextGroup();
            }
        }, window.infiniteGroupInterval * 1000);
        
        return;
    }
    
    try {
        // 현재 계정 정보 가져오기
        const accountName = document.getElementById('selectedAccountName').textContent;
        const accountPhone = document.getElementById('selectedAccountPhone').textContent;
        
        // 계정 정보에서 user_id 찾기
        const accounts = JSON.parse(localStorage.getItem('telegramAccounts') || '[]');
        const account = accounts.find(acc => 
            acc.name === accountName && acc.phone === accountPhone
        );
        
        if (!account) {
            throw new Error('계정을 찾을 수 없습니다.');
        }
        
        // 단일 그룹에 메시지 전송
        const response = await fetch('/api/telegram/send-message', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                userId: account.user_id,
                groups: [currentGroup], // 단일 그룹만 전송
                message: window.infiniteMessage,
                mediaInfo: window.infiniteMediaInfo
            })
        });
        
        const result = await response.json();
        
        if (response.ok && result.success) {
            window.infiniteSendCount++;
            console.log(`🔄 그룹 전송 성공 (${window.infiniteSendCount}번째):`, currentGroup.title);
            
            // 토글 스위치에 상태 표시 (라벨 업데이트)
            const toggleLabel = document.querySelector('.toggle-label');
            if (toggleLabel) {
                toggleLabel.textContent = `무한 전송 (사이클 ${window.infiniteCycleCount}, 그룹 ${window.infiniteCurrentGroupIndex + 1}/${window.infiniteGroups.length})`;
            }
        } else {
            console.error('🔄 그룹 전송 실패:', currentGroup.title, result);
        }
        
    } catch (error) {
        console.error('❌ 그룹 전송 중 오류:', currentGroup.title, error);
    }
    
    // 다음 그룹으로 이동
    window.infiniteCurrentGroupIndex++;
    
    // 그룹간 간격 대기 후 다음 그룹 전송
    setTimeout(() => {
        if (window.isInfiniteSending) {
            sendToNextGroup();
        }
    }, window.infiniteGroupInterval * 1000);
}

// 무한 전송 중단
function stopInfiniteSend() {
    console.log('⏹️ 무한 전송 중단');
    
    // 전역 변수 초기화
    window.isInfiniteSending = false;
    window.infiniteMessage = null;
    window.infiniteMediaInfo = null;
    window.infiniteGroups = null;
    window.infiniteSendCount = 0;
    window.infiniteCycleCount = 0;
    window.infiniteCurrentGroupIndex = 0;
    window.infiniteSendEnabled = false;
    window.infiniteMinNewMessages = null;
    
    // 토글 스위치 상태 복원
    const infiniteSendToggle = document.getElementById('infiniteSendToggle');
    if (infiniteSendToggle) {
        infiniteSendToggle.checked = false;
    }
    
    // 라벨 복원
    const toggleLabel = document.querySelector('.toggle-label');
    if (toggleLabel) {
        toggleLabel.textContent = '무한 전송';
    }
    
    // 저장된 설정 숨기기
    const savedSettings = document.getElementById('savedSettings');
    if (savedSettings) {
        savedSettings.style.display = 'none';
    }
    
    showNotification('⏹️ 무한 전송이 중단되었습니다.', 'info');
}

// 저장된 메시지 해제 함수
function clearSavedMessage() {
    console.log('🗑️ 저장된 메시지 해제');
    
    // 전역 변수 초기화
    window.selectedMediaInfo = null;
    
    // 입력칸 초기화 및 활성화
    const messageInput = document.querySelector('.message-input');
    if (messageInput) {
        messageInput.value = '';
        messageInput.placeholder = '전송할 메시지를 입력하세요...';
        messageInput.disabled = false;
        messageInput.style.backgroundColor = '';
        messageInput.style.cursor = '';
        messageInput.focus();
    }
    
    // 저장된 메시지 버튼을 원래대로 복원
    const savedMessagesBtn = document.getElementById('savedMessagesBtn');
    if (savedMessagesBtn) {
        savedMessagesBtn.textContent = '💾 저장된 메시지';
        savedMessagesBtn.style.backgroundColor = '';
        savedMessagesBtn.style.borderColor = '';
        savedMessagesBtn.onclick = showSavedMessages;
        console.log('💾 저장된 메시지 버튼이 원래대로 복원됨');
    }
    
    // 알림 표시
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #ff4444;
        color: white;
        padding: 10px 15px;
        border-radius: 5px;
        z-index: 10000;
        font-size: 14px;
        max-width: 300px;
    `;
    notification.textContent = '🗑️ 저장된 메시지가 해제되었습니다.';
    document.body.appendChild(notification);
    
    // 2초 후 자동 제거
    setTimeout(() => {
        if (notification.parentNode) {
            notification.parentNode.removeChild(notification);
        }
    }, 2000);
}

// 저장된 메시지 모달 닫기
function closeSavedMessages() {
    console.log('💾 저장된 메시지 모달 닫기');
    
    const modal = document.getElementById('savedMessagesModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

// status-bar 내리기 애니메이션 후 계정 목록 표시
async function hideStatusBarAndShowAccounts() {
    try {
        console.log('🎬 status-bar 내리기 애니메이션 시작');
        
        // status-bar 요소 찾기
        const statusBar = document.querySelector('.status-bar');
        console.log('🔍 status-bar 요소:', statusBar);
        
        if (!statusBar) {
            console.log('❌ status-bar를 찾을 수 없습니다. DOM 구조를 확인합니다.');
            
            // DOM 구조 확인
            const allElements = document.querySelectorAll('*');
            console.log('🔍 DOM 요소들:', allElements);
            
            // status-bar 관련 요소들 찾기
            const statusElements = document.querySelectorAll('[class*="status"]');
            console.log('🔍 status 관련 요소들:', statusElements);
            
            return;
        }
        
        console.log('✅ status-bar 요소 찾음:', statusBar);
        
        // status-bar 내리기 애니메이션
        statusBar.style.transition = 'transform 0.5s ease-in-out';
        statusBar.style.transform = 'translateY(100%)';
        console.log('🎬 status-bar 애니메이션 시작: translateY(100%)');
        
        // 애니메이션 완료 후 계정 목록 로드
        setTimeout(async () => {
            console.log('🔍 계정 목록 로딩 시작');
            
            try {
                const response = await fetch('/api/telegram/load-accounts', {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json',
                    }
                });
                
                const result = await response.json();
                console.log('🔍 계정 목록 응답:', result);
                console.log('🔍 응답 상태:', response.status);
                console.log('🔍 계정 개수:', result.accounts ? result.accounts.length : 0);
                
                if (response.ok && result.success) {
                    if (result.accounts && result.accounts.length > 0) {
                        console.log(`✅ ${result.accounts.length}개의 연동된 계정을 찾았습니다.`);
                        console.log('📋 계정 목록:', result.accounts);
                        
                        // 계정 목록 표시 (status-bar 위에)
                        showAccountListAboveStatusBar(result.accounts);
                    } else {
                        console.log('📭 연동된 계정이 없습니다.');
                        console.log('📭 Firebase에 계정이 저장되지 않았을 수 있습니다.');
                        
                        
                        // status-bar 다시 올리기
                        statusBar.style.transform = 'translateY(0)';
                        console.log('🔄 status-bar 복원');
                    }
                } else {
                    console.error('❌ 계정 목록 로딩 실패:', result);
                    throw new Error(result.error || '계정 목록 로딩 실패');
                }
                
            } catch (error) {
                console.error('❌ 계정 목록 로딩 실패:', error);
                // status-bar 다시 올리기
                statusBar.style.transform = 'translateY(0)';
                console.log('🔄 status-bar 복원 (에러)');
            }
        }, 500); // 0.5초 후 계정 목록 로드
        
    } catch (error) {
        console.error('❌ status-bar 애니메이션 실패:', error);
    }
}

// status-bar 위에 계정 목록 표시
function showAccountListAboveStatusBar(accounts) {
    console.log('📋 status-bar 위에 계정 목록 표시 중...', accounts);
    
    // 기존 계정 목록 모달이 있으면 제거
    const existingModal = document.getElementById('accountListModal');
    if (existingModal) {
        document.body.removeChild(existingModal);
    }
    
    // 계정 목록을 표시할 컨테이너 생성
    const accountContainer = document.createElement('div');
    accountContainer.id = 'accountListContainer';
    accountContainer.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.9);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 10000;
        backdrop-filter: blur(10px);
        animation: fadeIn 0.5s ease-in-out;
    `;
    
    // CSS 애니메이션 추가
    if (!document.getElementById('accountListAnimation')) {
        const style = document.createElement('style');
        style.id = 'accountListAnimation';
        style.textContent = `
            @keyframes fadeIn {
                from { opacity: 0; }
                to { opacity: 1; }
            }
            @keyframes slideUp {
                from { transform: translateY(50px); opacity: 0; }
                to { transform: translateY(0); opacity: 1; }
            }
        `;
        document.head.appendChild(style);
    }
    
    const modalContent = document.createElement('div');
    modalContent.style.cssText = `
        background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%);
        border-radius: 20px;
        padding: 30px;
        max-width: 500px;
        width: 90%;
        max-height: 80vh;
        overflow-y: auto;
        border: 2px solid #10B981;
        box-shadow: 0 20px 40px rgba(0, 0, 0, 0.5);
        animation: slideUp 0.5s ease-out;
    `;
    
    modalContent.innerHTML = `
        <div style="text-align: center; margin-bottom: 25px;">
            <h2 style="color: #10B981; margin: 0 0 10px 0; font-size: 24px; font-weight: 600;">
                📱 연동된 텔레그램 계정
            </h2>
            <p style="color: #888; margin: 0; font-size: 14px;">
                ${accounts.length}개의 계정이 연동되어 있습니다
            </p>
        </div>
        
        <div id="accountList" style="margin-bottom: 25px;">
            ${accounts.map((account, index) => `
                <div class="account-item" style="
                    background: linear-gradient(135deg, #2a2a2a 0%, #3a3a3a 100%);
                    border: 1px solid #444;
                    border-radius: 12px;
                    padding: 15px;
                    margin-bottom: 10px;
                    cursor: pointer;
                    transition: all 0.3s ease;
                    position: relative;
                " data-user-id="${account.user_id}">
                    <div style="display: flex; align-items: center; justify-content: space-between;">
                        <div style="flex: 1;">
                            <div style="color: #10B981; font-weight: 600; font-size: 16px; margin-bottom: 5px;">
                                ${account.first_name} ${account.last_name || ''}
                            </div>
                            <div style="color: #888; font-size: 14px; margin-bottom: 3px;">
                                📱 ${account.phone_number}
                            </div>
                            ${account.username ? `
                                <div style="color: #888; font-size: 14px;">
                                    @${account.username}
                                </div>
                            ` : ''}
                        </div>
                        <div style="color: #10B981; font-size: 20px;">
                            ▶
                        </div>
                    </div>
                </div>
            `).join('')}
        </div>
        
        <div style="text-align: center;">
            <button id="closeAccountList" style="
                background: linear-gradient(135deg, #6c757d 0%, #5a6268 100%);
                color: white;
                border: none;
                padding: 12px 30px;
                border-radius: 8px;
                font-size: 14px;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.3s ease;
            ">닫기</button>
        </div>
    `;
    
    accountContainer.appendChild(modalContent);
    document.body.appendChild(accountContainer);
    
    // 계정 클릭 이벤트
    const accountItems = accountContainer.querySelectorAll('.account-item');
    accountItems.forEach(item => {
        item.addEventListener('mouseenter', () => {
            item.style.borderColor = '#10B981';
            item.style.transform = 'translateY(-2px)';
            item.style.boxShadow = '0 5px 15px rgba(16, 185, 129, 0.3)';
        });
        
        item.addEventListener('mouseleave', () => {
            item.style.borderColor = '#444';
            item.style.transform = 'translateY(0)';
            item.style.boxShadow = 'none';
        });
        
        item.addEventListener('click', () => {
            const userId = item.dataset.userId;
            const account = accounts.find(acc => acc.user_id === userId);
            
            console.log('📱 선택된 계정:', account);
            
            // 컨테이너 제거
            document.body.removeChild(accountContainer);
            
            // status-bar 다시 올리기
            const statusBar = document.querySelector('.status-bar');
            if (statusBar) {
                statusBar.style.transform = 'translateY(0)';
            }
            
            // 선택된 계정으로 그룹 로드
            loadGroupsForAccount(account);
        });
    });
    
    // 닫기 버튼 이벤트
    accountContainer.querySelector('#closeAccountList').addEventListener('click', () => {
        document.body.removeChild(accountContainer);
        
        // status-bar 다시 올리기
        const statusBar = document.querySelector('.status-bar');
        if (statusBar) {
            statusBar.style.transform = 'translateY(0)';
        }
    });
    
    // 컨테이너 배경 클릭 시 닫기
    accountContainer.addEventListener('click', (e) => {
        if (e.target === accountContainer) {
            document.body.removeChild(accountContainer);
            
            // status-bar 다시 올리기
            const statusBar = document.querySelector('.status-bar');
            if (statusBar) {
                statusBar.style.transform = 'translateY(0)';
            }
        }
    });
}

// 저장된 텔레그램 설정 로드
function loadTelegramSettings() {
    try {
        const savedSettings = localStorage.getItem('telegramSettings');
        if (savedSettings) {
            const settings = JSON.parse(savedSettings);
            
            if (elements.telegramApiId) elements.telegramApiId.value = settings.apiId || '';
            if (elements.telegramApiHash) elements.telegramApiHash.value = settings.apiHash || '';
            if (elements.telegramPhone) elements.telegramPhone.value = settings.phone || '';
            
            // 값이 있으면 플레이스홀더 숨기기
            if (settings.apiId) hideTelegramPlaceholder(elements.telegramApiId, elements.telegramApiIdPlaceholder);
            if (settings.apiHash) hideTelegramPlaceholder(elements.telegramApiHash, elements.telegramApiHashPlaceholder);
            if (settings.phone) hideTelegramPlaceholder(elements.telegramPhone, elements.telegramPhonePlaceholder);
            
            // 인증 상태 복원
            if (settings.isAuthenticated) {
                telegramAuthState = 'authenticated';
                elements.saveTelegramBtn.textContent = '✓ Authenticated';
                elements.saveTelegramBtn.style.background = '#10B981';
                elements.saveTelegramBtn.style.borderColor = '#10B981';
                
                // 입력 필드들 비활성화
                elements.telegramApiId.disabled = true;
                elements.telegramApiHash.disabled = true;
                elements.telegramPhone.disabled = true;
            }
            
            console.log('텔레그램 설정 로드됨:', settings);
        }
    } catch (error) {
        console.error('텔레그램 설정 로드 실패:', error);
    }
}

// 메인 앱 이벤트 핸들러들
function handleLogout() {
    if (confirm('정말로 로그아웃하시겠습니까?')) {
        // 저장된 이메일 삭제
        clearSavedEmail();
        
        // 로그인 화면으로 전환
        showLoginScreen();
    }
}


// 창 닫기
function closeWindow() {
    // 웹에서는 페이지를 닫거나 다른 페이지로 이동
    if (confirm('정말로 종료하시겠습니까?')) {
        window.close();
    }
}

// 데이터 초기화 함수
function clearAllData() {
    if (confirm('모든 저장된 데이터를 삭제하시겠습니까?\n(로컬 저장소의 사용자 설정만 삭제됩니다. Firebase 데이터는 삭제되지 않습니다.)')) {
        // 로컬 스토리지 데이터만 삭제 (Firebase 데이터는 유지)
        localStorage.removeItem('userSettings');
        
        // 입력 필드 초기화
        clearAllInputs();
        
        // rememberCheckbox 제거됨
        
        alert('로컬 데이터가 삭제되었습니다. 페이지를 새로고침합니다.');
        location.reload();
    }
}

// 개발자 도구용 함수 (콘솔에서 사용)
window.clearAllData = clearAllData;
window.showStoredData = async function() {
    console.log('로컬 사용자 설정:', JSON.parse(localStorage.getItem('userSettings') || '{}'));
    
    // Firebase 데이터도 조회
    try {
        const signUps = await window.firebaseService.getAllSignUps();
        console.log('Firebase 등록된 사용자:', signUps);
        
        // 코드 정보는 Firebase에서 직접 조회할 수 있도록 함수 제공
        console.log('Firebase 코드 정보 조회: window.firebaseService.getAllCodes() 사용');
    } catch (error) {
        console.error('Firebase 데이터 조회 실패:', error);
    }
};

// 드래그 기능 (웹에서는 제한적)
let isDragging = false;
let currentX;
let currentY;
let initialX;
let initialY;
let xOffset = 0;
let yOffset = 0;

const loginWindow = document.querySelector('.login-window');

loginWindow.addEventListener('mousedown', dragStart);
document.addEventListener('mousemove', drag);
document.addEventListener('mouseup', dragEnd);

function dragStart(e) {
    if (e.target.classList.contains('close-btn') || e.target.closest('.input-field')) {
        return;
    }
    
    initialX = e.clientX - xOffset;
    initialY = e.clientY - yOffset;
    
    if (e.target === loginWindow || loginWindow.contains(e.target)) {
        isDragging = true;
    }
}

function drag(e) {
    if (isDragging) {
        e.preventDefault();
        
        currentX = e.clientX - initialX;
        currentY = e.clientY - initialY;
        
        xOffset = currentX;
        yOffset = currentY;
        
        loginWindow.style.transform = `translate(${currentX}px, ${currentY}px)`;
    }
}

function dragEnd(e) {
    initialX = currentX;
    initialY = currentY;
    
    isDragging = false;
}
