from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import os
import json
import time
from datetime import datetime
import asyncio
import logging
import threading
import concurrent.futures
import tempfile
import io
import base64
import requests

# Telegram 라이브러리
try:
    from telethon import TelegramClient
    from telethon.errors import SessionPasswordNeededError, PhoneCodeInvalidError, PhoneCodeExpiredError
    print('Telethon 모듈 로드 성공')
except ImportError as e:
    print(f'Telethon 모듈 로드 실패: {e}')
    TelegramClient = None

app = Flask(__name__)
CORS(app)

# 로깅 설정
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# 텔레그램 클라이언트 저장소
clients = {}

# Firebase 설정
FIREBASE_URL = "https://wint365-date-default-rtdb.asia-southeast1.firebasedatabase.app"

# Firebase 세션 관리 함수
def save_session_to_firebase(client_id, session_b64, phone_code_hash, api_id, api_hash, phone_number):
    """Firebase에 텔레그램 세션 데이터 저장"""
    try:
        # 이미 Base64로 인코딩된 세션 데이터 사용
        
        session_info = {
            'clientId': client_id,
            'sessionData': session_b64,
            'phoneCodeHash': phone_code_hash,
            'apiId': api_id,
            'apiHash': api_hash,
            'phoneNumber': phone_number,
            'createdAt': datetime.now().isoformat(),
            'expiresAt': datetime.fromtimestamp(time.time() + 24 * 60 * 60).isoformat(),  # 24시간 후 만료
            'ip': 'Server'
        }
        
        url = f"{FIREBASE_URL}/telegram_sessions/{client_id}.json"
        response = requests.put(url, json=session_info, timeout=10)
        
        if response.status_code == 200:
            logger.info(f'🔥 Firebase 세션 저장 성공: {client_id}')
            return True
        else:
            logger.error(f'🔥 Firebase 세션 저장 실패: {response.status_code}')
            return False
            
    except Exception as e:
        logger.error(f'🔥 Firebase 세션 저장 에러: {e}')
        return False

def get_session_from_firebase(client_id):
    """Firebase에서 텔레그램 세션 데이터 조회"""
    try:
        url = f"{FIREBASE_URL}/telegram_sessions/{client_id}.json"
        response = requests.get(url, timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            if data:
                # 만료 시간 확인
                expires_at = datetime.fromisoformat(data['expiresAt'].replace('Z', '+00:00'))
                if datetime.now(expires_at.tzinfo) > expires_at:
                    logger.info(f'🔥 Firebase 세션 만료됨: {client_id}')
                    delete_session_from_firebase(client_id)
                    return None
                
                logger.info(f'🔥 Firebase 세션 조회 성공: {client_id}')
                return data
            else:
                logger.info(f'🔥 Firebase 세션 없음: {client_id}')
                return None
        else:
            logger.error(f'🔥 Firebase 세션 조회 실패: {response.status_code}')
            return None
            
    except Exception as e:
        logger.error(f'🔥 Firebase 세션 조회 에러: {e}')
        return None

def delete_session_from_firebase(client_id):
    """Firebase에서 텔레그램 세션 데이터 삭제"""
    try:
        url = f"{FIREBASE_URL}/telegram_sessions/{client_id}.json"
        response = requests.delete(url, timeout=10)
        
        if response.status_code == 200:
            logger.info(f'🔥 Firebase 세션 삭제 성공: {client_id}')
            return True
        else:
            logger.error(f'🔥 Firebase 세션 삭제 실패: {response.status_code}')
            return False
            
    except Exception as e:
        logger.error(f'🔥 Firebase 세션 삭제 에러: {e}')
        return False

def save_account_to_firebase(account_info):
    """Firebase에 인증된 계정 정보 저장"""
    try:
        logger.info(f'🔥 Firebase 계정 정보 저장 시작: {account_info["user_id"]}')
        logger.info(f'🔥 저장할 계정 정보: {account_info}')
        
        url = f"{FIREBASE_URL}/authenticated_accounts/{account_info['user_id']}.json"
        logger.info(f'🔥 Firebase URL: {url}')
        
        response = requests.put(url, json=account_info, timeout=10)
        logger.info(f'🔥 Firebase 응답 상태: {response.status_code}')
        logger.info(f'🔥 Firebase 응답 내용: {response.text}')
        
        if response.status_code == 200:
            logger.info(f'🔥 Firebase 계정 정보 저장 성공: {account_info["user_id"]}')
            return True
        else:
            logger.error(f'🔥 Firebase 계정 정보 저장 실패: {response.status_code}')
            logger.error(f'🔥 Firebase 에러 응답: {response.text}')
            return False
            
    except Exception as e:
        logger.error(f'🔥 Firebase 계정 정보 저장 에러: {e}')
        logger.error(f'🔥 에러 타입: {type(e)}')
        return False

def get_account_from_firebase(user_id):
    """Firebase에서 인증된 계정 정보 조회"""
    try:
        url = f"{FIREBASE_URL}/authenticated_accounts/{user_id}.json"
        response = requests.get(url, timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            if data:
                logger.info(f'🔥 Firebase 계정 정보 조회 성공: {user_id}')
                return data
            else:
                logger.info(f'🔥 Firebase 계정 정보 없음: {user_id}')
                return None
        else:
            logger.error(f'🔥 Firebase 계정 정보 조회 실패: {response.status_code}')
            return None
            
    except Exception as e:
        logger.error(f'🔥 Firebase 계정 정보 조회 에러: {e}')
        return None

def load_telegram_groups_with_session(account_info):
    """세션 데이터를 사용해서 텔레그램 그룹 목록 로드"""
    try:
        logger.info(f'🔍 텔레그램 그룹 로딩 시작: {account_info["user_id"]}')
        
        # 임시 세션 파일 생성
        temp_session_file = f'temp_groups_{account_info["user_id"]}'
        
        # 세션 데이터 복원
        session_b64 = account_info.get('session_data')
        if not session_b64:
            logger.error('❌ 세션 데이터 없음')
            return None
            
        session_bytes = base64.b64decode(session_b64)
        
        # 임시 세션 파일 생성
        with open(f'{temp_session_file}.session', 'wb') as f:
            f.write(session_bytes)
        
        # 클라이언트 생성
        client = TelegramClient(temp_session_file, account_info['api_id'], account_info['api_hash'])
        
        try:
            # 연결
            client.connect()
            logger.info('✅ 텔레그램 연결 성공')
            
            # 그룹 목록 가져오기
            groups = []
            
            # 대화 목록 가져오기 (그룹과 채널만)
            dialogs = client.get_dialogs()
            
            for dialog in dialogs:
                if hasattr(dialog.entity, 'megagroup') or hasattr(dialog.entity, 'broadcast'):
                    group_info = {
                        'id': dialog.entity.id,
                        'title': dialog.entity.title,
                        'type': 'supergroup' if hasattr(dialog.entity, 'megagroup') else 'channel',
                        'member_count': getattr(dialog.entity, 'participants_count', 0),
                        'username': getattr(dialog.entity, 'username', ''),
                        'description': getattr(dialog.entity, 'about', '')
                    }
                    groups.append(group_info)
            
            logger.info(f'✅ {len(groups)}개의 그룹/채널을 찾았습니다.')
            return groups
            
        except Exception as e:
            logger.error(f'❌ 그룹 로딩 실패: {e}')
            return None
            
        finally:
            # 연결 해제 및 임시 파일 정리
            try:
                if client.is_connected():
                    client.disconnect()
            except:
                pass
                
            try:
                os.remove(f'{temp_session_file}.session')
            except:
                pass
            
    except Exception as e:
        logger.error(f'❌ 그룹 로딩 에러: {e}')
        return None

def get_all_accounts_from_firebase():
    """Firebase에서 모든 인증된 계정 목록 조회"""
    try:
        url = f"{FIREBASE_URL}/authenticated_accounts.json"
        response = requests.get(url, timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            if data:
                accounts = []
                for user_id, account_info in data.items():
                    if account_info:  # None이 아닌 경우만
                        accounts.append({
                            'user_id': user_id,
                            'first_name': account_info.get('first_name', ''),
                            'last_name': account_info.get('last_name', ''),
                            'username': account_info.get('username', ''),
                            'phone_number': account_info.get('phone_number', ''),
                            'authenticated_at': account_info.get('authenticated_at', '')
                        })
                logger.info(f'🔥 Firebase 계정 목록 조회 성공: {len(accounts)}개 계정')
                return accounts
            else:
                logger.info('🔥 Firebase에 저장된 계정이 없습니다.')
                return []
        else:
            logger.error(f'🔥 Firebase 계정 목록 조회 실패: {response.status_code}')
            return []
            
    except Exception as e:
        logger.error(f'🔥 Firebase 계정 목록 조회 에러: {e}')
        return []

def test_telegram_connection(account_info):
    """텔레그램 연결 테스트 (그룹 로딩 전)"""
    try:
        logger.info(f'🔍 텔레그램 연결 테스트 시작: {account_info["user_id"]}')
        
        # 세션 데이터 복원
        session_b64 = account_info.get('session_data')
        if not session_b64:
            logger.error('❌ 세션 데이터 없음')
            return False
            
        session_bytes = base64.b64decode(session_b64)
        temp_session_file = f'temp_test_{account_info["user_id"]}'
        
        # 임시 세션 파일 생성
        with open(f'{temp_session_file}.session', 'wb') as f:
            f.write(session_bytes)
        
        # 비동기 연결 테스트 함수
        async def test_connection_async():
            try:
                # 클라이언트 생성 및 연결 테스트
                client = TelegramClient(temp_session_file, account_info['api_id'], account_info['api_hash'])
                
                # 연결 테스트
                await client.connect()
                
                if client.is_connected():
                    # 간단한 API 호출 테스트
                    me = await client.get_me()
                    logger.info(f'✅ 연결 테스트 성공: {me.first_name}')
                    await client.disconnect()
                    return True
                else:
                    logger.error('❌ 연결 테스트 실패')
                    await client.disconnect()
                    return False
                    
            except Exception as e:
                logger.error(f'❌ 연결 테스트 에러: {e}')
                try:
                    await client.disconnect()
                except:
                    pass
                return False
        
        # 새 이벤트 루프에서 실행
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        
        try:
            result = loop.run_until_complete(test_connection_async())
            return result
        finally:
            loop.close()
            
            # 임시 파일 정리
            try:
                os.remove(f'{temp_session_file}.session')
            except:
                pass
            
    except Exception as e:
        logger.error(f'❌ 연결 테스트 에러: {e}')
        
        # 임시 파일 정리
        try:
            os.remove(f'{temp_session_file}.session')
        except:
            pass
            
        return False

# 동기 방식으로 처리하므로 run_async 함수 불필요

# 정적 파일 서빙
@app.route('/')
def index():
    return send_from_directory('.', 'index.html')

@app.route('/<path:filename>')
def static_files(filename):
    return send_from_directory('.', filename)

# 서버 상태 확인 엔드포인트
@app.route('/status')
def status():
    return jsonify({
        'status': 'running',
        'server': 'Flask (Python)',
        'timestamp': datetime.now().isoformat(),
        'telethon_loaded': TelegramClient is not None,
        'endpoints': [
            'GET /',
            'POST /api/telegram/send-code',
            'POST /api/telegram/verify-code',
            'GET /health',
            'GET /ping',
            'GET /status'
        ]
    })

# 인증코드 발송 엔드포인트
@app.route('/api/telegram/send-code', methods=['POST'])
def send_code():
    try:
        data = request.get_json()
        api_id = data.get('apiId')
        api_hash = data.get('apiHash')
        phone_number = data.get('phoneNumber')
        
        # 입력 검증
        logger.info(f'📋 입력 검증 시작: api_id={api_id}, api_hash={"***" if api_hash else "None"}, phone_number={phone_number}')
        
        if not all([api_id, api_hash, phone_number]):
            logger.error('❌ 필수 필드 누락')
            return jsonify({
                'success': False,
                'error': 'API ID, API Hash, Phone Number가 모두 필요합니다.'
            }), 400
        
        try:
            api_id = int(api_id)
        except ValueError:
            return jsonify({
                'success': False,
                'error': 'API ID는 숫자여야 합니다.'
            }), 400
        
        if not phone_number.startswith('+'):
            return jsonify({
                'success': False,
                'error': '전화번호는 +로 시작해야 합니다.'
            }), 400
        
        # Telethon 모듈 로드 확인
        if not TelegramClient:
            logger.error('❌ Telethon 모듈이 로드되지 않았습니다.')
            return jsonify({
                'success': False,
                'error': 'Telethon 모듈 로드 실패 - 서버를 재시작해주세요'
            }), 500
        
        # 실제 Telegram MTProto API 호출
        try:
            logger.info('🔍 MTProto API 호출 시작...')
            logger.info(f'📋 요청 정보: API ID={api_id}, Hash=***{api_hash[-4:]}, Phone={phone_number}')
            logger.info(f'📋 API ID 타입: {type(api_id)}, API Hash 길이: {len(api_hash) if api_hash else 0}')
            
            client_id = str(int(time.time() * 1000))
            logger.info(f'🆔 클라이언트 ID 생성: {client_id}')
            
            # API 자격 증명 검증
            if not api_id or api_id <= 0:
                raise ValueError(f'잘못된 API ID: {api_id}')
            if not api_hash or len(api_hash) != 32:
                raise ValueError(f'잘못된 API Hash 길이: {len(api_hash) if api_hash else 0} (32자리여야 함)')
            if not phone_number or not phone_number.startswith('+'):
                raise ValueError(f'잘못된 전화번호 형식: {phone_number}')
            
            # Telethon을 완전히 새 스레드에서 실행
            def run_telethon_complete():
                # 새로운 이벤트 루프 생성
                loop = asyncio.new_event_loop()
                asyncio.set_event_loop(loop)
                
                async def send_code_async():
                    # Telethon 클라이언트 생성 (임시 파일 세션 사용)
                    logger.info('🔧 Telethon 클라이언트 생성 중...')
                    session_file = f'temp_session_{client_id}'
                    logger.info(f'📁 임시 세션 파일: {session_file}')
                    client = TelegramClient(session_file, api_id, api_hash)
                    logger.info('✅ Telethon 클라이언트 생성 완료')
                
                    try:
                        logger.info('🔌 Telegram 서버 연결 중...')
                        await client.connect()
                        logger.info('✅ Telegram 서버 연결 성공')
                        
                        # 연결 안정화 대기
                        await asyncio.sleep(2)
                        logger.info('⏳ 연결 안정화 대기 완료')
                        
                        # 연결 상태 확인
                        if not client.is_connected():
                            logger.error('❌ 클라이언트 연결 실패')
                            raise Exception('텔레그램 서버 연결에 실패했습니다.')
                        logger.info('✅ 클라이언트 연결 상태 확인 완료')
                        
                        logger.info('📱 인증코드 발송 요청 중...')
                        logger.info(f'📋 전화번호 형식: {phone_number}')
                        logger.info(f'📋 API ID: {api_id}')
                        logger.info(f'📋 API Hash: ***{api_hash[-4:]}')
                        
                        # 텔레그램 앱으로 인증코드 요청 (타임아웃 추가)
                        try:
                            result = await asyncio.wait_for(
                                client.send_code_request(phone_number), 
                                timeout=30.0
                            )
                        except asyncio.TimeoutError:
                            logger.error('❌ 인증코드 요청 타임아웃 (30초)')
                            raise Exception('인증코드 요청이 시간 초과되었습니다. 네트워크 연결을 확인하고 다시 시도해주세요.')
                        logger.info(f'✅ 인증코드 발송 성공: phone_code_hash=***{result.phone_code_hash[-4:]}')
                        logger.info(f'📋 결과 타입: {type(result)}')
                        logger.info(f'📋 결과 속성: {dir(result)}')
                        
                        # Data Center Migration 후 안정화 대기
                        logger.info('⏳ Data Center Migration 안정화 대기 (5초)...')
                        await asyncio.sleep(5)
                        logger.info('✅ Data Center Migration 안정화 완료')
                        
                        # 결과 상세 정보 로깅
                        if hasattr(result, 'phone_code_hash'):
                            logger.info(f'📋 phone_code_hash: {result.phone_code_hash}')
                        if hasattr(result, 'type'):
                            logger.info(f'📋 type: {result.type}')
                        if hasattr(result, 'next_type'):
                            logger.info(f'📋 next_type: {result.next_type}')
                        if hasattr(result, 'timeout'):
                            logger.info(f'📋 timeout: {result.timeout}')
                        
                        # 전체 결과 객체 로깅
                        logger.info(f'📋 전체 결과: {result}')
                        
                        return client, result, session_file
                    finally:
                        # 연결 유지 (세션 보존을 위해)
                        logger.info('🔌 클라이언트 연결 유지 (세션 보존)')
                        # 연결 해제하지 않음 - 인증 시도에서 재사용
                
                try:
                    client, result, session_file = loop.run_until_complete(send_code_async())
                    return client, result, session_file
                finally:
                    loop.close()
            
            # 새 스레드에서 실행
            with concurrent.futures.ThreadPoolExecutor() as executor:
                future = executor.submit(run_telethon_complete)
                client, result, session_file = future.result()
            
            
            # 세션 파일을 읽어서 Firebase에 저장
            # Firebase 저장 일시 비활성화 (인증코드 발송 문제 우선 해결)
            logger.info('🔥 Firebase 저장 일시 비활성화 (인증코드 발송 문제 우선 해결)')
            firebase_saved = False
            
            # 클라이언트 데이터 저장 (원래 클라이언트 포함)
            clients[client_id] = {
                'client': client,  # 원래 클라이언트 저장
                'session_file': session_file,
                'api_id': api_id,
                'api_hash': api_hash,
                'phone_number': phone_number,
                'firebase_saved': firebase_saved
            }
            logger.info('💾 클라이언트 데이터 저장 완료')
            
            # phone_code_hash 업데이트
            clients[client_id]['phone_code_hash'] = result.phone_code_hash
            logger.info('💾 phone_code_hash 업데이트 완료')
            
            return jsonify({
                'success': True,
                'phoneCodeHash': result.phone_code_hash,
                'clientId': client_id,
                'message': '인증코드가 텔레그램 앱으로 발송되었습니다! 텔레그램 앱을 확인하고 5분 이내에 입력해주세요.'
            })
            
        except Exception as api_error:
            logger.error(f'❌ MTProto API 호출 실패: {api_error}')
            logger.error(f'  - 에러 타입: {type(api_error).__name__}')
            logger.error(f'  - 에러 메시지: {str(api_error)}')
            logger.error(f'  - 전화번호: {phone_number}')
            logger.error(f'  - API ID: {api_id}')
            logger.error(f'  - API Hash: ***{api_hash[-4:]}')
            
            # 구체적인 에러 분석
            error_message = f'MTProto API 호출 실패: {str(api_error)}'
            if 'PHONE_NUMBER_INVALID' in str(api_error):
                error_message = '전화번호 형식이 올바르지 않습니다. +82로 시작하는 형식으로 입력해주세요.'
            elif 'API_ID_INVALID' in str(api_error):
                error_message = 'API ID가 올바르지 않습니다. 텔레그램 개발자 계정에서 확인해주세요.'
            elif 'API_HASH_INVALID' in str(api_error):
                error_message = 'API Hash가 올바르지 않습니다. 텔레그램 개발자 계정에서 확인해주세요.'
            elif 'PHONE_NUMBER_BANNED' in str(api_error):
                error_message = '해당 전화번호는 사용할 수 없습니다.'
            elif 'FLOOD_WAIT' in str(api_error):
                # Flood Control 시간 추출
                import re
                wait_time_match = re.search(r'(\d+)', str(api_error))
                if wait_time_match:
                    wait_seconds = int(wait_time_match.group(1))
                    wait_hours = wait_seconds // 3600
                    wait_minutes = (wait_seconds % 3600) // 60
                    wait_remaining_seconds = wait_seconds % 60
                    
                    if wait_hours > 0:
                        error_message = f'🚫 Flood Control: {wait_hours}시간 {wait_minutes}분 후에 다시 시도해주세요. (텔레그램 보안 정책)'
                    else:
                        error_message = f'🚫 Flood Control: {wait_minutes}분 {wait_remaining_seconds}초 후에 다시 시도해주세요.'
                    
                    logger.error(f'🚫 Flood Control 감지: {wait_seconds}초 대기 필요 ({wait_hours}시간 {wait_minutes}분)')
                else:
                    error_message = '🚫 Flood Control: 요청이 너무 많습니다. 잠시 후 다시 시도해주세요.'
                    logger.error('🚫 Flood Control 감지: 대기 시간 불명')
            elif 'NETWORK' in str(api_error):
                error_message = '네트워크 연결에 문제가 있습니다. 인터넷 연결을 확인해주세요.'
            
            return jsonify({
                'success': False,
                'error': error_message,
                'details': {
                    'type': type(api_error).__name__,
                    'message': str(api_error)
                }
            }), 500
        
    except Exception as error:
        logger.error(f'서버 오류: {error}')
        return jsonify({
            'success': False,
            'error': f'서버 오류: {str(error)}'
        }), 500

# 인증코드 검증 엔드포인트
@app.route('/api/telegram/verify-code', methods=['POST'])
def verify_code():
    try:
        data = request.get_json()
        phone_code = data.get('phoneCode')
        client_id = data.get('clientId')
        
        if not phone_code:
            return jsonify({
                'success': False,
                'error': '인증코드가 필요합니다.'
            }), 400
        
        if not client_id or client_id not in clients:
            logger.error(f'❌ 클라이언트 ID를 찾을 수 없음: {client_id}')
            logger.error(f'📋 현재 저장된 클라이언트들: {list(clients.keys())}')
            return jsonify({
                'success': False,
                'error': '클라이언트 데이터를 찾을 수 없습니다. 인증코드를 다시 요청해주세요.'
            }), 400
        
        client_data = clients[client_id]
        logger.info(f'📋 클라이언트 데이터 확인: {client_id}')
        logger.info(f'📋 클라이언트 데이터 키들: {list(client_data.keys())}')
        logger.info(f'📋 phone_code_hash 존재: {bool(client_data.get("phone_code_hash"))}')
        logger.info(f'📋 클라이언트 연결 상태: {client_data.get("client").is_connected() if client_data.get("client") else "N/A"}')
        
        # 실제 Telegram MTProto API로 인증 검증
        try:
            logger.info('🔍 인증코드 검증 시작...')
            logger.info(f'📋 검증 정보: clientId={client_id}, phoneCode={phone_code}')
            
            # 새로운 클라이언트를 생성하여 인증 (asyncio 문제 해결)
            def run_telethon_verify():
                # 새로운 이벤트 루프 생성
                loop = asyncio.new_event_loop()
                asyncio.set_event_loop(loop)
                
                async def verify_code_async():
                    # 세션 파일을 사용하여 클라이언트 생성 (세션 일치 보장)
                    logger.info('🔧 세션 파일로 클라이언트 생성 중...')
                    session_file = client_data.get('session_file')
                    
                    if session_file:
                        logger.info(f'✅ 세션 파일 발견: {session_file}')
                        client = TelegramClient(session_file, client_data['api_id'], client_data['api_hash'])
                        logger.info('✅ 세션 파일로 클라이언트 생성 완료')
                    else:
                        logger.info('⚠️ 세션 파일 없음, 새 클라이언트 생성...')
                        client = TelegramClient(f'session_verify_{client_id}', client_data['api_id'], client_data['api_hash'])
                        logger.info('✅ 새로운 클라이언트 생성 완료')
                    
                    try:
                        # 클라이언트 연결 상태 확인
                        if not client.is_connected():
                            logger.info('🔌 클라이언트 연결 중...')
                            await client.connect()
                            logger.info('✅ 클라이언트 연결 완료')
                        else:
                            logger.info('✅ 클라이언트 이미 연결됨')
                        
                        # 실제 인증 수행
                        logger.info('🔐 인증 수행 중...')
                        phone_code_hash = client_data.get('phone_code_hash')
                        if phone_code_hash:
                            logger.info(f'📋 인증 정보: phoneCode={phone_code}, phoneCodeHash=***{phone_code_hash[-4:]}')
                        else:
                            logger.error('❌ phone_code_hash가 없습니다!')
                            raise Exception('phone_code_hash가 없습니다')
                        
                        # Telethon의 올바른 sign_in 사용법
                        logger.info('🔐 sign_in 메서드 호출 중...')
                        logger.info(f'📋 인증 시도 정보: phone={client_data.get("phone_number")}, code={phone_code}, hash=***{phone_code_hash[-4:]}')
                        
                        # 전화번호와 함께 sign_in 시도
                        result = await client.sign_in(
                            phone=client_data.get('phone_number'),
                            code=phone_code, 
                            phone_code_hash=phone_code_hash
                        )
                        logger.info(f'✅ 인증 성공: userId={result.id}, firstName={result.first_name}')
                        
                        # 인증 성공 후 계정 정보 저장 및 Firebase 세션 삭제
                        logger.info('🔥 인증 성공, 계정 정보 저장 중...')
                        
                        # 인증된 계정 정보 저장 (세션 데이터 포함)
                        # 세션 파일을 읽어서 Base64 인코딩
                        try:
                            with open(f'{temp_session_file}.session', 'rb') as f:
                                session_bytes = f.read()
                            session_b64 = base64.b64encode(session_bytes).decode('utf-8')
                        except:
                            # 세션 파일이 없으면 빈 문자열
                            session_b64 = ""
                        
                        account_info = {
                            'user_id': result.id,
                            'first_name': result.first_name,
                            'last_name': result.last_name,
                            'username': result.username,
                            'phone_number': client_data['phone_number'],
                            'api_id': client_data['api_id'],
                            'api_hash': client_data['api_hash'],
                            'session_data': session_b64,  # 세션 데이터 포함
                            'authenticated_at': datetime.now().isoformat(),
                            'client_id': client_id
                        }
                        
                        # Firebase에 계정 정보 저장
                        logger.info('🔥 Firebase에 계정 정보 저장 시도 중...')
                        logger.info(f'🔥 저장할 계정 정보: {account_info}')
                        save_result = save_account_to_firebase(account_info)
                        if save_result:
                            logger.info('✅ Firebase 계정 정보 저장 성공!')
                        else:
                            logger.error('❌ Firebase 계정 정보 저장 실패!')
                            # 저장 실패해도 계속 진행 (로컬 저장은 성공했으므로)
                        
                        # Firebase 세션 삭제
                        logger.info('🔥 Firebase 세션 삭제 중...')
                        delete_session_from_firebase(client_id)
                        
                        return result, account_info
                        
                    finally:
                        # 클라이언트 연결 해제
                        if client.is_connected():
                            await client.disconnect()
                            logger.info('🔌 클라이언트 연결 해제 완료')
                
                try:
                    result, account_info = loop.run_until_complete(verify_code_async())
                    return result, account_info
                finally:
                    loop.close()
            
            # 새 스레드에서 실행 (Event loop 문제 해결)
            try:
                logger.info('📋 새 스레드에서 인증 실행')
                with concurrent.futures.ThreadPoolExecutor() as executor:
                    future = executor.submit(run_telethon_verify)
                    result, account_info = future.result()
            except Exception as loop_error:
                logger.error(f'❌ 이벤트 루프 실행 실패: {loop_error}')
                raise loop_error
            
            # 클라이언트 정리
            if client_id in clients:
                del clients[client_id]
            logger.info('🗑️ 클라이언트 데이터 정리 완료')
            
            return jsonify({
                'success': True,
                'user': {
                    'id': result.id,
                    'first_name': result.first_name,
                    'last_name': result.last_name,
                    'username': result.username
                },
                'account_info': account_info,
                'message': '실제 MTProto API로 개인 계정 인증이 완료되었습니다!'
            })
            
        except PhoneCodeInvalidError:
            logger.error('❌ 인증코드가 올바르지 않습니다.')
            if client_id in clients:
                del clients[client_id]
            return jsonify({
                'success': False,
                'error': '인증코드가 올바르지 않습니다. 텔레그램 앱에서 받은 코드를 정확히 입력해주세요.'
            }), 400
            
        except PhoneCodeExpiredError:
            logger.error('❌ 인증코드가 만료되었습니다.')
            # 인증 실패 시 Firebase 세션 정리
            logger.info('🔥 인증 실패, Firebase 세션 정리 중...')
            delete_session_from_firebase(client_id)
            
            if client_id in clients:
                del clients[client_id]
            return jsonify({
                'success': False,
                'error': '인증코드가 만료되었습니다. 새로운 인증코드를 요청해주세요.'
            }), 400
            
        except SessionPasswordNeededError:
            logger.error('❌ 2단계 인증이 필요합니다.')
            # 2단계 인증이 필요한 경우 클라이언트 데이터 유지
            logger.info('🔐 2단계 인증 대기 중 - 클라이언트 데이터 유지')
            return jsonify({
                'success': False,
                'error': 'SESSION_PASSWORD_NEEDED',
                'message': '2단계 인증이 필요합니다. 비밀번호를 입력해주세요.'
            }), 400
            
        except Exception as api_error:
            logger.error(f'❌ 인증코드 검증 실패: {api_error}')
            logger.error(f'  - 에러 타입: {type(api_error).__name__}')
            logger.error(f'  - 에러 메시지: {str(api_error)}')
            logger.error(f'  - 클라이언트 연결 상태: N/A')
            logger.error(f'  - phone_code_hash 존재: {bool(client_data.get("phone_code_hash"))}')
            logger.error(f'  - phone_code_hash 값: {client_data.get("phone_code_hash", "None")}')
            
            # 인증 실패 시 Firebase 세션 정리
            logger.info('🔥 인증 실패, Firebase 세션 정리 중...')
            delete_session_from_firebase(client_id)
            
            if client_id in clients:
                del clients[client_id]
            logger.info('🗑️ 실패한 클라이언트 데이터 정리 완료')
            
            # 구체적인 에러 분석
            error_message = f'MTProto API 인증 실패: {str(api_error)}'
            if 'PHONE_NUMBER_UNOCCUPIED' in str(api_error):
                error_message = '등록되지 않은 전화번호입니다.'
            elif 'FLOOD_WAIT' in str(api_error):
                # Flood Control 시간 추출
                import re
                wait_time_match = re.search(r'(\d+)', str(api_error))
                if wait_time_match:
                    wait_seconds = int(wait_time_match.group(1))
                    wait_minutes = wait_seconds // 60
                    error_message = f'요청이 너무 많습니다. {wait_minutes}분 {wait_seconds % 60}초 후에 다시 시도해주세요.'
                else:
                    error_message = '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.'
            elif 'PHONE_CODE_INVALID' in str(api_error):
                error_message = '인증코드가 올바르지 않습니다. 텔레그램 앱에서 받은 코드를 정확히 입력해주세요.'
            elif 'PHONE_CODE_EXPIRED' in str(api_error):
                error_message = '인증코드가 만료되었습니다. 새로운 인증코드를 요청해주세요.'
            
            return jsonify({
                'success': False,
                'error': error_message,
                'details': {
                    'type': type(api_error).__name__,
                    'message': str(api_error)
                }
            }), 500
        
    except Exception as error:
        logger.error(f'서버 오류: {error}')
        return jsonify({
            'success': False,
            'error': f'서버 오류: {str(error)}'
        }), 500

# 2단계 인증 비밀번호 처리
@app.route('/api/telegram/verify-password', methods=['POST'])
def verify_password():
    try:
        data = request.get_json()
        client_id = data.get('client_id')
        password = data.get('password')
        
        if not client_id or not password:
            return jsonify({
                'success': False,
                'error': '클라이언트 ID와 비밀번호가 필요합니다.'
            }), 400
        
        if client_id not in clients:
            return jsonify({
                'success': False,
                'error': '클라이언트 데이터를 찾을 수 없습니다. 다시 인증코드를 요청해주세요.'
            }), 400
        
        client_data = clients[client_id]
        
        def run_telethon_password():
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            
            async def verify_password_async():
                # 세션 파일을 사용하여 클라이언트 생성
                session_file = client_data.get('session_file')
                if session_file:
                    client = TelegramClient(session_file, client_data['api_id'], client_data['api_hash'])
                else:
                    client = TelegramClient(f'session_password_{client_id}', client_data['api_id'], client_data['api_hash'])
                
                try:
                    await client.connect()
                    logger.info('🔐 2단계 인증 비밀번호 확인 중...')
                    
                    # 2단계 인증 비밀번호로 로그인
                    result = await client.sign_in(password=password)
                    logger.info('✅ 2단계 인증 성공!')
                    
                    # 세션 데이터 읽기
                    session_data = None
                    if session_file and os.path.exists(session_file):
                        try:
                            with open(session_file, 'rb') as f:
                                session_data = base64.b64encode(f.read()).decode('utf-8')
                            logger.info('📁 2단계 인증 세션 데이터 읽기 성공')
                        except Exception as e:
                            logger.error(f'❌ 2단계 인증 세션 데이터 읽기 실패: {e}')
                    
                    # 계정 정보 수집 (세션 데이터 포함)
                    account_info = {
                        'user_id': result.id,
                        'first_name': result.first_name,
                        'last_name': result.last_name,
                        'username': result.username,
                        'phone_number': client_data.get('phone_number'),
                        'api_id': client_data['api_id'],
                        'api_hash': client_data['api_hash'],
                        'session_data': session_data,  # 세션 데이터 추가
                        'authenticated_at': datetime.now().isoformat()
                    }
                    
                    # Firebase에 계정 정보 저장
                    logger.info('🔥 2단계 인증 Firebase에 계정 정보 저장 시도 중...')
                    logger.info(f'🔥 저장할 계정 정보: {account_info}')
                    save_result = save_account_to_firebase(account_info)
                    if save_result:
                        logger.info('✅ 2단계 인증 Firebase 계정 정보 저장 성공!')
                    else:
                        logger.error('❌ 2단계 인증 Firebase 계정 정보 저장 실패!')
                        # 저장 실패해도 계속 진행
                    
                    return result, account_info
                    
                finally:
                    await client.disconnect()
            
            return loop.run_until_complete(verify_password_async())
        
        # 새 스레드에서 실행
        with concurrent.futures.ThreadPoolExecutor() as executor:
            future = executor.submit(run_telethon_password)
            result, account_info = future.result()
        
        # 클라이언트 정리
        if client_id in clients:
            del clients[client_id]
        
        return jsonify({
            'success': True,
            'user': {
                'id': result.id,
                'first_name': result.first_name,
                'last_name': result.last_name,
                'username': result.username
            },
            'account_info': account_info,
            'message': '2단계 인증이 완료되었습니다!'
        })
        
    except Exception as error:
        logger.error(f'2단계 인증 실패: {error}')
        return jsonify({
            'success': False,
            'error': f'2단계 인증 실패: {str(error)}'
        }), 500

# 헬스체크 엔드포인트
@app.route('/health')
def health():
    return jsonify({
        'status': 'healthy',
        'timestamp': datetime.now().isoformat(),
        'telethon_loaded': TelegramClient is not None
    })

# 텔레그램 계정 목록 로딩 엔드포인트

@app.route('/api/telegram/load-accounts', methods=['GET'])
def load_accounts():
    """Firebase에서 모든 인증된 텔레그램 계정 목록 로드"""
    try:
        logger.info('🔍 인증된 계정 목록 로딩 요청')
        
        # Firebase에서 모든 계정 정보 조회
        accounts = get_all_accounts_from_firebase()
        
        if not accounts:
            return jsonify({
                'success': True,
                'accounts': [],
                'message': '연동된 계정이 없습니다. 먼저 텔레그램 계정을 연동해주세요.'
            })
        
        logger.info(f'✅ 계정 목록 로딩 성공: {len(accounts)}개 계정')
        
        return jsonify({
            'success': True,
            'accounts': accounts,
            'message': f'{len(accounts)}개의 연동된 계정을 찾았습니다.'
        })
        
    except Exception as e:
        logger.error(f'❌ 계정 목록 로딩 실패: {e}')
        return jsonify({
            'success': False,
            'error': f'계정 목록 로딩 실패: {str(e)}'
        }), 500

# 텔레그램 그룹 로딩 엔드포인트
@app.route('/api/telegram/load-groups', methods=['POST'])
def load_telegram_groups():
    """인증된 계정의 텔레그램 그룹 로딩"""
    try:
        data = request.get_json()
        user_id = data.get('userId')
        
        if not user_id:
            return jsonify({
                'success': False,
                'error': '사용자 ID가 필요합니다.'
            }), 400
        
        logger.info(f'🔍 그룹 로딩 요청: {user_id}')
        
        # Firebase에서 계정 정보 조회
        account_info = get_account_from_firebase(user_id)
        if not account_info:
            return jsonify({
                'success': False,
                'error': '인증된 계정 정보를 찾을 수 없습니다. 다시 인증해주세요.'
            }), 404
        
        # 연결 테스트 (그룹 로딩 전) - 관대한 방식으로 변경
        logger.info('🔍 그룹 로딩 전 연결 테스트 중...')
        logger.info(f'🔍 테스트할 계정 정보: {account_info}')
        
        connection_test_result = test_telegram_connection(account_info)
        logger.info(f'🔍 연결 테스트 결과: {connection_test_result}')
        
        if not connection_test_result:
            logger.warning('⚠️ 연결 테스트 실패했지만 그룹 로딩을 시도합니다')
            logger.warning(f'⚠️ 실패한 계정: {account_info}')
            # 연결 테스트 실패해도 그룹 로딩을 시도 (세션이 만료되었을 수 있음)
        
        # 실제 그룹 로딩 로직
        logger.info('✅ 그룹 로딩 시작')
        
        # 세션 데이터로 실제 그룹 목록 가져오기
        groups = load_telegram_groups_with_session(account_info)
        
        if groups is None:
            return jsonify({
                'success': False,
                'error': '그룹 로딩에 실패했습니다. 세션이 만료되었을 수 있습니다.'
            }), 500
        
        return jsonify({
            'success': True,
            'groups': groups,
            'message': f'{len(groups)}개의 그룹을 로딩했습니다.',
            'account_info': {
                'user_id': account_info['user_id'],
                'first_name': account_info['first_name'],
                'last_name': account_info.get('last_name', ''),
                'username': account_info.get('username', ''),
                'phone_number': account_info['phone_number']
            }
        })
        
    except Exception as error:
        logger.error(f'❌ 그룹 로딩 실패: {error}')
        return jsonify({
            'success': False,
            'error': f'그룹 로딩 실패: {str(error)}'
        }), 500

def delete_account_from_firebase(user_id):
    """Firebase에서 계정 정보 삭제"""
    try:
        url = f"{FIREBASE_URL}/authenticated_accounts/{user_id}.json"
        response = requests.delete(url, timeout=10)
        
        if response.status_code == 200:
            logger.info(f'🔥 Firebase 계정 정보 삭제 성공: {user_id}')
            return True
        else:
            logger.error(f'🔥 Firebase 계정 정보 삭제 실패: {response.status_code}')
            return False
            
    except Exception as e:
        logger.error(f'🔥 Firebase 계정 정보 삭제 에러: {e}')
        return False

# 그룹 목록 API는 Flood Control 때문에 일단 비활성화

# Keep-Alive 엔드포인트 (Render Free Plan용)
@app.route('/ping')
def ping():
    return jsonify({
        'status': 'alive',
        'timestamp': datetime.now().isoformat()
    })

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 3000))
    logger.info(f'🚀 WINT365 Python 서버 시작됨 - 포트: {port}')
    logger.info(f'📋 Telethon 모듈: {"✅ 로드됨" if TelegramClient else "❌ 로드 실패"}')
    
    if not TelegramClient:
        logger.error('⚠️  Telethon 모듈 로드 실패 - MTProto API 사용 불가')
    else:
        logger.info('✅ MTProto API 사용 준비 완료!')
    
    app.run(host='0.0.0.0', port=port, debug=False)
