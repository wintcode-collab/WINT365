using System;
using System.Collections.Generic;
using System.IO;
using System.Threading.Tasks;
using WTelegram;

namespace GridstudioLoginApp
{
    public class ActualWorkingTelegramClient
    {
        private Client _client;
        private readonly string _apiId;
        private readonly string _apiHash;
        private string _phoneCodeHash;
        private string _phoneNumber;
        private bool _needs2FA = false;
        private bool _isFullyAuthenticated = false;
        private string _sessionData = "";
        private string _sessionPath = "";

        public bool Needs2FA => _needs2FA;
        public bool IsFullyAuthenticated => _isFullyAuthenticated;

        public ActualWorkingTelegramClient(string apiId, string apiHash)
        {
            _apiId = apiId;
            _apiHash = apiHash;
        }
        
        // 세션 데이터를 Base64 문자열로 가져오기
        public string GetSessionData()
        {
            return _sessionData;
        }
        
        // 세션 파일 경로 반환
        public string GetSessionPath()
        {
            return _sessionPath;
        }

        public async Task<bool> SendCodeAsync(string phoneNumber)
        {
            try
            {
                System.Diagnostics.Debug.WriteLine($"🔍 WTelegramClient 초기화 시작...");
                System.Diagnostics.Debug.WriteLine($"📋 API ID: {_apiId}, Phone: {phoneNumber}");
                
                _phoneNumber = phoneNumber;
                
                // 세션 파일 경로 생성 (타임스탬프 추가로 매번 고유한 파일 생성)
                string timestamp = DateTime.Now.ToString("yyyyMMddHHmmss");
                _sessionPath = Path.Combine(Path.GetTempPath(), $"telegram_session_{phoneNumber}_{timestamp}.dat");
                System.Diagnostics.Debug.WriteLine($"📂 새로운 세션 경로: {_sessionPath}");
                
                // WTelegramClient 초기화
                _client = new Client(what =>
                {
                    switch (what)
                    {
                        case "api_id": return _apiId;
                        case "api_hash": return _apiHash;
                        case "phone_number": return phoneNumber;
                        case "session_pathname": return _sessionPath;
                        default: return null;
                    }
                });
                
                System.Diagnostics.Debug.WriteLine($"✅ WTelegramClient 클라이언트 생성 완료");
                System.Diagnostics.Debug.WriteLine($"📱 전화번호로 로그인 시도: {phoneNumber}");
                System.Diagnostics.Debug.WriteLine($"📂 세션 경로: {_sessionPath}");
                
                // 실제 텔레그램 서버에 연결하고 인증 코드 전송
                var result = await _client.Login(phoneNumber);
                System.Diagnostics.Debug.WriteLine($"📋 로그인 결과: {result ?? "null"}");
            
                if (result == "verification_code")
                {
                    System.Diagnostics.Debug.WriteLine($"✅ 인증 코드가 전송됨!");
                    return true;
                }
                else if (result == "password")
                {
                    System.Diagnostics.Debug.WriteLine($"🔐 2단계 인증이 필요함");
                    return true;
                }
                else if (result == null)
                {
                    System.Diagnostics.Debug.WriteLine($"✅ 로그인 성공");
                    // 세션 파일은 MainAppWindow에서 직접 읽음 (Client Dispose 후)
                    return true;
                }
                else
                {
                    System.Diagnostics.Debug.WriteLine($"❓ 예상치 못한 결과: {result}");
                    return false;
                }
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"❌ SendCodeAsync 오류: {ex.GetType().Name}: {ex.Message}");
                System.Diagnostics.Debug.WriteLine($"❌ 스택 트레이스: {ex.StackTrace}");
                if (ex.InnerException != null)
                {
                    System.Diagnostics.Debug.WriteLine($"❌ 내부 오류: {ex.InnerException.Message}");
                }
                return false;
            }
        }
        
        // 세션 데이터 저장 메서드
        private async Task SaveSessionData(string sessionPath)
        {
            try
            {
                if (!File.Exists(sessionPath))
                {
                    System.Diagnostics.Debug.WriteLine($"⚠️ 세션 파일이 존재하지 않음: {sessionPath}");
                    return;
                }

                // WTelegramClient가 파일을 강하게 잠그고 있으므로
                // 임시 복사본을 만들어서 읽기
                string tempCopyPath = Path.Combine(Path.GetTempPath(), $"temp_session_copy_{Guid.NewGuid()}.dat");
                
                System.Diagnostics.Debug.WriteLine($"📋 원본 세션 파일: {sessionPath}");
                System.Diagnostics.Debug.WriteLine($"📋 임시 복사 경로: {tempCopyPath}");
                
                // 파일 복사 시도 (최대 10번)
                int maxRetries = 10;
                int retryDelayMs = 500;
                bool copySuccess = false;
                
                for (int i = 0; i < maxRetries; i++)
                {
                    try
                    {
                        System.Diagnostics.Debug.WriteLine($"🔄 세션 파일 복사 시도 {i + 1}/{maxRetries}...");
                        
                        // File.Copy는 읽기 전용 접근이므로 더 잘 작동할 수 있음
                        File.Copy(sessionPath, tempCopyPath, overwrite: true);
                        copySuccess = true;
                        System.Diagnostics.Debug.WriteLine($"✅ 세션 파일 복사 성공!");
                        break;
                    }
                    catch (IOException) when (i < maxRetries - 1)
                    {
                        System.Diagnostics.Debug.WriteLine($"⏳ 파일 복사 실패. {retryDelayMs}ms 후 재시도...");
                        await Task.Delay(retryDelayMs);
                    }
                }
                
                if (!copySuccess)
                {
                    System.Diagnostics.Debug.WriteLine($"❌ 세션 파일 복사 실패: 최대 재시도 횟수 초과");
                    return;
                }
                
                // 복사본 읽기
                try
                {
                    byte[] sessionBytes = await File.ReadAllBytesAsync(tempCopyPath);
                    _sessionData = Convert.ToBase64String(sessionBytes);
                    System.Diagnostics.Debug.WriteLine($"✅ 세션 데이터 저장 완료! ({sessionBytes.Length} bytes)");
                    System.Diagnostics.Debug.WriteLine($"📝 세션 데이터 미리보기: {_sessionData.Substring(0, Math.Min(100, _sessionData.Length))}...");
                }
                finally
                {
                    // 임시 파일 삭제
                    try
                    {
                        if (File.Exists(tempCopyPath))
                        {
                            File.Delete(tempCopyPath);
                            System.Diagnostics.Debug.WriteLine($"🗑️ 임시 복사본 삭제 완료");
                        }
                    }
                    catch (Exception deleteEx)
                    {
                        System.Diagnostics.Debug.WriteLine($"⚠️ 임시 파일 삭제 실패: {deleteEx.Message}");
                    }
                }
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"❌ 세션 데이터 저장 오류: {ex.Message}");
                System.Diagnostics.Debug.WriteLine($"❌ 스택 트레이스: {ex.StackTrace}");
            }
        }

        public async Task<bool> VerifyCodeAsync(string phoneNumber, string code)
        {
            try
            {
                System.Diagnostics.Debug.WriteLine($"🔍 VerifyCodeAsync 시작: {phoneNumber}, 코드: {code}");
                System.Diagnostics.Debug.WriteLine($"🔍 _client 상태: {(_client != null ? "초기화됨" : "null")}");
                System.Diagnostics.Debug.WriteLine($"🔍 _sessionPath: {_sessionPath}");
                
                if (_client == null)
                {
                    System.Diagnostics.Debug.WriteLine($"❌ 클라이언트가 초기화되지 않았습니다!");
                    return false;
                }

                System.Diagnostics.Debug.WriteLine($"✅ 코드 제출 시작: {code}");
                var result = await _client.Login(code);
                System.Diagnostics.Debug.WriteLine($"📋 코드 제출 완료! 결과: '{result ?? "null"}'");
                
                if (result == "password")
                {
                    System.Diagnostics.Debug.WriteLine($"🔐 2단계 인증이 필요함 - password 요청됨");
                    _needs2FA = true;
                    _isFullyAuthenticated = false;
                    
                    // 세션 파일 확인 (2FA 전에도 부분적으로 저장될 수 있음)
                    System.Diagnostics.Debug.WriteLine($"📂 세션 파일 확인: {File.Exists(_sessionPath)}");
                    if (File.Exists(_sessionPath))
                    {
                        var fileInfo = new FileInfo(_sessionPath);
                        System.Diagnostics.Debug.WriteLine($"📂 세션 파일 크기: {fileInfo.Length} bytes");
                    }
                    
                    return false; // 2단계 인증이 필요하므로 false 반환
                }
                else if (result == null)
                {
                    System.Diagnostics.Debug.WriteLine($"✅ 로그인 완전 성공! (2FA 없음)");
                    _needs2FA = false;
                    _isFullyAuthenticated = true;
                    // 세션 파일을 Base64로 인코딩
                    await SaveSessionData(_sessionPath);
                    return true;
                }
                
                System.Diagnostics.Debug.WriteLine($"❌ 예상치 못한 결과: '{result}'");
                return false;
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"❌❌❌ VerifyCodeAsync 예외 발생! ❌❌❌");
                System.Diagnostics.Debug.WriteLine($"❌ 예외 타입: {ex.GetType().FullName}");
                System.Diagnostics.Debug.WriteLine($"❌ 예외 메시지: {ex.Message}");
                System.Diagnostics.Debug.WriteLine($"❌ 스택 트레이스:\n{ex.StackTrace}");
                if (ex.InnerException != null)
                {
                    System.Diagnostics.Debug.WriteLine($"❌ 내부 예외: {ex.InnerException.GetType().FullName}");
                    System.Diagnostics.Debug.WriteLine($"❌ 내부 예외 메시지: {ex.InnerException.Message}");
                }
                
                // 예외 메시지를 사용자에게 표시
                throw new Exception($"인증 코드 확인 중 오류: {ex.Message}", ex);
            }
        }

        public async Task<bool> VerifyPasswordAsync(string password)
        {
            try
            {
                System.Diagnostics.Debug.WriteLine($"🔍 VerifyPasswordAsync 시작");
                System.Diagnostics.Debug.WriteLine($"📂 세션 경로: {_sessionPath}");
                
                if (_client == null)
                {
                    System.Diagnostics.Debug.WriteLine($"❌ 클라이언트가 초기화되지 않았습니다!");
                    return false;
                }

                System.Diagnostics.Debug.WriteLine($"✅ 2단계 인증 비밀번호 제출 중");
                var result = await _client.Login(password);
                System.Diagnostics.Debug.WriteLine($"📋 비밀번호 제출 결과: {result ?? "null"}");
                
                if (result == null)
                {
                    System.Diagnostics.Debug.WriteLine($"✅ 로그인 성공!");
                    _isFullyAuthenticated = true;
                    _needs2FA = false;
                    
                    // 세션 파일 확인
                    System.Diagnostics.Debug.WriteLine($"📂 세션 파일 존재 여부: {File.Exists(_sessionPath)}");
                    // 세션 파일은 MainAppWindow에서 직접 읽음 (Client Dispose 후)
                    
                    return true;
                }
                
                System.Diagnostics.Debug.WriteLine($"❌ 비밀번호 인증 실패");
                _needs2FA = true;
                return false;
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"❌ VerifyPasswordAsync 오류: {ex.GetType().Name}: {ex.Message}");
                System.Diagnostics.Debug.WriteLine($"❌ 스택 트레이스: {ex.StackTrace}");
                if (ex.InnerException != null)
                {
                    System.Diagnostics.Debug.WriteLine($"❌ 내부 오류: {ex.InnerException.Message}");
                }
                return false;
            }
        }

        public async Task<List<string>> GetGroupListAsync()
        {
            try
            {
                System.Diagnostics.Debug.WriteLine($"🔍 GetGroupListAsync 시작");
                
                if (_client == null)
                {
                    System.Diagnostics.Debug.WriteLine($"❌ 클라이언트가 초기화되지 않았습니다!");
                    return new List<string>();
                }

                System.Diagnostics.Debug.WriteLine($"✅ 그룹 목록 가져오는 중...");
                var dialogs = await _client.Messages_GetAllDialogs();
                
                var groupList = new List<string>();
                foreach (var dialog in dialogs.dialogs)
                {
                    if (dialogs.UserOrChat(dialog) is TL.Chat chat)
                    {
                        groupList.Add(chat.title);
                        System.Diagnostics.Debug.WriteLine($"  - 그룹: {chat.title}");
                    }
                    else if (dialogs.UserOrChat(dialog) is TL.Channel channel)
                    {
                        groupList.Add(channel.title);
                        System.Diagnostics.Debug.WriteLine($"  - 채널: {channel.title}");
                    }
                }
                
                System.Diagnostics.Debug.WriteLine($"✅ 총 {groupList.Count}개의 그룹/채널 발견");
                return groupList;
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"❌ GetGroupListAsync 오류: {ex.GetType().Name}: {ex.Message}");
                System.Diagnostics.Debug.WriteLine($"❌ 스택 트레이스: {ex.StackTrace}");
                
                // 오류 발생 시 샘플 데이터 반환
                return new List<string>
                {
                    "샘플 그룹 1",
                    "샘플 그룹 2",
                    "샘플 그룹 3"
                };
            }
        }

        // 현재 로그인된 계정의 이름 가져오기
        public async Task<string> GetCurrentAccountName()
        {
            try
            {
                System.Diagnostics.Debug.WriteLine($"🔍 GetCurrentAccountName 시작");
                System.Diagnostics.Debug.WriteLine($"   - _client: {(_client != null ? "있음" : "없음")}");
                System.Diagnostics.Debug.WriteLine($"   - _isFullyAuthenticated: {_isFullyAuthenticated}");
                
                if (_client == null)
                {
                    System.Diagnostics.Debug.WriteLine($"❌ 클라이언트가 없습니다!");
                    return "Unknown User";
                }
                
                if (!_isFullyAuthenticated)
                {
                    System.Diagnostics.Debug.WriteLine($"❌ 아직 완전히 인증되지 않았습니다!");
                    return "Unknown User";
                }

                System.Diagnostics.Debug.WriteLine($"✅ LoginUserIfNeeded 호출 중...");
                var user = await _client.LoginUserIfNeeded();
                System.Diagnostics.Debug.WriteLine($"📋 User 정보: {(user != null ? "있음" : "없음")}");
                
                if (user != null)
                {
                    string firstName = user.first_name ?? "";
                    string lastName = user.last_name ?? "";
                    string fullName = $"{firstName} {lastName}".Trim();
                    
                    System.Diagnostics.Debug.WriteLine($"   - First Name: {firstName}");
                    System.Diagnostics.Debug.WriteLine($"   - Last Name: {lastName}");
                    System.Diagnostics.Debug.WriteLine($"   - Full Name: {fullName}");
                    
                    string result = string.IsNullOrEmpty(fullName) ? "Unknown User" : fullName;
                    System.Diagnostics.Debug.WriteLine($"✅ 최종 계정 이름: {result}");
                    return result;
                }

                System.Diagnostics.Debug.WriteLine($"❌ User 정보를 가져올 수 없습니다");
                return "Unknown User";
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"❌ GetCurrentAccountName 오류: {ex.Message}");
                System.Diagnostics.Debug.WriteLine($"❌ 스택 트레이스: {ex.StackTrace}");
                return "Unknown User";
            }
        }

        // 세션 데이터로 로그인하여 계정 정보 가져오기
        public static async Task<string> GetAccountNameFromSession(string apiId, string apiHash, string sessionData)
        {
            Client tempClient = null;
            try
            {
                // Base64 세션 데이터를 파일로 저장
                byte[] sessionBytes = Convert.FromBase64String(sessionData);
                string tempSessionPath = Path.Combine(Path.GetTempPath(), $"temp_session_{Guid.NewGuid()}.dat");
                await File.WriteAllBytesAsync(tempSessionPath, sessionBytes);
                
                // WTelegramClient로 로그인
                tempClient = new Client(what =>
                {
                    switch (what)
                    {
                        case "api_id": return apiId;
                        case "api_hash": return apiHash;
                        case "session_pathname": return tempSessionPath;
                        default: return null;
                    }
                });
                
                // 로그인 시도
                var loginResult = await tempClient.LoginUserIfNeeded();
                
                if (loginResult != null)
                {
                    // 사용자 정보 가져오기
                    string firstName = loginResult.first_name ?? "";
                    string lastName = loginResult.last_name ?? "";
                    string fullName = $"{firstName} {lastName}".Trim();
                    
                    // 임시 세션 파일 삭제
                    try
                    {
                        if (File.Exists(tempSessionPath))
                            File.Delete(tempSessionPath);
                    }
                    catch { }
                    
                    return string.IsNullOrEmpty(fullName) ? "Unknown User" : fullName;
                }
                
                return "Unknown User";
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"❌ GetAccountNameFromSession 오류: {ex.Message}");
                return "Unknown User";
            }
            finally
            {
                tempClient?.Dispose();
            }
        }

        public void Dispose()
        {
            try
            {
                System.Diagnostics.Debug.WriteLine($"🔍 Dispose 시작");
                
                if (_client != null)
                {
                    _client.Dispose();
                    System.Diagnostics.Debug.WriteLine($"✅ WTelegramClient 정리 완료");
                }
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"❌ Dispose 오류: {ex.Message}");
            }
        }
    }
}
