using System;
using System.Windows;

namespace GridstudioLoginApp
{
    public partial class App : Application
    {
        protected override void OnStartup(StartupEventArgs e)
        {
            // 전역 예외 처리기 등록
            AppDomain.CurrentDomain.UnhandledException += CurrentDomain_UnhandledException;
            DispatcherUnhandledException += App_DispatcherUnhandledException;
            
            base.OnStartup(e);
        }

        private void CurrentDomain_UnhandledException(object sender, UnhandledExceptionEventArgs e)
        {
            var exception = e.ExceptionObject as Exception;
            System.Diagnostics.Debug.WriteLine($"처리되지 않은 예외: {exception?.Message}");
            System.Diagnostics.Debug.WriteLine($"스택 트레이스: {exception?.StackTrace}");
            
            MessageBox.Show($"처리되지 않은 오류가 발생했습니다:\n{exception?.Message}", 
                "오류", MessageBoxButton.OK, MessageBoxImage.Error);
        }

        private void App_DispatcherUnhandledException(object sender, System.Windows.Threading.DispatcherUnhandledExceptionEventArgs e)
        {
            System.Diagnostics.Debug.WriteLine($"UI 스레드 예외: {e.Exception.Message}");
            System.Diagnostics.Debug.WriteLine($"스택 트레이스: {e.Exception.StackTrace}");
            
            MessageBox.Show($"UI 오류가 발생했습니다:\n{e.Exception.Message}", 
                "UI 오류", MessageBoxButton.OK, MessageBoxImage.Error);
            
            e.Handled = true; // 예외를 처리했음을 표시
        }
    }
}