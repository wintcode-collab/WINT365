using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.Json;

namespace GridstudioLoginApp
{
    public class InviteCodeGenerator
    {
        private static string CodesFilePath = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), "WINT365Login", "invite_codes.json");
        private static List<InviteCode> _codes = new List<InviteCode>();

        static InviteCodeGenerator()
        {
            LoadCodes();
        }

        public class InviteCode
        {
            public string Code { get; set; }
            public DateTime CreatedAt { get; set; }
            public DateTime ExpiryDate { get; set; }  // 만료일
            public int ExpiryDays { get; set; } = 30;  // 만료 기간 (일)
            public bool IsUsed { get; set; }
            public DateTime? UsedAt { get; set; }
            public string UsedBy { get; set; } = "";
        }

        // 새 초대 코드 생성 (기본 30일 만료)
        public static string GenerateCode()
        {
            return GenerateCode(30); // 기본 30일
        }

        // 새 초대 코드 생성 (사용자 지정 만료일)
        public static string GenerateCode(int expiryDays)
        {
            string code = GenerateRandomCode();
            var inviteCode = new InviteCode
            {
                Code = code,
                CreatedAt = DateTime.Now,
                ExpiryDate = DateTime.MinValue, // 등록되기 전까지는 시간 정지 (MinValue로 설정)
                ExpiryDays = expiryDays, // 만료 기간 저장
                IsUsed = false
            };

            _codes.Add(inviteCode);
            SaveCodes();
            return code;
        }

        // 코드 검증 (만료일 확인 포함)
        public static bool ValidateCode(string inputCode)
        {
            var code = _codes.Find(c => c.Code == inputCode && !c.IsUsed);
            if (code == null) return false;
            
            // 등록되지 않은 코드는 만료일 확인 건너뛰기
            if (code.ExpiryDate == DateTime.MinValue) return true;
            
            // 만료일 확인
            return DateTime.Now <= code.ExpiryDate;
        }

        // 코드 검증 (상세 정보 반환)
        public static (bool IsValid, string Message) ValidateCodeWithDetails(string inputCode)
        {
            var code = _codes.Find(c => c.Code == inputCode);
            if (code == null)
            {
                return (false, "Invalid access code.");
            }
            
            if (code.IsUsed)
            {
                return (false, "This access code has already been used.");
            }
            
            // 등록되지 않은 코드는 만료일 확인 건너뛰기
            if (code.ExpiryDate != DateTime.MinValue && DateTime.Now > code.ExpiryDate)
            {
                return (false, $"This access code expired on {code.ExpiryDate:yyyy-MM-dd HH:mm}.");
            }
            
            return (true, "Valid access code.");
        }

        // 코드 사용 처리
        public static bool UseCode(string inputCode, string usedBy)
        {
            var code = _codes.Find(c => c.Code == inputCode && !c.IsUsed);
            if (code != null)
            {
                code.IsUsed = true;
                code.UsedAt = DateTime.Now;
                code.UsedBy = usedBy;
                // 등록 시점부터 만료 기간 시작
                code.ExpiryDate = DateTime.Now.AddDays(code.ExpiryDays);
                SaveCodes();
                return true;
            }
            return false;
        }

        // 모든 코드 목록 (관리자용)
        public static List<InviteCode> GetAllCodes()
        {
            return _codes;
        }

        // 코드 삭제
        public static bool DeleteCode(string codeToDelete)
        {
            try
            {
                var code = _codes.Find(c => c.Code == codeToDelete);
                if (code != null)
                {
                    _codes.Remove(code);
                    SaveCodes();
                    return true;
                }
                return false;
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"코드 삭제 실패: {ex.Message}");
                return false;
            }
        }

        // 코드 사용 상태 토글 (사용 불가/사용 가능)
        public static bool ToggleCodeUsage(string codeToToggle)
        {
            try
            {
                var code = _codes.Find(c => c.Code == codeToToggle);
                if (code != null)
                {
                    code.IsUsed = !code.IsUsed;
                    if (code.IsUsed)
                    {
                        code.UsedAt = DateTime.Now;
                        code.UsedBy = "관리자";
                    }
                    else
                    {
                        code.UsedAt = null;
                        code.UsedBy = "";
                    }
                    SaveCodes();
                    return true;
                }
                return false;
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"코드 상태 토글 실패: {ex.Message}");
                return false;
            }
        }

        private static string GenerateRandomCode()
        {
            const string chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
            var random = new Random();
            string randomPart = new string(Enumerable.Repeat(chars, 30)
                .Select(s => s[random.Next(s.Length)]).ToArray());
            return $"WINT365_{randomPart}";
        }

        private static void LoadCodes()
        {
            try
            {
                if (File.Exists(CodesFilePath))
                {
                    string jsonString = File.ReadAllText(CodesFilePath);
                    _codes = JsonSerializer.Deserialize<List<InviteCode>>(jsonString) ?? new List<InviteCode>();
                }
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"코드 로드 실패: {ex.Message}");
                _codes = new List<InviteCode>();
            }
        }

        private static void SaveCodes()
        {
            try
            {
                string directory = Path.GetDirectoryName(CodesFilePath);
                if (!Directory.Exists(directory))
                {
                    Directory.CreateDirectory(directory);
                }

                var options = new JsonSerializerOptions { WriteIndented = true };
                string jsonString = JsonSerializer.Serialize(_codes, options);
                File.WriteAllText(CodesFilePath, jsonString);
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"코드 저장 실패: {ex.Message}");
            }
        }
    }
}
