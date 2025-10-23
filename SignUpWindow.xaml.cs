using System;
using System.Windows;
using System.Windows.Input;
using System.Windows.Controls;

namespace GridstudioLoginApp
{
    public partial class SignUpWindow : Window
    {
        public SignUpWindow()
        {
            InitializeComponent();
            SetupWindow();
            SetupPlaceholders();
        }

        private void SetupWindow()
        {
            // 창 드래그 설정
            this.MouseDown += (sender, e) =>
            {
                if (e.ChangedButton == MouseButton.Left)
                {
                    this.DragMove();
                }
            };

            // Enter 키로 회원가입
            this.KeyDown += (sender, e) =>
            {
                if (e.Key == Key.Enter)
                {
                    SignUpButton_Click(sender, e);
                }
            };
        }

        private void SetupPlaceholders()
        {
            // 이메일 플레이스홀더
            EmailTextBox.GotFocus += (s, e) => EmailPlaceholder.Visibility = Visibility.Collapsed;
            EmailTextBox.LostFocus += (s, e) => 
            {
                if (string.IsNullOrEmpty(EmailTextBox.Text))
                    EmailPlaceholder.Visibility = Visibility.Visible;
            };
            EmailTextBox.TextChanged += (s, e) => 
            {
                if (!string.IsNullOrEmpty(EmailTextBox.Text))
                    EmailPlaceholder.Visibility = Visibility.Collapsed;
            };

            // 비밀번호 플레이스홀더
            PasswordBox.GotFocus += (s, e) => PasswordPlaceholder.Visibility = Visibility.Collapsed;
            PasswordBox.LostFocus += (s, e) => 
            {
                if (string.IsNullOrEmpty(PasswordBox.Password))
                    PasswordPlaceholder.Visibility = Visibility.Visible;
            };
            PasswordBox.PasswordChanged += (s, e) => 
            {
                if (!string.IsNullOrEmpty(PasswordBox.Password))
                    PasswordPlaceholder.Visibility = Visibility.Collapsed;
            };

            // 비밀번호 확인 플레이스홀더
            ConfirmPasswordBox.GotFocus += (s, e) => ConfirmPasswordPlaceholder.Visibility = Visibility.Collapsed;
            ConfirmPasswordBox.LostFocus += (s, e) => 
            {
                if (string.IsNullOrEmpty(ConfirmPasswordBox.Password))
                    ConfirmPasswordPlaceholder.Visibility = Visibility.Visible;
            };
            ConfirmPasswordBox.PasswordChanged += (s, e) => 
            {
                if (!string.IsNullOrEmpty(ConfirmPasswordBox.Password))
                    ConfirmPasswordPlaceholder.Visibility = Visibility.Collapsed;
            };
        }


        private void SignUpButton_Click(object sender, RoutedEventArgs e)
        {
            string email = EmailTextBox.Text;
            string password = PasswordBox.Password;
            string confirmPassword = ConfirmPasswordBox.Password;

            // 입력 검증
            if (string.IsNullOrEmpty(email) || string.IsNullOrEmpty(password) || string.IsNullOrEmpty(confirmPassword))
            {
                ShowError("Please fill in all fields.");
                return;
            }

            if (password != confirmPassword)
            {
                ShowError("Passwords do not match.");
                return;
            }

            if (password.Length < 6)
            {
                ShowError("Password must be at least 6 characters.");
                return;
            }

            // 성공 애니메이션
            ErrorTextBlock.Visibility = Visibility.Collapsed;
            SignUpButton.Content = "✓ SUCCESS";
            SignUpButton.Background = new System.Windows.Media.SolidColorBrush(
                (System.Windows.Media.Color)System.Windows.Media.ColorConverter.ConvertFromString("#10B981"));

            // 2초 후 창 닫기
            System.Windows.Threading.DispatcherTimer timer = new System.Windows.Threading.DispatcherTimer();
            timer.Interval = TimeSpan.FromSeconds(2);
            timer.Tick += (s, args) =>
            {
                timer.Stop();
                this.Close();
            };
            timer.Start();
        }

        private void BackToLoginButton_Click(object sender, RoutedEventArgs e)
        {
            this.Close();
        }

        private void CloseButton_Click(object sender, RoutedEventArgs e)
        {
            this.Close();
        }

        private void ShowError(string message)
        {
            ErrorTextBlock.Text = message;
            ErrorTextBlock.Visibility = Visibility.Visible;
        }
    }
}
