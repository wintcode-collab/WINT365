using System;

namespace GridstudioLoginApp
{
    class InviteCodeTool
    {
        static void Main(string[] args)
        {
            Console.WriteLine("=== WINT365 초대 코드 관리 도구 ===");
            Console.WriteLine();

            while (true)
            {
                Console.WriteLine("1. 새 초대 코드 생성");
                Console.WriteLine("2. 모든 코드 목록 보기");
                Console.WriteLine("3. 종료");
                Console.Write("선택하세요 (1-3): ");

                string choice = Console.ReadLine();

                switch (choice)
                {
                    case "1":
                        GenerateNewCode();
                        break;
                    case "2":
                        ShowAllCodes();
                        break;
                    case "3":
                        Console.WriteLine("프로그램을 종료합니다.");
                        return;
                    default:
                        Console.WriteLine("잘못된 선택입니다.");
                        break;
                }

                Console.WriteLine();
            }
        }

        private static void GenerateNewCode()
        {
            string newCode = InviteCodeGenerator.GenerateCode();
            Console.WriteLine();
            Console.WriteLine("=== 새 초대 코드 생성됨 ===");
            Console.WriteLine($"코드: {newCode}");
            Console.WriteLine($"생성 시간: {DateTime.Now:yyyy-MM-dd HH:mm:ss}");
            Console.WriteLine("===============================");
        }

        private static void ShowAllCodes()
        {
            var codes = InviteCodeGenerator.GetAllCodes();
            Console.WriteLine();
            Console.WriteLine("=== 모든 초대 코드 목록 ===");
            
            if (codes.Count == 0)
            {
                Console.WriteLine("생성된 코드가 없습니다.");
            }
            else
            {
                foreach (var code in codes)
                {
                    string status = code.IsUsed ? $"사용됨 ({code.UsedBy})" : "사용 가능";
                    string createdTime = code.CreatedAt.ToString("yyyy-MM-dd HH:mm:ss");
                    Console.WriteLine($"{code.Code} - {status} (생성: {createdTime})");
                }
            }
            
            Console.WriteLine("=============================");
        }
    }
}
