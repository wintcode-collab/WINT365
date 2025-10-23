using System;

namespace GridstudioLoginApp
{
    public static class FirebaseConfig
    {
        // Firebase 프로젝트 설정
        // Firebase Console에서 프로젝트 설정 > 일반 > 웹 앱에서 확인
        public static string FirebaseUrl = "https://wint365-date-default-rtdb.asia-southeast1.firebasedatabase.app/";
        
        // Firebase Web API Key (Authentication용)
        // Firebase Console > 프로젝트 설정 > 일반 > 웹 앱에서 확인
        public static string FirebaseApiKey = "AIzaSyD4BXeUQZsUsY5Sy7ExymnlOyZ_5u37tAA";
        
        // 보안 규칙 (나중에 설정)
        // Firebase Console > Realtime Database > 규칙에서 설정
        // {
        //   "rules": {
        //     "signups": {
        //       ".read": true,
        //       ".write": true
        //     },
        //     "invite_codes": {
        //       ".read": true,
        //       ".write": true
        //     }
        //   }
        // }
    }
}
