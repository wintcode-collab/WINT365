using System;
using System.Threading.Tasks;
using System.Linq;

namespace GridstudioLoginApp
{
    public class ConsoleTest
    {
        public static async Task Main(string[] args)
        {
            Console.WriteLine("🔍 WTelegramClient 콘솔 테스트 시작...");
            
            try
            {
                // WTelegramClient 타입 찾기
                Console.WriteLine("🔍 WTelegramClient 타입 검색 중...");
                
                // WTelegramClient 어셈블리에서 모든 타입 찾기
                var wtelegramAssembly = AppDomain.CurrentDomain.GetAssemblies()
                    .FirstOrDefault(a => a.GetName().Name == "WTelegramClient");
                
                if (wtelegramAssembly != null)
                {
                    Console.WriteLine($"✅ WTelegramClient 어셈블리 발견: {wtelegramAssembly.FullName}");
                    Console.WriteLine("🔍 WTelegramClient 어셈블리의 모든 타입:");
                    foreach (var type in wtelegramAssembly.GetTypes())
                    {
                        Console.WriteLine($"  - {type.FullName}");
                    }
                }
                
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
                Console.WriteLine("🔧 클라이언트 인스턴스 생성 테스트...");
                var client = Activator.CreateInstance(clientType, 12345, "test_hash_12345678901234567890");
                Console.WriteLine("✅ 클라이언트 인스턴스 생성 성공");
                
                // Login 메서드 확인
                Console.WriteLine("🔍 Login 메서드 검색 중...");
                var loginMethod = clientType.GetMethod("Login", new[] { typeof(string) });
                if (loginMethod == null)
                {
                    Console.WriteLine("❌ Login 메서드를 찾을 수 없습니다!");
                    return;
                }
                
                Console.WriteLine("✅ Login 메서드 발견");
                Console.WriteLine("✅ WTelegramClient 모든 구성 요소가 정상적으로 로드됨");
                
                // 실제 API 호출 테스트 (더미 데이터로)
                Console.WriteLine("🔧 실제 API 호출 테스트...");
                try
                {
                    var result = await (Task<string>)loginMethod.Invoke(client, new object[] { "+821012345678" });
                    Console.WriteLine($"📋 API 호출 결과: {result ?? "null"}");
                }
                catch (Exception apiEx)
                {
                    Console.WriteLine($"⚠️ API 호출 테스트 실패 (예상됨): {apiEx.GetType().Name}: {apiEx.Message}");
                    Console.WriteLine("✅ 하지만 WTelegramClient는 정상적으로 로드됨");
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"❌ WTelegramClient 테스트 실패: {ex.GetType().Name}: {ex.Message}");
                Console.WriteLine($"❌ 스택 트레이스: {ex.StackTrace}");
            }
            
            Console.WriteLine("🔍 테스트 완료. 아무 키나 누르세요...");
            Console.ReadKey();
        }
    }
}
