using System;
using System.Linq;
using System.Windows;
using System.Windows.Input;
using System.Windows.Threading;

namespace GridstudioLoginApp
{
    public partial class SuccessMessageBox : Window
    {
        private DispatcherTimer progressTimer;
        private DispatcherTimer closeTimer;
        private double progressValue = 0;
        private bool isClosing = false;

        public SuccessMessageBox(string message, Window parentWindow = null)
        {
            InitializeComponent();
            MessageTextBlock.Text = message;
            
            // 메시지 길이에 따라 창 크기 조정
            AdjustWindowSize();
            
            // 부모 창이 있으면 그 창 기준으로 중앙에 위치
            if (parentWindow != null)
            {
                this.Left = parentWindow.Left + (parentWindow.Width - this.Width) / 2;
                this.Top = parentWindow.Top + (parentWindow.Height - this.Height) / 2;
            }
            
            // 프로그레스 바 애니메이션 시작
            StartProgressAnimation();
        }

        private void AdjustWindowSize()
        {
            // 텍스트 길이에 따라 창 크기 조정
            int lineCount = MessageTextBlock.Text.Split('\n').Length;
            int maxLineLength = MessageTextBlock.Text.Split('\n').Max(line => line.Length);
            
            // 최소/최대 크기 설정
            double minWidth = 400;
            double maxWidth = 500;
            double minHeight = 180;
            double maxHeight = 280;
            
            // 너비 계산 (문자당 약 8픽셀 + 여백)
            double calculatedWidth = Math.Max(minWidth, Math.Min(maxWidth, maxLineLength * 8 + 100));
            
            // 높이 계산 (줄당 약 22픽셀 + 헤더/프로그레스바) - 더 컴팩트하게
            double calculatedHeight = Math.Max(minHeight, Math.Min(maxHeight, lineCount * 22 + 100));
            
            this.Width = calculatedWidth;
            this.Height = calculatedHeight;
        }

        private void StartProgressAnimation()
        {
            progressTimer = new DispatcherTimer();
            progressTimer.Interval = TimeSpan.FromMilliseconds(30); // 30ms마다 업데이트
            progressTimer.Tick += (s, e) =>
            {
                progressValue += 1; // 3초에 걸쳐 100% 완료 (30ms * 100 = 3000ms = 3초)
                ProgressBar.Value = progressValue;
                
                if (progressValue >= 100)
                {
                    progressTimer.Stop();
                    // 프로그레스 바가 100% 완료되면 창 닫기
                    CloseWindow();
                }
            };
            progressTimer.Start();
        }

        private void Window_KeyDown(object sender, KeyEventArgs e)
        {
            if (e.Key == Key.Enter && !isClosing)
            {
                // 엔터 키를 누르면 즉시 창 닫기
                CloseWindow();
            }
        }

        private void CloseWindow()
        {
            if (isClosing) return; // 이미 닫는 중이면 무시
            
            isClosing = true;
            progressTimer?.Stop();
            this.Close();
        }
    }
}
