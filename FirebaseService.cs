using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Firebase.Database;
using Firebase.Database.Query;

namespace GridstudioLoginApp
{
    public class FirebaseService
    {
        private FirebaseClient firebase;
        private FirebaseAuthService authService;

        public FirebaseService()
        {
            try
            {
                System.Diagnostics.Debug.WriteLine("FirebaseService 초기화 시작...");
                System.Diagnostics.Debug.WriteLine($"Firebase URL: {FirebaseConfig.FirebaseUrl}");
                
                // Firebase 클라이언트 초기화
                firebase = new FirebaseClient(FirebaseConfig.FirebaseUrl);
                authService = new FirebaseAuthService();
                
                System.Diagnostics.Debug.WriteLine("FirebaseService 초기화 완료");
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"FirebaseService 초기화 실패: {ex.Message}");
                System.Diagnostics.Debug.WriteLine($"스택 트레이스: {ex.StackTrace}");
                throw; // 초기화 실패 시 예외를 다시 던짐
            }
        }

        public async Task<bool> SaveSignUpAsync(string email, string password)
        {
            try
            {
                // 회원가입 정보를 Firebase에 저장
                var signUpData = new
                {
                    email = email,
                    password = password,
                    timestamp = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss"),
                    ip = GetLocalIPAddress()
                };

                // "signups" 노드에 데이터 추가
                await firebase.Child("signups").PostAsync(signUpData);
                
                return true;
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"Firebase 저장 실패: {ex.Message}");
                return false;
            }
        }

        public async Task<bool> IsUserRegistered(string email)
        {
            try
            {
                System.Diagnostics.Debug.WriteLine($"Firebase: Checking if user is registered: {email}");
                
                // Firebase에서 회원가입된 사용자인지 확인
                var signUps = await firebase.Child("signups").OnceAsync<dynamic>();
                System.Diagnostics.Debug.WriteLine($"Firebase: Retrieved {signUps.Count()} signup records");
                
                foreach (var signUp in signUps)
                {
                    System.Diagnostics.Debug.WriteLine($"Firebase: Checking signup email: {signUp.Object.email}");
                    if (signUp.Object.email == email)
                    {
                        System.Diagnostics.Debug.WriteLine($"Firebase: User {email} found in signups!");
                        return true;
                    }
                }
                
                System.Diagnostics.Debug.WriteLine($"Firebase: User {email} not found in signups");
                return false;
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"Firebase 사용자 확인 실패: {ex.Message}");
                System.Diagnostics.Debug.WriteLine($"Stack trace: {ex.StackTrace}");
                return false;
            }
        }

        // 코드 관리 기능 추가
        public async Task<string> GenerateCodeAsync(int expiryDays = 30)
        {
            try
            {
                string code = GenerateRandomCode();
                var codeData = new
                {
                    code = code,
                    createdAt = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss"),
                    expiryDate = (string)null, // 등록 시점에 설정될 예정
                    assignedAt = (string)null, // 등록 시점에 설정될 예정
                    isUsed = false,
                    usedAt = (string)null,
                    usedBy = (string)null,
                    assignedTo = "", // 빈 문자열로 초기화
                    ip = GetLocalIPAddress()
                };

                // "invite_codes" 노드에 코드 추가
                await firebase.Child("invite_codes").PostAsync(codeData);
                return code;
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"Firebase 코드 생성 실패: {ex.Message}");
                return null;
            }
        }

        public async Task<(bool IsValid, string Message)> ValidateCodeAsync(string inputCode, string userEmail = "")
        {
            try
            {
                System.Diagnostics.Debug.WriteLine($"ValidateCodeAsync: Validating code {inputCode} for user {userEmail}");
                
                var codes = await firebase.Child("invite_codes").OnceAsync<dynamic>();
                System.Diagnostics.Debug.WriteLine($"ValidateCodeAsync: Retrieved {codes.Count()} codes from Firebase");
                
                foreach (var codeSnapshot in codes)
                {
                    var codeData = codeSnapshot.Object;
                    System.Diagnostics.Debug.WriteLine($"ValidateCodeAsync: Checking code {codeData.code} (isUsed: {codeData.isUsed}, assignedTo: {codeData.assignedTo})");
                    
                    if (codeData.code == inputCode)
                    {
                        if (codeData.isUsed == true)
                        {
                            System.Diagnostics.Debug.WriteLine($"ValidateCodeAsync: Code {inputCode} is already used");
                            return (false, "This access code has already been used.");
                        }
                        
                        // expiryDate가 null인 경우 (아직 등록되지 않은 코드)는 유효한 것으로 처리
                        string expiryDateString = codeData.expiryDate?.ToString() ?? "";
                        
                        if (string.IsNullOrEmpty(expiryDateString))
                        {
                            System.Diagnostics.Debug.WriteLine($"ValidateCodeAsync: Code {inputCode} is not yet registered (expiryDate is null)");
                            // 아직 등록되지 않은 코드는 유효함
                        }
                        else
                        {
                            // 등록된 코드의 경우 만료일 확인
                            DateTime expiryDate = DateTime.Now.AddDays(30); // 기본값 설정
                            
                            // 여러 날짜 형식 시도
                            string[] dateFormats = {
                                "yyyy-MM-dd HH:mm:ss",
                                "yyyy-MM-ddTHH:mm:ss",
                                "yyyy-MM-ddTHH:mm:ss.fffZ",
                                "yyyy-MM-ddTHH:mm:ssZ",
                                "yyyy-MM-dd",
                                "MM/dd/yyyy HH:mm:ss",
                                "dd/MM/yyyy HH:mm:ss"
                            };
                            
                            bool dateParsed = false;
                            foreach (string format in dateFormats)
                            {
                                if (DateTime.TryParseExact(expiryDateString, format, null, System.Globalization.DateTimeStyles.None, out expiryDate))
                                {
                                    dateParsed = true;
                                    break;
                                }
                            }
                            
                            // TryParse로도 시도
                            if (!dateParsed)
                            {
                                dateParsed = DateTime.TryParse(expiryDateString, out expiryDate);
                            }
                            
                            if (dateParsed && DateTime.Now > expiryDate)
                            {
                                System.Diagnostics.Debug.WriteLine($"ValidateCodeAsync: Code {inputCode} has expired on {expiryDate}");
                                return (false, $"This access code expired on {expiryDate:yyyy-MM-dd HH:mm}.");
                            }
                        }
                        
                        // 코드가 특정 사용자에게 할당되었는지 확인
                        string assignedTo = codeData.assignedTo?.ToString() ?? "";
                        if (!string.IsNullOrEmpty(assignedTo) && !string.IsNullOrEmpty(userEmail))
                        {
                            if (assignedTo != userEmail)
                            {
                                System.Diagnostics.Debug.WriteLine($"ValidateCodeAsync: Code {inputCode} is assigned to {assignedTo}, not {userEmail}");
                                return (false, "This access code is not assigned to your account.");
                            }
                            else
                            {
                                System.Diagnostics.Debug.WriteLine($"ValidateCodeAsync: Code {inputCode} is correctly assigned to {userEmail}");
                            }
                        }
                        else if (string.IsNullOrEmpty(assignedTo))
                        {
                            System.Diagnostics.Debug.WriteLine($"ValidateCodeAsync: Code {inputCode} is not assigned to any user, allowing registration");
                        }
                        
                        System.Diagnostics.Debug.WriteLine($"ValidateCodeAsync: Code {inputCode} is valid");
                        return (true, "Valid access code.");
                    }
                }
                
                System.Diagnostics.Debug.WriteLine($"ValidateCodeAsync: Code {inputCode} not found");
                return (false, "Invalid access code.");
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"ValidateCodeAsync: Firebase 코드 검증 실패: {ex.Message}");
                System.Diagnostics.Debug.WriteLine($"ValidateCodeAsync: Stack trace: {ex.StackTrace}");
                return (false, $"Error validating code: {ex.Message}");
            }
        }

        public async Task<bool> UseCodeAsync(string inputCode, string usedBy)
        {
            try
            {
                var codes = await firebase.Child("invite_codes").OnceAsync<dynamic>();
                
                foreach (var codeSnapshot in codes)
                {
                    var codeData = codeSnapshot.Object;
                    if (codeData.code == inputCode && codeData.isUsed != true)
                    {
                        // 코드 사용 처리
                        await firebase.Child("invite_codes").Child(codeSnapshot.Key).PutAsync(new
                        {
                            code = codeData.code,
                            createdAt = codeData.createdAt,
                            expiryDate = codeData.expiryDate,
                            isUsed = true,
                            usedAt = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss"),
                            usedBy = usedBy,
                            ip = GetLocalIPAddress()
                        });
                        
                        return true;
                    }
                }
                
                return false;
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"Firebase 코드 사용 실패: {ex.Message}");
                return false;
            }
        }

        public async Task<List<dynamic>> GetAllCodesAsync()
        {
            try
            {
                var codes = await firebase.Child("invite_codes").OnceAsync<dynamic>();
                return codes.Select(c => c.Object).ToList();
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"Firebase 코드 목록 조회 실패: {ex.Message}");
                return new List<dynamic>();
            }
        }

        public async Task<List<dynamic>> GetAllSignUpsAsync()
        {
            try
            {
                System.Diagnostics.Debug.WriteLine("Firebase: Getting all signups...");
                var signUps = await firebase.Child("signups").OnceAsync<dynamic>();
                System.Diagnostics.Debug.WriteLine($"Firebase: Retrieved {signUps.Count()} signup records");
                return signUps.Select(s => s.Object).ToList();
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"Firebase 회원가입 목록 조회 실패: {ex.Message}");
                return new List<dynamic>();
            }
        }

        public async Task<bool> RegisterCodeToUserAsync(string code, string userEmail)
        {
            try
            {
                System.Diagnostics.Debug.WriteLine($"RegisterCodeToUserAsync: Starting registration for code {code} and user {userEmail}");
                
                // Firebase 연결 테스트 - invite_codes 노드로 직접 테스트
                System.Diagnostics.Debug.WriteLine("Firebase connection test starting...");
                
                var codes = await firebase.Child("invite_codes").OnceAsync<dynamic>();
                System.Diagnostics.Debug.WriteLine($"RegisterCodeToUserAsync: Retrieved {codes.Count()} codes from Firebase");
                
                foreach (var codeSnapshot in codes)
                {
                    var codeData = codeSnapshot.Object;
                    System.Diagnostics.Debug.WriteLine($"RegisterCodeToUserAsync: Checking code {codeData.code} (isUsed: {codeData.isUsed}, assignedTo: {codeData.assignedTo})");
                    
                    if (codeData.code == code && codeData.isUsed != true)
                    {
                        string assignedTo = codeData.assignedTo?.ToString() ?? "";
                        
                        // 코드가 이미 해당 사용자에게 할당되어 있는지 확인
                        if (assignedTo == userEmail)
                        {
                            System.Diagnostics.Debug.WriteLine($"RegisterCodeToUserAsync: Code {code} is already assigned to user {userEmail}");
                            return true; // 이미 할당되어 있으면 성공으로 처리
                        }
                        
                        // 코드가 다른 사용자에게 할당되어 있는지 확인
                        if (!string.IsNullOrEmpty(assignedTo) && assignedTo != userEmail)
                        {
                            System.Diagnostics.Debug.WriteLine($"RegisterCodeToUserAsync: Code {code} is already assigned to another user: {assignedTo}");
                            return false; // 다른 사용자에게 할당되어 있으면 실패
                        }
                        
                        // assignedTo가 비어있거나 현재 사용자에게 할당된 경우 등록 허용
                        if (string.IsNullOrEmpty(assignedTo) || assignedTo == userEmail)
                        {
                            System.Diagnostics.Debug.WriteLine($"RegisterCodeToUserAsync: Found matching code {code}, updating assignedTo to {userEmail}");
                            
                            // 코드를 해당 사용자에게 등록 (assignedTo 필드 업데이트)
                            // 등록 시점부터 기간을 계산하도록 assignedAt과 새로운 expiryDate 설정
                            DateTime assignedAt = DateTime.Now;
                            
                            // 시간 단위 모드 확인 및 만료일 계산
                            DateTime newExpiryDate;
                            bool isHoursMode = false;
                            double expiryValue = 0;
                            int expiryDays = 30; // 기본값
                            
                            // 시간 단위 모드 확인
                            if (codeData.isHoursMode != null)
                            {
                                bool.TryParse(codeData.isHoursMode.ToString(), out isHoursMode);
                            }
                            
                            if (codeData.expiryValue != null)
                            {
                                double.TryParse(codeData.expiryValue.ToString(), out expiryValue);
                            }
                            
                            if (codeData.expiryDays != null)
                            {
                                int.TryParse(codeData.expiryDays.ToString(), out expiryDays);
                            }
                            
                            if (isHoursMode && expiryValue > 0)
                            {
                                // 시간 단위 모드
                                newExpiryDate = assignedAt.AddHours(expiryValue);
                                System.Diagnostics.Debug.WriteLine($"RegisterCodeToUserAsync: Using hours mode - {expiryValue} hours from now");
                            }
                            else
                            {
                                // 일 단위 모드
                                newExpiryDate = assignedAt.AddDays(expiryDays);
                                System.Diagnostics.Debug.WriteLine($"RegisterCodeToUserAsync: Using days mode - {expiryDays} days from now");
                            }
                            
                            await firebase.Child("invite_codes").Child(codeSnapshot.Key).PutAsync(new
                            {
                                code = codeData.code,
                                createdAt = codeData.createdAt,
                                assignedAt = assignedAt.ToString("yyyy-MM-dd HH:mm:ss"), // 등록 시점 기록
                                expiryDate = newExpiryDate.ToString("yyyy-MM-dd HH:mm:ss"), // 등록 시점부터 계산된 만료일
                                expiryDays = codeData.expiryDays,
                                isHoursMode = codeData.isHoursMode,
                                expiryValue = codeData.expiryValue,
                                isUsed = false,
                                usedAt = (string)null,
                                usedBy = (string)null,
                                assignedTo = userEmail, // 사용자에게 할당
                                ip = GetLocalIPAddress()
                            });
                            
                            System.Diagnostics.Debug.WriteLine($"RegisterCodeToUserAsync: Successfully registered code {code} to user {userEmail}");
                            return true;
                        }
                    }
                }
                
                System.Diagnostics.Debug.WriteLine($"RegisterCodeToUserAsync: Code {code} not found or already used");
                System.Diagnostics.Debug.WriteLine($"RegisterCodeToUserAsync: Available codes in Firebase:");
                foreach (var codeSnapshot in codes)
                {
                    var codeData = codeSnapshot.Object;
                    System.Diagnostics.Debug.WriteLine($"  - Code: {codeData.code}, isUsed: {codeData.isUsed}, assignedTo: '{codeData.assignedTo}'");
                }
                return false;
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"RegisterCodeToUserAsync: Firebase 코드 등록 실패: {ex.Message}");
                System.Diagnostics.Debug.WriteLine($"RegisterCodeToUserAsync: Stack trace: {ex.StackTrace}");
                return false;
            }
        }

        private string GenerateRandomCode()
        {
            const string chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
            var random = new Random();
            string randomPart = new string(Enumerable.Repeat(chars, 30)
                .Select(s => s[random.Next(s.Length)]).ToArray());
            return $"WINT365_{randomPart}";
        }

        private string GetLocalIPAddress()
        {
            try
            {
                var host = System.Net.Dns.GetHostEntry(System.Net.Dns.GetHostName());
                foreach (var ip in host.AddressList)
                {
                    if (ip.AddressFamily == System.Net.Sockets.AddressFamily.InterNetwork)
                    {
                        return ip.ToString();
                    }
                }
                return "Unknown";
            }
            catch
            {
                return "Unknown";
            }
        }

        // 사용자가 코드를 등록했는지 확인
        public async Task<bool> HasUserRegisteredCodeAsync(string userEmail)
        {
            try
            {
                System.Diagnostics.Debug.WriteLine($"HasUserRegisteredCodeAsync: Checking if user {userEmail} has registered a code");
                
                var codes = await firebase.Child("invite_codes").OnceAsync<dynamic>();
                System.Diagnostics.Debug.WriteLine($"HasUserRegisteredCodeAsync: Retrieved {codes.Count()} codes from Firebase");
                
                foreach (var codeSnapshot in codes)
                {
                    var codeData = codeSnapshot.Object;
                    string assignedTo = codeData.assignedTo?.ToString() ?? "";
                    
                    if (assignedTo == userEmail)
                    {
                        System.Diagnostics.Debug.WriteLine($"HasUserRegisteredCodeAsync: User {userEmail} has registered code {codeData.code}");
                        return true;
                    }
                }
                
                System.Diagnostics.Debug.WriteLine($"HasUserRegisteredCodeAsync: User {userEmail} has not registered any code");
                return false;
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"HasUserRegisteredCodeAsync: Error checking user code registration: {ex.Message}");
                return false;
            }
        }

        public async Task<string> GetUserCodeRemainingDaysAsync(string userEmail)
        {
            try
            {
                System.Diagnostics.Debug.WriteLine($"GetUserCodeRemainingDaysAsync: Getting remaining days for user {userEmail}");
                var codes = await firebase.Child("invite_codes").OnceAsync<dynamic>();
                
                foreach (var codeSnapshot in codes)
                {
                    var codeData = codeSnapshot.Object;
                    string assignedTo = codeData.assignedTo?.ToString() ?? "";
                    if (assignedTo == userEmail)
                    {
                        // 등록 시점부터 기간 계산
                        DateTime assignedAt;
                        DateTime expiryDate;
                        
                        // assignedAt이 있으면 등록 시점부터, 없으면 기존 expiryDate 사용 (하위 호환성)
                        string assignedAtString = codeData.assignedAt?.ToString() ?? "";
                        string expiryDateString = codeData.expiryDate?.ToString() ?? "";
                        
                        // 시간 단위 모드 확인 변수들을 메서드 스코프에서 선언
                        bool isHoursMode = false;
                        double expiryValue = 0;
                        int expiryDays = 30; // 기본값
                        
                        // 시간 단위 모드 확인
                        if (codeData.isHoursMode != null)
                        {
                            bool.TryParse(codeData.isHoursMode.ToString(), out isHoursMode);
                        }
                        
                        if (codeData.expiryValue != null)
                        {
                            double.TryParse(codeData.expiryValue.ToString(), out expiryValue);
                        }
                        
                        if (codeData.expiryDays != null)
                        {
                            int.TryParse(codeData.expiryDays.ToString(), out expiryDays);
                        }
                        
                        // 안전한 날짜 파싱 함수
                        bool TryParseDate(string dateString, out DateTime result)
                        {
                            result = DateTime.MinValue;
                            if (string.IsNullOrEmpty(dateString)) return false;
                            
                            string[] dateFormats = {
                                "yyyy-MM-dd HH:mm:ss",
                                "yyyy-MM-ddTHH:mm:ss",
                                "yyyy-MM-ddTHH:mm:ss.fffZ",
                                "yyyy-MM-ddTHH:mm:ssZ",
                                "yyyy-MM-dd",
                                "MM/dd/yyyy HH:mm:ss",
                                "dd/MM/yyyy HH:mm:ss"
                            };
                            
                            foreach (string format in dateFormats)
                            {
                                if (DateTime.TryParseExact(dateString, format, null, System.Globalization.DateTimeStyles.None, out result))
                                {
                                    return true;
                                }
                            }
                            
                            return DateTime.TryParse(dateString, out result);
                        }
                        
                        if (TryParseDate(assignedAtString, out assignedAt))
                        {
                            
                            if (isHoursMode && expiryValue > 0)
                            {
                                // 시간 단위 모드
                                expiryDate = assignedAt.AddHours(expiryValue);
                                System.Diagnostics.Debug.WriteLine($"GetUserCodeRemainingDaysAsync: Using hours mode - {expiryValue} hours from assignedAt {assignedAt} for user {userEmail}");
                            }
                            else
                            {
                                // 일 단위 모드
                                expiryDate = assignedAt.AddDays(expiryDays);
                                System.Diagnostics.Debug.WriteLine($"GetUserCodeRemainingDaysAsync: Using days mode - {expiryDays} days from assignedAt {assignedAt} for user {userEmail}");
                            }
                        }
                        else if (TryParseDate(expiryDateString, out expiryDate))
                        {
                            // 기존 방식 (하위 호환성) - 등록 시점을 모르므로 만료일만 표시
                            System.Diagnostics.Debug.WriteLine($"GetUserCodeRemainingDaysAsync: Using legacy expiryDate {expiryDate} for user {userEmail}");
                            
                            // 기존 코드에 assignedAt 필드 추가 (하위 호환성 개선)
                            DateTime estimatedAssignedAt = expiryDate.AddDays(-30); // 만료일에서 30일 전으로 추정
                            
                            DateTime nowTime = DateTime.Now;
                            TimeSpan remainingTime = expiryDate - nowTime;
                            
                            if (remainingTime.TotalDays > 0)
                            {
                                int days = (int)Math.Ceiling(remainingTime.TotalDays);
                                string legacyAssignedDateStr = estimatedAssignedAt.ToString("yyyy-MM-dd HH:mm:ss");
                                string legacyExpiryDateStr = expiryDate.ToString("yyyy-MM-dd HH:mm:ss");
                                return $"Registered: {legacyAssignedDateStr}\nExpires: {legacyExpiryDateStr}\n\n({days} day{(days == 1 ? "" : "s")} remaining)";
                            }
                            else
                            {
                                string legacyAssignedDateStr = estimatedAssignedAt.ToString("yyyy-MM-dd HH:mm:ss");
                                string legacyExpiryDateStr = expiryDate.ToString("yyyy-MM-dd HH:mm:ss");
                                return $"Registered: {legacyAssignedDateStr}\nExpired: {legacyExpiryDateStr}";
                            }
                        }
                        else
                        {
                            System.Diagnostics.Debug.WriteLine($"GetUserCodeRemainingDaysAsync: Could not parse assignedAt or expiryDate for user {userEmail}");
                            return "Access code expiry date not available";
                        }
                        
                        // 등록 시점과 만료 기간 모두 표시 (YYYY-MM-DD HH:mm:ss 형식)
                        string assignedDateStr = assignedAt.ToString("yyyy-MM-dd HH:mm:ss");
                        string expiryDateStr = expiryDate.ToString("yyyy-MM-dd HH:mm:ss");
                        
                        DateTime now = DateTime.Now;
                        TimeSpan remaining = expiryDate - now;
                        
                        if (remaining.TotalSeconds > 0)
                        {
                            // 시간 단위 모드인지 확인하여 적절한 단위로 표시
                            if (isHoursMode && expiryValue > 0)
                            {
                                // 시간 단위 모드 - 시간과 분으로 표시
                                int totalHours = (int)remaining.TotalHours; // 올림 제거
                                int minutes = remaining.Minutes;
                                
                                if (totalHours >= 24)
                                {
                                    int days = totalHours / 24;
                                    int hours = totalHours % 24;
                                    System.Diagnostics.Debug.WriteLine($"GetUserCodeRemainingDaysAsync: User {userEmail} has {days} days {hours} hours remaining (expires: {expiryDate})");
                                    
                                    if (hours > 0)
                                        return $"Registered: {assignedDateStr}\nExpires: {expiryDateStr}\n\n({days} day{(days == 1 ? "" : "s")} {hours} hour{(hours == 1 ? "" : "s")} remaining)";
                                    else
                                        return $"Registered: {assignedDateStr}\nExpires: {expiryDateStr}\n\n({days} day{(days == 1 ? "" : "s")} remaining)";
                                }
                                else if (totalHours > 0)
                                {
                                    System.Diagnostics.Debug.WriteLine($"GetUserCodeRemainingDaysAsync: User {userEmail} has {totalHours} hours {minutes} minutes remaining (expires: {expiryDate})");
                                    
                                    if (minutes > 0)
                                        return $"Registered: {assignedDateStr}\nExpires: {expiryDateStr}\n\n({totalHours} hour{(totalHours == 1 ? "" : "s")} {minutes} minute{(minutes == 1 ? "" : "s")} remaining)";
                                    else
                                        return $"Registered: {assignedDateStr}\nExpires: {expiryDateStr}\n\n({totalHours} hour{(totalHours == 1 ? "" : "s")} remaining)";
                                }
                                else
                                {
                                    int totalMinutes = (int)Math.Ceiling(remaining.TotalMinutes);
                                    System.Diagnostics.Debug.WriteLine($"GetUserCodeRemainingDaysAsync: User {userEmail} has {totalMinutes} minutes remaining (expires: {expiryDate})");
                                    return $"Registered: {assignedDateStr}\nExpires: {expiryDateStr}\n\n({totalMinutes} minute{(totalMinutes == 1 ? "" : "s")} remaining)";
                                }
                            }
                            else
                            {
                                // 일 단위 모드 - 기존 방식
                                int days = (int)Math.Ceiling(remaining.TotalDays);
                                System.Diagnostics.Debug.WriteLine($"GetUserCodeRemainingDaysAsync: User {userEmail} has {days} days remaining (expires: {expiryDate})");
                                return $"Registered: {assignedDateStr}\nExpires: {expiryDateStr}\n\n({days} day{(days == 1 ? "" : "s")} remaining)";
                            }
                        }
                        else
                        {
                            System.Diagnostics.Debug.WriteLine($"GetUserCodeRemainingDaysAsync: User {userEmail} code has expired (expired: {expiryDate})");
                            return $"Registered: {assignedDateStr}\nExpired: {expiryDateStr}";
                        }
                    }
                }
                
                System.Diagnostics.Debug.WriteLine($"GetUserCodeRemainingDaysAsync: No code found for user {userEmail}");
                return "No access code found";
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"GetUserCodeRemainingDaysAsync: Error getting remaining days: {ex.Message}");
                return "Error retrieving code information";
            }
        }

        // 텔레그램 계정 저장
        public async Task<bool> SaveTelegramAccountAsync(string userEmail, string apiId, string apiHash, string phone, string sessionData = "", string accountName = "")
        {
            try
            {
                System.Diagnostics.Debug.WriteLine($"SaveTelegramAccountAsync: Saving account for {userEmail}");
                
                var accountData = new
                {
                    userEmail = userEmail,
                    apiId = apiId,
                    apiHash = apiHash,
                    phone = phone,
                    sessionData = sessionData,
                    accountName = accountName,
                    createdAt = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss"),
                    ip = GetLocalIPAddress()
                };

                // "telegram_accounts" 노드에 데이터 추가
                await firebase.Child("telegram_accounts").PostAsync(accountData);
                
                System.Diagnostics.Debug.WriteLine($"SaveTelegramAccountAsync: Account saved successfully");
                return true;
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"SaveTelegramAccountAsync: Failed to save account: {ex.Message}");
                return false;
            }
        }

        // 중복 계정 확인
        public async Task<bool> IsPhoneNumberAlreadyRegistered(string userEmail, string phoneNumber)
        {
            try
            {
                var accounts = await firebase.Child("telegram_accounts").OnceAsync<dynamic>();
                
                foreach (var account in accounts)
                {
                    if (account.Object.userEmail == userEmail && account.Object.phone == phoneNumber)
                    {
                        return true; // 이미 등록된 전화번호
                    }
                }
                
                return false; // 등록되지 않은 전화번호
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"IsPhoneNumberAlreadyRegistered: Error checking phone number: {ex.Message}");
                return false;
            }
        }

        // 사용자의 텔레그램 계정 목록 가져오기
        public async Task<List<dynamic>> GetTelegramAccountsAsync(string userEmail)
        {
            try
            {
                System.Diagnostics.Debug.WriteLine($"GetTelegramAccountsAsync: Getting accounts for {userEmail}");
                var accounts = await firebase.Child("telegram_accounts").OnceAsync<dynamic>();
                
                var userAccounts = new List<dynamic>();
                foreach (var account in accounts)
                {
                    if (account.Object.userEmail == userEmail)
                    {
                        userAccounts.Add(new
                        {
                            id = account.Key,
                            apiId = account.Object.apiId,
                            apiHash = account.Object.apiHash,
                            phone = account.Object.phone,
                            sessionData = account.Object.sessionData?.ToString() ?? "",
                            accountName = account.Object.accountName?.ToString() ?? "",
                            createdAt = account.Object.createdAt?.ToString() ?? ""
                        });
                    }
                }
                
                System.Diagnostics.Debug.WriteLine($"GetTelegramAccountsAsync: Found {userAccounts.Count} accounts");
                return userAccounts;
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"GetTelegramAccountsAsync: Error getting accounts: {ex.Message}");
                return new List<dynamic>();
            }
        }
    }
}
