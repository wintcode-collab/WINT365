using System;
using System.Threading.Tasks;
using Firebase.Auth;

namespace GridstudioLoginApp
{
    public class FirebaseAuthService
    {
        private FirebaseAuthProvider authProvider;
        private FirebaseAuthLink authLink;

        public FirebaseAuthService()
        {
            authProvider = new FirebaseAuthProvider(new Firebase.Auth.FirebaseConfig(FirebaseConfig.FirebaseApiKey));
            authLink = null;
        }

        // 관리자 로그인
        public async Task<bool> AdminLoginAsync(string email, string password)
        {
            try
            {
                authLink = await authProvider.SignInWithEmailAndPasswordAsync(email, password);
                return authLink.User != null;
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"관리자 로그인 실패: {ex.Message}");
                return false;
            }
        }

        // 사용자 로그인
        public async Task<bool> UserLoginAsync(string email, string password)
        {
            try
            {
                authLink = await authProvider.SignInWithEmailAndPasswordAsync(email, password);
                return authLink.User != null;
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"사용자 로그인 실패: {ex.Message}");
                return false;
            }
        }

        // 회원가입
        public async Task<bool> SignUpAsync(string email, string password)
        {
            try
            {
                authLink = await authProvider.CreateUserWithEmailAndPasswordAsync(email, password);
                return authLink.User != null;
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"회원가입 실패: {ex.Message}");
                return false;
            }
        }

        // 로그아웃
        public void Logout()
        {
            authLink = null;
        }

        // 현재 사용자 ID
        public string GetCurrentUserId()
        {
            return authLink?.User?.LocalId;
        }

        // 관리자 여부 확인
        public bool IsAdmin()
        {
            return authLink?.User?.Email == "admin@wint365.com";
        }

        // 인증 토큰 가져오기
        public string GetAuthToken()
        {
            return authLink?.FirebaseToken;
        }
    }
}
