using System;
using System.Threading.Tasks;

namespace GridstudioLoginApp
{
    public class TestTelegram
    {
        public static async Task TestWTelegramClient()
        {
            try
            {
                Console.WriteLine("🔍 WTelegramClient 테스트 시작...");
                
                // WTelegramClient 타입 찾기
                var clientType = Type.GetType("WTelegramClient.Client, WTelegramClient");
                if (clientType == null)
                {
                    Console.WriteLine("❌ WTelegramClient.Client 타입을 찾을 수 없습니다!");
                    Console.WriteLine("🔧 로드된 어셈블리 목록:");
                    foreach (var assembly in AppDomain.CurrentDomain.GetAssemblies())
                    {
                        Console.WriteLine($"  - {assembly.FullName}");
                    }
                    return;
                }
                
                Console.WriteLine($"✅ WTelegramClient.Client 타입 발견: {clientType.FullName}");
                
                // 클라이언트 인스턴스 생성 테스트
                var client = Activator.CreateInstance(clientType, 12345, "test_hash");
                Console.WriteLine("✅ 클라이언트 인스턴스 생성 성공");
                
                // Login 메서드 확인
                var loginMethod = clientType.GetMethod("Login", new[] { typeof(string) });
                if (loginMethod == null)
                {
                    Console.WriteLine("❌ Login 메서드를 찾을 수 없습니다!");
                    return;
                }
                
                Console.WriteLine("✅ Login 메서드 발견");
                Console.WriteLine("✅ WTelegramClient 테스트 완료 - 모든 구성 요소가 정상적으로 로드됨");
            }
            catch (Exception ex)
            {
                Console.WriteLine($"❌ WTelegramClient 테스트 실패: {ex.GetType().Name}: {ex.Message}");
                Console.WriteLine($"❌ 스택 트레이스: {ex.StackTrace}");
            }
        }
    }
}
