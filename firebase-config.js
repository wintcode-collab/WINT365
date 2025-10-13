// Firebase 설정
const firebaseConfig = {
    // Firebase 프로젝트 설정
    apiKey: "AlzaSyD4BXeUQZsUsY5Sy7ExymnlOyZ_5u37tAA",
    authDomain: "wint365-date.firebaseapp.com",
    databaseURL: "https://wint365-date-default-rtdb.asia-southeast1.firebasedatabase.app/",
    projectId: "wint365-date",
    storageBucket: "wint365-date.appspot.com",
    messagingSenderId: "123456789",
    appId: "1:123456789:web:abcdef123456"
};

// Firebase 초기화
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getDatabase, ref, push, get, set, update, remove } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js';

const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

// Firebase 서비스 클래스
class FirebaseService {
    constructor() {
        this.database = database;
    }

    // 회원가입 정보 저장
    async saveSignUp(email, password) {
        try {
            const signUpData = {
                email: email,
                password: password,
                timestamp: new Date().toISOString(),
                ip: await this.getLocalIPAddress()
            };

            const signUpsRef = ref(this.database, 'signups');
            await push(signUpsRef, signUpData);
            
            console.log('Firebase: 회원가입 정보 저장 성공');
            return true;
        } catch (error) {
            console.error('Firebase 저장 실패:', error);
            return false;
        }
    }

    // 사용자 등록 여부 확인
    async isUserRegistered(email) {
        try {
            console.log(`Firebase: 사용자 등록 확인: ${email}`);
            
            const signUpsRef = ref(this.database, 'signups');
            const snapshot = await get(signUpsRef);
            
            if (snapshot.exists()) {
                const signUps = snapshot.val();
                console.log(`Firebase: ${Object.keys(signUps).length}개의 회원가입 기록 조회`);
                
                for (const key in signUps) {
                    if (signUps[key].email === email) {
                        console.log(`Firebase: 사용자 ${email} 등록 확인됨`);
                        return true;
                    }
                }
            }
            
            console.log(`Firebase: 사용자 ${email} 등록되지 않음`);
            return false;
        } catch (error) {
            console.error('Firebase 사용자 확인 실패:', error);
            return false;
        }
    }

    // 모든 회원가입 정보 조회
    async getAllSignUps() {
        try {
            console.log('Firebase: 모든 회원가입 정보 조회');
            const signUpsRef = ref(this.database, 'signups');
            const snapshot = await get(signUpsRef);
            
            if (snapshot.exists()) {
                const signUps = snapshot.val();
                console.log(`Firebase: ${Object.keys(signUps).length}개의 회원가입 기록 조회`);
                return Object.values(signUps);
            }
            
            return [];
        } catch (error) {
            console.error('Firebase 회원가입 목록 조회 실패:', error);
            return [];
        }
    }

    // 코드 검증
    async validateCode(inputCode, userEmail = '') {
        try {
            console.log(`Firebase: 코드 검증 - ${inputCode}, 사용자: ${userEmail}`);
            
            const codesRef = ref(this.database, 'invite_codes');
            const snapshot = await get(codesRef);
            
            if (snapshot.exists()) {
                const codes = snapshot.val();
                console.log(`Firebase: ${Object.keys(codes).length}개의 코드 조회`);
                
                for (const key in codes) {
                    const codeData = codes[key];
                    console.log(`Firebase: 코드 확인 - ${codeData.code} (사용됨: ${codeData.isUsed}, 할당됨: ${codeData.assignedTo})`);
                    
                    if (codeData.code === inputCode) {
                        if (codeData.isUsed === true) {
                            console.log(`Firebase: 코드 ${inputCode} 이미 사용됨`);
                            return { isValid: false, message: 'This access code has already been used.' };
                        }
                        
                        // 만료일 확인
                        if (codeData.expiryDate) {
                            const expiryDate = new Date(codeData.expiryDate);
                            if (new Date() > expiryDate) {
                                console.log(`Firebase: 코드 ${inputCode} 만료됨 - ${expiryDate}`);
                                return { isValid: false, message: `This access code expired on ${expiryDate.toLocaleString()}.` };
                            }
                        }
                        
                        // 사용자 할당 확인
                        if (codeData.assignedTo && userEmail) {
                            if (codeData.assignedTo !== userEmail) {
                                console.log(`Firebase: 코드 ${inputCode} 다른 사용자에게 할당됨: ${codeData.assignedTo}`);
                                return { isValid: false, message: 'This access code is not assigned to your account.' };
                            }
                        }
                        
                        console.log(`Firebase: 코드 ${inputCode} 유효함`);
                        return { isValid: true, message: 'Valid access code.' };
                    }
                }
            }
            
            console.log(`Firebase: 코드 ${inputCode} 찾을 수 없음`);
            return { isValid: false, message: 'Invalid access code.' };
        } catch (error) {
            console.error('Firebase 코드 검증 실패:', error);
            return { isValid: false, message: `Error validating code: ${error.message}` };
        }
    }

    // 코드를 사용자에게 등록
    async registerCodeToUser(code, userEmail) {
        try {
            console.log(`Firebase: 코드 등록 - ${code}, 사용자: ${userEmail}`);
            
            const codesRef = ref(this.database, 'invite_codes');
            const snapshot = await get(codesRef);
            
            if (snapshot.exists()) {
                const codes = snapshot.val();
                
                for (const key in codes) {
                    const codeData = codes[key];
                    
                    if (codeData.code === code && codeData.isUsed !== true) {
                        const assignedTo = codeData.assignedTo || '';
                        
                        // 이미 해당 사용자에게 할당되어 있는지 확인
                        if (assignedTo === userEmail) {
                            console.log(`Firebase: 코드 ${code} 이미 사용자 ${userEmail}에게 할당됨`);
                            return true;
                        }
                        
                        // 다른 사용자에게 할당되어 있는지 확인
                        if (assignedTo && assignedTo !== userEmail) {
                            console.log(`Firebase: 코드 ${code} 다른 사용자에게 할당됨: ${assignedTo}`);
                            return false;
                        }
                        
                        // 코드 등록
                        const assignedAt = new Date();
                        const expiryDate = new Date(assignedAt.getTime() + (30 * 24 * 60 * 60 * 1000)); // 30일 후
                        
                        const updatedCodeData = {
                            ...codeData,
                            assignedAt: assignedAt.toISOString(),
                            expiryDate: expiryDate.toISOString(),
                            assignedTo: userEmail,
                            ip: await this.getLocalIPAddress()
                        };
                        
                        const codeRef = ref(this.database, `invite_codes/${key}`);
                        await set(codeRef, updatedCodeData);
                        
                        console.log(`Firebase: 코드 ${code} 사용자 ${userEmail}에게 등록 성공`);
                        return true;
                    }
                }
            }
            
            console.log(`Firebase: 코드 ${code} 찾을 수 없거나 이미 사용됨`);
            return false;
        } catch (error) {
            console.error('Firebase 코드 등록 실패:', error);
            return false;
        }
    }

    // 코드 사용 처리
    async useCode(inputCode, usedBy) {
        try {
            const codesRef = ref(this.database, 'invite_codes');
            const snapshot = await get(codesRef);
            
            if (snapshot.exists()) {
                const codes = snapshot.val();
                
                for (const key in codes) {
                    const codeData = codes[key];
                    
                    if (codeData.code === inputCode && codeData.isUsed !== true) {
                        const updatedCodeData = {
                            ...codeData,
                            isUsed: true,
                            usedAt: new Date().toISOString(),
                            usedBy: usedBy,
                            ip: await this.getLocalIPAddress()
                        };
                        
                        const codeRef = ref(this.database, `invite_codes/${key}`);
                        await set(codeRef, updatedCodeData);
                        
                        return true;
                    }
                }
            }
            
            return false;
        } catch (error) {
            console.error('Firebase 코드 사용 실패:', error);
            return false;
        }
    }

    // 사용자가 코드를 등록했는지 확인
    async hasUserRegisteredCode(userEmail) {
        try {
            console.log(`Firebase: 사용자 코드 등록 확인: ${userEmail}`);
            
            const codesRef = ref(this.database, 'invite_codes');
            const snapshot = await get(codesRef);
            
            if (snapshot.exists()) {
                const codes = snapshot.val();
                
                for (const key in codes) {
                    const codeData = codes[key];
                    const assignedTo = codeData.assignedTo || '';
                    
                    if (assignedTo === userEmail) {
                        console.log(`Firebase: 사용자 ${userEmail} 코드 등록됨: ${codeData.code}`);
                        return true;
                    }
                }
            }
            
            console.log(`Firebase: 사용자 ${userEmail} 코드 등록되지 않음`);
            return false;
        } catch (error) {
            console.error('Firebase 사용자 코드 등록 확인 실패:', error);
            return false;
        }
    }

    // 사용자 코드 남은 기간 조회
    async getUserCodeRemainingDays(userEmail) {
        try {
            console.log(`Firebase: 사용자 코드 남은 기간 조회: ${userEmail}`);
            
            const codesRef = ref(this.database, 'invite_codes');
            const snapshot = await get(codesRef);
            
            if (snapshot.exists()) {
                const codes = snapshot.val();
                
                for (const key in codes) {
                    const codeData = codes[key];
                    const assignedTo = codeData.assignedTo || '';
                    
                    if (assignedTo === userEmail) {
                        const assignedAt = new Date(codeData.assignedAt);
                        const expiryDate = new Date(codeData.expiryDate);
                        const now = new Date();
                        
                        const assignedDateStr = assignedAt.toLocaleString();
                        const expiryDateStr = expiryDate.toLocaleString();
                        
                        const remaining = expiryDate - now;
                        
                        if (remaining > 0) {
                            const days = Math.ceil(remaining / (1000 * 60 * 60 * 24));
                            console.log(`Firebase: 사용자 ${userEmail} ${days}일 남음`);
                            return `Registered: ${assignedDateStr}\nExpires: ${expiryDateStr}\n\n(${days} day${days === 1 ? '' : 's'} remaining)`;
                        } else {
                            console.log(`Firebase: 사용자 ${userEmail} 코드 만료됨`);
                            return `Registered: ${assignedDateStr}\nExpired: ${expiryDateStr}`;
                        }
                    }
                }
            }
            
            console.log(`Firebase: 사용자 ${userEmail} 코드 없음`);
            return 'No access code found';
        } catch (error) {
            console.error('Firebase 사용자 코드 남은 기간 조회 실패:', error);
            return 'Error retrieving code information';
        }
    }

    // 텔레그램 세션 데이터 저장
    async saveTelegramSession(clientId, sessionData, phoneCodeHash, apiId, apiHash, phoneNumber) {
        try {
            console.log(`Firebase: 텔레그램 세션 저장 - ${clientId}`);
            
            const sessionInfo = {
                clientId: clientId,
                sessionData: sessionData, // Base64로 인코딩된 세션 데이터
                phoneCodeHash: phoneCodeHash,
                apiId: apiId,
                apiHash: apiHash,
                phoneNumber: phoneNumber,
                createdAt: new Date().toISOString(),
                expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24시간 후 만료
                ip: await this.getLocalIPAddress()
            };

            const sessionsRef = ref(this.database, `telegram_sessions/${clientId}`);
            await set(sessionsRef, sessionInfo);
            
            console.log('Firebase: 텔레그램 세션 저장 성공');
            return true;
        } catch (error) {
            console.error('Firebase 텔레그램 세션 저장 실패:', error);
            return false;
        }
    }

    // 텔레그램 세션 데이터 조회
    async getTelegramSession(clientId) {
        try {
            console.log(`Firebase: 텔레그램 세션 조회 - ${clientId}`);
            
            const sessionRef = ref(this.database, `telegram_sessions/${clientId}`);
            const snapshot = await get(sessionRef);
            
            if (snapshot.exists()) {
                const sessionData = snapshot.val();
                
                // 만료 시간 확인
                const expiresAt = new Date(sessionData.expiresAt);
                if (new Date() > expiresAt) {
                    console.log(`Firebase: 세션 ${clientId} 만료됨`);
                    await this.deleteTelegramSession(clientId);
                    return null;
                }
                
                console.log('Firebase: 텔레그램 세션 조회 성공');
                return sessionData;
            }
            
            console.log(`Firebase: 세션 ${clientId} 찾을 수 없음`);
            return null;
        } catch (error) {
            console.error('Firebase 텔레그램 세션 조회 실패:', error);
            return null;
        }
    }

    // 텔레그램 세션 데이터 삭제
    async deleteTelegramSession(clientId) {
        try {
            console.log(`Firebase: 텔레그램 세션 삭제 - ${clientId}`);
            
            const sessionRef = ref(this.database, `telegram_sessions/${clientId}`);
            await remove(sessionRef);
            
            console.log('Firebase: 텔레그램 세션 삭제 성공');
            return true;
        } catch (error) {
            console.error('Firebase 텔레그램 세션 삭제 실패:', error);
            return false;
        }
    }

    // 자동전송 상태 저장
    async saveAutoSendStatus(userEmail, accountName, status) {
        try {
            console.log(`Firebase: 자동전송 상태 저장 - ${userEmail}, ${accountName}`);
            
            const autoSendData = {
                userEmail: userEmail,
                accountName: accountName,
                isRunning: status.isRunning,
                startedAt: status.startedAt || new Date().toISOString(),
                groups: status.groups || [],
                message: status.message || '',
                mediaInfo: status.mediaInfo || null,
                nextSendTime: status.nextSendTime || null,
                settings: status.settings || {},
                lastUpdated: new Date().toISOString(),
                ip: await this.getLocalIPAddress()
            };

            const autoSendRef = ref(this.database, `auto_send_status/${userEmail}_${accountName.replace(/\s+/g, '_')}`);
            await set(autoSendRef, autoSendData);
            
            console.log('Firebase: 자동전송 상태 저장 성공');
            return true;
        } catch (error) {
            console.error('Firebase 자동전송 상태 저장 실패:', error);
            return false;
        }
    }

    // 자동전송 상태 조회
    async getAutoSendStatus(userEmail, accountName) {
        try {
            console.log(`Firebase: 자동전송 상태 조회 - ${userEmail}, ${accountName}`);
            
            const autoSendRef = ref(this.database, `auto_send_status/${userEmail}_${accountName.replace(/\s+/g, '_')}`);
            const snapshot = await get(autoSendRef);
            
            if (snapshot.exists()) {
                const statusData = snapshot.val();
                console.log('Firebase: 자동전송 상태 조회 성공');
                return statusData;
            }
            
            console.log(`Firebase: 자동전송 상태 없음 - ${userEmail}, ${accountName}`);
            return null;
        } catch (error) {
            console.error('Firebase 자동전송 상태 조회 실패:', error);
            return null;
        }
    }

    // 자동전송 상태 삭제 (중지 시)
    async deleteAutoSendStatus(userEmail, accountName) {
        try {
            console.log(`Firebase: 자동전송 상태 삭제 - ${userEmail}, ${accountName}`);
            
            const autoSendRef = ref(this.database, `auto_send_status/${userEmail}_${accountName.replace(/\s+/g, '_')}`);
            await remove(autoSendRef);
            
            console.log('Firebase: 자동전송 상태 삭제 성공');
            return true;
        } catch (error) {
            console.error('Firebase 자동전송 상태 삭제 실패:', error);
            return false;
        }
    }

    // 사용자의 모든 자동전송 상태 조회
    async getAllAutoSendStatus(userEmail) {
        try {
            console.log(`Firebase: 사용자 자동전송 상태 조회 - ${userEmail}`);
            
            const autoSendRef = ref(this.database, 'auto_send_status');
            const snapshot = await get(autoSendRef);
            
            if (snapshot.exists()) {
                const allStatus = snapshot.val();
                const userStatus = [];
                
                for (const key in allStatus) {
                    if (allStatus[key].userEmail === userEmail) {
                        userStatus.push(allStatus[key]);
                    }
                }
                
                console.log(`Firebase: ${userStatus.length}개의 자동전송 상태 조회`);
                return userStatus;
            }
            
            return [];
        } catch (error) {
            console.error('Firebase 사용자 자동전송 상태 조회 실패:', error);
            return [];
        }
    }

    // 로컬 IP 주소 가져오기 (웹에서는 제한적)
    async getLocalIPAddress() {
        try {
            // 웹에서는 실제 IP를 가져올 수 없으므로 시뮬레이션
            return 'Web-Client';
        } catch (error) {
            return 'Unknown';
        }
    }
}

// 전역 Firebase 서비스 인스턴스
window.firebaseService = new FirebaseService();


