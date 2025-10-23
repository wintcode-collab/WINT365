using System;
using System.Collections.Generic;
using System.Windows;

namespace GridstudioLoginApp
{
    public class InviteCodeManager
    {
        public static void ShowCodeGenerator()
        {
            string newCode = InviteCodeGenerator.GenerateCode();
            MessageBox.Show($"새 초대 코드: {newCode}\n\n이 코드를 회원가입 시 사용하세요.", 
                          "초대 코드 생성", 
                          MessageBoxButton.OK, 
                          MessageBoxImage.Information);
        }

        public static void ShowAllCodes()
        {
            var codes = InviteCodeGenerator.GetAllCodes();
            string codeList = "생성된 초대 코드 목록:\n\n";
            
            foreach (var code in codes)
            {
                string status = code.IsUsed ? $"사용됨 ({code.UsedBy})" : "사용 가능";
                codeList += $"{code.Code} - {status}\n";
            }
            
            MessageBox.Show(codeList, "초대 코드 목록", MessageBoxButton.OK, MessageBoxImage.Information);
        }
    }
}
