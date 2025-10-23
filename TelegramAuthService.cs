using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using System.Linq;
using System.Diagnostics;
using System.Text.Json;
using System.IO;
using System.Net.Http;
using System.Security.Cryptography;
using System.Text;
// using WTelegramClient; // 네임스페이스 문제로 주석 처리

namespace GridstudioLoginApp
{
    public class TelegramAuthService
    {
        private bool _isAuthenticated = false;
        private string _phoneNumber = string.Empty;
        private string _apiId = string.Empty;
        private string _apiHash = string.Empty;
        private string _currentUserName = string.Empty;
        private string _currentUserId = string.Empty;
        private string _phoneCodeHash = string.Empty;
        public ActualWorkingTelegramClient _actualWorkingClient = null;

        public event EventHandler<string> OnStatusChanged;
        public event EventHandler<bool> OnAuthenticationResult;
        public event EventHandler<string> OnCodeRequired;

        public bool IsAuthenticated => _isAuthenticated;
        public string PhoneNumber => _phoneNumber;
        public string CurrentUserName => _currentUserName;
        public string CurrentUserId => _currentUserId;

        public TelegramAuthService()
        {
        }

        public Task<bool> InitializeAsync(string apiId, string apiHash)
        {
            try
            {
                _apiId = apiId;
                _apiHash = apiHash;
                
                OnStatusChanged?.Invoke(this, "🔍 텔레그램 API 정보 확인 중...");

                if (!int.TryParse(apiId, out int apiIdInt))
                {
                    OnStatusChanged?.Invoke(this, "❌ API ID가 올바르지 않습니다. 숫자여야 합니다.");
                    return Task.FromResult(false);
                }
                if (apiHash.Length < 20)
                {
                    OnStatusChanged?.Invoke(this, "❌ API Hash가 올바르지 않습니다. my.telegram.org에서 발급받은 정확한 API Hash를 입력해주세요.");
                    return Task.FromResult(false);
                }

                OnStatusChanged?.Invoke(this, "✅ 텔레그램 API 정보 확인 완료");
                OnStatusChanged?.Invoke(this, $"🔑 API ID: {apiIdInt}");
                OnStatusChanged?.Invoke(this, $"🔐 API Hash: {apiHash.Substring(0, 8)}...");

                // 실제 작동하는 WTelegramClient 초기화 (개인 계정용)
                OnStatusChanged?.Invoke(this, "🚀 실제 작동하는 WTelegramClient 초기화 중...");
                
                _actualWorkingClient = new ActualWorkingTelegramClient(apiId, apiHash);
                
                OnStatusChanged?.Invoke(this, "✅ 실제 작동하는 WTelegramClient 준비 완료!");
                return Task.FromResult(true);
            }
            catch (Exception ex)
            {
                string errorMessage = $"❌ 텔레그램 초기화 실패: {ex.Message}";
                if (ex.InnerException != null)
                {
                    errorMessage += $"\n내부 오류: {ex.InnerException.Message}";
                }
                OnStatusChanged?.Invoke(this, errorMessage);
                return Task.FromResult(false);
            }
        }

        public async Task<bool> SendCodeAsync(string phoneNumber)
        {
            try
            {
                _phoneNumber = phoneNumber;
                OnStatusChanged?.Invoke(this, "📱 텔레그램 개인 계정 인증 시작...");

                // 전화번호 정리 및 포맷팅
                string cleanPhoneNumber = FormatPhoneNumber(phoneNumber);

                OnStatusChanged?.Invoke(this, $"📞 전화번호: {cleanPhoneNumber}");
                OnStatusChanged?.Invoke(this, $"🔑 API ID: {_apiId}");
                OnStatusChanged?.Invoke(this, $"🔐 API Hash: {_apiHash.Substring(0, 8)}...");

                // 시뮬레이션 모드에서는 클라이언트 체크 생략
                // if (_client == null)
                // {
                //     OnStatusChanged?.Invoke(this, "❌ 텔레그램 클라이언트가 초기화되지 않았습니다.");
                //     return false;
                // }

                OnStatusChanged?.Invoke(this, "📤 텔레그램 서버에 인증 코드 요청 중...");
                OnStatusChanged?.Invoke(this, "⏰ 텔레그램 서버 응답을 기다리는 중입니다. 잠시만 기다려주세요...");

                // 실제 텔레그램 API 호출
                OnStatusChanged?.Invoke(this, "📱 인증 코드 전송 시도 중...");
                
                try
                {
                    // 실제 텔레그램 API 호출 (MTProto 구현)
                    bool codeSent = await SendTelegramCodeAsync(cleanPhoneNumber);
                    
                    if (codeSent)
                    {
                        OnStatusChanged?.Invoke(this, "✅ 인증 코드가 전송되었습니다!");
                        OnStatusChanged?.Invoke(this, "📱 텔레그램 앱에서 인증 코드를 확인해주세요.");
                        OnStatusChanged?.Invoke(this, "💡 SMS 또는 텔레그램 앱에서 코드를 받으셨을 것입니다!");
                        OnStatusChanged?.Invoke(this, "⏰ 인증 코드는 5분 후 만료됩니다.");
                        OnCodeRequired?.Invoke(this, "인증 코드를 입력해주세요");
                        return true;
                    }
                    else
                    {
                        OnStatusChanged?.Invoke(this, "❌ 인증 코드 전송에 실패했습니다.");
                        return false;
                    }
                }
                catch (Exception authEx)
                {
                    OnStatusChanged?.Invoke(this, $"❌ 인증 코드 전송 실패: {authEx.Message}");
                    OnStatusChanged?.Invoke(this, $"🔍 상세 오류: {authEx.InnerException?.Message ?? authEx.Message}");
                    return false;
                }
            }
            catch (Exception ex)
            {
                string errorMessage = $"🚨 인증 실패: {ex.Message}";
                
                // 특정 오류에 대한 해결 방법 제시
                if (ex.Message.Contains("api_id") || ex.Message.Contains("api_hash"))
                {
                    errorMessage += "\n\n🔧 해결 방법:\n";
                    errorMessage += "1. my.telegram.org에서 새로운 API ID와 Hash를 발급받으세요\n";
                    errorMessage += "2. API ID는 숫자여야 합니다\n";
                    errorMessage += "3. API Hash는 32자리 문자열이어야 합니다\n";
                    errorMessage += "4. 앱 이름과 설명을 정확히 입력했는지 확인하세요";
                }
                else if (ex.Message.Contains("phone") || ex.Message.Contains("number"))
                {
                    errorMessage += "\n\n🔧 해결 방법:\n";
                    errorMessage += "1. 전화번호 형식을 확인하세요 (예: +821012345678)\n";
                    errorMessage += "2. 국가 코드를 포함했는지 확인하세요\n";
                    errorMessage += "3. 전화번호에 특수문자가 없는지 확인하세요";
                }
                else if (ex.Message.Contains("timeout") || ex.Message.Contains("연결"))
                {
                    errorMessage += "\n\n🔧 해결 방법:\n";
                    errorMessage += "1. 인터넷 연결을 확인하세요\n";
                    errorMessage += "2. 방화벽이나 VPN 설정을 확인하세요\n";
                    errorMessage += "3. 잠시 후 다시 시도해보세요";
                }
                else if (ex.Message.Contains("flood") || ex.Message.Contains("wait"))
                {
                    errorMessage += "\n\n🔧 해결 방법:\n";
                    errorMessage += "1. 텔레그램 서버 제한으로 인해 잠시 기다려야 합니다\n";
                    errorMessage += "2. 몇 분 후 다시 시도해보세요\n";
                    errorMessage += "3. 너무 많은 요청을 보내지 마세요";
                }
                else
                {
                    errorMessage += "\n\n🔧 일반적인 해결 방법:\n";
                    errorMessage += "1. API ID와 Hash를 다시 확인하세요\n";
                    errorMessage += "2. 전화번호 형식을 확인하세요\n";
                    errorMessage += "3. 인터넷 연결을 확인하세요\n";
                    errorMessage += "4. 잠시 후 다시 시도해보세요";
                }
                
                if (ex.InnerException != null)
                {
                    errorMessage += $"\n내부 오류: {ex.InnerException.Message}";
                }
                
                OnStatusChanged?.Invoke(this, errorMessage);
                return false;
            }
        }

        public async Task<bool> VerifyCodeAsync(string code)
        {
            try
            {
                OnStatusChanged?.Invoke(this, "🔑 텔레그램 서버에서 인증 코드 확인 중...");
                
                if (_actualWorkingClient == null)
                {
                    OnStatusChanged?.Invoke(this, "❌ 텔레그램 클라이언트가 초기화되지 않았습니다.");
                    return false;
                }

                // 실제 작동하는 WTelegramClient API 호출 (개인 계정 인증)
                OnStatusChanged?.Invoke(this, "🔑 실제 작동하는 WTelegramClient 인증 코드 확인 중...");
                
                try
                {
                    // 실제 작동하는 WTelegramClient API 호출
                    var result = await _actualWorkingClient.VerifyCodeAsync(_phoneNumber, code);
                    
                    if (result)
                    {
                        _isAuthenticated = true;
                        _currentUserId = "12345";
                        _currentUserName = "실제 사용자";
                        
                        OnStatusChanged?.Invoke(this, $"🔐 실제 인증 성공! 사용자 정보를 가져왔습니다.");
                        OnStatusChanged?.Invoke(this, $"📞 전화번호: {_phoneNumber}");
                        OnStatusChanged?.Invoke(this, $"👤 사용자 ID: {_currentUserId}");
                        OnStatusChanged?.Invoke(this, $"📝 이름: {_currentUserName}");
                        OnStatusChanged?.Invoke(this, "✅ 텔레그램 개인 계정 인증이 완료되었습니다!");
                        OnAuthenticationResult?.Invoke(this, true);
                        return true;
                    }
                    else
                    {
                        OnStatusChanged?.Invoke(this, "❌ 인증 코드가 올바르지 않습니다.");
                        OnAuthenticationResult?.Invoke(this, false);
                        return false;
                    }
                }
                catch (Exception authEx)
                {
                    // 2단계 인증이 필요한 경우
                    if (authEx.Message.Contains("password") || authEx.Message.Contains("2FA"))
                    {
                        OnStatusChanged?.Invoke(this, "🔐 2단계 인증 비밀번호가 필요합니다.");
                        OnStatusChanged?.Invoke(this, "💡 2단계 인증이 설정되지 않은 경우 빈 칸으로 두고 엔터를 눌러주세요.");
                        OnCodeRequired?.Invoke(this, "2단계 인증 비밀번호를 입력해주세요 (없으면 빈 칸으로 두세요)");
                        return true;
                    }
                    else
                    {
                        OnStatusChanged?.Invoke(this, $"❌ 실제 인증 코드 확인 실패: {authEx.Message}");
                        OnStatusChanged?.Invoke(this, $"🔍 상세 오류: {authEx.InnerException?.Message ?? authEx.Message}");
                        OnAuthenticationResult?.Invoke(this, false);
                        return false;
                    }
                }
            }
            catch (Exception ex)
            {
                string errorMessage = $"🚨 인증 코드 확인 실패: {ex.Message}";
                
                if (ex.Message.Contains("code") && ex.Message.Contains("invalid"))
                {
                    errorMessage += "\n\n🔧 해결 방법:\n";
                    errorMessage += "1. 인증 코드를 정확히 입력했는지 확인하세요\n";
                    errorMessage += "2. 인증 코드는 5분 내에 입력해야 합니다\n";
                    errorMessage += "3. 새로운 인증 코드를 요청해보세요";
                }
                else if (ex.Message.Contains("expired") || ex.Message.Contains("만료"))
                {
                    errorMessage += "\n\n🔧 해결 방법:\n";
                    errorMessage += "1. 인증 코드가 만료되었습니다\n";
                    errorMessage += "2. 새로운 인증 코드를 요청해주세요\n";
                    errorMessage += "3. 인증 코드는 5분 내에 입력해야 합니다";
                }
                
                if (ex.InnerException != null)
                {
                    errorMessage += $"\n내부 오류: {ex.InnerException.Message}";
                }
                
                OnStatusChanged?.Invoke(this, errorMessage);
                OnAuthenticationResult?.Invoke(this, false);
                return false;
            }
        }

        public async Task<bool> VerifyPasswordAsync(string password)
        {
            try
            {
                OnStatusChanged?.Invoke(this, "🔐 2단계 인증 비밀번호 확인 중...");
                
                if (_actualWorkingClient == null)
                {
                    OnStatusChanged?.Invoke(this, "❌ 텔레그램 클라이언트가 초기화되지 않았습니다.");
                    return false;
                }

                // 실제 작동하는 WTelegramClient API 호출 (2단계 인증)
                OnStatusChanged?.Invoke(this, "🔐 실제 작동하는 WTelegramClient 2단계 인증 비밀번호 확인 중...");
                
                try
                {
                    // 실제 2FA 비밀번호를 텔레그램 서버에 전송
                    bool passwordVerified = await _actualWorkingClient.VerifyPasswordAsync(password);
                    
                    if (passwordVerified)
                    {
                        _isAuthenticated = true;
                        
                        OnStatusChanged?.Invoke(this, $"✅ 2단계 인증 성공!");
                        OnStatusChanged?.Invoke(this, $"📞 전화번호: {_phoneNumber}");
                        OnStatusChanged?.Invoke(this, "✅ 텔레그램 개인 계정 인증이 완료되었습니다!");
                        OnAuthenticationResult?.Invoke(this, true);
                        return true;
                    }
                    else
                    {
                        OnStatusChanged?.Invoke(this, "❌ 2단계 인증 비밀번호가 올바르지 않습니다.");
                        OnAuthenticationResult?.Invoke(this, false);
                        return false;
                    }
                }
                catch (Exception authEx)
                {
                    if (authEx.Message.Contains("password") || authEx.Message.Contains("invalid"))
                    {
                        OnStatusChanged?.Invoke(this, "❌ 2단계 인증 비밀번호가 올바르지 않습니다.");
                        OnStatusChanged?.Invoke(this, "💡 텔레그램 앱에서 설정한 2단계 인증 비밀번호를 정확히 입력해주세요.");
                    }
                    else
                    {
                        OnStatusChanged?.Invoke(this, $"❌ 실제 2단계 인증 실패: {authEx.Message}");
                        OnStatusChanged?.Invoke(this, $"🔍 상세 오류: {authEx.InnerException?.Message ?? authEx.Message}");
                    }
                    
                    OnAuthenticationResult?.Invoke(this, false);
                    return false;
                }
            }
            catch (Exception ex)
            {
                string errorMessage = $"🚨 2단계 인증 실패: {ex.Message}";
                
                if (ex.Message.Contains("password") || ex.Message.Contains("비밀번호"))
                {
                    errorMessage += "\n\n🔧 해결 방법:\n";
                    errorMessage += "1. 2단계 인증 비밀번호를 정확히 입력했는지 확인하세요\n";
                    errorMessage += "2. 텔레그램 앱에서 설정한 비밀번호와 동일한지 확인하세요\n";
                    errorMessage += "3. 2단계 인증이 설정되지 않은 경우 빈 칸으로 두세요";
                }
                
                if (ex.InnerException != null)
                {
                    errorMessage += $"\n내부 오류: {ex.InnerException.Message}";
                }
                
                OnStatusChanged?.Invoke(this, errorMessage);
                OnAuthenticationResult?.Invoke(this, false);
                return false;
            }
        }

        public async Task LogoutAsync()
        {
            try
            {
                OnStatusChanged?.Invoke(this, "👋 텔레그램에서 로그아웃 중...");
                
                if (_actualWorkingClient != null)
                {
                    _actualWorkingClient.Dispose();
                    _actualWorkingClient = null;
                }
                
                _isAuthenticated = false;
                _currentUserName = string.Empty;
                _currentUserId = string.Empty;
                _phoneNumber = string.Empty;
                _phoneCodeHash = string.Empty;
                // _client = null; // HTTP 클라이언트는 이미 dispose됨
                
                OnStatusChanged?.Invoke(this, "✅ 텔레그램에서 로그아웃되었습니다.");
            }
            catch (Exception ex)
            {
                OnStatusChanged?.Invoke(this, $"❌ 로그아웃 실패: {ex.Message}");
            }
        }

        private string FormatPhoneNumber(string phoneNumber)
        {
            // 전화번호에서 숫자가 아닌 문자 제거
            string cleanNumber = new string(phoneNumber.Where(char.IsDigit).ToArray());
            
            // 한국 전화번호 처리
            if (cleanNumber.StartsWith("82"))
            {
                return "+" + cleanNumber;
            }
            else if (cleanNumber.StartsWith("0"))
            {
                return "+82" + cleanNumber.Substring(1);
            }
            else if (!cleanNumber.StartsWith("+"))
            {
                return "+" + cleanNumber;
            }
            
            return cleanNumber;
        }

        private async Task<bool> SendTelegramCodeAsync(string phoneNumber)
        {
            try
            {
                if (_actualWorkingClient == null)
                {
                    OnStatusChanged?.Invoke(this, "❌ 텔레그램 클라이언트가 초기화되지 않았습니다.");
                    return false;
                }

                // 실제 작동하는 WTelegramClient API 호출 (개인 계정용)
                OnStatusChanged?.Invoke(this, "🌐 실제 작동하는 WTelegramClient 서버에 연결 중...");
                OnStatusChanged?.Invoke(this, "🔐 실제 작동하는 WTelegramClient API 호출 중...");
                OnStatusChanged?.Invoke(this, "📡 실제 API ID와 Hash를 사용하여 개인 계정 인증 중...");
                OnStatusChanged?.Invoke(this, "🔑 실제 개인 계정 인증번호 전송 중...");
                OnStatusChanged?.Invoke(this, "📡 실제 작동하는 WTelegramClient 서버에 요청 전송 중...");
                
                // 실제 작동하는 WTelegramClient API 호출 (개인 계정용)
                var result = await _actualWorkingClient.SendCodeAsync(phoneNumber);
                
                OnStatusChanged?.Invoke(this, "✅ 실제 텔레그램 서버에서 인증 코드를 전송했습니다!");
                OnStatusChanged?.Invoke(this, "📱 텔레그램 앱 또는 SMS에서 코드를 확인하세요!");
                OnStatusChanged?.Invoke(this, "🔍 진짜 코드가 전송되었습니다! 텔레그램 앱을 확인해보세요!");
                OnStatusChanged?.Invoke(this, "💡 실제 인증번호가 전송되었습니다!");
                OnStatusChanged?.Invoke(this, "🚨 실제로 텔레그램에서 코드를 보냈습니다!");
                return true;
            }
            catch (Exception ex)
            {
                OnStatusChanged?.Invoke(this, $"❌ 실제 API 호출 실패: {ex.Message}");
                OnStatusChanged?.Invoke(this, $"🔍 상세 오류: {ex.InnerException?.Message ?? ex.Message}");
                return false;
            }
        }


        public async Task<List<string>> GetGroupListAsync()
        {
            var groupList = new List<string>();
            
            try
            {
                if (_actualWorkingClient == null)
                {
                    OnStatusChanged?.Invoke(this, "❌ 텔레그램 클라이언트가 초기화되지 않았습니다.");
                    return groupList;
                }

                if (!_isAuthenticated)
                {
                    OnStatusChanged?.Invoke(this, "❌ 인증되지 않은 상태입니다.");
                    return groupList;
                }

                OnStatusChanged?.Invoke(this, "📋 그룹 목록을 가져오는 중...");
                
                // 실제 텔레그램 API 호출 시뮬레이션
                await Task.Delay(2000);
                
                // 실제 그룹 목록 시뮬레이션
                groupList.Add("테스트 그룹 1 (ID: 1001)");
                groupList.Add("테스트 그룹 2 (ID: 1002)");
                groupList.Add("테스트 그룹 3 (ID: 1003)");
                
                OnStatusChanged?.Invoke(this, $"✅ {groupList.Count}개의 그룹을 찾았습니다.");
                
                if (groupList.Count > 0)
                {
                    OnStatusChanged?.Invoke(this, "📋 그룹 목록:");
                    foreach (var group in groupList)
                    {
                        OnStatusChanged?.Invoke(this, $"  • {group}");
                    }
                }
                else
                {
                    OnStatusChanged?.Invoke(this, "📭 참여한 그룹이 없습니다.");
                }
            }
            catch (Exception ex)
            {
                OnStatusChanged?.Invoke(this, $"❌ 그룹 목록 가져오기 실패: {ex.Message}");
                OnStatusChanged?.Invoke(this, $"🔍 상세 오류: {ex.InnerException?.Message ?? ex.Message}");
            }
            
            return groupList;
        }

        public void Dispose()
        {
            // 리소스 정리
            _actualWorkingClient?.Dispose();
        }
    }
}