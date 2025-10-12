# Firebase Realtime Database 규칙 설정 가이드

## 🚨 현재 문제
Firebase 연결 테스트에서 "파이어베이스 연결 테스트"라고만 나오는 것은 Firebase 규칙이 너무 제한적이기 때문입니다.

## 🔧 해결 방법

### 1. Firebase 콘솔 접속
1. [Firebase 콘솔](https://console.firebase.google.com/) 접속
2. `wint365-date` 프로젝트 선택
3. 왼쪽 메뉴에서 **"Realtime Database"** 클릭

### 2. 규칙 탭으로 이동
1. 상단 탭에서 **"규칙"** 클릭
2. 현재 규칙이 다음과 같이 되어 있을 것입니다:

```json
{
  "rules": {
    ".read": "auth != null",
    ".write": "auth != null"
  }
}
```

### 3. 임시 규칙 변경 (테스트용)
**⚠️ 주의: 이 규칙은 보안상 위험하므로 테스트 후 반드시 원래대로 되돌려야 합니다!**

```json
{
  "rules": {
    ".read": true,
    ".write": true
  }
}
```

### 4. 규칙 게시
1. **"게시"** 버튼 클릭
2. 확인 메시지에서 **"게시"** 클릭

### 5. 테스트
1. 웹사이트에서 **Load 버튼** 클릭
2. Firebase 연결 테스트 결과 확인
3. 텔레그램 계정 연동 테스트

### 6. 보안 규칙으로 복원 (중요!)
테스트 완료 후 반드시 다음 규칙으로 복원하세요:

```json
{
  "rules": {
    "signups": {
      ".read": true,
      ".write": true
    },
    "invite_codes": {
      ".read": true,
      ".write": true
    },
    "telegram_sessions": {
      ".read": true,
      ".write": true
    },
    "authenticated_accounts": {
      ".read": true,
      ".write": true
    },
    "test": {
      ".read": true,
      ".write": true
    }
  }
}
```

## 🔍 문제 진단

### Firebase 연결 테스트 결과 해석:
- **200**: 성공
- **401**: 인증 필요 (규칙 문제)
- **403**: 권한 없음 (규칙 문제)
- **404**: 경로 없음 (URL 문제)

### 로그 확인:
서버 로그에서 다음을 확인하세요:
```
🔥 Firebase 연결 테스트 시작
🔥 Firebase URL: https://wint365-date-default-rtdb.asia-southeast1.firebasedatabase.app
🔥 PUT 응답 상태: 200
🔥 GET 응답 상태: 200
```

## 📞 지원
문제가 지속되면 Firebase 콘솔의 **"사용량"** 탭에서 API 호출 제한을 확인하세요.
