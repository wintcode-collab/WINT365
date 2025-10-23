using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Input;
using System.Windows.Media;

namespace GridstudioLoginApp
{
    public partial class MainAppWindow : Window
    {
        private TelegramAuthService _telegramAuthService = new TelegramAuthService();
        private FirebaseService _firebaseService;
        private string _userEmail;
        
        // 등록 중인 계정 정보 임시 저장
        private string _pendingApiId;
        private string _pendingApiHash;
        private string _pendingPhone;
        
        // 선택된 계정 목록
        private List<TelegramAccountInfo> _selectedAccounts = new List<TelegramAccountInfo>();
        
        public MainAppWindow()
        {
            InitializeComponent();
            SetupWindow();
            InitializeServices();
            // 시작 시 홈 화면 표시
            ShowHomeContent();
            SetupRegisterTextBoxEvents();
        }
        
        public MainAppWindow(string userEmail) : this()
        {
            _userEmail = userEmail;
        }

        private void InitializeServices()
        {
            _firebaseService = new FirebaseService();
        }
        
        
        

        private void SetupWindow()
        {
            // 창 드래그 가능하게 만들기
            this.MouseDown += (sender, e) =>
            {
                if (e.LeftButton == MouseButtonState.Pressed)
                {
                    this.DragMove();
                }
            };

            // Ctrl+L 로그아웃
            this.KeyDown += (sender, e) =>
            {
                if (e.Key == Key.L && Keyboard.Modifiers == ModifierKeys.Control)
                {
                    LogoutButton_Click(sender, e);
                }
            };

            // 창이 처음 로드될 때 활성화 상태로 설정
            this.Loaded += (sender, e) =>
            {
                this.Activate();
            };
        }

        private void MinimizeButton_Click(object sender, RoutedEventArgs e)
        {
            // 창 최소화
            this.WindowState = WindowState.Minimized;
        }

        private void CloseButton_Click(object sender, RoutedEventArgs e)
        {
            // 창 닫기
            this.Close();
        }

        private void LogoutButton_Click(object sender, RoutedEventArgs e)
        {
            // 로그아웃 확인
            MessageBoxResult result = MessageBox.Show(
                "Are you sure you want to logout?", 
                "Logout Confirmation", 
                MessageBoxButton.YesNo, 
                MessageBoxImage.Question);

            if (result == MessageBoxResult.Yes)
            {
                // 로그인 창으로 돌아가기
                MainWindow loginWindow = new MainWindow();
                loginWindow.Show();
                this.Close();
            }
        }



        private void TelegramButton_Click(object sender, RoutedEventArgs e)
        {
            try
            {
                System.Diagnostics.Process.Start(new System.Diagnostics.ProcessStartInfo
                {
                    FileName = "http://t.me/WINT365",
                    UseShellExecute = true
                });
            }
            catch (Exception ex)
            {
                MessageBox.Show($"텔레그램 링크를 열 수 없습니다: {ex.Message}", "오류", MessageBoxButton.OK, MessageBoxImage.Error);
            }
        }

        private void SetHomeButtonActive()
        {
            // 홈버튼을 활성화 상태로 설정 (불빛 들어옴)
            if (HomeButton != null)
            {
                HomeButton.Tag = "Active";
            }
        }

        private void ShowHomeContent()
        {
            // 홈 콘텐츠 표시
            HomeContent.Visibility = Visibility.Visible;
            RegisterContent.Visibility = Visibility.Collapsed;
            LoadContent.Visibility = Visibility.Collapsed;
            HeaderLoadContent.Visibility = Visibility.Collapsed;
            SetHomeButtonActive();
            UpdateHeaderUnderline(false, false);
        }

        private void ShowRegisterContent()
        {
            // 등록하기 콘텐츠 표시
            HomeContent.Visibility = Visibility.Collapsed;
            RegisterContent.Visibility = Visibility.Visible;
            LoadContent.Visibility = Visibility.Collapsed;
            HeaderLoadContent.Visibility = Visibility.Collapsed;
            
            // RegisterMainPanel은 보이고 RegisterFormPanel은 숨김
            if (RegisterMainPanel != null && RegisterFormPanel != null)
            {
                RegisterMainPanel.Visibility = Visibility.Visible;
                RegisterFormPanel.Visibility = Visibility.Collapsed;
            }
            
            // 입력 필드 초기화
            ResetRegisterForm();
            
            // 홈버튼 비활성화
            if (HomeButton != null)
            {
                HomeButton.Tag = "";
            }
            UpdateHeaderUnderline(true, false);
        }
        
        private void ResetRegisterForm()
        {
            // 입력 필드 초기화
            if (RegisterApiIdTextBox != null)
            {
                RegisterApiIdTextBox.Text = "Your API ID";
                RegisterApiIdTextBox.IsEnabled = true;
            }
            if (RegisterApiHashTextBox != null)
            {
                RegisterApiHashTextBox.Text = "Your API Hash";
                RegisterApiHashTextBox.IsEnabled = true;
            }
            if (RegisterPhoneNumberTextBox != null)
            {
                RegisterPhoneNumberTextBox.Text = "01012345678";
                RegisterPhoneNumberTextBox.IsEnabled = true;
            }
            if (VerificationCodeTextBox != null)
            {
                VerificationCodeTextBox.Text = "Enter verification code";
                VerificationCodeTextBox.IsEnabled = true;
            }
            if (TwoFactorPasswordBox != null)
            {
                TwoFactorPasswordBox.Clear();
                TwoFactorPasswordBox.IsEnabled = true;
            }
            
            // 패널 Visibility 초기화
            if (RegisterInputPanel != null) RegisterInputPanel.Visibility = Visibility.Visible;
            if (VerificationCodePanel != null) VerificationCodePanel.Visibility = Visibility.Collapsed;
            if (VerifyCodeButton != null) VerifyCodeButton.Visibility = Visibility.Collapsed;
            if (TwoFactorPasswordPanel != null) TwoFactorPasswordPanel.Visibility = Visibility.Collapsed;
            if (VerifyPasswordButton != null) VerifyPasswordButton.Visibility = Visibility.Collapsed;
            if (MessageDisplayBorder != null) MessageDisplayBorder.Visibility = Visibility.Collapsed;
            
            // 버튼 텍스트 및 활성화 상태 초기화
            if (RegisterTelegramButton != null)
            {
                RegisterTelegramButton.Content = "Register Telegram Account";
                RegisterTelegramButton.IsEnabled = true;
            }
            if (VerifyCodeButton != null)
            {
                VerifyCodeButton.Content = "Verify Code";
                VerifyCodeButton.IsEnabled = true;
            }
            if (VerifyPasswordButton != null)
            {
                VerifyPasswordButton.Content = "Verify Password";
                VerifyPasswordButton.IsEnabled = true;
            }
        }
        
        private void UpdateHeaderUnderline(bool isRegisterActive, bool isLoadActive = false)
        {
            // 계정 등록 버튼 상태 변경
            if (HeaderRegisterText != null && HeaderRegisterUnderline != null)
            {
                if (isRegisterActive)
                {
                    // 선택 상태: 텍스트는 흰색, 구분선은 노란색(골드)
                    HeaderRegisterText.Foreground = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#FFFFFF"));
                    HeaderRegisterUnderline.Background = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#FFD700"));
                }
                else
                {
                    // 비선택 상태: 구분선 투명, 텍스트는 회색
                    HeaderRegisterText.Foreground = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#888888"));
                    HeaderRegisterUnderline.Background = new SolidColorBrush(Colors.Transparent);
                }
            }
            
            // 불러오기 버튼 상태 변경
            if (HeaderLoadText != null && HeaderLoadUnderline != null)
            {
                if (isLoadActive)
                {
                    // 선택 상태: 텍스트는 흰색, 구분선은 노란색(골드)
                    HeaderLoadText.Foreground = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#FFFFFF"));
                    HeaderLoadUnderline.Background = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#FFD700"));
                }
                else
                {
                    // 비선택 상태: 구분선 투명, 텍스트는 회색
                    HeaderLoadText.Foreground = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#888888"));
                    HeaderLoadUnderline.Background = new SolidColorBrush(Colors.Transparent);
                }
            }
        }

        private void HomeButton_Click(object sender, RoutedEventArgs e)
        {
            // 홈 버튼 클릭 시 홈 콘텐츠로 돌아가기
            ShowHomeContent();
        }

        private void RegisterButton_Click(object sender, RoutedEventArgs e)
        {
            // 등록하기 버튼 클릭 시 입력 폼 표시
            if (RegisterMainPanel != null && RegisterFormPanel != null)
            {
                RegisterMainPanel.Visibility = Visibility.Collapsed;
                RegisterFormPanel.Visibility = Visibility.Visible;
                
                // 입력 필드 초기화
                ResetRegisterForm();
            }
        }
        
        private void HeaderRegisterButton_Click(object sender, RoutedEventArgs e)
        {
            // 헤더의 "계정 등록" 버튼 클릭 시
            ShowRegisterContent();
        }

        private void HeaderLoadButton_Click(object sender, RoutedEventArgs e)
        {
            // 헤더의 "불러오기" 버튼 클릭 시 (별도 화면)
            HomeContent.Visibility = Visibility.Collapsed;
            RegisterContent.Visibility = Visibility.Collapsed;
            LoadContent.Visibility = Visibility.Collapsed;
            HeaderLoadContent.Visibility = Visibility.Visible;
            
            // 헤더 구분선 업데이트 (불러오기 선택)
            UpdateHeaderUnderline(false, true);
        }

        private async void LoadButton_Click(object sender, RoutedEventArgs e)
        {
            // 계정 등록 화면의 불러오기 버튼 클릭 시 (헤더와 독립적)
            HomeContent.Visibility = Visibility.Collapsed;
            RegisterContent.Visibility = Visibility.Collapsed;
            HeaderLoadContent.Visibility = Visibility.Collapsed;
            
            // 불러오기 화면 표시 (계정 목록)
            LoadContent.Visibility = Visibility.Visible;
            
            // 헤더 구분선은 업데이트하지 않음 (독립적 동작)
            
            // 계정 목록 불러오기
            await LoadAccountsAsync();
        }
        
        private async Task LoadAccountsAsync()
        {
            try
            {
                // 로딩 표시
                LoadingText.Visibility = Visibility.Visible;
                AccountListBorder.Visibility = Visibility.Collapsed;
                SelectedCountText.Visibility = Visibility.Collapsed;
                ConfirmLoadButton.Visibility = Visibility.Collapsed;
                
                // Firebase에서 계정 목록 가져오기
                var accounts = await _firebaseService.GetTelegramAccountsAsync(_userEmail);
                
                if (accounts == null || accounts.Count == 0)
                {
                    LoadingText.Text = "등록된 계정이 없습니다.\n\n'등록하기'에서 계정을 먼저 등록해주세요.";
                    return;
                }
                
                // 계정 목록을 ListBox에 바인딩
                var accountList = new System.Collections.ObjectModel.ObservableCollection<TelegramAccountInfo>();
                
                LoadingText.Text = $"계정 정보를 불러오는 중... (0/{accounts.Count})";
                
                int processedCount = 0;
                var tempList = new List<TelegramAccountInfo>();
                
                foreach (var account in accounts)
                {
                    try
                    {
                        var phoneNumber = account.phone?.ToString() ?? "알 수 없음";
                        var createdAtString = account.createdAt?.ToString() ?? DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss");
                        var apiId = account.apiId?.ToString() ?? "";
                        var apiHash = account.apiHash?.ToString() ?? "";
                        var sessionData = account.sessionData?.ToString() ?? "";
                        
                        // Firebase에 저장된 계정 이름 가져오기 (등록 시점에 저장됨)
                        string accountName = account.accountName?.ToString() ?? phoneNumber;
                        if (string.IsNullOrEmpty(accountName) || accountName == "Unknown User")
                        {
                            accountName = phoneNumber; // 계정 이름이 없으면 전화번호 사용
                        }
                        
                        processedCount++;
                        LoadingText.Text = $"계정 정보를 불러오는 중... ({processedCount}/{accounts.Count})";
                        
                        // DateTime 파싱 시도
                        DateTime createdAtDateTime;
                        if (!DateTime.TryParse(createdAtString, out createdAtDateTime))
                        {
                            createdAtDateTime = DateTime.Now;
                        }
                        
                        tempList.Add(new TelegramAccountInfo
                        {
                            AccountName = accountName,
                            PhoneNumber = phoneNumber,
                            CreatedAt = $"등록일: {createdAtString}",
                            CreatedAtDateTime = createdAtDateTime,
                            ApiId = apiId,
                            ApiHash = apiHash,
                            SessionData = sessionData
                        });
                    }
                    catch (Exception ex)
                    {
                        System.Diagnostics.Debug.WriteLine($"계정 파싱 오류: {ex.Message}");
                    }
                }
                
                // 등록일 기준 내림차순 정렬 (최신 등록이 맨 위)
                var sortedList = tempList.OrderByDescending(x => x.CreatedAtDateTime).ToList();
                
                // ObservableCollection에 정렬된 항목 추가
                foreach (var item in sortedList)
                {
                    accountList.Add(item);
                }
                
                AccountListBox.ItemsSource = accountList;
                
                // 선택 변경 이벤트 핸들러 추가
                AccountListBox.SelectionChanged += (s, e) =>
                {
                    int selectedCount = AccountListBox.SelectedItems.Count;
                    SelectedCountText.Text = $"선택된 계정: {selectedCount}개";
                    
                    if (selectedCount > 0)
                    {
                        ConfirmLoadButton.Visibility = Visibility.Visible;
                    }
                    else
                    {
                        ConfirmLoadButton.Visibility = Visibility.Collapsed;
                    }
                };
                
                // 로딩 숨기고 계정 목록 표시
                LoadingText.Visibility = Visibility.Collapsed;
                AccountListBorder.Visibility = Visibility.Visible;
                SelectedCountText.Visibility = Visibility.Visible;
                
                System.Diagnostics.Debug.WriteLine($"✅ {accountList.Count}개의 계정을 불러왔습니다.");
            }
            catch (Exception ex)
            {
                LoadingText.Text = $"계정 불러오기 실패:\n{ex.Message}";
                System.Diagnostics.Debug.WriteLine($"❌ LoadAccountsAsync 오류: {ex.Message}");
            }
        }
        
        private void BackToHomeButton_Click(object sender, RoutedEventArgs e)
        {
            // 계정 등록 메인 화면으로 돌아가기
            ShowRegisterContent();
        }
        
        private void ConfirmLoadButton_Click(object sender, RoutedEventArgs e)
        {
            var selectedAccounts = AccountListBox.SelectedItems.Cast<TelegramAccountInfo>().ToList();
            
            if (selectedAccounts.Count == 0)
            {
                System.Windows.MessageBox.Show("계정을 선택해주세요.", "알림", MessageBoxButton.OK, MessageBoxImage.Information);
                return;
            }
            
            // 선택된 계정 저장
            _selectedAccounts = selectedAccounts;
            
            System.Diagnostics.Debug.WriteLine($"✅ {selectedAccounts.Count}개 계정 선택 완료");
            foreach (var account in selectedAccounts)
            {
                System.Diagnostics.Debug.WriteLine($"  - {account.AccountName} ({account.PhoneNumber}, API ID: {account.ApiId})");
            }
            
            // 계정 개수 텍스트 업데이트
            if (SelectedAccountCountText != null)
            {
                SelectedAccountCountText.Text = $"총 등록된 계정: {_selectedAccounts.Count}개";
            }
            
            // 계정 설정 탭으로 이동
            HomeContent.Visibility = Visibility.Collapsed;
            RegisterContent.Visibility = Visibility.Collapsed;
            LoadContent.Visibility = Visibility.Collapsed;
            HeaderLoadContent.Visibility = Visibility.Visible;
            
            // 헤더 구분선 업데이트 (계정 설정 선택)
            UpdateHeaderUnderline(false, true);
        }
        
        private void GroupSettingButton_Click(object sender, RoutedEventArgs e)
        {
            // 전송 그룹 설정 기능 구현 예정
        }
        
        private void MessageSettingButton_Click(object sender, RoutedEventArgs e)
        {
            // 전송 메시지 설정 기능 구현 예정
        }
        
        private void SendMethodSettingButton_Click(object sender, RoutedEventArgs e)
        {
            // 전송 방식 설정 기능 구현 예정
        }

        private async void RegisterTelegramButton_Click(object sender, RoutedEventArgs e)
        {
            System.Diagnostics.Debug.WriteLine("🔍 RegisterTelegramButton_Click 시작");
            
            // WTelegramClient 테스트 먼저 실행
            await TestTelegram.TestWTelegramClient();
            
            string apiId = RegisterApiIdTextBox.Text.Trim();
            string apiHash = RegisterApiHashTextBox.Text.Trim();
            string phoneNumber = RegisterPhoneNumberTextBox.Text.Trim();
            
            // 등록 정보 임시 저장
            _pendingApiId = apiId;
            _pendingApiHash = apiHash;
            _pendingPhone = phoneNumber;
            
            System.Diagnostics.Debug.WriteLine($"🔍 입력값: API ID={apiId}, API Hash={apiHash}, Phone={phoneNumber}");

            // 플레이스홀더 텍스트 제거
            if (apiId == "Your API ID") apiId = "";
            if (apiHash == "Your API Hash") apiHash = "";
            if (phoneNumber == "01012345678") phoneNumber = "";

            if (string.IsNullOrEmpty(apiId) || string.IsNullOrEmpty(apiHash) || string.IsNullOrEmpty(phoneNumber))
            {
                ShowMessage("⚠️ 모든 필드를 입력해주세요.", true);
                return;
            }

            // API ID가 숫자인지 확인
            if (!int.TryParse(apiId, out int apiIdInt))
            {
                ShowMessage("⚠️ API ID는 숫자여야 합니다.", true);
                return;
            }

            // API Hash 길이 확인 (일반적으로 32자리)
            if (apiHash.Length < 20)
            {
                ShowMessage("⚠️ API Hash가 올바르지 않습니다.\n\nmy.telegram.org에서 발급받은 정확한 API Hash를 입력해주세요.", true);
                return;
            }

            // 전화번호 길이 확인 (최소 10자리)
            if (phoneNumber.Length < 10)
            {
                ShowMessage("⚠️ 전화번호가 너무 짧습니다.\n\n(예: 01012345678 또는 +821012345678)", true);
                return;
            }

            // 중복 계정 확인
            bool isAlreadyRegistered = await _firebaseService.IsPhoneNumberAlreadyRegistered(_userEmail, phoneNumber);
            if (isAlreadyRegistered)
            {
                ShowMessage($"⚠️ 이미 등록된 전화번호입니다.\n\n전화번호: {phoneNumber}\n\n다른 전화번호를 사용해주세요.", true);
                return;
            }

            RegisterTelegramButton.IsEnabled = false;
            RegisterTelegramButton.Content = "Processing...";

            try
            {
                System.Diagnostics.Debug.WriteLine("🔍 TelegramAuthService 초기화 시작");
                
                // 새로운 TelegramAuthService 인스턴스 생성
                _telegramAuthService = new TelegramAuthService();
                
                System.Diagnostics.Debug.WriteLine("🔍 TelegramAuthService 초기화 완료");
                
                // 상태 변경 이벤트 핸들러 추가 (메시지 표시 제거)
                _telegramAuthService.OnStatusChanged += (sender, status) =>
                {
                    // 디버그 출력만 사용
                    System.Diagnostics.Debug.WriteLine($"🔍 TelegramAuthService 상태: {status}");
                };
                
                // API ID와 Hash로 초기화
                System.Diagnostics.Debug.WriteLine("🔍 InitializeAsync 호출 시작");
                bool initialized = await _telegramAuthService.InitializeAsync(apiId, apiHash);
                System.Diagnostics.Debug.WriteLine($"🔍 InitializeAsync 결과: {initialized}");
                
                if (initialized)
                {
                    // 인증 코드 전송
                    System.Diagnostics.Debug.WriteLine("🔍 SendCodeAsync 호출 시작");
                    bool codeSent = await _telegramAuthService.SendCodeAsync(phoneNumber);
                    System.Diagnostics.Debug.WriteLine($"🔍 SendCodeAsync 결과: {codeSent}");
                    
                    // 버튼 상태 복원
                    RegisterTelegramButton.IsEnabled = true;
                    RegisterTelegramButton.Content = "Register Telegram Account";
                    
                    if (codeSent)
                    {
                        // 초기 입력 필드들 숨기기 (API ID, Hash, Phone)
                        RegisterInputPanel.Visibility = Visibility.Collapsed;

                        // 인증 코드 입력 필드와 버튼 표시
                        VerificationCodePanel.Visibility = Visibility.Visible;
                        VerifyCodeButton.Visibility = Visibility.Visible;
                    }
                    else
                    {
                        // 더 자세한 오류 메시지는 TelegramAuthService에서 이미 처리됨
                        // 여기서는 간단한 안내만 표시
                        ShowMessage("❌ 인증 코드 전송에 실패했습니다.\n\n위의 상태 메시지를 확인하여 문제를 해결해주세요.", true);
                    }
                }
                else
                {
                    ShowMessage("❌ 텔레그램 초기화에 실패했습니다.\n\nAPI ID와 Hash를 확인해주세요.", true);
                }
            }
            catch (Exception ex)
            {
                string errorMessage = $"❌ 등록 중 오류가 발생했습니다:\n\n{ex.Message}";
                if (ex.InnerException != null)
                {
                    errorMessage += $"\n\n상세 오류: {ex.InnerException.Message}";
                }
                ShowMessage(errorMessage, true);
            }
            finally
            {
                RegisterTelegramButton.IsEnabled = true;
                RegisterTelegramButton.Content = "Register Telegram Account";
            }
        }

        private void SetupRegisterTextBoxEvents()
        {
            // API ID 입력창
            RegisterApiIdTextBox.GotFocus += (sender, e) =>
            {
                if (RegisterApiIdTextBox.Text == "Your API ID")
                {
                    RegisterApiIdTextBox.Text = "";
                }
            };
            
            RegisterApiIdTextBox.LostFocus += (sender, e) =>
            {
                if (string.IsNullOrWhiteSpace(RegisterApiIdTextBox.Text))
                {
                    RegisterApiIdTextBox.Text = "Your API ID";
                }
            };
            
            // API Hash 입력창
            RegisterApiHashTextBox.GotFocus += (sender, e) =>
            {
                if (RegisterApiHashTextBox.Text == "Your API Hash")
                {
                    RegisterApiHashTextBox.Text = "";
                }
            };
            
            RegisterApiHashTextBox.LostFocus += (sender, e) =>
            {
                if (string.IsNullOrWhiteSpace(RegisterApiHashTextBox.Text))
                {
                    RegisterApiHashTextBox.Text = "Your API Hash";
                }
            };
            
            // 전화번호 입력창
            RegisterPhoneNumberTextBox.GotFocus += (sender, e) =>
            {
                if (RegisterPhoneNumberTextBox.Text == "01012345678")
                {
                    RegisterPhoneNumberTextBox.Text = "";
                }
            };
            
            RegisterPhoneNumberTextBox.LostFocus += (sender, e) =>
            {
                if (string.IsNullOrWhiteSpace(RegisterPhoneNumberTextBox.Text))
                {
                    RegisterPhoneNumberTextBox.Text = "01012345678";
                }
            };

            // 인증 코드 입력 필드 이벤트
            VerificationCodeTextBox.GotFocus += (sender, e) =>
            {
                if (VerificationCodeTextBox.Text == "Enter verification code")
                {
                    VerificationCodeTextBox.Text = "";
                }
            };

            VerificationCodeTextBox.LostFocus += (sender, e) =>
            {
                if (string.IsNullOrWhiteSpace(VerificationCodeTextBox.Text))
                {
                    VerificationCodeTextBox.Text = "Enter verification code";
                }
            };
        }

        private async void VerifyCodeButton_Click(object sender, RoutedEventArgs e)
        {
            string code = VerificationCodeTextBox.Text.Trim();
            
            // 플레이스홀더 텍스트 제거
            if (code == "Enter verification code")
            {
                code = "";
            }
            
            if (string.IsNullOrEmpty(code))
            {
                ShowMessage("⚠️ 인증 코드를 입력해주세요.", true);
                return;
            }

            // 인증 코드 형식 검증 (숫자만 허용)
            if (!code.All(char.IsDigit))
            {
                ShowMessage("⚠️ 인증 코드는 숫자만 입력해주세요.", true);
                return;
            }

            VerifyCodeButton.IsEnabled = false;
            VerifyCodeButton.Content = "Processing...";

            try
            {
                // 인증 코드 확인
                bool verified = await _telegramAuthService.VerifyCodeAsync(code);
                
                if (verified)
                {
                    // 인증 성공 시 Firebase에 계정 저장
                    
                    try
                    {
                        // 1. 계정 이름 먼저 가져오기 (Client가 필요)
                        string accountName = "Unknown User";
                        try
                        {
                            accountName = await _telegramAuthService._actualWorkingClient.GetCurrentAccountName();
                            System.Diagnostics.Debug.WriteLine($"✅ 계정 이름: {accountName}");
                        }
                        catch (Exception nameEx)
                        {
                            System.Diagnostics.Debug.WriteLine($"⚠️ 계정 이름 가져오기 실패: {nameEx.Message}");
                        }
                        
                        // 2. 세션 파일 경로 저장
                        string sessionPath = _telegramAuthService._actualWorkingClient.GetSessionPath();
                        System.Diagnostics.Debug.WriteLine($"📂 세션 파일 경로: {sessionPath}");
                        
                        // 3. Client Dispose (파일 잠금 해제)
                        System.Diagnostics.Debug.WriteLine($"🔓 WTelegramClient Dispose 시작...");
                        _telegramAuthService._actualWorkingClient.Dispose();
                        System.Diagnostics.Debug.WriteLine($"✅ WTelegramClient Dispose 완료!");
                        
                        // 4. 잠시 대기 (파일 잠금이 완전히 해제될 때까지)
                        await Task.Delay(1000);
                        
                        // 5. 이제 세션 파일 읽기 (Client가 닫혔으므로 파일 잠금 해제됨)
                        string sessionData = "";
                        try
                        {
                            if (System.IO.File.Exists(sessionPath))
                            {
                                byte[] sessionBytes = await System.IO.File.ReadAllBytesAsync(sessionPath);
                                sessionData = Convert.ToBase64String(sessionBytes);
                                System.Diagnostics.Debug.WriteLine($"✅ 세션 데이터 읽기 성공! ({sessionBytes.Length} bytes)");
                                System.Diagnostics.Debug.WriteLine($"📝 세션 데이터 미리보기: {sessionData.Substring(0, Math.Min(100, sessionData.Length))}...");
                }
                else
                {
                                System.Diagnostics.Debug.WriteLine($"⚠️ 세션 파일이 존재하지 않음: {sessionPath}");
                            }
                        }
                        catch (Exception sessionEx)
                        {
                            System.Diagnostics.Debug.WriteLine($"❌ 세션 파일 읽기 실패: {sessionEx.Message}");
                        }
                        
                        // 6. Firebase에 계정 정보 저장
                        bool saveSuccess = await _firebaseService.SaveTelegramAccountAsync(
                            _userEmail,
                            _pendingApiId,
                            _pendingApiHash,
                            _pendingPhone,
                            sessionData,
                            accountName
                        );
                        
                        if (saveSuccess)
                        {
                            // 성공 애니메이션 표시
                            await ShowSuccessAnimation($"✅ 계정이 성공적으로 등록되었습니다!\n\n📱 전화번호: {_pendingPhone}");
                            
                            // 등록 메인 화면으로 돌아가기 (자동으로 입력 필드 초기화됨)
                            ShowRegisterContent();
                            RegisterApiIdTextBox.Text = "Your API ID";
                            RegisterApiHashTextBox.Text = "Your API Hash";
                            RegisterPhoneNumberTextBox.Text = "01012345678";
                        }
                        else
                        {
                            ShowMessage("⚠️ 인증은 성공했지만 계정 저장에 실패했습니다.\n\n다시 등록해주세요.", true);
                        }
                    }
                    catch (Exception saveEx)
                    {
                        ShowMessage($"⚠️ 인증은 성공했지만 저장 중 오류가 발생했습니다:\n{saveEx.Message}", true);
                    }
                }
                else
                {
                    // 2단계 인증이 필요한지 확인
                    if (_telegramAuthService._actualWorkingClient != null && 
                        _telegramAuthService._actualWorkingClient.Needs2FA)
                    {
                        // 인증 코드 입력칸 비활성화
                        VerificationCodeTextBox.IsEnabled = false;
                        VerifyCodeButton.Visibility = Visibility.Collapsed;
                        
                        // 2차 비밀번호 입력칸 표시
                        TwoFactorPasswordPanel.Visibility = Visibility.Visible;
                        VerifyPasswordButton.Visibility = Visibility.Visible;
                    }
                    else
                    {
                        ShowMessage("❌ 인증 코드가 올바르지 않습니다.\n\n다시 시도해주세요.", true);
                    }
                }
            }
            catch (Exception ex)
            {
                string errorMessage = $"❌ 인증 중 오류가 발생했습니다:\n{ex.Message}";
                if (ex.InnerException != null)
                {
                    errorMessage += $"\n\n상세 오류: {ex.InnerException.Message}";
                }
                ShowMessage(errorMessage, true);
            }
            finally
            {
                VerifyCodeButton.IsEnabled = true;
                VerifyCodeButton.Content = "Verify Code";
            }
        }

        private async void VerifyPasswordButton_Click(object sender, RoutedEventArgs e)
        {
            string password = TwoFactorPasswordBox.Password;
            
            if (string.IsNullOrEmpty(password))
            {
                ShowMessage("⚠️ 2단계 인증 비밀번호를 입력해주세요.", true);
                return;
            }

            VerifyPasswordButton.IsEnabled = false;
            VerifyPasswordButton.Content = "Processing...";

            try
            {
                // 2차 비밀번호 확인
                bool verified = await _telegramAuthService.VerifyPasswordAsync(password);
                
                if (verified)
                {
                    // 인증 성공 시 Firebase에 계정 저장
                    
                    try
                    {
                        // 1. 계정 이름 먼저 가져오기 (Client가 필요)
                        string accountName = "Unknown User";
                        try
                        {
                            accountName = await _telegramAuthService._actualWorkingClient.GetCurrentAccountName();
                            System.Diagnostics.Debug.WriteLine($"✅ 계정 이름: {accountName}");
                        }
                        catch (Exception nameEx)
                        {
                            System.Diagnostics.Debug.WriteLine($"⚠️ 계정 이름 가져오기 실패: {nameEx.Message}");
                        }
                        
                        // 2. 세션 파일 경로 저장
                        string sessionPath = _telegramAuthService._actualWorkingClient.GetSessionPath();
                        System.Diagnostics.Debug.WriteLine($"📂 세션 파일 경로: {sessionPath}");
                        
                        // 3. Client Dispose (파일 잠금 해제)
                        System.Diagnostics.Debug.WriteLine($"🔓 WTelegramClient Dispose 시작...");
                        _telegramAuthService._actualWorkingClient.Dispose();
                        System.Diagnostics.Debug.WriteLine($"✅ WTelegramClient Dispose 완료!");
                        
                        // 4. 잠시 대기 (파일 잠금이 완전히 해제될 때까지)
                        await Task.Delay(1000);
                        
                        // 5. 이제 세션 파일 읽기 (Client가 닫혔으므로 파일 잠금 해제됨)
                        string sessionData = "";
                        try
                        {
                            if (System.IO.File.Exists(sessionPath))
                            {
                                byte[] sessionBytes = await System.IO.File.ReadAllBytesAsync(sessionPath);
                                sessionData = Convert.ToBase64String(sessionBytes);
                                System.Diagnostics.Debug.WriteLine($"✅ 세션 데이터 읽기 성공! ({sessionBytes.Length} bytes)");
                                System.Diagnostics.Debug.WriteLine($"📝 세션 데이터 미리보기: {sessionData.Substring(0, Math.Min(100, sessionData.Length))}...");
                        }
                        else
                        {
                                System.Diagnostics.Debug.WriteLine($"⚠️ 세션 파일이 존재하지 않음: {sessionPath}");
                            }
                        }
                        catch (Exception sessionEx)
                        {
                            System.Diagnostics.Debug.WriteLine($"❌ 세션 파일 읽기 실패: {sessionEx.Message}");
                        }
                        
                        // 6. Firebase에 계정 정보 저장
                        bool saveSuccess = await _firebaseService.SaveTelegramAccountAsync(
                            _userEmail,
                            _pendingApiId,
                            _pendingApiHash,
                            _pendingPhone,
                            sessionData,
                            accountName
                        );
                        
                        if (saveSuccess)
                        {
                            // 성공 애니메이션 표시
                            await ShowSuccessAnimation($"✅ 계정이 성공적으로 등록되었습니다!\n\n📱 전화번호: {_pendingPhone}");
                            
                            // 등록 메인 화면으로 돌아가기 (자동으로 입력 필드 초기화됨)
                            ShowRegisterContent();
                            TwoFactorPasswordBox.Clear();
                    RegisterApiIdTextBox.Text = "Your API ID";
                    RegisterApiHashTextBox.Text = "Your API Hash";
                    RegisterPhoneNumberTextBox.Text = "01012345678";
                }
                else
                {
                            ShowMessage("⚠️ 인증은 성공했지만 계정 저장에 실패했습니다.\n\n다시 등록해주세요.", true);
                        }
                    }
                    catch (Exception saveEx)
                    {
                        ShowMessage($"⚠️ 인증은 성공했지만 저장 중 오류가 발생했습니다:\n{saveEx.Message}", true);
                    }
                    }
                    else
                    {
                    ShowMessage("❌ 2단계 인증 비밀번호가 올바르지 않습니다.\n\n다시 시도해주세요.", true);
                }
            }
            catch (Exception ex)
            {
                string errorMessage = $"❌ 2단계 인증 중 오류가 발생했습니다:\n{ex.Message}";
                if (ex.InnerException != null)
                {
                    errorMessage += $"\n\n상세 오류: {ex.InnerException.Message}";
                }
                ShowMessage(errorMessage, true);
            }
            finally
            {
                VerifyPasswordButton.IsEnabled = true;
                VerifyPasswordButton.Content = "Verify Password";
            }
        }

        // 메시지를 창 내부에 표시하는 메서드
        private void ShowMessage(string message, bool isError = true)
        {
            // 메시지 텍스트 설정
            MessageDisplayText.Text = message;
            
            // 에러 메시지인지 성공 메시지인지에 따라 색상 변경
            if (isError)
            {
                MessageDisplayBorder.BorderBrush = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#FF6B6B"));
                MessageDisplayText.Foreground = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#FF6B6B"));
            }
            else
            {
                MessageDisplayBorder.BorderBrush = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#4CAF50"));
                MessageDisplayText.Foreground = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#4CAF50"));
            }
            
            // 메시지 영역 표시
            MessageDisplayBorder.Visibility = Visibility.Visible;
            
            // 창 높이 고정 (동적 조정 제거)
            // AdjustWindowHeightForMessage(message);
        }

        // 메시지 숨기기 메서드
        private void HideMessage()
        {
            MessageDisplayBorder.Visibility = Visibility.Collapsed;
        }

        // 메시지 길이에 따라 창 높이를 동적으로 조정하는 메서드
        private void AdjustWindowHeightForMessage(string message)
        {
            // 기본 창 높이
            double baseHeight = 550;
            
            // 메시지가 없으면 기본 높이로 설정
            if (string.IsNullOrEmpty(message))
            {
                this.Height = baseHeight;
                return;
            }
            
            // 메시지 길이에 따른 추가 높이 계산
            int messageLength = message.Length;
            double additionalHeight = 0;
            
            // 메시지 길이에 따라 추가 높이 계산 (대략적인 계산)
            if (messageLength > 100)
            {
                additionalHeight = 50; // 긴 메시지의 경우 50px 추가
            }
            else if (messageLength > 50)
            {
                additionalHeight = 30; // 중간 길이 메시지의 경우 30px 추가
            }
            else
            {
                additionalHeight = 20; // 짧은 메시지의 경우 20px 추가
            }
            
            // 줄바꿈 개수에 따른 추가 높이 계산
            int lineBreaks = message.Split('\n').Length - 1;
            additionalHeight += lineBreaks * 20; // 각 줄바꿈마다 20px 추가
            
            // 최대 높이 제한 (화면을 벗어나지 않도록)
            double maxHeight = 800;
            double newHeight = Math.Min(baseHeight + additionalHeight, maxHeight);
            
            this.Height = newHeight;
        }

        // 인증 성공 시 새로운 빈 창을 띄우는 메서드
        private void ShowSuccessWindow()
        {
            try
            {
                // 새로운 Success 창 생성 및 표시
                var successWindow = new SuccessWindow();
                successWindow.Show();
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"ShowSuccessWindow 오류: {ex.Message}");
                // 오류 발생 시 기본 메시지 표시
                ShowMessage("✅ 인증이 완료되었습니다!\n\n텔레그램 계정이 성공적으로 등록되었습니다.", false);
            }
        }

        // 성공 애니메이션 표시 메서드
        private async Task ShowSuccessAnimation(string message)
        {
            try
            {
                // SuccessMessageBox 생성 및 표시
                var successBox = new SuccessMessageBox(message);
                successBox.Owner = this;
                successBox.ShowDialog();
                
                // ShowDialog()가 끝나면 (3초 후 자동으로 닫힘) 바로 다음 작업 진행
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"ShowSuccessAnimation 오류: {ex.Message}");
                // 오류 발생 시 기본 MessageBox 표시
                System.Windows.MessageBox.Show(message, "성공", MessageBoxButton.OK, MessageBoxImage.Information);
            }
        }

        // 엔터키로 버튼 클릭 지원
        private void Window_KeyDown(object sender, KeyEventArgs e)
        {
            if (e.Key == Key.Enter)
            {
                // HomeContent가 보이면
                if (HomeContent.Visibility == Visibility.Visible)
                {
                    // 기본적으로 아무것도 하지 않음 (홈 화면)
                    return;
                }
                
                // RegisterContent가 보이면
                if (RegisterContent.Visibility == Visibility.Visible)
                {
                    // RegisterInputPanel이 보이면 Register 버튼 클릭
                    if (RegisterInputPanel.Visibility == Visibility.Visible && RegisterTelegramButton.IsEnabled)
                    {
                        RegisterTelegramButton_Click(RegisterTelegramButton, new RoutedEventArgs());
                    }
                    // VerificationCodePanel이 보이고 VerifyCodeButton이 보이면
                    else if (VerificationCodePanel.Visibility == Visibility.Visible && 
                             VerifyCodeButton.Visibility == Visibility.Visible && 
                             VerifyCodeButton.IsEnabled)
                    {
                        VerifyCodeButton_Click(VerifyCodeButton, new RoutedEventArgs());
                    }
                    // TwoFactorPasswordPanel이 보이고 VerifyPasswordButton이 보이면
                    else if (TwoFactorPasswordPanel.Visibility == Visibility.Visible && 
                             VerifyPasswordButton.Visibility == Visibility.Visible && 
                             VerifyPasswordButton.IsEnabled)
                    {
                        VerifyPasswordButton_Click(VerifyPasswordButton, new RoutedEventArgs());
                    }
                }
                
                // LoadContent는 현재 비어있음 (추후 구현 예정)
                
                e.Handled = true; // 이벤트 처리 완료
            }
        }

    }
    
    // 계정 정보 클래스
    public class TelegramAccountInfo
    {
        public string AccountName { get; set; }  // 텔레그램 실제 계정 이름
        public string PhoneNumber { get; set; }
        public string CreatedAt { get; set; }
        public DateTime CreatedAtDateTime { get; set; }  // 정렬용 DateTime
        public string ApiId { get; set; }
        public string ApiHash { get; set; }
        public string SessionData { get; set; }
    }
}


