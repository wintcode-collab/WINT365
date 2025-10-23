using System;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Input;
using System.Windows.Controls;

namespace GridstudioLoginApp
{
    public partial class MainWindow : Window
    {
        private UserSettings userSettings;
        private bool isSignUpMode = false;
        private bool isCodeMode = false;
        private bool isCodeRegistrationMode = false;
        private FirebaseService firebaseService;
        private FirebaseAuthService authService;
        
        // 애니메이션 타이머 관리
        private System.Windows.Threading.DispatcherTimer currentAnimationTimer;
        private System.Windows.Threading.DispatcherTimer currentTypingTimer;
        private System.Windows.Threading.DispatcherTimer currentBlinkingTimer;
        private System.Windows.Threading.DispatcherTimer currentCodeTypingTimer;
        private bool isAnimationRunning = false;
        private bool isCodeAnimationRunning = false;
        private bool isLoginInProgress = false;

        public MainWindow()
        {
            try
            {
                InitializeComponent();
                SetupWindow();
                LoadUserSettings();
                RememberCheckBox.Click += RememberCheckBox_Click;
                
                // CODE INJECTION Panel 초기화
                CodeInjectionPanel.Visibility = Visibility.Collapsed;
                
                StartTypingAnimation();

                // Firebase 서비스 초기화를 지연 로딩으로 변경
                InitializeFirebaseServicesAsync();
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"MainWindow 초기화 오류: {ex.Message}");
                System.Diagnostics.Debug.WriteLine($"스택 트레이스: {ex.StackTrace}");
                
                // 오류 발생 시 기본 메시지 표시
                MessageBox.Show($"애플리케이션 초기화 중 오류가 발생했습니다:\n{ex.Message}", 
                    "초기화 오류", MessageBoxButton.OK, MessageBoxImage.Error);
            }
        }

        private async void InitializeFirebaseServicesAsync()
        {
            try
            {
                System.Diagnostics.Debug.WriteLine("Firebase 서비스 지연 초기화 시작...");
                
                // 백그라운드에서 Firebase 서비스 초기화
                await Task.Run(() =>
                {
                    try
                    {
                        firebaseService = new FirebaseService();
                        authService = new FirebaseAuthService();
                        System.Diagnostics.Debug.WriteLine("Firebase 서비스 지연 초기화 완료");
                    }
                    catch (Exception ex)
                    {
                        System.Diagnostics.Debug.WriteLine($"Firebase 서비스 지연 초기화 실패: {ex.Message}");
                        // Firebase 초기화 실패해도 애플리케이션은 계속 실행
                    }
                });
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"Firebase 서비스 초기화 중 오류: {ex.Message}");
            }
        }

        private void LoadUserSettings()
        {
            userSettings = UserSettings.Load();
            RememberCheckBox.IsChecked = userSettings.RememberMe;
            
            System.Diagnostics.Debug.WriteLine($"설정 로드: RememberMe={userSettings.RememberMe}, Email={userSettings.Email}");
            
            if (userSettings.RememberMe && !string.IsNullOrEmpty(userSettings.Email))
            {
                UsernameTextBox.Text = userSettings.Email;
            }
        }

        private void SaveUserSettings()
        {
            if (userSettings == null)
                userSettings = new UserSettings();

            userSettings.RememberMe = RememberCheckBox.IsChecked ?? false;
            
            if (userSettings.RememberMe)
            {
                userSettings.Email = UsernameTextBox.Text;
                userSettings.Password = ""; // 보안상 비밀번호는 저장하지 않음
            }
            else
            {
                userSettings.Email = "";
                userSettings.Password = "";
            }

            System.Diagnostics.Debug.WriteLine($"설정 저장: RememberMe={userSettings.RememberMe}, Email={userSettings.Email}");
            userSettings.Save();
        }

        private void StartTypingAnimation()
        {
            // 이미 애니메이션이 실행 중이면 중복 실행 방지
            if (isAnimationRunning)
            {
                return;
            }
            
            // 기존 애니메이션 중지
            StopAllAnimations();
            
            isAnimationRunning = true;
            
            // 추가 강제 초기화 - 모든 TextBlock을 명시적으로 리셋
            Char1.Text = ""; Char1.Opacity = 0; Char1.Visibility = Visibility.Hidden;
            Char2.Text = ""; Char2.Opacity = 0; Char2.Visibility = Visibility.Hidden;
            Char3.Text = ""; Char3.Opacity = 0; Char3.Visibility = Visibility.Hidden;
            Char4.Text = ""; Char4.Opacity = 0; Char4.Visibility = Visibility.Hidden;
            Char5.Text = ""; Char5.Opacity = 0; Char5.Visibility = Visibility.Hidden;
            Char6.Text = ""; Char6.Opacity = 0; Char6.Visibility = Visibility.Hidden;
            Char7.Text = ""; Char7.Opacity = 0; Char7.Visibility = Visibility.Hidden;
            Char8.Text = ""; Char8.Opacity = 0; Char8.Visibility = Visibility.Hidden;
            Char9.Text = ""; Char9.Opacity = 0; Char9.Visibility = Visibility.Hidden;
            Char10.Text = ""; Char10.Opacity = 0; Char10.Visibility = Visibility.Hidden;
            Char11.Text = ""; Char11.Opacity = 0; Char11.Visibility = Visibility.Hidden;
            Char12.Text = ""; Char12.Opacity = 0; Char12.Visibility = Visibility.Hidden;
            Char13.Text = ""; Char13.Opacity = 0; Char13.Visibility = Visibility.Hidden;
            Char14.Text = ""; Char14.Opacity = 0; Char14.Visibility = Visibility.Hidden;
            SignChar1.Text = ""; SignChar1.Opacity = 0; SignChar1.Visibility = Visibility.Hidden;
            SignChar2.Text = ""; SignChar2.Opacity = 0; SignChar2.Visibility = Visibility.Hidden;
            SignChar3.Text = ""; SignChar3.Opacity = 0; SignChar3.Visibility = Visibility.Hidden;
            SignChar4.Text = ""; SignChar4.Opacity = 0; SignChar4.Visibility = Visibility.Hidden;
            SignChar5.Text = ""; SignChar5.Opacity = 0; SignChar5.Visibility = Visibility.Hidden;
            SignChar6.Text = ""; SignChar6.Opacity = 0; SignChar6.Visibility = Visibility.Hidden;
            SignChar7.Text = ""; SignChar7.Opacity = 0; SignChar7.Visibility = Visibility.Hidden;
            
            // UI 강제 업데이트
            this.UpdateLayout();
            
            // 잠시 후 다시 보이게 하고 애니메이션 시작
            currentAnimationTimer = new System.Windows.Threading.DispatcherTimer();
            currentAnimationTimer.Interval = TimeSpan.FromMilliseconds(0);
            currentAnimationTimer.Tick += (sender, args) =>
            {
                currentAnimationTimer.Stop();
                currentAnimationTimer = null;
                
                // Char1~Char8만 다시 보이게 하기
                Char1.Visibility = Visibility.Visible;
                Char2.Visibility = Visibility.Visible;
                Char3.Visibility = Visibility.Visible;
                Char4.Visibility = Visibility.Visible;
                Char5.Visibility = Visibility.Visible;
                Char6.Visibility = Visibility.Visible;
                Char7.Visibility = Visibility.Visible;
                Char8.Visibility = Visibility.Visible;
                
                // 애니메이션 시작
                ShowNextCharacter(0);
            };
            currentAnimationTimer.Start();
        }

        private void ShowNextCharacter(int index)
        {
            string[] characters = { "@", "W", "I", "N", "T", "3", "6", "5" };
            TextBlock[] textBlocks = { Char1, Char2, Char3, Char4, Char5, Char6, Char7, Char8 };

            if (index < characters.Length)
            {
                textBlocks[index].Text = characters[index];
                
                // 페이드인 애니메이션
                var fadeInAnimation = new System.Windows.Media.Animation.DoubleAnimation
                {
                    From = 0.0,
                    To = 1.0,
                    Duration = TimeSpan.FromMilliseconds(300)
                };
                
                textBlocks[index].BeginAnimation(UIElement.OpacityProperty, fadeInAnimation);
                
                // 다음 글자를 200ms 후에 표시
                currentTypingTimer = new System.Windows.Threading.DispatcherTimer();
                currentTypingTimer.Interval = TimeSpan.FromMilliseconds(200);
                currentTypingTimer.Tick += (s, e) =>
                {
                    currentTypingTimer.Stop();
                    currentTypingTimer = null;
                    ShowNextCharacter(index + 1);
                };
                currentTypingTimer.Start();
            }
            else
            {
                // 모든 글자가 나타난 후 1초 지연 후 깜빡이는 애니메이션 시작
                var delayTimer = new System.Windows.Threading.DispatcherTimer();
                delayTimer.Interval = TimeSpan.FromMilliseconds(1000); // 1초 지연
                delayTimer.Tick += (s, e) =>
                {
                    delayTimer.Stop();
                    StartBlinkingAnimation();
                };
                delayTimer.Start();
            }
        }

        private void StartBlinkingAnimation()
        {
            // 타이핑 애니메이션 완료, 깜빡임 애니메이션 시작
            isAnimationRunning = false;
            
            TextBlock[] textBlocks = { Char1, Char2, Char3, Char4, Char5, Char6, Char7, Char8 };

            foreach (var textBlock in textBlocks)
            {
                // 부드럽게 시작하는 깜빡이는 애니메이션
                var fadeOutAnimation = new System.Windows.Media.Animation.DoubleAnimation
                {
                    From = 1.0,
                    To = 0.85,
                    Duration = TimeSpan.FromMilliseconds(2000),
                    EasingFunction = new System.Windows.Media.Animation.SineEase()
                };

                var fadeInAnimation = new System.Windows.Media.Animation.DoubleAnimation
                {
                    From = 0.85,
                    To = 1.0,
                    Duration = TimeSpan.FromMilliseconds(2000),
                    EasingFunction = new System.Windows.Media.Animation.SineEase()
                };

                // 스토리보드로 부드러운 반복 애니메이션 생성
                var storyboard = new System.Windows.Media.Animation.Storyboard();
                storyboard.Children.Add(fadeOutAnimation);
                storyboard.Children.Add(fadeInAnimation);
                
                // 애니메이션 순서 설정
                System.Windows.Media.Animation.Storyboard.SetTarget(fadeOutAnimation, textBlock);
                System.Windows.Media.Animation.Storyboard.SetTargetProperty(fadeOutAnimation, new System.Windows.PropertyPath(UIElement.OpacityProperty));
                
                System.Windows.Media.Animation.Storyboard.SetTarget(fadeInAnimation, textBlock);
                System.Windows.Media.Animation.Storyboard.SetTargetProperty(fadeInAnimation, new System.Windows.PropertyPath(UIElement.OpacityProperty));
                
                // 타이밍 설정
                fadeInAnimation.BeginTime = TimeSpan.FromMilliseconds(2000);
                
                // 무한 반복
                storyboard.RepeatBehavior = System.Windows.Media.Animation.RepeatBehavior.Forever;
                storyboard.Begin();
            }
        }

        private void StartSignUpTypingAnimation()
        {
            // 기존 애니메이션 중지
            StopAllAnimations();
            
            isAnimationRunning = true;
            
            // 추가 강제 초기화 - 모든 TextBlock을 명시적으로 리셋
            Char1.Text = ""; Char1.Opacity = 0; Char1.Visibility = Visibility.Hidden;
            Char2.Text = ""; Char2.Opacity = 0; Char2.Visibility = Visibility.Hidden;
            Char3.Text = ""; Char3.Opacity = 0; Char3.Visibility = Visibility.Hidden;
            Char4.Text = ""; Char4.Opacity = 0; Char4.Visibility = Visibility.Hidden;
            Char5.Text = ""; Char5.Opacity = 0; Char5.Visibility = Visibility.Hidden;
            Char6.Text = ""; Char6.Opacity = 0; Char6.Visibility = Visibility.Hidden;
            Char7.Text = ""; Char7.Opacity = 0; Char7.Visibility = Visibility.Hidden;
            Char8.Text = ""; Char8.Opacity = 0; Char8.Visibility = Visibility.Hidden;
            Char9.Text = ""; Char9.Opacity = 0; Char9.Visibility = Visibility.Hidden;
            Char10.Text = ""; Char10.Opacity = 0; Char10.Visibility = Visibility.Hidden;
            Char11.Text = ""; Char11.Opacity = 0; Char11.Visibility = Visibility.Hidden;
            Char12.Text = ""; Char12.Opacity = 0; Char12.Visibility = Visibility.Hidden;
            Char13.Text = ""; Char13.Opacity = 0; Char13.Visibility = Visibility.Hidden;
            Char14.Text = ""; Char14.Opacity = 0; Char14.Visibility = Visibility.Hidden;
            SignChar1.Text = ""; SignChar1.Opacity = 0; SignChar1.Visibility = Visibility.Hidden;
            SignChar2.Text = ""; SignChar2.Opacity = 0; SignChar2.Visibility = Visibility.Hidden;
            SignChar3.Text = ""; SignChar3.Opacity = 0; SignChar3.Visibility = Visibility.Hidden;
            SignChar4.Text = ""; SignChar4.Opacity = 0; SignChar4.Visibility = Visibility.Hidden;
            SignChar5.Text = ""; SignChar5.Opacity = 0; SignChar5.Visibility = Visibility.Hidden;
            SignChar6.Text = ""; SignChar6.Opacity = 0; SignChar6.Visibility = Visibility.Hidden;
            SignChar7.Text = ""; SignChar7.Opacity = 0; SignChar7.Visibility = Visibility.Hidden;
            
            // UI 강제 업데이트
            this.UpdateLayout();
            
            // 잠시 후 다시 보이게 하고 애니메이션 시작
            var showTimer = new System.Windows.Threading.DispatcherTimer();
            showTimer.Interval = TimeSpan.FromMilliseconds(0);
            showTimer.Tick += (sender, args) =>
            {
                showTimer.Stop();
                
                // SignChar1~SignChar7만 다시 보이게 하기
                SignChar1.Visibility = Visibility.Visible;
                SignChar2.Visibility = Visibility.Visible;
                SignChar3.Visibility = Visibility.Visible;
                SignChar4.Visibility = Visibility.Visible;
                SignChar5.Visibility = Visibility.Visible;
                SignChar6.Visibility = Visibility.Visible;
                SignChar7.Visibility = Visibility.Visible;
                
                // 애니메이션 시작
                ShowNextSignUpCharacter(0);
            };
            showTimer.Start();
        }

        private void ShowNextSignUpCharacter(int index)
        {
            string[] characters = { "S", "I", "G", "N", " ", "U", "P" };
            TextBlock[] textBlocks = { SignChar1, SignChar2, SignChar3, SignChar4, SignChar5, SignChar6, SignChar7 };

            if (index < characters.Length)
            {
                textBlocks[index].Text = characters[index];
                
                // 페이드인 애니메이션
                var fadeInAnimation = new System.Windows.Media.Animation.DoubleAnimation
                {
                    From = 0.0,
                    To = 1.0,
                    Duration = TimeSpan.FromMilliseconds(300)
                };
                
                textBlocks[index].BeginAnimation(UIElement.OpacityProperty, fadeInAnimation);
                
                // 다음 글자를 200ms 후에 표시
                var timer = new System.Windows.Threading.DispatcherTimer();
                timer.Interval = TimeSpan.FromMilliseconds(200);
                timer.Tick += (s, e) =>
                {
                    timer.Stop();
                    ShowNextSignUpCharacter(index + 1);
                };
                timer.Start();
            }
            else
            {
                // 모든 글자가 나타난 후 1초 지연 후 깜빡이는 애니메이션 시작
                var delayTimer = new System.Windows.Threading.DispatcherTimer();
                delayTimer.Interval = TimeSpan.FromMilliseconds(1000);
                delayTimer.Tick += (s, e) =>
                {
                    delayTimer.Stop();
                    StartSignUpBlinkingAnimation();
                };
                delayTimer.Start();
            }
        }

        private void StartSignUpBlinkingAnimation()
        {
            // 타이핑 애니메이션 완료, 깜빡임 애니메이션 시작
            isAnimationRunning = false;
            
            TextBlock[] textBlocks = { SignChar1, SignChar2, SignChar3, SignChar4, SignChar5, SignChar6, SignChar7 };

            foreach (var textBlock in textBlocks)
            {
                // 부드럽게 시작하는 깜빡이는 애니메이션
                var fadeOutAnimation = new System.Windows.Media.Animation.DoubleAnimation
                {
                    From = 1.0,
                    To = 0.85,
                    Duration = TimeSpan.FromMilliseconds(2000),
                    EasingFunction = new System.Windows.Media.Animation.SineEase()
                };

                var fadeInAnimation = new System.Windows.Media.Animation.DoubleAnimation
                {
                    From = 0.85,
                    To = 1.0,
                    Duration = TimeSpan.FromMilliseconds(2000),
                    EasingFunction = new System.Windows.Media.Animation.SineEase()
                };

                // 스토리보드로 부드러운 반복 애니메이션 생성
                var storyboard = new System.Windows.Media.Animation.Storyboard();
                storyboard.Children.Add(fadeOutAnimation);
                storyboard.Children.Add(fadeInAnimation);
                
                // 애니메이션 순서 설정
                System.Windows.Media.Animation.Storyboard.SetTarget(fadeOutAnimation, textBlock);
                System.Windows.Media.Animation.Storyboard.SetTargetProperty(fadeOutAnimation, new System.Windows.PropertyPath(UIElement.OpacityProperty));
                
                System.Windows.Media.Animation.Storyboard.SetTarget(fadeInAnimation, textBlock);
                System.Windows.Media.Animation.Storyboard.SetTargetProperty(fadeInAnimation, new System.Windows.PropertyPath(UIElement.OpacityProperty));
                
                // 타이밍 설정
                fadeInAnimation.BeginTime = TimeSpan.FromMilliseconds(2000);
                
                // 무한 반복
                storyboard.RepeatBehavior = System.Windows.Media.Animation.RepeatBehavior.Forever;
                storyboard.Begin();
            }
        }

        private void StopAllAnimations()
        {
            // 모든 타이머 중지
            if (currentAnimationTimer != null)
            {
                currentAnimationTimer.Stop();
                currentAnimationTimer = null;
            }
            
            if (currentTypingTimer != null)
            {
                currentTypingTimer.Stop();
                currentTypingTimer = null;
            }
            
            if (currentBlinkingTimer != null)
            {
                currentBlinkingTimer.Stop();
                currentBlinkingTimer = null;
            }
            
            if (currentCodeTypingTimer != null)
            {
                currentCodeTypingTimer.Stop();
                currentCodeTypingTimer = null;
            }
            
            isAnimationRunning = false;
            isCodeAnimationRunning = false;
            
            // 모든 TextBlock의 애니메이션 중지
            TextBlock[] textBlocks = { Char1, Char2, Char3, Char4, Char5, Char6, Char7, Char8, Char9, Char10, Char11, Char12, Char13, Char14, SignChar1, SignChar2, SignChar3, SignChar4, SignChar5, SignChar6, SignChar7, CodeChar1, CodeChar2, CodeChar3, CodeChar4, CodeChar5, CodeChar6, CodeChar7, CodeChar8, CodeChar9, CodeChar10, CodeChar11, CodeChar12, CodeChar13, CodeChar14 };
            
            foreach (var textBlock in textBlocks)
            {
                // 애니메이션 중지
                textBlock.BeginAnimation(UIElement.OpacityProperty, null);
                // 강제로 텍스트와 투명도 리셋
                textBlock.Text = "";
                textBlock.Opacity = 0;
                // Visibility로도 숨기기
                textBlock.Visibility = Visibility.Hidden;
                // 레이아웃 강제 업데이트
                textBlock.UpdateLayout();
            }
            
            // CODE INJECTION Panel도 숨기기
            CodeInjectionPanel.Visibility = Visibility.Collapsed;
        }


        private void StartCodeTypingAnimation()
        {
            // 이미 코드 애니메이션이 실행 중이면 중복 실행 방지
            if (isCodeAnimationRunning)
            {
                return;
            }
            
            // 기존 애니메이션 중지
            StopAllAnimations();
            
            isCodeAnimationRunning = true;
            
            // 추가 강제 초기화 - 모든 TextBlock을 명시적으로 리셋 (다른 애니메이션과 동일)
            Char1.Text = ""; Char1.Opacity = 0; Char1.Visibility = Visibility.Hidden;
            Char2.Text = ""; Char2.Opacity = 0; Char2.Visibility = Visibility.Hidden;
            Char3.Text = ""; Char3.Opacity = 0; Char3.Visibility = Visibility.Hidden;
            Char4.Text = ""; Char4.Opacity = 0; Char4.Visibility = Visibility.Hidden;
            Char5.Text = ""; Char5.Opacity = 0; Char5.Visibility = Visibility.Hidden;
            Char6.Text = ""; Char6.Opacity = 0; Char6.Visibility = Visibility.Hidden;
            Char7.Text = ""; Char7.Opacity = 0; Char7.Visibility = Visibility.Hidden;
            Char8.Text = ""; Char8.Opacity = 0; Char8.Visibility = Visibility.Hidden;
            Char9.Text = ""; Char9.Opacity = 0; Char9.Visibility = Visibility.Hidden;
            Char10.Text = ""; Char10.Opacity = 0; Char10.Visibility = Visibility.Hidden;
            Char11.Text = ""; Char11.Opacity = 0; Char11.Visibility = Visibility.Hidden;
            Char12.Text = ""; Char12.Opacity = 0; Char12.Visibility = Visibility.Hidden;
            Char13.Text = ""; Char13.Opacity = 0; Char13.Visibility = Visibility.Hidden;
            Char14.Text = ""; Char14.Opacity = 0; Char14.Visibility = Visibility.Hidden;
            SignChar1.Text = ""; SignChar1.Opacity = 0; SignChar1.Visibility = Visibility.Hidden;
            SignChar2.Text = ""; SignChar2.Opacity = 0; SignChar2.Visibility = Visibility.Hidden;
            SignChar3.Text = ""; SignChar3.Opacity = 0; SignChar3.Visibility = Visibility.Hidden;
            SignChar4.Text = ""; SignChar4.Opacity = 0; SignChar4.Visibility = Visibility.Hidden;
            SignChar5.Text = ""; SignChar5.Opacity = 0; SignChar5.Visibility = Visibility.Hidden;
            SignChar6.Text = ""; SignChar6.Opacity = 0; SignChar6.Visibility = Visibility.Hidden;
            SignChar7.Text = ""; SignChar7.Opacity = 0; SignChar7.Visibility = Visibility.Hidden;
            
            // CODE INJECTION Panel 보이게 하기
            CodeInjectionPanel.Visibility = Visibility.Visible;
            
            // UI 강제 업데이트
            this.UpdateLayout();
            
            // 잠시 후 다시 보이게 하고 애니메이션 시작 (다른 애니메이션과 동일한 방식)
            currentAnimationTimer = new System.Windows.Threading.DispatcherTimer();
            currentAnimationTimer.Interval = TimeSpan.FromMilliseconds(0);
            currentAnimationTimer.Tick += (sender, args) =>
            {
                currentAnimationTimer.Stop();
                currentAnimationTimer = null;
                
                // CodeChar1~CodeChar14만 다시 보이게 하기 (다른 애니메이션과 동일)
                CodeChar1.Visibility = Visibility.Visible;
                CodeChar2.Visibility = Visibility.Visible;
                CodeChar3.Visibility = Visibility.Visible;
                CodeChar4.Visibility = Visibility.Visible;
                CodeChar5.Visibility = Visibility.Visible;
                CodeChar6.Visibility = Visibility.Visible;
                CodeChar7.Visibility = Visibility.Visible;
                CodeChar8.Visibility = Visibility.Visible;
                CodeChar9.Visibility = Visibility.Visible;
                CodeChar10.Visibility = Visibility.Visible;
                CodeChar11.Visibility = Visibility.Visible;
                CodeChar12.Visibility = Visibility.Visible;
                CodeChar13.Visibility = Visibility.Visible;
                CodeChar14.Visibility = Visibility.Visible;
                
                // 애니메이션 시작
                ShowNextCodeInjectionCharacter(0);
            };
            currentAnimationTimer.Start();
        }
        
        private TextBlock GetCodeChar(int index)
        {
            return index switch
            {
                1 => CodeChar1, 2 => CodeChar2, 3 => CodeChar3, 4 => CodeChar4,
                5 => CodeChar5, 6 => CodeChar6, 7 => CodeChar7, 8 => CodeChar8,
                9 => CodeChar9, 10 => CodeChar10, 11 => CodeChar11, 12 => CodeChar12,
                13 => CodeChar13, 14 => CodeChar14,
                _ => CodeChar1
            };
        }

        private void ShowNextCodeInjectionCharacter(int index)
        {
            // 코드 애니메이션이 중지되었으면 실행하지 않음
            if (!isCodeAnimationRunning)
            {
                return;
            }
            
            string[] codeText = { "C", "O", "D", "E", " ", "I", "N", "J", "E", "C", "T", "I", "O", "N" };
            TextBlock[] textBlocks = { CodeChar1, CodeChar2, CodeChar3, CodeChar4, CodeChar5, CodeChar6, CodeChar7, CodeChar8, CodeChar9, CodeChar10, CodeChar11, CodeChar12, CodeChar13, CodeChar14 };

            if (index < codeText.Length)
            {
                // 현재 글자를 설정
                textBlocks[index].Text = codeText[index];
                
                // 페이드인 애니메이션
                var fadeInAnimation = new System.Windows.Media.Animation.DoubleAnimation
                {
                    From = 0.0,
                    To = 1.0,
                    Duration = TimeSpan.FromMilliseconds(300)
                };
                
                textBlocks[index].BeginAnimation(UIElement.OpacityProperty, fadeInAnimation);
                
                // 다음 글자를 200ms 후에 표시
                var timer = new System.Windows.Threading.DispatcherTimer();
                timer.Interval = TimeSpan.FromMilliseconds(200);
                timer.Tick += (s, e) =>
                {
                    timer.Stop();
                    ShowNextCodeInjectionCharacter(index + 1);
                };
                timer.Start();
            }
            else
            {
                // 모든 글자가 나타난 후 1초 지연 후 깜빡이는 애니메이션 시작
                var delayTimer = new System.Windows.Threading.DispatcherTimer();
                delayTimer.Interval = TimeSpan.FromMilliseconds(1000); // 1초 지연
                delayTimer.Tick += (s, e) =>
                {
                    delayTimer.Stop();
                    isCodeAnimationRunning = false;
                    StartCodeInjectionBlinkingAnimation();
                };
                delayTimer.Start();
            }
        }

        private void ShowNextCodeCharacter(int index)
        {
            TextBlock[] textBlocks = { SignChar1, SignChar2, SignChar3, SignChar4, SignChar5, SignChar6, SignChar7 };
            string[] codeText = { "C", "O", "D", "E", " ", " ", " " };

            if (index < textBlocks.Length)
            {
                textBlocks[index].Text = codeText[index];
                textBlocks[index].Opacity = 0;

                // 부드러운 페이드인 애니메이션
                var fadeInAnimation = new System.Windows.Media.Animation.DoubleAnimation
                {
                    From = 0,
                    To = 1,
                    Duration = TimeSpan.FromMilliseconds(300),
                    EasingFunction = new System.Windows.Media.Animation.CubicEase() { EasingMode = System.Windows.Media.Animation.EasingMode.EaseOut }
                };

                System.Windows.Media.Animation.Storyboard.SetTarget(fadeInAnimation, textBlocks[index]);
                System.Windows.Media.Animation.Storyboard.SetTargetProperty(fadeInAnimation, new System.Windows.PropertyPath(UIElement.OpacityProperty));

                var storyboard = new System.Windows.Media.Animation.Storyboard();
                storyboard.Children.Add(fadeInAnimation);
                storyboard.Begin();

                // 다음 글자 애니메이션을 위한 타이머
                var timer = new System.Windows.Threading.DispatcherTimer();
                timer.Interval = TimeSpan.FromMilliseconds(150);
                timer.Tick += (s, e) =>
                {
                    timer.Stop();
                    ShowNextCodeCharacter(index + 1);
                };
                timer.Start();
            }
            else
            {
                // 모든 글자가 나타난 후 1초 지연 후 깜빡이는 애니메이션 시작
                var delayTimer = new System.Windows.Threading.DispatcherTimer();
                delayTimer.Interval = TimeSpan.FromMilliseconds(1000);
                delayTimer.Tick += (s, e) =>
                {
                    delayTimer.Stop();
                    StartCodeBlinkingAnimation();
                };
                delayTimer.Start();
            }
        }


        private void StartCodeBlinkingAnimation()
        {
            TextBlock[] textBlocks = { SignChar1, SignChar2, SignChar3, SignChar4, SignChar5, SignChar6, SignChar7 };

            foreach (var textBlock in textBlocks)
            {
                // 부드럽게 시작하는 깜빡이는 애니메이션
                var fadeOutAnimation = new System.Windows.Media.Animation.DoubleAnimation
                {
                    From = 1.0,
                    To = 0.85,
                    Duration = TimeSpan.FromMilliseconds(2000),
                    EasingFunction = new System.Windows.Media.Animation.SineEase()
                };

                var fadeInAnimation = new System.Windows.Media.Animation.DoubleAnimation
                {
                    From = 0.85,
                    To = 1.0,
                    Duration = TimeSpan.FromMilliseconds(2000),
                    EasingFunction = new System.Windows.Media.Animation.SineEase()
                };

                // 스토리보드로 부드러운 반복 애니메이션 생성
                var storyboard = new System.Windows.Media.Animation.Storyboard();
                storyboard.Children.Add(fadeOutAnimation);
                storyboard.Children.Add(fadeInAnimation);
                
                // 애니메이션 순서 설정
                System.Windows.Media.Animation.Storyboard.SetTarget(fadeOutAnimation, textBlock);
                System.Windows.Media.Animation.Storyboard.SetTargetProperty(fadeOutAnimation, new System.Windows.PropertyPath(UIElement.OpacityProperty));
                
                System.Windows.Media.Animation.Storyboard.SetTarget(fadeInAnimation, textBlock);
                System.Windows.Media.Animation.Storyboard.SetTargetProperty(fadeInAnimation, new System.Windows.PropertyPath(UIElement.OpacityProperty));
                
                // 타이밍 설정
                fadeInAnimation.BeginTime = TimeSpan.FromMilliseconds(2000);
                
                // 무한 반복
                storyboard.RepeatBehavior = System.Windows.Media.Animation.RepeatBehavior.Forever;
                storyboard.Begin();
            }
        }


        private void SignUp_MouseLeftButtonDown(object sender, MouseButtonEventArgs e)
        {
            // 현재 코드 모드라면 먼저 해제
            if (isCodeMode)
            {
                isCodeMode = false;
                CodeInputPanel.Visibility = Visibility.Collapsed;
                PasswordPanel.Visibility = Visibility.Visible;
                
                // 애니메이션 완전 초기화
                StopAllAnimations();
                TextBlock[] allTextBlocks = { Char1, Char2, Char3, Char4, Char5, Char6, Char7, Char8, Char9, Char10, Char11, Char12, Char13, Char14, SignChar1, SignChar2, SignChar3, SignChar4, SignChar5, SignChar6, SignChar7 };
                foreach (var textBlock in allTextBlocks)
                {
                    textBlock.Text = "";
                    textBlock.Opacity = 0;
                }
            }
            
            // 회원가입 모드로 전환
            ToggleSignUpMode();
        }

        private void Code_MouseLeftButtonDown(object sender, MouseButtonEventArgs e)
        {
            // 현재 회원가입 모드라면 먼저 해제
            if (isSignUpMode)
            {
                isSignUpMode = false;
                ConfirmPasswordPanel.Visibility = Visibility.Collapsed;
                PasswordPanel.Visibility = Visibility.Visible;
                
                // 애니메이션 완전 초기화
                StopAllAnimations();
                
                // 모든 TextBlock을 완전히 리셋
                TextBlock[] allTextBlocks = { Char1, Char2, Char3, Char4, Char5, Char6, Char7, Char8, Char9, Char10, Char11, Char12, Char13, Char14, SignChar1, SignChar2, SignChar3, SignChar4, SignChar5, SignChar6, SignChar7 };
                foreach (var textBlock in allTextBlocks)
                {
                    textBlock.Text = "";
                    textBlock.Opacity = 0;
                    textBlock.Visibility = Visibility.Hidden;
                    textBlock.BeginAnimation(UIElement.OpacityProperty, null);
                }
                
                // UI 강제 업데이트
                this.UpdateLayout();
                
                // 잠시 대기 후 코드 등록 모드로 전환
                var delayTimer = new System.Windows.Threading.DispatcherTimer();
                delayTimer.Interval = TimeSpan.FromMilliseconds(300);
                delayTimer.Tick += (s, args) =>
                {
                    delayTimer.Stop();
                    ToggleCodeRegistrationMode();
                };
                delayTimer.Start();
                return;
            }
            
            // 현재 코드 모드라면 먼저 해제
            if (isCodeMode)
            {
                isCodeMode = false;
                CodeInputPanel.Visibility = Visibility.Collapsed;
                PasswordPanel.Visibility = Visibility.Visible;
                
                // 애니메이션 완전 초기화
                StopAllAnimations();
                
                // UI 강제 업데이트
                this.UpdateLayout();
                
                // 잠시 대기 후 코드 등록 모드로 전환
                var delayTimer = new System.Windows.Threading.DispatcherTimer();
                delayTimer.Interval = TimeSpan.FromMilliseconds(300);
                delayTimer.Tick += (s, args) =>
                {
                    delayTimer.Stop();
                    ToggleCodeRegistrationMode();
                };
                delayTimer.Start();
                return;
            }
            
            // 코드 등록 모드로 전환
            ToggleCodeRegistrationMode();
        }

        private void ToggleSignUpMode()
        {
            isSignUpMode = !isSignUpMode;
            
                if (isSignUpMode)
                {
                    // 회원가입 모드 - 윈도우 높이를 늘림
                    this.Height = 330;
                
                // 회원가입 모드
                ConfirmPasswordPanel.Visibility = Visibility.Visible;
                CodeInputPanel.Visibility = Visibility.Collapsed; // 코드 입력창 숨기기
                LoginButton.Content = "COMPLETE";
                LoginButton.Margin = new Thickness(0, -15, 0, 0); // COMPLETE 버튼을 위로 올림
                EmailPlaceholder.Text = "Email ID";
                PasswordPlaceholder.Text = "Password";
                ConfirmPasswordPlaceholder.Text = "Confirm Password";
                ConfirmPasswordPlaceholder.Visibility = Visibility.Visible;
                
                // Sign up 버튼 텍스트를 CANCEL로 변경
                var signUpTextBlock = this.FindName("SignUpTextBlock") as TextBlock;
                if (signUpTextBlock != null)
                {
                    signUpTextBlock.Text = "CANCEL";
                }
                
                // CODE 텍스트 숨기기
                var codeTextBlock = this.FindName("CodeTextBlock") as TextBlock;
                if (codeTextBlock != null)
                {
                    codeTextBlock.Visibility = Visibility.Collapsed;
                }
                
                // Remember me 숨기기
                RememberMePanel.Visibility = Visibility.Collapsed;
                
                // 창 높이 늘리기
                this.Height = 350;
                
                // 제목 패널 전환
                TitlePanel.Visibility = Visibility.Collapsed;
                SignUpPanel.Visibility = Visibility.Visible;
                
                // 추가 강제 초기화 - 모든 TextBlock을 명시적으로 리셋
                Char1.Text = ""; Char1.Opacity = 0;
                Char2.Text = ""; Char2.Opacity = 0;
                Char3.Text = ""; Char3.Opacity = 0;
                Char4.Text = ""; Char4.Opacity = 0;
                Char5.Text = ""; Char5.Opacity = 0;
                Char6.Text = ""; Char6.Opacity = 0;
                Char7.Text = ""; Char7.Opacity = 0;
                Char8.Text = ""; Char8.Opacity = 0;
                Char9.Text = ""; Char9.Opacity = 0;
                Char10.Text = ""; Char10.Opacity = 0;
                Char11.Text = ""; Char11.Opacity = 0;
                Char12.Text = ""; Char12.Opacity = 0;
                Char13.Text = ""; Char13.Opacity = 0;
                Char14.Text = ""; Char14.Opacity = 0;
                SignChar1.Text = ""; SignChar1.Opacity = 0;
                SignChar2.Text = ""; SignChar2.Opacity = 0;
                SignChar3.Text = ""; SignChar3.Opacity = 0;
                SignChar4.Text = ""; SignChar4.Opacity = 0;
                SignChar5.Text = ""; SignChar5.Opacity = 0;
                SignChar6.Text = ""; SignChar6.Opacity = 0;
                SignChar7.Text = ""; SignChar7.Opacity = 0;
                
                // UI 강제 업데이트
                this.UpdateLayout();
                
                // Sign up 타이핑 애니메이션 시작
                StartSignUpTypingAnimation();
                
                // 입력 필드 초기화
                UsernameTextBox.Text = "";
                PasswordBox.Password = "";
                ConfirmPasswordBox.Password = "";
                HideErrorMessage();
            }
            else
            {
                // 로그인 모드 - 윈도우 높이를 원래대로 복원
                this.Height = 300;
                
                // 로그인 모드
                ConfirmPasswordPanel.Visibility = Visibility.Collapsed;
                CodeInputPanel.Visibility = Visibility.Collapsed; // 코드 입력창 숨기기
                LoginButton.Content = "LOGIN";
                LoginButton.Margin = new Thickness(0, 0, 0, -2); // LOGIN 버튼 마진을 원래대로 복원
                LoginButton.Background = new System.Windows.Media.SolidColorBrush(System.Windows.Media.Colors.Transparent); // 배경색 원래대로 복원
                EmailPlaceholder.Text = "Email ID";
                PasswordPlaceholder.Text = "Password";
                
                // Sign up 버튼 텍스트를 원래대로 변경
                var signUpTextBlock = this.FindName("SignUpTextBlock") as TextBlock;
                if (signUpTextBlock != null)
                {
                    signUpTextBlock.Text = "SIGN UP";
                }
                
                // CODE 텍스트 다시 보이기
                var codeTextBlock = this.FindName("CodeTextBlock") as TextBlock;
                if (codeTextBlock != null)
                {
                    codeTextBlock.Text = "CODE";
                    codeTextBlock.Visibility = Visibility.Visible;
                }
                
                // Remember me 다시 보이기
                RememberMePanel.Visibility = Visibility.Visible;
                
                // 창 높이 원래대로
                this.Height = 300;
                
                // 제목 패널 전환
                SignUpPanel.Visibility = Visibility.Collapsed;
                TitlePanel.Visibility = Visibility.Visible;
                
                // 기존 애니메이션 완전히 중지하고 초기화
                StopAllAnimations();
                
                // 모든 TextBlock 초기화 (CodeChar 포함)
                TextBlock[] allTextBlocks = { Char1, Char2, Char3, Char4, Char5, Char6, Char7, Char8, Char9, Char10, Char11, Char12, Char13, Char14, SignChar1, SignChar2, SignChar3, SignChar4, SignChar5, SignChar6, SignChar7, CodeChar1, CodeChar2, CodeChar3, CodeChar4, CodeChar5, CodeChar6, CodeChar7, CodeChar8, CodeChar9, CodeChar10, CodeChar11, CodeChar12, CodeChar13, CodeChar14 };
                foreach (var textBlock in allTextBlocks)
                {
                    textBlock.Text = "";
                    textBlock.Opacity = 0;
                    textBlock.Visibility = Visibility.Hidden;
                    textBlock.BeginAnimation(UIElement.OpacityProperty, null);
                }
                
                // CODE INJECTION Panel도 숨기기
                CodeInjectionPanel.Visibility = Visibility.Collapsed;
                
                // @WINT365 타이핑 애니메이션 다시 시작
                StartTypingAnimation();
                
                // 입력 필드 초기화
                UsernameTextBox.Text = "";
                PasswordBox.Password = "";
                ConfirmPasswordBox.Password = "";
                HideErrorMessage();
            }
        }

        private void ToggleCodeMode()
        {
            isCodeMode = !isCodeMode;
            
            if (isCodeMode)
            {
                // 코드 모드
                CodeInputPanel.Visibility = Visibility.Visible;
                LoginButton.Content = "VERIFY";
                EmailPlaceholder.Text = "Email ID";
                PasswordPlaceholder.Text = "Password";
                CodePlaceholder.Text = "Access Code";
                
                // 비밀번호 입력창 숨기기
                PasswordPanel.Visibility = Visibility.Collapsed;
                
                // CODE 텍스트를 CANCEL로 변경
                var codeTextBlock = this.FindName("CodeTextBlock") as TextBlock;
                if (codeTextBlock != null)
                {
                    codeTextBlock.Text = "CANCEL";
                }
                
                // SIGN UP 텍스트를 빈 공간으로 만들어서 CANCEL이 원래 CODE 위치에 오도록 함
                var signUpTextBlock = this.FindName("SignUpTextBlock") as TextBlock;
                if (signUpTextBlock != null)
                {
                    signUpTextBlock.Text = "";  // 텍스트를 빈 문자열로 설정
                    signUpTextBlock.Visibility = Visibility.Visible;  // 보이게 유지하되 빈 공간으로
                    signUpTextBlock.Margin = new Thickness(0, 0, 20, 0);  // 원래 마진 유지
                }
                
                // Remember me 숨기기
                RememberMePanel.Visibility = Visibility.Collapsed;
                
                // 창 높이 조정 (메인 로그인창과 동일하게)
                this.Height = 300;
                
                // 입력 필드 초기화
                UsernameTextBox.Text = "";
                PasswordBox.Password = "";
                CodeBox.Text = "";
                HideErrorMessage();
                
                // 애니메이션 완전 중지
                StopAllAnimations();
                
                // 코드 애니메이션 상태 초기화
                isCodeAnimationRunning = false;
                
                // 추가 강제 초기화 - 모든 TextBlock을 명시적으로 리셋
                Char1.Text = ""; Char1.Opacity = 0; Char1.Visibility = Visibility.Hidden;
                Char2.Text = ""; Char2.Opacity = 0; Char2.Visibility = Visibility.Hidden;
                Char3.Text = ""; Char3.Opacity = 0; Char3.Visibility = Visibility.Hidden;
                Char4.Text = ""; Char4.Opacity = 0; Char4.Visibility = Visibility.Hidden;
                Char5.Text = ""; Char5.Opacity = 0; Char5.Visibility = Visibility.Hidden;
                Char6.Text = ""; Char6.Opacity = 0; Char6.Visibility = Visibility.Hidden;
                Char7.Text = ""; Char7.Opacity = 0; Char7.Visibility = Visibility.Hidden;
                Char8.Text = ""; Char8.Opacity = 0; Char8.Visibility = Visibility.Hidden;
                Char9.Text = ""; Char9.Opacity = 0; Char9.Visibility = Visibility.Hidden;
                Char10.Text = ""; Char10.Opacity = 0; Char10.Visibility = Visibility.Hidden;
                Char11.Text = ""; Char11.Opacity = 0; Char11.Visibility = Visibility.Hidden;
                Char12.Text = ""; Char12.Opacity = 0; Char12.Visibility = Visibility.Hidden;
                Char13.Text = ""; Char13.Opacity = 0; Char13.Visibility = Visibility.Hidden;
                Char14.Text = ""; Char14.Opacity = 0; Char14.Visibility = Visibility.Hidden;
                SignChar1.Text = ""; SignChar1.Opacity = 0; SignChar1.Visibility = Visibility.Hidden;
                SignChar2.Text = ""; SignChar2.Opacity = 0; SignChar2.Visibility = Visibility.Hidden;
                SignChar3.Text = ""; SignChar3.Opacity = 0; SignChar3.Visibility = Visibility.Hidden;
                SignChar4.Text = ""; SignChar4.Opacity = 0; SignChar4.Visibility = Visibility.Hidden;
                SignChar5.Text = ""; SignChar5.Opacity = 0; SignChar5.Visibility = Visibility.Hidden;
                SignChar6.Text = ""; SignChar6.Opacity = 0; SignChar6.Visibility = Visibility.Hidden;
                SignChar7.Text = ""; SignChar7.Opacity = 0; SignChar7.Visibility = Visibility.Hidden;
                
                // UI 강제 업데이트
                this.UpdateLayout();
                
                // 코드 타이핑 애니메이션 시작
                StartCodeTypingAnimation();
            }
            else
            {
                // 로그인 모드
                CodeInputPanel.Visibility = Visibility.Collapsed;
                LoginButton.Content = "LOGIN";
                LoginButton.Background = new System.Windows.Media.SolidColorBrush(System.Windows.Media.Colors.Transparent); // 배경색 원래대로 복원
                EmailPlaceholder.Text = "Email ID";
                PasswordPlaceholder.Text = "Password";
                
                // 비밀번호 입력창 다시 보이기
                PasswordPanel.Visibility = Visibility.Visible;
                
                // CODE 텍스트를 원래대로 변경
                var codeTextBlock = this.FindName("CodeTextBlock") as TextBlock;
                if (codeTextBlock != null)
                {
                    codeTextBlock.Text = "CODE";
                }
                
                // SIGN UP 텍스트를 원래대로 복원
                var signUpTextBlock = this.FindName("SignUpTextBlock") as TextBlock;
                if (signUpTextBlock != null)
                {
                    signUpTextBlock.Text = "SIGN UP";  // 원래 텍스트로 복원
                    signUpTextBlock.Foreground = new System.Windows.Media.SolidColorBrush(
                        (System.Windows.Media.Color)System.Windows.Media.ColorConverter.ConvertFromString("#CCCCCC"));
                    signUpTextBlock.Visibility = Visibility.Visible;
                    signUpTextBlock.Margin = new Thickness(0, 0, 20, 0);  // 원래 마진 유지
                }
                
                // Remember me 다시 보이기
                RememberMePanel.Visibility = Visibility.Visible;
                
                // 창 높이 원래대로
                this.Height = 300;
                
                // 입력 필드 초기화
                UsernameTextBox.Text = "";
                PasswordBox.Password = "";
                CodeBox.Text = "";
                HideErrorMessage();
                
                // 기존 애니메이션 완전히 중지하고 초기화
                StopAllAnimations();
                
                // 코드 애니메이션 상태 초기화
                isCodeAnimationRunning = false;
                
                // 추가 강제 초기화 - 모든 TextBlock을 명시적으로 리셋
                Char1.Text = ""; Char1.Opacity = 0;
                Char2.Text = ""; Char2.Opacity = 0;
                Char3.Text = ""; Char3.Opacity = 0;
                Char4.Text = ""; Char4.Opacity = 0;
                Char5.Text = ""; Char5.Opacity = 0;
                Char6.Text = ""; Char6.Opacity = 0;
                Char7.Text = ""; Char7.Opacity = 0;
                Char8.Text = ""; Char8.Opacity = 0;
                Char9.Text = ""; Char9.Opacity = 0;
                Char10.Text = ""; Char10.Opacity = 0;
                Char11.Text = ""; Char11.Opacity = 0;
                Char12.Text = ""; Char12.Opacity = 0;
                Char13.Text = ""; Char13.Opacity = 0;
                Char14.Text = ""; Char14.Opacity = 0;
                SignChar1.Text = ""; SignChar1.Opacity = 0;
                SignChar2.Text = ""; SignChar2.Opacity = 0;
                SignChar3.Text = ""; SignChar3.Opacity = 0;
                SignChar4.Text = ""; SignChar4.Opacity = 0;
                SignChar5.Text = ""; SignChar5.Opacity = 0;
                SignChar6.Text = ""; SignChar6.Opacity = 0;
                SignChar7.Text = ""; SignChar7.Opacity = 0;
                
                // UI 강제 업데이트
                this.UpdateLayout();
                
                // @WINT365 타이핑 애니메이션 다시 시작
                StartTypingAnimation();
            }
        }

        private void ToggleCodeRegistrationMode()
        {
            isCodeRegistrationMode = !isCodeRegistrationMode;
            
            if (isCodeRegistrationMode)
            {
                // 코드 등록 모드 - 최소한의 변경만
                CodeRegistrationPanel.Visibility = Visibility.Visible;
                LoginButton.Content = "REGISTER";
                // 로그인 버튼 스타일을 원래대로 유지 (MinimalButtonStyle)
                LoginButton.Background = new System.Windows.Media.SolidColorBrush(System.Windows.Media.Colors.Transparent);
                LoginButton.Foreground = new System.Windows.Media.SolidColorBrush(System.Windows.Media.Colors.White);
                LoginButton.BorderBrush = new System.Windows.Media.SolidColorBrush(
                    (System.Windows.Media.Color)System.Windows.Media.ColorConverter.ConvertFromString("#CCCCCC"));
                EmailPlaceholder.Text = "Email ID";
                PasswordPlaceholder.Text = "Password";
                CodeRegistrationPlaceholder.Text = "Access Code";
                
                // 비밀번호 입력창 숨기기
                PasswordPanel.Visibility = Visibility.Collapsed;
                
                // CODE 텍스트를 CANCEL로 변경 (색상 유지)
                var codeTextBlock = this.FindName("CodeTextBlock") as TextBlock;
                if (codeTextBlock != null)
                {
                    codeTextBlock.Text = "CANCEL";
                    codeTextBlock.Foreground = new System.Windows.Media.SolidColorBrush(
                        (System.Windows.Media.Color)System.Windows.Media.ColorConverter.ConvertFromString("#CCCCCC"));
                }
                
                // SIGN UP 텍스트를 빈 공간으로 만들어서 CANCEL이 원래 CODE 위치에 오도록 함
                var signUpTextBlock = this.FindName("SignUpTextBlock") as TextBlock;
                if (signUpTextBlock != null)
                {
                    signUpTextBlock.Text = "";  // 텍스트를 빈 문자열로 설정
                    signUpTextBlock.Foreground = new System.Windows.Media.SolidColorBrush(
                        (System.Windows.Media.Color)System.Windows.Media.ColorConverter.ConvertFromString("#CCCCCC"));
                    signUpTextBlock.Visibility = Visibility.Visible;  // 보이게 유지하되 빈 공간으로
                    signUpTextBlock.Margin = new Thickness(0, 0, 20, 0);  // 원래 마진 유지
                }
                
                // Remember me 숨기기
                RememberMePanel.Visibility = Visibility.Collapsed;
                
                // 창 높이 조정 (처음 실행과 동일하게 유지)
                this.Height = 300;
                
                // 입력 필드 초기화
                UsernameTextBox.Text = "";
                PasswordBox.Password = "";
                CodeRegistrationBox.Text = "";
                HideErrorMessage();
                
                // 코드 등록 모드에서도 애니메이션 시작
                StartCodeTypingAnimation();
            }
            else
            {
                // 일반 모드로 복원
                CodeRegistrationPanel.Visibility = Visibility.Collapsed;
                PasswordPanel.Visibility = Visibility.Visible;
                LoginButton.Content = "LOGIN";
                // 로그인 버튼 스타일을 원래대로 복원 (MinimalButtonStyle)
                LoginButton.Background = new System.Windows.Media.SolidColorBrush(System.Windows.Media.Colors.Transparent);
                LoginButton.Foreground = new System.Windows.Media.SolidColorBrush(System.Windows.Media.Colors.White);
                LoginButton.BorderBrush = new System.Windows.Media.SolidColorBrush(
                    (System.Windows.Media.Color)System.Windows.Media.ColorConverter.ConvertFromString("#CCCCCC"));
                EmailPlaceholder.Text = "Email ID";
                PasswordPlaceholder.Text = "Password";
                
                // CODE 텍스트를 원래대로 복원
                var codeTextBlock = this.FindName("CodeTextBlock") as TextBlock;
                if (codeTextBlock != null)
                {
                    codeTextBlock.Text = "CODE";
                    codeTextBlock.Foreground = new System.Windows.Media.SolidColorBrush(
                        (System.Windows.Media.Color)System.Windows.Media.ColorConverter.ConvertFromString("#CCCCCC"));
                }
                
                // SIGN UP 텍스트를 원래대로 복원
                var signUpTextBlock = this.FindName("SignUpTextBlock") as TextBlock;
                if (signUpTextBlock != null)
                {
                    signUpTextBlock.Text = "SIGN UP";  // 원래 텍스트로 복원
                    signUpTextBlock.Foreground = new System.Windows.Media.SolidColorBrush(
                        (System.Windows.Media.Color)System.Windows.Media.ColorConverter.ConvertFromString("#CCCCCC"));
                    signUpTextBlock.Visibility = Visibility.Visible;
                    signUpTextBlock.Margin = new Thickness(0, 0, 20, 0);  // 원래 마진 유지
                }
                
                // Remember me 다시 보이기
                RememberMePanel.Visibility = Visibility.Visible;
                
                // 창 높이 원래대로
                this.Height = 300;
                
                // 입력 필드 초기화
                UsernameTextBox.Text = "";
                PasswordBox.Password = "";
                CodeRegistrationBox.Text = "";
                HideErrorMessage();
                
                // 애니메이션 다시 시작 (처음 실행과 동일하게)
                StopAllAnimations();
                StartTypingAnimation();
                
                // UI 강제 업데이트
                this.UpdateLayout();
            }
        }

        private void RememberCheckBox_Click(object sender, RoutedEventArgs e)
        {
            // 체크박스 클릭 이벤트 처리
            System.Diagnostics.Debug.WriteLine($"Remember Me 체크 상태: {RememberCheckBox.IsChecked}");
            
            // 체크박스 상태가 변경되면 즉시 저장
            SaveUserSettings();
        }


        private void ShowPlaceholdersIfEmpty()
        {
            // placeholder 텍스트 다시 표시
            if (UsernameTextBox.Text == "")
            {
                EmailPlaceholder.Visibility = Visibility.Visible;
            }
            if (PasswordBox.Password == "")
            {
                PasswordPlaceholder.Visibility = Visibility.Visible;
            }
            if (ConfirmPasswordBox.Password == "")
            {
                ConfirmPasswordPlaceholder.Visibility = Visibility.Visible;
            }
            if (CodeBox.Text == "")
            {
                CodePlaceholder.Visibility = Visibility.Visible;
            }
        }

        private void SetupWindow()
        {
            // 창 드래그 설정
            this.MouseDown += (sender, e) =>
            {
                if (e.LeftButton == MouseButtonState.Pressed)
                {
                    this.DragMove();
                }
            };

            // 창 클릭 시 포커스 해제
            this.MouseLeftButtonDown += (sender, e) =>
            {
                // 현재 포커스된 요소가 입력창이 아닌 경우에만 포커스 해제
                if (!(e.OriginalSource is TextBox) && !(e.OriginalSource is PasswordBox))
                {
                    // 포커스 해제
                    Keyboard.ClearFocus();
                    
                    // placeholder 텍스트 다시 표시
                    ShowPlaceholdersIfEmpty();
                }
            };

            // 창이 비활성화될 때 placeholder 표시
            this.Deactivated += (sender, e) =>
            {
                ShowPlaceholdersIfEmpty();
            };

            // Enter 키로 로그인
            this.KeyDown += (sender, e) =>
            {
                if (e.Key == Key.Enter)
                {
                    LoginButton_Click(sender, e);
                }
            };

            // Remember me 체크박스 기본값
            RememberCheckBox.IsChecked = true;
        }

        private void LoginButton_Click(object sender, RoutedEventArgs e)
        {
            if (isSignUpMode)
            {
                HandleSignUp();
            }
            else if (isCodeRegistrationMode)
            {
                HandleCodeRegistration();
            }
            else
            {
                HandleLogin();
            }
        }

        // 사용자 자격 증명 검증
        private async Task<bool> ValidateUserCredentials(string email, string password)
        {
            try
            {
                System.Diagnostics.Debug.WriteLine($"Validating user credentials: {email}");
                
                if (firebaseService != null)
                {
                    // Firebase에서 사용자 정보 확인
                    var signUps = await firebaseService.GetAllSignUpsAsync();
                    
                    foreach (var signUp in signUps)
                    {
                        if (signUp.email == email && signUp.password == password)
                        {
                            System.Diagnostics.Debug.WriteLine($"User credentials validated successfully: {email}");
                            return true;
                        }
                    }
                }
                
                System.Diagnostics.Debug.WriteLine($"User credentials validation failed: {email}");
                return false;
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"Error validating user credentials: {ex.Message}");
                return false;
            }
        }

        // 회원가입된 사용자인지 확인
        private async Task<bool> IsRegisteredUser(string email)
        {
            try
            {
                System.Diagnostics.Debug.WriteLine($"Checking if user is registered: {email}");
                
                // Firebase에서 사용자 확인
                if (firebaseService != null)
                {
                    System.Diagnostics.Debug.WriteLine("Firebase service is available, checking user registration...");
                    bool isRegistered = await firebaseService.IsUserRegistered(email);
                    System.Diagnostics.Debug.WriteLine($"User registration check result: {isRegistered}");
                    return isRegistered;
                }
                
                System.Diagnostics.Debug.WriteLine("Firebase service is null!");
                // Firebase가 없으면 로컬 확인 (임시)
                // 실제로는 Firebase나 다른 DB에서 확인해야 함
                return await Task.FromResult(true); // 임시로 항상 true 반환
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"Error checking user registration: {ex.Message}");
                System.Diagnostics.Debug.WriteLine($"Stack trace: {ex.StackTrace}");
                return false;
            }
        }

        private async void HandleLogin()
        {
            // 중복 클릭 방지
            if (isLoginInProgress)
            {
                return;
            }
            
            isLoginInProgress = true;
            
            try
            {
                string username = UsernameTextBox.Text.Trim();
                string password = PasswordBox.Password.Trim();

            // 코드 모드인지 확인
            if (isCodeMode)
            {
                string code = CodeBox.Text.Trim();
                
                // 입력 검증 (이메일과 코드만)
                if (string.IsNullOrEmpty(username) || string.IsNullOrEmpty(code))
                {
                    ShowError("Please enter email and access code.");
                    return;
                }
                
                // 사용자 ID 형식 검증 (이메일 또는 사용자명 허용)
                if (string.IsNullOrWhiteSpace(username) || username.Length < 3)
                {
                    ShowError("Please enter a valid user ID or email address.");
                    return;
                }
                
                // Firebase를 통한 코드 검증 (사용자 이메일 포함)
                var validationResult = await firebaseService.ValidateCodeAsync(code, username);
                if (!validationResult.IsValid)
                {
                    ShowError(validationResult.Message);
                    return;
                }
                
                // 회원가입된 ID인지 확인 (Firebase에서 확인)
                if (!await IsRegisteredUser(username))
                {
                    ShowError("This email is not registered. Please sign up first.");
                    return;
                }
                
                // Firebase를 통한 코드 사용 처리
                if (await firebaseService.UseCodeAsync(code, username))
                {
                    ShowSuccess("Access code verified successfully! Welcome back!");
                    
                    // 성공 시 로그인 모드로 전환
                    await Task.Delay(1500); // 성공 메시지 표시 시간
                    ToggleCodeMode();
                }
                else
                {
                    ShowError("Failed to verify access code. Please try again.");
                }
                return;
            }

            // 일반 로그인 모드
            // 입력 검증
            if (string.IsNullOrEmpty(username) || string.IsNullOrEmpty(password))
            {
                ShowError("Please enter both email and password.");
                return;
            }

            // Firebase에서 사용자 인증
            bool isValidUser = await ValidateUserCredentials(username, password);
            if (isValidUser)
            {
                // 사용자가 코드를 등록했는지 확인
                bool hasRegisteredCode = await firebaseService.HasUserRegisteredCodeAsync(username);
                if (!hasRegisteredCode)
                {
                    ShowError("You must register an access code before logging in. Please click 'CODE' to register your access code first.");
                    return;
                }
                
                // 코드 남은 기간 가져오기
                string remainingDaysMessage = await firebaseService.GetUserCodeRemainingDaysAsync(username);
                
                HideErrorMessage();
                
                // 설정 저장
                SaveUserSettings();
                
                // 성공 애니메이션
                LoginButton.Content = "✓ SUCCESS";
                LoginButton.Background = new System.Windows.Media.SolidColorBrush(
                    (System.Windows.Media.Color)System.Windows.Media.ColorConverter.ConvertFromString("#10B981"));
                
                // 메시지박스로 성공 메시지 표시
                string successMessage = $"Welcome back!\n\n{remainingDaysMessage}";
                SuccessMessageBox successBox = new SuccessMessageBox(successMessage, this);
                successBox.Closed += (s, args) =>
                {
                    // 메시지박스가 닫힌 후 메인 창으로 이동 (사용자 이메일 전달)
                    MainAppWindow mainApp = new MainAppWindow(username);
                    mainApp.Show();
                    this.Close();
                };
                successBox.Show();
            }
            else
            {
                ShowError("Invalid email or password.");
            }
            }
            finally
            {
                isLoginInProgress = false;
            }
        }

        private async void HandleSignUp()
        {
            string email = UsernameTextBox.Text.Trim();
            string password = PasswordBox.Password.Trim();
            string confirmPassword = ConfirmPasswordBox.Password.Trim();

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

            // 중복 이메일 체크
            if (await firebaseService.IsUserRegistered(email))
            {
                ShowError("This email is already registered. Please use a different email.");
                return;
            }

            // Firebase에 회원가입 정보 저장
            bool saveSuccess = await firebaseService.SaveSignUpAsync(email, password);
            
            if (saveSuccess)
            {
                // 성공 애니메이션
                HideErrorMessage();
                LoginButton.Content = "✓ SUCCESS";
                LoginButton.Background = new System.Windows.Media.SolidColorBrush(
                    (System.Windows.Media.Color)System.Windows.Media.ColorConverter.ConvertFromString("#10B981"));

                // 2초 후 로그인 모드로 전환
                System.Windows.Threading.DispatcherTimer timer = new System.Windows.Threading.DispatcherTimer();
                timer.Interval = TimeSpan.FromSeconds(2);
                timer.Tick += (s, args) =>
                {
                    timer.Stop();
                    ToggleSignUpMode(); // 로그인 모드로 전환
                };
                timer.Start();
            }
            else
            {
                ShowError("Failed to save signup information. Please try again.");
            }
        }

        private async void HandleCodeRegistration()
        {
            string email = UsernameTextBox.Text.Trim();
            string code = CodeRegistrationBox.Text.Trim();

            // 디버깅 로그 추가
            System.Diagnostics.Debug.WriteLine($"Code Registration - Email: '{email}', Code: '{code}'");

            // 입력 검증
            if (string.IsNullOrEmpty(email) || string.IsNullOrEmpty(code))
            {
                ShowError("Please enter both email and access code.");
                return;
            }

            // 사용자 ID 형식 검증 (이메일 또는 사용자명 허용)
            if (string.IsNullOrWhiteSpace(email) || email.Length < 3)
            {
                System.Diagnostics.Debug.WriteLine($"User ID validation failed for: '{email}'");
                ShowError("Please enter a valid user ID or email address.");
                return;
            }

            // 회원가입된 사용자인지 확인
            System.Diagnostics.Debug.WriteLine($"Checking if user is registered: {email}");
            if (!await firebaseService.IsUserRegistered(email))
            {
                System.Diagnostics.Debug.WriteLine($"User not registered: {email}");
                ShowError("This email is not registered. Please sign up first.");
                return;
            }
            System.Diagnostics.Debug.WriteLine($"User is registered: {email}");

            // Firebase에서 코드 검증
            System.Diagnostics.Debug.WriteLine($"Validating code: {code} for user: {email}");
            var validationResult = await firebaseService.ValidateCodeAsync(code, email);
            if (!validationResult.IsValid)
            {
                System.Diagnostics.Debug.WriteLine($"Code validation failed: {validationResult.Message}");
                ShowError(validationResult.Message);
                return;
            }
            System.Diagnostics.Debug.WriteLine($"Code validation successful: {code}");

            // 코드를 해당 사용자에게 등록 (이미 할당된 경우도 성공으로 처리)
            System.Diagnostics.Debug.WriteLine($"Registering code {code} to user {email}");
            bool registrationSuccess = await firebaseService.RegisterCodeToUserAsync(code, email);
            
            if (registrationSuccess)
            {
                // 성공 애니메이션
                HideErrorMessage();
                LoginButton.Content = "✓ REGISTERED";
                LoginButton.Background = new System.Windows.Media.SolidColorBrush(
                    (System.Windows.Media.Color)System.Windows.Media.ColorConverter.ConvertFromString("#10B981"));

                // 2초 후 일반 모드로 전환
                System.Windows.Threading.DispatcherTimer timer = new System.Windows.Threading.DispatcherTimer();
                timer.Interval = TimeSpan.FromSeconds(2);
                timer.Tick += (s, args) =>
                {
                    timer.Stop();
                    ToggleCodeRegistrationMode(); // 일반 모드로 전환
                };
                timer.Start();
            }
            else
            {
                System.Diagnostics.Debug.WriteLine($"Code registration failed for code: {code}, user: {email}");
                ShowError($"Failed to register code '{code}'. Please check:\n1. The code exists and is valid\n2. The code is not already assigned to another user\n3. Firebase connection is working\n\nDebug: Check Visual Studio Output window for detailed logs");
            }
        }

        private void ShowError(string message)
        {
            ErrorTextBlock.Text = message;
            ErrorTextBlock.Foreground = new System.Windows.Media.SolidColorBrush(System.Windows.Media.Colors.Red);
            ErrorTextBlock.Visibility = Visibility.Visible;
            
            // 메시지를 아래로 이동
            if (isSignUpMode)
            {
                ErrorTextBlock.Margin = new Thickness(0, 18, 0, 2); // Sign up 모드에서 메시지를 적당히 아래로
            }
            else
            {
                ErrorTextBlock.Margin = new Thickness(0, 15, 0, 2); // 일반 모드에서 메시지를 조금 아래로
            }
            
            // 오류 메시지 표시 시 창 높이 늘리기
            ExpandWindowForMessage();
        }

        private void ShowSuccess(string message)
        {
            ErrorTextBlock.Text = message;
            ErrorTextBlock.Foreground = new System.Windows.Media.SolidColorBrush(System.Windows.Media.Colors.Green);
            ErrorTextBlock.Visibility = Visibility.Visible;
            
            // 메시지를 아래로 이동
            if (isSignUpMode)
            {
                ErrorTextBlock.Margin = new Thickness(0, 18, 0, 2); // Sign up 모드에서 메시지를 적당히 아래로
            }
            else
            {
                ErrorTextBlock.Margin = new Thickness(0, 15, 0, 2); // 일반 모드에서 메시지를 조금 아래로
            }
            
            // 성공 메시지 표시 시 창 높이 늘리기
            ExpandWindowForMessage();
            
            // 2초 후 메시지 숨기기
            var timer = new System.Windows.Threading.DispatcherTimer();
            timer.Interval = TimeSpan.FromSeconds(2);
            timer.Tick += (s, e) =>
            {
                timer.Stop();
                HideErrorMessage();
            };
            timer.Start();
        }

        private void ExpandWindowForMessage()
        {
            // 메시지가 표시될 때 창 높이를 늘림
            if (isSignUpMode)
            {
                // Sign up 모드에서는 메시지에 맞춰 창 높이를 조금 더 늘림
                this.Height = 350; // Sign up 모드 + 메시지 높이
            }
            else
            {
                this.Height = 310; // 기본 높이에서 10픽셀만 늘림
            }
        }

        private void RestoreWindowHeight()
        {
            // 메시지가 숨겨질 때 창 높이를 원래대로
            if (isSignUpMode)
            {
                // Sign up 모드에서는 창 높이를 유지 (줄이지 않음)
                this.Height = 330; // Sign up 모드 높이 유지
                LoginButton.Margin = new Thickness(0, -15, 0, 0); // COMPLETE 버튼 마진 유지
            }
            else if (isCodeRegistrationMode)
            {
                this.Height = 300; // 코드 등록 모드 높이
                LoginButton.Margin = new Thickness(0, 0, 0, -2); // LOGIN 버튼 마진 복원
            }
            else
            {
                this.Height = 300; // 일반 모드 높이
                LoginButton.Margin = new Thickness(0, 0, 0, -2); // LOGIN 버튼 마진 복원
            }
        }

        private void HideErrorMessage()
        {
            ErrorTextBlock.Visibility = Visibility.Collapsed;
            ErrorTextBlock.Foreground = new System.Windows.Media.SolidColorBrush(System.Windows.Media.Colors.Red);
            
            // 메시지 마진을 원래대로 복원
            ErrorTextBlock.Margin = new Thickness(0, 10, 0, 2);
            
            RestoreWindowHeight();
        }

        private void CloseButton_Click(object sender, RoutedEventArgs e)
        {
            this.Close();
        }


        // Email placeholder 기능
        private void UsernameTextBox_GotFocus(object sender, RoutedEventArgs e)
        {
            EmailPlaceholder.Visibility = Visibility.Collapsed;
        }

        private void UsernameTextBox_MouseLeftButtonDown(object sender, MouseButtonEventArgs e)
        {
            EmailPlaceholder.Visibility = Visibility.Collapsed;
        }

        private void UsernameTextBox_PreviewMouseLeftButtonDown(object sender, MouseButtonEventArgs e)
        {
            EmailPlaceholder.Visibility = Visibility.Collapsed;
        }

        private void UsernameTextBox_LostFocus(object sender, RoutedEventArgs e)
        {
            if (UsernameTextBox.Text == "")
            {
                EmailPlaceholder.Visibility = Visibility.Visible;
            }
            else
            {
                EmailPlaceholder.Visibility = Visibility.Collapsed;
            }
        }

        private void UsernameTextBox_TextChanged(object sender, System.Windows.Controls.TextChangedEventArgs e)
        {
            if (UsernameTextBox.Text == "")
            {
                EmailPlaceholder.Visibility = Visibility.Visible;
            }
            else
            {
                EmailPlaceholder.Visibility = Visibility.Collapsed;
            }
        }

        // Password placeholder 기능
        private void PasswordBox_GotFocus(object sender, RoutedEventArgs e)
        {
            PasswordPlaceholder.Visibility = Visibility.Collapsed;
        }

        private void PasswordBox_MouseLeftButtonDown(object sender, MouseButtonEventArgs e)
        {
            PasswordPlaceholder.Visibility = Visibility.Collapsed;
        }

        private void PasswordBox_PreviewMouseLeftButtonDown(object sender, MouseButtonEventArgs e)
        {
            PasswordPlaceholder.Visibility = Visibility.Collapsed;
        }

        private void PasswordBox_LostFocus(object sender, RoutedEventArgs e)
        {
            if (PasswordBox.Password == "")
            {
                PasswordPlaceholder.Visibility = Visibility.Visible;
            }
            else
            {
                PasswordPlaceholder.Visibility = Visibility.Collapsed;
            }
        }

        private void ConfirmPasswordBox_GotFocus(object sender, RoutedEventArgs e)
        {
            ConfirmPasswordPlaceholder.Visibility = Visibility.Collapsed;
        }

        private void ConfirmPasswordBox_MouseLeftButtonDown(object sender, MouseButtonEventArgs e)
        {
            ConfirmPasswordPlaceholder.Visibility = Visibility.Collapsed;
        }

        private void ConfirmPasswordBox_PreviewMouseLeftButtonDown(object sender, MouseButtonEventArgs e)
        {
            ConfirmPasswordPlaceholder.Visibility = Visibility.Collapsed;
        }

        private void ConfirmPasswordBox_LostFocus(object sender, RoutedEventArgs e)
        {
            if (ConfirmPasswordBox.Password == "")
            {
                ConfirmPasswordPlaceholder.Visibility = Visibility.Visible;
            }
            else
            {
                ConfirmPasswordPlaceholder.Visibility = Visibility.Collapsed;
            }
        }

        private void ConfirmPasswordBox_PasswordChanged(object sender, RoutedEventArgs e)
        {
            if (ConfirmPasswordBox.Password != "")
            {
                ConfirmPasswordPlaceholder.Visibility = Visibility.Collapsed;
            }
            else
            {
                ConfirmPasswordPlaceholder.Visibility = Visibility.Visible;
            }
        }


        private void PasswordBox_PasswordChanged(object sender, RoutedEventArgs e)
        {
            if (PasswordBox.Password == "")
            {
                PasswordPlaceholder.Visibility = Visibility.Visible;
            }
            else
            {
                PasswordPlaceholder.Visibility = Visibility.Collapsed;
            }
        }


        // Code 입력창 이벤트 핸들러들
        private void CodeBox_GotFocus(object sender, RoutedEventArgs e)
        {
            CodePlaceholder.Visibility = Visibility.Collapsed;
        }

        private void CodeBox_MouseLeftButtonDown(object sender, MouseButtonEventArgs e)
        {
            CodePlaceholder.Visibility = Visibility.Collapsed;
        }

        private void CodeBox_PreviewMouseLeftButtonDown(object sender, MouseButtonEventArgs e)
        {
            CodePlaceholder.Visibility = Visibility.Collapsed;
        }

        private void CodeBox_LostFocus(object sender, RoutedEventArgs e)
        {
            if (CodeBox.Text == "")
            {
                CodePlaceholder.Visibility = Visibility.Visible;
            }
        }

        private void CodeBox_TextChanged(object sender, System.Windows.Controls.TextChangedEventArgs e)
        {
            if (CodeBox.Text == "")
            {
                CodePlaceholder.Visibility = Visibility.Visible;
            }
            else
            {
                CodePlaceholder.Visibility = Visibility.Collapsed;
            }
        }

        private void StartCodeInjectionBlinkingAnimation()
        {
            // 타이핑 애니메이션 완료, 깜빡임 애니메이션 시작
            isAnimationRunning = false;
            
            // 모든 CodeChar TextBlock에 깜빡임 애니메이션 적용
            for (int i = 1; i <= 14; i++)
            {
                var textBlock = GetCodeChar(i);
                
                // 부드럽게 시작하는 깜빡이는 애니메이션 (SIGN UP과 동일)
                var fadeOutAnimation = new System.Windows.Media.Animation.DoubleAnimation
                {
                    From = 1.0,
                    To = 0.85,
                    Duration = TimeSpan.FromMilliseconds(2000),
                    EasingFunction = new System.Windows.Media.Animation.SineEase()
                };

                var fadeInAnimation = new System.Windows.Media.Animation.DoubleAnimation
                {
                    From = 0.85,
                    To = 1.0,
                    Duration = TimeSpan.FromMilliseconds(2000),
                    EasingFunction = new System.Windows.Media.Animation.SineEase()
                };

                var storyboard = new System.Windows.Media.Animation.Storyboard();
                storyboard.Children.Add(fadeOutAnimation);
                storyboard.Children.Add(fadeInAnimation);

                System.Windows.Media.Animation.Storyboard.SetTarget(fadeOutAnimation, textBlock);
                System.Windows.Media.Animation.Storyboard.SetTargetProperty(fadeOutAnimation, new System.Windows.PropertyPath(UIElement.OpacityProperty));

                System.Windows.Media.Animation.Storyboard.SetTarget(fadeInAnimation, textBlock);
                System.Windows.Media.Animation.Storyboard.SetTargetProperty(fadeInAnimation, new System.Windows.PropertyPath(UIElement.OpacityProperty));

                // 애니메이션을 반복
                storyboard.RepeatBehavior = System.Windows.Media.Animation.RepeatBehavior.Forever;
                storyboard.AutoReverse = true;
                storyboard.Begin();
            }
        }

        // 코드 등록 입력 필드 이벤트 핸들러들
        private void CodeRegistrationBox_TextChanged(object sender, TextChangedEventArgs e)
        {
            if (CodeRegistrationBox.Text == "")
            {
                CodeRegistrationPlaceholder.Visibility = Visibility.Visible;
            }
            else
            {
                CodeRegistrationPlaceholder.Visibility = Visibility.Collapsed;
            }
        }

        private void CodeRegistrationBox_GotFocus(object sender, RoutedEventArgs e)
        {
            // 코드 등록 입력 필드 포커스 이벤트 - 플레이스홀더 숨기기
            CodeRegistrationPlaceholder.Visibility = Visibility.Collapsed;
        }

        private void CodeRegistrationBox_LostFocus(object sender, RoutedEventArgs e)
        {
            // 코드 등록 입력 필드 포커스 해제 이벤트 - 텍스트가 비어있으면 플레이스홀더 표시
            if (CodeRegistrationBox.Text == "")
            {
                CodeRegistrationPlaceholder.Visibility = Visibility.Visible;
            }
            else
            {
                CodeRegistrationPlaceholder.Visibility = Visibility.Collapsed;
            }
        }

        private void CodeRegistrationBox_MouseLeftButtonDown(object sender, MouseButtonEventArgs e)
        {
            // 코드 등록 입력 필드 마우스 클릭 이벤트 - 플레이스홀더 숨기기
            CodeRegistrationPlaceholder.Visibility = Visibility.Collapsed;
        }

        private void CodeRegistrationBox_PreviewMouseLeftButtonDown(object sender, MouseButtonEventArgs e)
        {
            // 코드 등록 입력 필드 마우스 클릭 미리보기 이벤트
        }

    }
}