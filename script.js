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
    
    // 자동 전송 설정 표시 초기화
    setTimeout(() => {
        updateAutoSendSettingsDisplay();
    }, 100);
    
    // 로그인 상태 확인 및 자동 로그인
    checkLoginState();
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

// 진행상황 섹션 숨기기 함수
function hideProgressSection() {
    const progressSection = document.getElementById('progressSection');
    if (progressSection) {
        progressSection.style.display = 'none';
    }
}

// Firebase 서비스 준비 대기
async function waitForFirebaseService() {
    let attempts = 0;
    const maxAttempts = 50; // 5초 대기 (100ms * 50)
    
    while (attempts < maxAttempts) {
        if (window.firebaseService) {
            console.log('✅ Firebase 서비스 준비 완료');
            
            // Firebase 연결 테스트
            try {
                const signUps = await window.firebaseService.getAllSignUps();
                console.log('✅ Firebase 데이터베이스 연결 확인됨');
                return;
            } catch (error) {
                console.error('❌ Firebase 데이터베이스 연결 실패:', error);
                throw new Error('Firebase 데이터베이스 연결 실패');
            }
        }
        
        console.log(`⏳ Firebase 서비스 대기 중... (${attempts + 1}/${maxAttempts})`);
        await new Promise(resolve => setTimeout(resolve, 100));
        attempts++;
    }
    
    throw new Error('Firebase 서비스 초기화 실패');
}

// 로그인 상태 확인 및 자동 로그인
async function checkLoginState() {
    try {
        console.log('🔍 로그인 상태 확인 중...');
        
        // Firebase 서비스 준비 대기
        await waitForFirebaseService();
        
        // 저장된 사용자 이메일 확인
        const savedEmail = localStorage.getItem('userEmail');
        if (!savedEmail) {
            console.log('❌ 저장된 이메일 없음, 로그인 화면 유지');
            return;
        }
        
        console.log('📧 저장된 이메일:', savedEmail);
        
        // Firebase에서 사용자 존재 여부 확인 (자동 로그인용)
        const userExists = await checkUserExists(savedEmail);
        if (userExists) {
            console.log('✅ 자동 로그인 성공:', savedEmail);
            
            // 메인 앱 화면으로 전환
            showMainApp(savedEmail);
            
            // 텔레그램 설정 및 자동전송 상태 복원
            setTimeout(() => {
                loadTelegramSettings();
                loadAutoSendSettings(); // 자동전송 설정 로드
                restoreAutoSendStatusOnLoad();
                updateSendButtonText(); // 전송 버튼 텍스트 초기화
                updateAutoSendSettingsDisplay(); // 자동전송 설정 표시 업데이트
            }, 1000);
            
        } else {
            console.log('❌ 자동 로그인 실패, 로그인 화면 유지');
            // 저장된 이메일 삭제
            localStorage.removeItem('userEmail');
        }
        
    } catch (error) {
        console.error('❌ 로그인 상태 확인 실패:', error);
        
        // Firebase 서비스 초기화 실패 시에도 기본 로그인 화면 유지
        if (error.message.includes('Firebase 서비스 초기화 실패')) {
            console.log('⚠️ Firebase 서비스 초기화 실패, 로그인 화면 유지');
        }
    }
}

// 로그아웃 함수
function logout() {
    try {
        console.log('🚪 로그아웃 중...');
        
        // 저장된 이메일 삭제
        localStorage.removeItem('userEmail');
        
        // 로그인 화면으로 전환
        showLoginScreen();
        
        console.log('✅ 로그아웃 완료');
    } catch (error) {
        console.error('❌ 로그아웃 실패:', error);
    }
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
    
    // 자동 전송 토글 이벤트 리스너
    setupAutoSendEventListeners();
    
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
async function checkUserExists(email) {
    try {
        // Firebase에서 사용자 존재 여부만 확인 (자동 로그인용)
        const signUps = await window.firebaseService.getAllSignUps();
        
        for (const signUp of signUps) {
            if (signUp.email === email) {
                console.log(`사용자 존재 확인: ${email}`);
                return true;
            }
        }
        
        console.log(`사용자 없음: ${email}`);
        return false;
    } catch (error) {
        console.error('사용자 확인 실패:', error);
        return false;
    }
}

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
        localStorage.setItem('userEmail', email); // 키를 userEmail로 통일
        console.log('이메일 저장됨:', email);
    } catch (error) {
        console.error('이메일 저장 실패:', error);
    }
}

function loadSavedEmail() {
    try {
        const savedEmail = localStorage.getItem('userEmail'); // 키를 userEmail로 통일
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
        localStorage.removeItem('userEmail'); // 키를 userEmail로 통일
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
            
            // 계정별 텔레그램 설정 저장
            saveAccountSettings('telegram', telegramSettings);
            
            // 전역 설정도 저장 (하위 호환성)
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
                
                // 계정 목록 표시
                showAccountList(result.accounts);
                
                elements.testTelegramBtn.textContent = '✓ Loaded';
                elements.testTelegramBtn.style.background = 'linear-gradient(135deg, #28a745 0%, #1e7e34 100%)';
                
                setTimeout(() => {
                    elements.testTelegramBtn.textContent = 'Load';
                    elements.testTelegramBtn.style.background = 'linear-gradient(135deg, #28a745 0%, #1e7e34 100%)';
                    elements.testTelegramBtn.disabled = false;
                }, 2000);
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


// 계정 목록 표시
function showAccountList(accounts) {
    console.log('📋 계정 목록 표시 중...', accounts);
    
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
        
        <div style="text-align: center; display: flex; gap: 15px; justify-content: center;">
            <button id="confirmAccountSelection" style="
                background: linear-gradient(135deg, #10B981 0%, #059669 100%);
                color: white;
                border: none;
                padding: 12px 30px;
                border-radius: 8px;
                font-size: 14px;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.3s ease;
                opacity: 0.5;
                pointer-events: none;
            ">확인</button>
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
    
    // 선택된 계정을 저장할 변수
    let selectedAccount = null;
    
    // 계정 클릭 이벤트
    const accountItems = modal.querySelectorAll('.account-item');
    accountItems.forEach(item => {
        item.addEventListener('mouseenter', () => {
            if (!item.classList.contains('selected')) {
                item.style.borderColor = '#10B981';
                item.style.transform = 'translateY(-2px)';
                item.style.boxShadow = '0 5px 15px rgba(16, 185, 129, 0.3)';
            }
        });
        
        item.addEventListener('mouseleave', () => {
            if (!item.classList.contains('selected')) {
                item.style.borderColor = '#444';
                item.style.transform = 'translateY(0)';
                item.style.boxShadow = 'none';
            }
        });
        
        item.addEventListener('click', () => {
            // 이전 선택 해제
            accountItems.forEach(otherItem => {
                otherItem.classList.remove('selected');
                otherItem.style.borderColor = '#444';
                otherItem.style.background = 'linear-gradient(135deg, #2a2a2a 0%, #3a3a3a 100%)';
                otherItem.style.transform = 'translateY(0)';
                otherItem.style.boxShadow = 'none';
            });
            
            // 현재 항목 선택
            item.classList.add('selected');
            item.style.borderColor = '#6B7280';
            item.style.background = 'linear-gradient(135deg, #6B7280 0%, #4B5563 100%)';
            item.style.transform = 'translateY(-2px)';
            item.style.boxShadow = '0 5px 15px rgba(107, 114, 128, 0.5)';
            
            // 선택된 계정 저장
            const userId = item.dataset.userId;
            selectedAccount = accounts.find(acc => acc.user_id === userId);
            
            console.log('📱 선택된 계정:', selectedAccount);
            
            // 확인 버튼 활성화
            const confirmBtn = modal.querySelector('#confirmAccountSelection');
            confirmBtn.style.opacity = '1';
            confirmBtn.style.pointerEvents = 'auto';
        });
    });
    
    // 확인 버튼 이벤트
    modal.querySelector('#confirmAccountSelection').addEventListener('click', async () => {
        if (selectedAccount) {
            console.log('📱 확인된 계정:', selectedAccount);
            
            // 모달 닫기
            document.body.removeChild(modal);
            
            // 마지막 선택 계정 저장 (자동 복원용)
            try {
                localStorage.setItem('lastSelectedAccount', String(selectedAccount.user_id));
            } catch (e) { console.warn('lastSelectedAccount 저장 실패', e); }
            
            // 선택된 계정으로 그룹 로드(완료까지 대기)
            await loadGroupsForAccount(selectedAccount);

            // 계정 변경 시 설정 복원(그룹 렌더 완료 후 순차 복원)
            loadTelegramSettings();
            loadAutoSendSettings();
            updateAutoSendSettingsDisplay();
            updateSendButtonText();
            // 서버 자동전송 상태로 토글/버튼 동기화 + 단기 재동기화 폴링
            restoreAutoSendStatusFor(selectedAccount.user_id);
            startPostRestoreSync(selectedAccount.user_id);
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

// 복원 직후 단기 재동기화: 30초 동안 5초 간격으로 서버 상태와 UI를 강제 동기화
function startPostRestoreSync(userId) {
    try {
        const startedAt = Date.now();
        const sync = async () => {
            try {
                const res = await fetch('/api/auto-send/status', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userId })
                });
                const data = await res.json();
                if (data?.success) {
                    // 토글/버튼 상태 반영
                    const toggle = document.getElementById('autoSendToggle');
                    if (toggle) toggle.checked = !!data.is_running;
                    if (!data.is_running) {
                        // OFF이면 로컬 스냅샷 제거 및 체크 해제로 UI 초기화
                        try {
                            const key = getCurrentAccountKey ? getCurrentAccountKey() : null;
                            if (key) localStorage.removeItem(`${key}_selectedGroups`);
                            document.querySelectorAll('.group-checkbox').forEach(cb => (cb.checked = false));
                            updateSelectedGroupsCount();
                        } catch (_) {}
                    }
                    updateAutoSendSettingsDisplay();
                    updateSendButtonText();
                }
            } catch (_) {}
            if (Date.now() - startedAt < 30000) {
                setTimeout(sync, 5000);
            }
        };
        setTimeout(sync, 0);
    } catch (e) { console.warn('post-restore sync 실패', e); }
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
        
        // 자동전송 상태 복원: 그룹 렌더 직후 계정 기준으로 복원
        if (account?.user_id) {
            restoreAutoSendStatusFor(account.user_id);
            startPostRestoreSync(account.user_id);
        }
        
        // 자동전송 상태 주기적 업데이트 시작
        startAutoSendStatusUpdate();
        
        // 그룹 전체선택 버튼 이벤트 리스너 추가
        setupGroupSelectionButtons();
        
        // 창 표시 (제일 위로 올라오기)
        groupsWindow.style.display = 'flex';
        setTimeout(() => {
            groupsWindow.classList.add('show');
        }, 100);
        
        console.log('✅ 텔레그램 그룹 관리 창 표시 완료');

        // 계정별 저장된 UI 상태 복원
    try {
        // 선택 그룹 복원
        const key = getCurrentAccountKey ? getCurrentAccountKey() : (account?.user_id ? `account_${account.user_id}` : null);
        if (key) {
            const saved = JSON.parse(localStorage.getItem(`${key}_selectedGroups`) || '[]');
            if (Array.isArray(saved) && saved.length) {
                saved.forEach(gid => {
                    const cb = document.querySelector(`.group-item input[type="checkbox"][data-group-id="${gid}"]`);
                    if (cb) cb.checked = true;
                });
            }
        }
        // 저장된 메시지/버튼 상태는 기존 로직으로 즉시 반영됨
        // 자동전송 상태 동기화는 상단에서 처리됨
    } catch (e) { console.warn('계정별 상태 복원 실패', e); }
    }
}

// 그룹 목록 렌더링
function renderGroupsList(groups) {
    const groupsList = document.getElementById('groupsList');
    if (!groupsList) return;
    
    groupsList.innerHTML = groups.map((group, index) => `
        <div class="group-item" data-group-id="${group.id}" data-group-index="${index}">
            <div class="group-checkbox-container">
                <input type="checkbox" class="group-checkbox" id="group-${group.id}" data-group-id="${group.id}" data-group-title="${group.title}">
                <label for="group-${group.id}" class="group-label">
                    <div class="group-name">${group.title}</div>
                    <div class="group-info">
                        <div class="group-type">
                            ${group.type === 'supergroup' ? '슈퍼그룹' : '채널'}
                        </div>
                    </div>
                </label>
            </div>
            <div class="group-status-info">
                <div class="group-message-count">
                    <span class="status-label">메시지 수:</span>
                    <span class="status-value" id="messageCount-${group.id}">확인 중...</span>
                </div>
                <div class="group-next-send">
                    <span class="status-label">다음 전송:</span>
                    <span class="status-value" id="nextSend-${group.id}">-</span>
                </div>
                <div class="group-auto-status">
                    <span class="status-label">자동전송:</span>
                    <span class="status-value" id="autoStatus-${group.id}">대기</span>
                </div>
            </div>
        </div>
    `).join('');
    
    // 체크박스 이벤트 추가
    const groupCheckboxes = groupsList.querySelectorAll('.group-checkbox');
    groupCheckboxes.forEach(checkbox => {
        checkbox.addEventListener('change', function() {
            updateSelectedGroupsCount();
            updateGroupItemVisualState(this);
            // ON 상태에서만 변경 스냅샷 저장
            try {
                const toggle = document.getElementById('autoSendToggle');
                const key = getCurrentAccountKey ? getCurrentAccountKey() : null;
                if (toggle && toggle.checked && key) {
                    const ids = Array.from(document.querySelectorAll('.group-checkbox:checked')).map(cb => cb.dataset.groupId);
                    localStorage.setItem(`${key}_selectedGroups`, JSON.stringify(ids));
                }
            } catch (e) { console.warn('선택 그룹 자동 저장 실패', e); }
        });
    });
    
    // 초기 선택된 그룹 수 업데이트
    updateSelectedGroupsCount();
    
    // 초기 시각적 상태 업데이트
    groupCheckboxes.forEach(checkbox => {
        updateGroupItemVisualState(checkbox);
    });
}

// 그룹 아이템의 시각적 상태 업데이트
function updateGroupItemVisualState(checkbox) {
    const groupItem = checkbox.closest('.group-item');
    if (groupItem) {
        if (checkbox.checked) {
            groupItem.classList.add('selected');
        } else {
            groupItem.classList.remove('selected');
        }
    }
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
    
    // 그룹 ID들 미리 추출
    const selectedGroupIds = Array.from(checkedBoxes).map(checkbox => checkbox.dataset.groupId);
    const validGroupIds = selectedGroupIds.filter(id => id && id !== 'undefined');
    if (validGroupIds.length === 0) {
        alert('선택된 그룹의 ID를 찾을 수 없습니다. 페이지를 새로고침하고 다시 시도해주세요.');
        return;
    }
    // ON으로 시작할 때만 현재 선택 그룹을 계정별로 저장(복원 스냅샷)
    try {
        const toggle = document.getElementById('autoSendToggle');
        const key = getCurrentAccountKey ? getCurrentAccountKey() : null;
        if (toggle && toggle.checked && key) {
            localStorage.setItem(`${key}_selectedGroups`, JSON.stringify(validGroupIds));
        }
    } catch (e) { console.warn('선택 그룹 저장 실패', e); }
    
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
    
    console.log('🔍 선택된 그룹 ID들:', selectedGroupIds);
    console.log('🔍 체크된 체크박스들:', checkedBoxes);
    console.log('🔍 유효한 그룹 ID들:', validGroupIds);
    
    // 자동 전송 ON 상태에서는 서버의 자동전송 API 호출
    const autoSendToggle = document.getElementById('autoSendToggle');
    if (autoSendToggle && autoSendToggle.checked) {
        console.log('🔍 자동 전송 모드: 서버 자동전송 API 호출');
        console.log('🔥 API URL 확인:', getApiBaseUrl());
        
        // 자동전송 설정이 Firebase에 저장되어 있는지 확인하고 저장
        // 전체 자동전송 설정 객체 확보(계정별 저장값 우선)
        let currentSettings = loadAccountSettings('autoSend');
        if (!currentSettings || typeof currentSettings !== 'object') {
            // 최소 기본값 보정
            currentSettings = { groupInterval: 30, repeatInterval: 30, maxRepeats: 10, messageThreshold: 5, enableMessageCheck: false };
        }
        console.log('🔥 현재 자동전송 설정(객체):', currentSettings);
        
        // Firebase에 설정 저장
        console.log('🔥 자동전송 시작 전 Firebase 설정 저장');
        await saveAutoSendSettingsToFirebase(currentSettings);
        
        // 자동전송 시작
        const autoSendSuccess = await startAutoSendWithGroups(validGroupIds, message, mediaInfo);
        if (autoSendSuccess) {
            console.log('✅ 자동전송 시작 성공');
            alert('🤖 자동전송이 시작되었습니다!\n\n설정된 간격마다 자동으로 전송됩니다.\nPC를 종료해도 계속 작동합니다.');
            return; // 자동전송이 시작되면 여기서 종료
        } else {
            console.log('❌ 자동전송 시작 실패');
            alert('❌ 자동전송 시작에 실패했습니다.\n\n자동전송 설정을 확인하고 다시 시도해주세요.');
            return; // 자동전송 실패 시 수동전송으로 진행하지 않음
        }
    }
    
    // 수동 전송 모드임을 명확히 표시
    console.log('📤 수동 전송 모드: 즉시 전송 후 종료');
    
    // 버튼 상태 변경
    if (sendBtn) {
        sendBtn.textContent = '📤 수동 전송 중...';
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
                
                // 그룹 간 간격 적용
                if (i < validGroupIds.length - 1) {
                    const groupInterval = getGroupInterval();
                    console.log(`⏰ 그룹간 대기: ${groupInterval}초`);
                    await new Promise(resolve => setTimeout(resolve, groupInterval * 1000));
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

        // 자동전송이 ON이면 현재 그룹 선택 스냅샷을 유지 저장(체크 해제 방지)
        try {
            const toggle = document.getElementById('autoSendToggle');
            const key = getCurrentAccountKey ? getCurrentAccountKey() : null;
            if (toggle && toggle.checked && key) {
                const ids = Array.from(document.querySelectorAll('.group-checkbox:checked')).map(cb => cb.dataset.groupId);
                localStorage.setItem(`${key}_selectedGroups`, JSON.stringify(ids));
            }
        } catch (e) { console.warn('저장된 메시지 선택 후 그룹 스냅샷 저장 실패', e); }
        
        console.log('✅ 텔레그램 저장된 메시지 선택 완료:', message.text?.substring(0, 50) + '...');
    }
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
        
        <div style="text-align: center; display: flex; gap: 15px; justify-content: center;">
            <button id="confirmAccountSelection" style="
                background: linear-gradient(135deg, #10B981 0%, #059669 100%);
                color: white;
                border: none;
                padding: 12px 30px;
                border-radius: 8px;
                font-size: 14px;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.3s ease;
                opacity: 0.5;
                pointer-events: none;
            ">확인</button>
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
    
    // 선택된 계정을 저장할 변수
    let selectedAccount = null;
    
    // 계정 클릭 이벤트
    const accountItems = accountContainer.querySelectorAll('.account-item');
    accountItems.forEach(item => {
        item.addEventListener('mouseenter', () => {
            if (!item.classList.contains('selected')) {
                item.style.borderColor = '#10B981';
                item.style.transform = 'translateY(-2px)';
                item.style.boxShadow = '0 5px 15px rgba(16, 185, 129, 0.3)';
            }
        });
        
        item.addEventListener('mouseleave', () => {
            if (!item.classList.contains('selected')) {
                item.style.borderColor = '#444';
                item.style.transform = 'translateY(0)';
                item.style.boxShadow = 'none';
            }
        });
        
        item.addEventListener('click', () => {
            // 이전 선택 해제
            accountItems.forEach(otherItem => {
                otherItem.classList.remove('selected');
                otherItem.style.borderColor = '#444';
                otherItem.style.background = 'linear-gradient(135deg, #2a2a2a 0%, #3a3a3a 100%)';
                otherItem.style.transform = 'translateY(0)';
                otherItem.style.boxShadow = 'none';
            });
            
            // 현재 항목 선택
            item.classList.add('selected');
            item.style.borderColor = '#6B7280';
            item.style.background = 'linear-gradient(135deg, #6B7280 0%, #4B5563 100%)';
            item.style.transform = 'translateY(-2px)';
            item.style.boxShadow = '0 5px 15px rgba(107, 114, 128, 0.5)';
            
            // 선택된 계정 저장
            const userId = item.dataset.userId;
            selectedAccount = accounts.find(acc => acc.user_id === userId);
            
            console.log('📱 선택된 계정:', selectedAccount);
            
            // 확인 버튼 활성화
            const confirmBtn = accountContainer.querySelector('#confirmAccountSelection');
            confirmBtn.style.opacity = '1';
            confirmBtn.style.pointerEvents = 'auto';
        });
    });
    
    // 확인 버튼 이벤트
    accountContainer.querySelector('#confirmAccountSelection').addEventListener('click', () => {
        if (selectedAccount) {
            console.log('📱 확인된 계정:', selectedAccount);
            
            // 컨테이너 제거
            document.body.removeChild(accountContainer);
            
            // status-bar 다시 올리기
            const statusBar = document.querySelector('.status-bar');
            if (statusBar) {
                statusBar.style.transform = 'translateY(0)';
            }
            
            // 선택된 계정으로 그룹 로드
            loadGroupsForAccount(selectedAccount);
            
            // 계정 변경 시 설정 복원
            setTimeout(() => {
                loadTelegramSettings();
                loadAutoSendSettings();
                updateAutoSendSettingsDisplay();
                updateSendButtonText();
            }, 500);
        }
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

// 자동 전송 이벤트 리스너 설정
function setupAutoSendEventListeners() {
    const autoSendToggle = document.getElementById('autoSendToggle');
    const autoSendSettingsModal = document.getElementById('autoSendSettingsModal');
    const closeAutoSendSettingsBtn = document.getElementById('closeAutoSendSettingsBtn');
    const autoSendStartBtn = document.getElementById('autoSendStartBtn');
    const autoSendStopBtn = document.getElementById('autoSendStopBtn');
    const autoSendSaveBtn = document.getElementById('autoSendSaveBtn');

    // 자동 전송 토글 클릭 시 설정 모달 열기
    if (autoSendToggle) {
        autoSendToggle.addEventListener('change', function() {
            // 페이지가 언로드 중인지 확인
            if (isPageUnloading || document.visibilityState === 'hidden' || document.readyState === 'unload') {
                console.log('🔄 페이지 언로드 중, 자동전송 중지 건너뜀');
                return;
            }
            
            if (this.checked) {
                showAutoSendSettingsModal();
                updateSendButtonText(true); // 자동전송 ON
            } else {
                // 자동전송 중지
                if (window.stopAutoSend) {
                    window.stopAutoSend();
                } else {
                    console.warn('⚠️ stopAutoSend 가 아직 로드되지 않음');
                }
                hideAutoSendSettingsModal();
                // 설정 표시 숨기기
                const settingsDisplay = document.getElementById('autoSendSettingsDisplay');
                if (settingsDisplay) {
                    settingsDisplay.style.display = 'none';
                }
                
                // 모든 그룹의 자동전송 상태를 대기로 변경
                const groupItems = document.querySelectorAll('.group-item');
                const updater = window.updateGroupAutoStatus;
                groupItems.forEach(item => {
                    const groupId = item.dataset.groupId;
                    if (!groupId) return;
                    if (typeof updater === 'function') {
                        updater(groupId, false);
                    }
                });
                
                // 전송 버튼 상태 초기화
                resetSendButtonState();
                updateSendButtonText(false); // 자동전송 OFF
                
                // 추가적인 UI 상태 초기화
                const sendButton = document.getElementById('sendButton');
                if (sendButton) {
                    sendButton.disabled = false;
                    sendButton.classList.remove('sending', 'disabled');
                    sendButton.style.opacity = '1';
                }
            }
        });
    }

    // 모달 닫기 버튼
    if (closeAutoSendSettingsBtn) {
        closeAutoSendSettingsBtn.addEventListener('click', closeAutoSendSettingsModal);
    }

    // 모달 배경 클릭 시 닫기 기능 제거 (X 버튼이나 설정 저장으로만 닫기)
    // if (autoSendSettingsModal) {
    //     autoSendSettingsModal.addEventListener('click', function(e) {
    //         if (e.target === autoSendSettingsModal) {
    //             closeAutoSendSettingsModal();
    //         }
    //     });
    // }


    // 설정 저장 버튼
    if (autoSendSaveBtn) {
        autoSendSaveBtn.addEventListener('click', saveAutoSendSettings);
    }

    // 메시지 개수 확인 체크박스 (상태 표시 제거로 이벤트 리스너 불필요)
    // const enableMessageCheck = document.getElementById('enableMessageCheck');
    // if (enableMessageCheck) {
    //     enableMessageCheck.addEventListener('change', updateMessageCheckStatus);
    // }
    
    // 입력창 자동 크기 조절
    setupAutoResizeInputs();
}

// 자동 전송 설정 모달 표시
function showAutoSendSettingsModal() {
    const modal = document.getElementById('autoSendSettingsModal');
    if (modal) {
        modal.style.display = 'flex';
        loadAutoSendSettings();
    }
}

// 자동 전송 설정 모달 숨기기
function hideAutoSendSettingsModal() {
    const modal = document.getElementById('autoSendSettingsModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

// 자동 전송 설정 모달 닫기 (X 버튼으로 닫을 때)
function closeAutoSendSettingsModal() {
    const modal = document.getElementById('autoSendSettingsModal');
    const toggle = document.getElementById('autoSendToggle');
    if (modal) {
        modal.style.display = 'none';
    }
    if (toggle) {
        toggle.checked = false;
    }
    // 설정 표시 숨기기
    const settingsDisplay = document.getElementById('autoSendSettingsDisplay');
    if (settingsDisplay) {
        settingsDisplay.style.display = 'none';
    }
}

// 자동 전송 설정 로드
function loadAutoSendSettings() {
    try {
        // 먼저 계정별 설정 확인
        let settings = loadAccountSettings('autoSend');
        
        // 계정별 설정이 없으면 전역 설정 확인
        if (!settings) {
            const savedSettings = localStorage.getItem('autoSendSettings');
            if (savedSettings) {
                settings = JSON.parse(savedSettings);
            }
        }
        
        if (settings) {
            const groupInterval = document.getElementById('groupInterval');
            const repeatInterval = document.getElementById('repeatInterval');
            const maxRepeats = document.getElementById('maxRepeats');
            const messageThreshold = document.getElementById('messageThreshold');
            const enableMessageCheck = document.getElementById('enableMessageCheck');
            
            if (groupInterval) groupInterval.value = settings.groupInterval || 30;
            if (repeatInterval) repeatInterval.value = settings.repeatInterval || 30;
            if (maxRepeats) maxRepeats.value = settings.maxRepeats || 10;
            if (messageThreshold) messageThreshold.value = settings.messageThreshold || 5;
            if (enableMessageCheck) enableMessageCheck.checked = settings.enableMessageCheck !== false;
            
            console.log('자동전송 설정 로드됨:', settings);
        }
    } catch (error) {
        console.error('자동전송 설정 로드 실패:', error);
    }
}

// 자동 전송 설정 저장
function saveAutoSendSettings() {
    const groupInterval = document.getElementById('groupInterval').value;
    const repeatInterval = document.getElementById('repeatInterval').value;
    const maxRepeats = document.getElementById('maxRepeats').value;
    const messageThreshold = document.getElementById('messageThreshold').value;
    const enableMessageCheck = document.getElementById('enableMessageCheck').checked;
    
    const settings = {
        groupInterval: parseInt(groupInterval),
        repeatInterval: parseInt(repeatInterval),
        maxRepeats: parseInt(maxRepeats),
        messageThreshold: parseInt(messageThreshold),
        enableMessageCheck: enableMessageCheck
    };
    
    console.log('🔧 자동전송 설정 저장:', settings);
    console.log('🔧 그룹 간격 원본 값:', groupInterval, '변환된 값:', parseInt(groupInterval));
    
    // 계정별 자동전송 설정 저장
    saveAccountSettings('autoSend', settings);
    
    // 전역 설정도 저장 (하위 호환성)
    localStorage.setItem('autoSendSettings', JSON.stringify(settings));
    
    // Firebase에 자동전송 설정 저장
    console.log('🔥 자동전송 설정 저장 시작 - Firebase 호출');
    saveAutoSendSettingsToFirebase(settings);
    
    // 설정 저장 완료 후 잠시 대기
    setTimeout(() => {
        console.log('⏰ 자동전송 설정 저장 완료, 이제 자동전송 가능');
    }, 1000);
    
    // 메시지 개수 확인 상태 업데이트 (제거됨)
    // updateMessageCheckStatus();
    
    // 자동 전송 토글을 ON으로 설정
    const autoSendToggle = document.getElementById('autoSendToggle');
    if (autoSendToggle) {
        autoSendToggle.checked = true;
    }
    
    // 설정 표시 업데이트
    updateAutoSendSettingsDisplay();
    
    // 모달 닫기
    hideAutoSendSettingsModal();
    
    // 성공 메시지 표시
    alert('자동 전송 설정이 저장되었습니다!');
}

// 입력창 자동 크기 조절 설정
function setupAutoResizeInputs() {
    const inputs = document.querySelectorAll('.setting-input');
    
    inputs.forEach(input => {
        // 입력 시 크기 자동 조절
        input.addEventListener('input', function() {
            autoResizeInput(this);
        });
        
        // 초기 크기 설정
        autoResizeInput(input);
    });
}

// 입력창 크기 자동 조절 함수
function autoResizeInput(input) {
    // 임시 span 요소를 생성하여 텍스트 너비 측정
    const tempSpan = document.createElement('span');
    tempSpan.style.visibility = 'hidden';
    tempSpan.style.position = 'absolute';
    tempSpan.style.fontSize = window.getComputedStyle(input).fontSize;
    tempSpan.style.fontFamily = window.getComputedStyle(input).fontFamily;
    tempSpan.style.padding = window.getComputedStyle(input).padding;
    tempSpan.style.border = window.getComputedStyle(input).border;
    tempSpan.textContent = input.value || input.placeholder || '0';
    
    document.body.appendChild(tempSpan);
    const textWidth = tempSpan.offsetWidth;
    document.body.removeChild(tempSpan);
    
    // 최소 80px, 최대 200px로 제한
    const newWidth = Math.max(80, Math.min(200, textWidth + 20));
    input.style.width = newWidth + 'px';
}

// 메시지 개수 확인 상태 업데이트 함수 제거됨 (UI에서 해당 섹션 제거)

// 그룹의 메시지 개수 확인
async function checkGroupMessageCount(groupId) {
    try {
        // TODO: 실제 API 호출로 그룹의 메시지 개수 확인
        // 현재는 임시로 랜덤 값 반환
        const messageCount = Math.floor(Math.random() * 20) + 1;
        console.log(`📊 그룹 ${groupId}의 메시지 개수: ${messageCount}`);
        return messageCount;
    } catch (error) {
        console.error('❌ 메시지 개수 확인 실패:', error);
        return 0;
    }
}

// 메시지 개수 기반 전송 여부 결정
async function shouldSendToGroup(groupId) {
    const enableMessageCheck = document.getElementById('enableMessageCheck');
    const messageThreshold = document.getElementById('messageThreshold');
    
    // 메시지 개수 확인이 비활성화되어 있으면 항상 전송
    if (!enableMessageCheck || !enableMessageCheck.checked) {
        return true;
    }
    
    const threshold = parseInt(messageThreshold?.value || 5);
    const messageCount = await checkGroupMessageCount(groupId);
    
    // 메시지 개수가 임계값보다 많으면 전송
    return messageCount > threshold;
}

// 선택된 그룹들에 대해 메시지 개수 확인
async function checkSelectedGroupsMessageCount() {
    const checkedBoxes = document.querySelectorAll('.group-checkbox:checked');
    const pendingGroups = [];
    const sendableGroups = [];
    
    for (const checkbox of checkedBoxes) {
        const groupId = checkbox.dataset.groupId;
        const shouldSend = await shouldSendToGroup(groupId);
        
        if (shouldSend) {
            sendableGroups.push(groupId);
        } else {
            pendingGroups.push(groupId);
        }
    }
    
    // 보류된 그룹 수 업데이트
    const pendingGroupsElement = document.getElementById('pendingGroups');
    if (pendingGroupsElement) {
        pendingGroupsElement.textContent = `${pendingGroups.length}개`;
    }
    
    console.log(`📤 전송 가능한 그룹: ${sendableGroups.length}개`);
    console.log(`⏸️ 보류된 그룹: ${pendingGroups.length}개`);
    
    return { sendableGroups, pendingGroups };
}

// 자동 전송 설정 표시 업데이트
function updateAutoSendSettingsDisplay() {
    console.log('🔍 자동 전송 설정 표시 업데이트 중...');
    
    const settingsDisplay = document.getElementById('autoSendSettingsDisplay');
    const settingsInfo = document.getElementById('settingsInfo');
    const autoSendToggle = document.getElementById('autoSendToggle');
    
    console.log('📋 요소 확인:', {
        settingsDisplay: !!settingsDisplay,
        settingsInfo: !!settingsInfo,
        autoSendToggle: !!autoSendToggle,
        toggleChecked: autoSendToggle?.checked
    });
    
    if (!settingsDisplay || !settingsInfo || !autoSendToggle) {
        console.log('❌ 필요한 요소가 없습니다');
        return;
    }
    
    if (autoSendToggle.checked) {
        const savedSettings = localStorage.getItem('autoSendSettings');
        console.log('💾 저장된 설정:', savedSettings);
        
        if (savedSettings) {
            const settings = JSON.parse(savedSettings);
            console.log('📊 파싱된 설정:', settings);
            
            // 모든 설정 정보를 표시
            const settingsTexts = [];
            
            // 그룹 간 전송 간격
            settingsTexts.push(`그룹간격 ${settings.groupInterval}초`);
            
            // 반복 전송 간격
            settingsTexts.push(`반복간격 ${settings.repeatInterval}분`);
            
            // 최대 반복 횟수
            const maxRepeatsText = settings.maxRepeats === 0 ? '무제한' : `${settings.maxRepeats}회`;
            settingsTexts.push(`최대반복 ${maxRepeatsText}`);
            
            // 메시지 개수 확인
            const messageCheckText = settings.enableMessageCheck ? `메시지 ${settings.messageThreshold}개 이하 보류` : '메시지 확인 비활성화';
            settingsTexts.push(messageCheckText);
            
            // 설정을 하나씩 순차적으로 표시
            settingsInfo.innerHTML = '';
            settingsDisplay.style.display = 'block';
            
            // 각 설정을 0.5초 간격으로 순차적으로 추가
            settingsTexts.forEach((text, index) => {
                setTimeout(() => {
                    if (index === 0) {
                        settingsInfo.innerHTML = `<span class="setting-item">${text}</span>`;
                    } else {
                        settingsInfo.innerHTML += `<span class="setting-item">${text}</span>`;
                    }
                }, index * 500); // 0.5초 간격
            });
            
            console.log('✅ 설정 표시 완료');
        } else {
            console.log('❌ 저장된 설정이 없습니다');
        }
    } else {
        settingsDisplay.style.display = 'none';
        console.log('🔴 자동 전송 OFF - 설정 표시 숨김');
    }
}


// 저장된 텔레그램 설정 로드
function loadTelegramSettings() {
    try {
        // 먼저 계정별 설정 확인
        let settings = loadAccountSettings('telegram');
        
        // 계정별 설정이 없으면 전역 설정 확인
        if (!settings) {
            const savedSettings = localStorage.getItem('telegramSettings');
            if (savedSettings) {
                settings = JSON.parse(savedSettings);
            }
        }
        
        if (settings) {
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

function resetSendButtonState() {
    // 전송 버튼 상태 초기화
    const sendButton = document.getElementById('sendButton');
    if (sendButton) {
        sendButton.disabled = false;
        sendButton.textContent = '전송';
        sendButton.classList.remove('sending', 'disabled');
        sendButton.style.opacity = '1';
        sendButton.style.backgroundColor = '';
        sendButton.style.borderColor = '';
    }
    
    // 진행상황 창 숨기기
    hideProgressSection();
    
    // 메시지 입력 필드도 활성화
    const messageInput = document.getElementById('messageInput');
    if (messageInput) {
        messageInput.disabled = false;
        messageInput.style.backgroundColor = '';
        messageInput.style.cursor = '';
    }
    
    console.log('🔄 전송 버튼 상태 초기화 완료');
}

// 그룹 전체선택 버튼 설정
function setupGroupSelectionButtons() {
    const selectAllBtn = document.getElementById('selectAllGroupsBtn');
    const deselectAllBtn = document.getElementById('deselectAllGroupsBtn');
    
    if (selectAllBtn) {
        selectAllBtn.addEventListener('click', function() {
            selectAllGroups();
        });
    }
    
    if (deselectAllBtn) {
        deselectAllBtn.addEventListener('click', function() {
            deselectAllGroups();
        });
    }
}

// 모든 그룹 선택
function selectAllGroups() {
    const groupCheckboxes = document.querySelectorAll('.group-checkbox');
    let selectedCount = 0;
    
    groupCheckboxes.forEach(checkbox => {
        if (!checkbox.disabled) {
            checkbox.checked = true;
            selectedCount++;
        }
    });
    
    // 선택된 그룹 수 업데이트
    updateSelectedGroupsCount();
    
    console.log(`✅ 전체 그룹 선택 완료: ${selectedCount}개 그룹`);
}

// 모든 그룹 선택 해제
function deselectAllGroups() {
    const groupCheckboxes = document.querySelectorAll('.group-checkbox');
    
    groupCheckboxes.forEach(checkbox => {
        checkbox.checked = false;
    });
    
    // 선택된 그룹 수 업데이트
    updateSelectedGroupsCount();
    
    console.log('❌ 전체 그룹 선택 해제 완료');
}

// 선택된 그룹 수 업데이트
function updateSelectedGroupsCount() {
    const groupCheckboxes = document.querySelectorAll('.group-checkbox:checked');
    const selectedCount = groupCheckboxes.length;
    
    // 선택된 그룹 수 표시 업데이트
    const selectedGroupsInfo = document.getElementById('selectedGroupsInfo');
    if (selectedGroupsInfo) {
        selectedGroupsInfo.textContent = `${selectedCount}개 그룹 선택됨`;
    }
    
    // 전송 버튼 상태 업데이트
    updateSendButtonState(selectedCount);
    
    return selectedCount;
}

// 전송 버튼 상태 업데이트 함수
function updateSendButtonState(selectedCount) {
    const sendBtn = document.getElementById('sendMessageBtn');
    
    if (sendBtn) {
        if (selectedCount > 0) {
            sendBtn.disabled = false;
            sendBtn.style.opacity = '1';
            updateSendButtonText(); // 자동전송 상태에 따라 텍스트 업데이트
        } else {
            sendBtn.disabled = true;
            sendBtn.style.opacity = '0.5';
        }
    }
}

// 전송 버튼 텍스트 업데이트
function updateSendButtonText(isAutoSend = null) {
    const sendBtn = document.getElementById('sendMessageBtn');
    const autoSendToggle = document.getElementById('autoSendToggle');
    
    if (sendBtn && autoSendToggle) {
        const isAutoSendMode = isAutoSend !== null ? isAutoSend : autoSendToggle.checked;
        
        if (isAutoSendMode) {
            sendBtn.textContent = '🤖 자동전송 시작';
            sendBtn.style.backgroundColor = '#4CAF50'; // 녹색
            sendBtn.style.borderColor = '#4CAF50';
        } else {
            sendBtn.textContent = '📤 수동 전송';
            sendBtn.style.backgroundColor = '#2196F3'; // 파란색
            sendBtn.style.borderColor = '#2196F3';
        }
    }
}

// API URL 관리 함수 (동일 오리진 사용: CORS 회피)
function getApiBaseUrl() {
    return '';
}

// 서버 자동전송 상태 복원 (특정 userId)
async function restoreAutoSendStatusFor(userId) {
    try {
        if (!userId) return;
        console.log('🔄 특정 계정 상태 복원 시작:', userId);
        const resp = await fetch(`${getApiBaseUrl()}/api/auto-send/status`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId })
        });
        const data = await resp.json();
        console.log('📊 특정 계정 상태:', data);
        const toggle = document.getElementById('autoSendToggle');
        if (!(data && data.success)) return;

        // 1) 토글을 서버 상태로 강제 일치
        if (toggle) {
            toggle.checked = !!data.is_running;
            updateSendButtonText(!!data.is_running);
        }

        // 2) 그룹 체크박스를 서버 group_ids로 강제 반영
        try {
            const serverGroups = Array.isArray(data.group_ids) ? data.group_ids.map(String) : [];
            const allCbs = document.querySelectorAll('.group-checkbox');
            allCbs.forEach(cb => {
                const gid = cb.dataset.groupId;
                cb.checked = serverGroups.includes(String(gid));
            });
            updateSelectedGroupsCount();
        } catch (_) {}

        // 3) 저장된 메시지/미디어 강제 반영
        try {
            if (data.media_info || data.message) {
                window.selectedMediaInfo = data.media_info || null;
                const messageInput = document.querySelector('.message-input');
                if (window.selectedMediaInfo) {
                    if (messageInput) {
                        messageInput.value = '';
                        messageInput.placeholder = '💾 저장된 메시지가 선택되었습니다. 해제 후 입력하세요.';
                        messageInput.disabled = true;
                        messageInput.style.backgroundColor = '#f0f0f0';
                        messageInput.style.cursor = 'not-allowed';
                    }
                } else if (messageInput) {
                    messageInput.value = data.message || '';
                    messageInput.disabled = false;
                    messageInput.style.backgroundColor = '';
                    messageInput.style.cursor = '';
                }
            }
        } catch (_) {}

        // 4) 서버가 is_running:false면 로컬 스냅샷 제거 및 UI 초기화(이전 로직 유지)
        if (!data.is_running) {
            try {
                const key = getCurrentAccountKey ? getCurrentAccountKey() : null;
                if (key) localStorage.removeItem(`${key}_selectedGroups`);
            } catch (_) {}
        }
    } catch (e) {
        console.warn('상태 복원 실패:', e);
    }
}

// 자동전송 중지 API 호출
async function stopAutoSend() {
    try {
        const accountName = document.getElementById('selectedAccountName')?.textContent?.trim();
        // 가능한 모든 경로로 userId 추출 시도
        let userId = document.getElementById('selectedAccountUserId')?.textContent?.trim()
            || document.querySelector('.account-item.selected')?.dataset?.userId
            || window.currentSelectedAccount?.user_id
            || window.selectedAccount?.user_id
            || '';
        // userId가 없으면 서버에서 계정 목록을 받아 매핑 (이름 → userId, 실패 시 전화번호로 매칭)
        if (!userId && accountName) {
            try {
                const accResp = await fetch(`${getApiBaseUrl()}/api/telegram/load-accounts`, {
                    method: 'GET'
                });
                const accData = await accResp.json();
                const accounts = accData.accounts || accData || [];
                // 1) 이름 매칭
                let found = (accounts || []).find(a => {
                    const full = `${a.first_name || ''} ${a.last_name || ''}`.trim();
                    return full === accountName;
                });
                // 2) 전화번호 매칭 (DOM에서 선택된 번호 읽기)
                if (!found) {
                    const phoneText = document.getElementById('selectedAccountPhone')?.textContent?.trim();
                    if (phoneText) {
                        found = (accounts || []).find(a => (a.phone_number || '').trim() === phoneText);
                    }
                }
                if (found && found.user_id) {
                    userId = String(found.user_id);
                }
            } catch (e) {
                console.warn('⚠️ 계정 목록 조회 실패(중지 준비)', e);
            }
        }
        // 마지막 안전장치: userId가 여전히 없으면 사용자에게 안내하고 중지 요청 중단
        if (!userId) {
            console.warn('❌ userId 매핑 실패: 중지 요청을 보내지 않습니다');
            alert('자동전송 중지에 필요한 계정 식별자를 찾지 못했습니다. 계정을 다시 선택한 후 시도해 주세요.');
            return;
        }
        if (!accountName && !userId) {
            console.warn('⚠️ 계정명이 없어 자동전송 중지 요청을 건너뜀');
            return;
        }
        console.log('🛑 자동전송 중지 요청:', { account_name: accountName, userId });
        const resp = await fetch(`${getApiBaseUrl()}/api/auto-send/stop`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ account_name: accountName, userId })
        });
        const result = await resp.json().catch(() => ({}));
        console.log('🛑 자동전송 중지 응답:', resp.status, result);
    } catch (e) {
        console.error('❌ 자동전송 중지 에러:', e);
    }
}
// 전역에서 접근 가능하도록 등록
window.stopAutoSend = stopAutoSend;

// Firebase 자동전송 설정 저장 함수
async function saveAutoSendSettingsToFirebase(settings) {
    try {
        const accountName = document.getElementById('selectedAccountName')?.textContent;
        // userId 우선 확보 (숫자 ID)
        let userId = localStorage.getItem('lastSelectedAccount')?.trim();
        if (!userId) {
            // 화면에서 선택된 계정의 data-user-id 조회
            userId = document.querySelector('.account-item.selected')?.dataset?.userId?.trim() || '';
        }
        if (!userId) {
            // 최후: 계정 목록에서 이름 매핑
            try {
                const resp = await fetch('/api/telegram/load-accounts');
                const json = await resp.json();
                const found = (json.accounts || []).find(acc => `${acc.first_name} ${acc.last_name || ''}`.trim() === (accountName||'').trim());
                if (found) userId = String(found.user_id);
            } catch {}
        }
        if (!userId) {
            console.error('❌ userId를 찾을 수 없어 Firebase 저장 불가');
            return;
        }

        console.log('🔥 Firebase 자동전송 설정 저장 시작:', userId, settings);
        console.log('🔥 API URL:', `${getApiBaseUrl()}/api/auto-send/save-settings`);
        
        const requestData = {
            userId: userId,
            settings: settings
        };
        console.log('🔥 전송할 데이터:', requestData);
        
        const response = await fetch(`${getApiBaseUrl()}/api/auto-send/save-settings`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestData)
        });
        
        console.log('🔥 응답 상태:', response.status);
        const result = await response.json();
        console.log('🔥 응답 내용:', result);
        
        if (result.success) {
            console.log('✅ Firebase 자동전송 설정 저장 성공:', result);
        } else {
            console.error('❌ Firebase 자동전송 설정 저장 실패:', result);
        }
        
    } catch (error) {
        console.error('❌ Firebase 자동전송 설정 저장 에러:', error);
    }
}

// 계정별 설정 관리 함수들
function getCurrentAccountKey() {
    const accountName = document.getElementById('selectedAccountName')?.textContent;
    const accountPhone = document.getElementById('selectedAccountPhone')?.textContent;
    
    if (!accountName || accountName === '계정을 선택하세요') {
        return null;
    }
    
    // 계정명과 전화번호를 조합하여 고유 키 생성
    return `${accountName}_${accountPhone}`.replace(/[^a-zA-Z0-9_]/g, '_');
}

function saveAccountSettings(settingsType, settings) {
    try {
        const accountKey = getCurrentAccountKey();
        if (!accountKey) {
            console.log('❌ 계정이 선택되지 않음, 설정 저장 건너뜀');
            return false;
        }
        
        const key = `accountSettings_${accountKey}_${settingsType}`;
        localStorage.setItem(key, JSON.stringify(settings));
        console.log(`✅ 계정별 ${settingsType} 설정 저장:`, accountKey, settings);
        return true;
    } catch (error) {
        console.error(`❌ 계정별 ${settingsType} 설정 저장 실패:`, error);
        return false;
    }
}

function loadAccountSettings(settingsType) {
    try {
        const accountKey = getCurrentAccountKey();
        if (!accountKey) {
            console.log('❌ 계정이 선택되지 않음, 기본 설정 사용');
            return null;
        }
        
        const key = `accountSettings_${accountKey}_${settingsType}`;
        const savedSettings = localStorage.getItem(key);
        
        if (savedSettings) {
            const settings = JSON.parse(savedSettings);
            console.log(`✅ 계정별 ${settingsType} 설정 로드:`, accountKey, settings);
            return settings;
        }
        
        console.log(`ℹ️ 계정별 ${settingsType} 설정 없음:`, accountKey);
        return null;
    } catch (error) {
        console.error(`❌ 계정별 ${settingsType} 설정 로드 실패:`, error);
        return null;
    }
}

// 그룹간 간격 설정 가져오기
function getGroupInterval() {
    try {
        // 먼저 계정별 설정 확인
        const accountSettings = loadAccountSettings('autoSend');
        if (accountSettings && accountSettings.groupInterval) {
            return accountSettings.groupInterval;
        }
        
        // 계정별 설정이 없으면 전역 설정 확인
        const savedSettings = localStorage.getItem('autoSendSettings');
        if (savedSettings) {
            const settings = JSON.parse(savedSettings);
            return settings.groupInterval || 30; // 기본값 30초
        }
        return 30; // 기본값
    } catch (error) {
        console.error('❌ 그룹간 간격 설정 조회 실패:', error);
        return 30; // 기본값
    }
}

// 자동전송 시작 함수
async function startAutoSendWithGroups(selectedGroups, message, mediaInfo) {
    try {
        console.log('🚀 자동전송 시작:', { selectedGroups, message, mediaInfo });
        
        // 현재 계정 정보 가져오기
        const accountName = document.getElementById('selectedAccountName').textContent;
        const accountPhone = document.getElementById('selectedAccountPhone').textContent;
        
        if (!accountName || accountName === '계정을 선택하세요') {
            throw new Error('계정이 선택되지 않았습니다.');
        }
        
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
        
        // 자동전송 시작 API 호출 (CORS 우회)
        const autoSendResponse = await fetch(`${getApiBaseUrl()}/api/auto-send/start`, {
            method: 'POST',
            mode: 'cors',
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
            },
            body: JSON.stringify({
                userId: String(account.user_id),
                group_ids: selectedGroups,
                message: message,
                media_info: mediaInfo
            })
        });
        
        const autoSendResult = await autoSendResponse.json();
        
        if (autoSendResponse.ok && autoSendResult.success) {
            console.log('✅ 자동전송 시작 성공:', autoSendResult);
            return true;
        } else {
            console.error('❌ 자동전송 시작 실패:', autoSendResult);
            return false;
        }
        
    } catch (error) {
        console.error('❌ 자동전송 시작 에러:', error);
        return false;
    }
}

// 자동전송 상태 주기적 업데이트
function startAutoSendStatusUpdate() {
    // 30초마다 자동전송 상태 확인
    setInterval(async () => {
        try {
            const accountName = document.getElementById('selectedAccountName').textContent;
            if (!accountName || accountName === '계정을 선택하세요') {
                return;
            }
            
            const response = await fetch('/api/auto-send/status', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ userId: localStorage.getItem('lastSelectedAccount') })
            });
            
            if (response.ok) {
                const statusData = await response.json();
                if (statusData.is_running && statusData.groups) {
                    // 그룹 상태 업데이트
                    statusData.groups.forEach(group => {
                        updateGroupAutoStatus(group.id, true);
                        if (group.next_send_time) {
                            updateGroupNextSendTime(group.id, group.next_send_time);
                        }
                    });
                }
            }
        } catch (error) {
            console.error('❌ 자동전송 상태 업데이트 실패:', error);
        }
    }, 30000); // 30초마다 업데이트
}

// 자동전송 상태 복원 함수
async function restoreAutoSendStatusOnLoad() {
    try {
        console.log('🔄 페이지 로드 시 자동전송 상태 복원 시작');
        // 계정 미선택이면 전역 복원 동작 금지 (계정 확정 시점에만 복원)
        const lastUserId = localStorage.getItem('lastSelectedAccount');
        if (!lastUserId) {
            console.log('❌ 계정이 선택되지 않음, 자동전송 상태 복원 건너뜀');
            return;
        }
        
        // 서버에서 자동전송 상태 조회
        const response = await fetch('/api/auto-send/status', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                userId: lastUserId
            })
        });
        
        if (response.ok) {
            const statusData = await response.json();
            console.log('📊 서버에서 가져온 자동전송 상태:', statusData);
            
            if (statusData.is_running) {
                // 자동전송이 실행 중인 경우 UI 업데이트
                const autoSendToggle = document.getElementById('autoSendToggle');
                if (autoSendToggle) {
                    autoSendToggle.checked = true;
                    console.log('✅ 자동전송 토글 ON으로 설정');
                }
                
                // 그룹 상태 업데이트
                if (statusData.groups && statusData.groups.length > 0) {
                    statusData.groups.forEach(group => {
                        updateGroupAutoStatus(group.id, true);
                        if (group.next_send_time) {
                            updateGroupNextSendTime(group.id, group.next_send_time);
                        }
                    });
                }
                
                console.log('✅ 자동전송 상태 복원 완료');
            } else {
                console.log('ℹ️ 자동전송이 실행 중이 아님');
            }
        } else {
            console.log('❌ 자동전송 상태 조회 실패:', response.status);
        }
    } catch (error) {
        console.error('❌ 자동전송 상태 복원 실패:', error);
    }
}

// 페이지 언로드 감지 변수
let isPageUnloading = false;

// 페이지 언로드 이벤트 감지
window.addEventListener('beforeunload', function() {
    isPageUnloading = true;
    console.log('🔄 페이지 언로드 시작, 자동전송 중지 방지');
});

// 페이지 가시성 변경 감지
document.addEventListener('visibilitychange', function() {
    if (document.visibilityState === 'hidden') {
        isPageUnloading = true;
        console.log('🔄 페이지 숨김, 자동전송 중지 방지');
    } else if (document.visibilityState === 'visible') {
        isPageUnloading = false;
        console.log('🔄 페이지 표시, 자동전송 중지 방지 해제');
    }
});

// 페이지 로드 시 전송 버튼 상태 초기화
document.addEventListener('DOMContentLoaded', function() {
    // DOM이 로드된 후 전송 버튼 상태 초기화
    setTimeout(() => {
        resetSendButtonState();
    }, 1000);
});
