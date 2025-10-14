from flask import Flask, request, jsonify, send_from_directory, send_file
from flask_cors import CORS, cross_origin
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
import re
import schedule
import time
from datetime import datetime, timedelta

# Telegram 라이브러리
try:
    from telethon import TelegramClient
    from telethon.errors import SessionPasswordNeededError, PhoneCodeInvalidError, PhoneCodeExpiredError
    print('Telethon 모듈 로드 성공')
except ImportError as e:
    print(f'Telethon 모듈 로드 실패: {e}')
    TelegramClient = None

app = Flask(__name__)
# CORS: 단일 허용 오리진으로 고정하고 /api/* 경로만 허용
ALLOWED_ORIGINS = ['https://xn--h89a770c.shop']
CORS(
    app,
    resources={r"/api/*": {"origins": ALLOWED_ORIGINS}},
    supports_credentials=False,
    allow_headers=['Content-Type', 'Authorization'],
    methods=['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
)

# 로깅 설정
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# CORS 헤더 추가 미들웨어
@app.after_request
def after_request(response):
    origin = request.headers.get('Origin')
    if origin in ALLOWED_ORIGINS:
        response.headers['Access-Control-Allow-Origin'] = origin
        response.headers['Vary'] = 'Origin'
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization'
    response.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS'
    response.headers['Access-Control-Max-Age'] = '86400'
    return response

# 프리플라이트(OPTIONS) 처리: /api/* 전부 200 반환 (고유 엔드포인트명)
@app.route('/api/<path:path>', methods=['OPTIONS'])
def cors_preflight_root(path):
    return '', 200

# 마크다운을 HTML로 변환하는 함수
def convert_markdown_to_html(text):
    """마크다운 문법을 HTML로 변환"""
    if not text:
        return text
    
    # **텍스트** -> <b>텍스트</b>
    text = re.sub(r'\*\*(.*?)\*\*', r'<b>\1</b>', text)
    
    # *텍스트* -> <i>텍스트</i>
    text = re.sub(r'\*(.*?)\*', r'<i>\1</i>', text)
    
    # __텍스트__ -> <b>텍스트</b>
    text = re.sub(r'__(.*?)__', r'<b>\1</b>', text)
    
    # _텍스트_ -> <i>텍스트</i>
    text = re.sub(r'_(.*?)_', r'<i>\1</i>', text)
    
    # `텍스트` -> <code>텍스트</code>
    text = re.sub(r'`(.*?)`', r'<code>\1</code>', text)
    
    # ```텍스트``` -> <pre>텍스트</pre>
    text = re.sub(r'```(.*?)```', r'<pre>\1</pre>', text, flags=re.DOTALL)
    
    return text

# 마크다운 문법을 제거하는 함수
def remove_markdown_syntax(text):
    """마크다운 문법을 제거하여 순수 텍스트로 변환"""
    if not text:
        return text
    
    # **텍스트** -> 텍스트
    text = re.sub(r'\*\*(.*?)\*\*', r'\1', text)
    
    # *텍스트* -> 텍스트
    text = re.sub(r'\*(.*?)\*', r'\1', text)
    
    # __텍스트__ -> 텍스트
    text = re.sub(r'__(.*?)__', r'\1', text)
    
    # _텍스트_ -> 텍스트
    text = re.sub(r'_(.*?)_', r'\1', text)
    
    # `텍스트` -> 텍스트
    text = re.sub(r'`(.*?)`', r'\1', text)
    
    # ```텍스트``` -> 텍스트
    text = re.sub(r'```(.*?)```', r'\1', text, flags=re.DOTALL)
    
    return text

# 텔레그램 클라이언트 저장소
clients = {}

# 자동전송 설정 저장소
auto_send_settings = {}
auto_send_jobs = {}

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
        logger.info(f'🔍 계정 정보: {account_info}')
        
        # 임시 세션 파일 생성
        temp_session_file = f'temp_groups_{account_info["user_id"]}'
        
        # 세션 데이터 복원
        session_b64 = account_info.get('session_data')
        if not session_b64:
            logger.error('❌ 세션 데이터 없음')
            return None
            
        logger.info(f'🔍 세션 데이터 길이: {len(session_b64)}')
        
        try:
            session_bytes = base64.b64decode(session_b64)
            logger.info(f'🔍 세션 바이트 길이: {len(session_bytes)}')
        except Exception as e:
            logger.error(f'❌ 세션 데이터 디코딩 실패: {e}')
            return None
        
        # 임시 세션 파일 생성
        try:
            with open(f'{temp_session_file}.session', 'wb') as f:
                f.write(session_bytes)
            logger.info(f'🔍 임시 세션 파일 생성 완료: {temp_session_file}.session')
        except Exception as e:
            logger.error(f'❌ 임시 세션 파일 생성 실패: {e}')
            return None
        
        # 비동기 그룹 로딩 함수
        async def load_groups_async():
            try:
                # 클라이언트 생성
                client = TelegramClient(temp_session_file, account_info['api_id'], account_info['api_hash'])
                logger.info('🔍 텔레그램 클라이언트 생성 완료')
                
                # 연결
                await client.connect()
                logger.info('✅ 텔레그램 연결 성공')
                
                # 연결 상태 확인
                if not client.is_connected():
                    logger.error('❌ 클라이언트 연결 실패')
                    return None
                
                # 그룹 목록 가져오기
                groups = []
                
                # 대화 목록 가져오기 (그룹과 채널만)
                logger.info('🔍 대화 목록 가져오는 중...')
                dialogs = await client.get_dialogs()
                logger.info(f'🔍 총 {len(dialogs)}개의 대화를 찾았습니다.')
                
                for dialog in dialogs:
                    try:
                        entity = dialog.entity
                        logger.info(f'🔍 대화 엔티티 타입: {type(entity)}')
                        
                        # 그룹이나 채널인지 확인
                        is_group = hasattr(entity, 'megagroup') and entity.megagroup
                        is_channel = hasattr(entity, 'broadcast') and entity.broadcast
                        
                        if is_group or is_channel:
                            # 슈퍼그룹의 경우 채널 ID로 변환
                            group_id = entity.id
                            if is_group and entity.id < 0:
                                # 슈퍼그룹 ID를 양수로 변환 (채널 ID에서 1000000000000을 뺌)
                                group_id = entity.id + 1000000000000
                                logger.info(f'📤 슈퍼그룹 ID 변환: {entity.id} -> {group_id}')
                            
                            group_info = {
                                'id': group_id,
                                'title': getattr(entity, 'title', 'Unknown'),
                                'type': 'supergroup' if is_group else 'channel',
                                'username': getattr(entity, 'username', ''),
                                'description': getattr(entity, 'about', '')
                            }
                            groups.append(group_info)
                            logger.info(f'✅ 그룹 추가: {group_info["title"]} ({group_info["type"]}) - ID: {group_id}')
                    except Exception as e:
                        logger.error(f'❌ 대화 처리 중 에러: {e}')
                        continue
                
                logger.info(f'✅ {len(groups)}개의 그룹/채널을 찾았습니다.')
                return groups
                
            except Exception as e:
                logger.error(f'❌ 그룹 로딩 실패: {e}')
                logger.error(f'❌ 에러 타입: {type(e)}')
                return None
                
            finally:
                # 연결 해제
                try:
                    if client.is_connected():
                        await client.disconnect()
                        logger.info('🔍 클라이언트 연결 해제 완료')
                except Exception as e:
                    logger.error(f'❌ 클라이언트 연결 해제 실패: {e}')
        
        # 새 이벤트 루프에서 실행
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        
        try:
            result = loop.run_until_complete(load_groups_async())
            return result
        finally:
            loop.close()
            
            # 임시 파일 정리
            try:
                os.remove(f'{temp_session_file}.session')
                logger.info('🔍 임시 세션 파일 정리 완료')
            except Exception as e:
                logger.error(f'❌ 임시 파일 정리 실패: {e}')
            
    except Exception as e:
        logger.error(f'❌ 그룹 로딩 에러: {e}')
        logger.error(f'❌ 에러 타입: {type(e)}')
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
                        session_file_path = f'{session_file}.session'
                        logger.info(f'🔍 일반 인증 세션 파일 경로: {session_file_path}')
                        logger.info(f'🔍 일반 인증 세션 파일 존재 여부: {os.path.exists(session_file_path)}')
                        
                        try:
                            with open(session_file_path, 'rb') as f:
                                session_bytes = f.read()
                                logger.info(f'🔍 일반 인증 세션 파일 크기: {len(session_bytes)} bytes')
                            session_b64 = base64.b64encode(session_bytes).decode('utf-8')
                            logger.info(f'🔍 일반 인증 세션 데이터 길이: {len(session_b64)}')
                            logger.info('📁 일반 인증 세션 데이터 읽기 성공')
                        except Exception as e:
                            # 세션 파일이 없으면 빈 문자열
                            logger.error(f'❌ 일반 인증 세션 데이터 읽기 실패: {e}')
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
                    session_file_path = f'{session_file}.session'
                    logger.info(f'🔍 2단계 인증 세션 파일 경로: {session_file_path}')
                    logger.info(f'🔍 2단계 인증 세션 파일 존재 여부: {os.path.exists(session_file_path)}')
                    
                    if session_file and os.path.exists(session_file_path):
                        try:
                            with open(session_file_path, 'rb') as f:
                                session_bytes = f.read()
                                logger.info(f'🔍 2단계 인증 세션 파일 크기: {len(session_bytes)} bytes')
                                session_data = base64.b64encode(session_bytes).decode('utf-8')
                                logger.info(f'🔍 2단계 인증 세션 데이터 길이: {len(session_data)}')
                            logger.info('📁 2단계 인증 세션 데이터 읽기 성공')
                        except Exception as e:
                            logger.error(f'❌ 2단계 인증 세션 데이터 읽기 실패: {e}')
                    else:
                        logger.error(f'❌ 2단계 인증 세션 파일이 존재하지 않습니다: {session_file_path}')
                    
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

# OPTIONS 요청 처리 (중복 피하기 위해 다른 함수명 사용)
@app.route('/api/<path:path>', methods=['OPTIONS'])
def cors_preflight(path):
    """CORS preflight 요청 처리"""
    logger.info(f'🔥 OPTIONS 요청 처리: /api/{path}')
    return '', 200

# API 테스트 엔드포인트
@app.route('/api/test', methods=['GET', 'POST'])
def api_test():
    """API 연결 테스트"""
    logger.info('🔥 API 테스트 엔드포인트 호출됨!')
    return jsonify({
        'success': True,
        'message': 'API 연결 성공',
        'method': request.method,
        'timestamp': datetime.now().isoformat()
    })

# Firebase 연결 테스트 API
@app.route('/api/firebase/test', methods=['GET'])
def test_firebase_connection():
    """Firebase 연결 테스트"""
    try:
        import requests
        
        # Firebase Realtime Database에 테스트 데이터 쓰기
        test_data = {
            'test': {
                'timestamp': datetime.now().isoformat(),
                'message': 'Firebase 연결 테스트',
                'server': 'Render'
            }
        }
        
        url = f"{FIREBASE_URL}/test.json"
        response = requests.put(url, json=test_data, timeout=10)
        
        if response.status_code == 200:
            logger.info('✅ Firebase 연결 성공')
            return jsonify({
                'success': True,
                'message': 'Firebase 연결 성공',
                'firebase_url': FIREBASE_URL,
                'timestamp': datetime.now().isoformat()
            })
        else:
            logger.error(f'❌ Firebase 연결 실패: {response.status_code}')
            return jsonify({
                'success': False,
                'error': f'Firebase 연결 실패: {response.status_code}',
                'firebase_url': FIREBASE_URL
            }), 500
            
    except Exception as e:
        logger.error(f'❌ Firebase 연결 테스트 에러: {e}')
        return jsonify({
            'success': False,
            'error': str(e),
            'firebase_url': FIREBASE_URL
        }), 500

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
        # ㄴuserId 또는 account_name 받아 처리
        user_id = (data.get('userId') or '').strip()
        account_name = (data.get('account_name') or '').strip()
        if not user_id and account_name:
            try:
                accounts_response = requests.get(f"{FIREBASE_URL}/authenticated_accounts.json", timeout=10)
                if accounts_response.status_code == 200:
                    accounts_data = accounts_response.json()
                    if accounts_data:
                        for uid, account_data in accounts_data.items():
                            if account_data and isinstance(account_data, dict):
                                full_name = f"{account_data.get('first_name', '')} {account_data.get('last_name', '')}".strip()
                                if full_name == account_name:
                                    user_id = uid
                                    break
            except Exception as e:
                logger.error(f'❌ 계정 조회 실패(중지): {e}')
        
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
        logger.info('🔍 그룹 로딩 함수 호출 중...')
        groups = load_telegram_groups_with_session(account_info)
        logger.info(f'🔍 그룹 로딩 결과: {groups}')
        
        if groups is None:
            logger.error('❌ 그룹 로딩 실패 - groups가 None')
            return jsonify({
                'success': False,
                'error': '그룹 로딩에 실패했습니다. 세션이 만료되었거나 연결에 문제가 있을 수 있습니다.'
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

# 텔레그램 메시지 전송 엔드포인트
@app.route('/api/telegram/saved-messages', methods=['POST'])
def get_telegram_saved_messages():
    """인증된 계정의 텔레그램 저장된 메시지 가져오기"""
    try:
        data = request.get_json()
        user_id = data.get('userId')

        if not user_id:
            return jsonify({
                'success': False,
                'error': '사용자 ID가 필요합니다.'
            }), 400

        logger.info(f'💾 저장된 메시지 요청: {user_id}')

        # Firebase에서 계정 정보 조회
        account_info = get_account_from_firebase(user_id)
        if not account_info:
            logger.error(f'❌ Firebase에서 계정 정보를 찾을 수 없음: {user_id}')
            return jsonify({
                'success': False,
                'error': '인증된 계정 정보를 찾을 수 없습니다. 다시 인증해주세요.'
            }), 404

        logger.info(f'💾 계정 정보 조회 성공: {account_info.get("first_name", "Unknown")}')
        logger.info(f'💾 계정 정보 상세: {account_info}')

        # 저장된 메시지 가져오기
        logger.info('💾 저장된 메시지 가져오기 시작...')
        saved_messages = get_telegram_saved_messages_with_session(account_info)
        logger.info(f'💾 저장된 메시지 가져오기 결과: {saved_messages}')

        if saved_messages is None:
            logger.error('❌ 저장된 메시지 가져오기 실패')
            return jsonify({
                'success': False,
                'error': '저장된 메시지 가져오기에 실패했습니다. 세션이 만료되었거나 연결에 문제가 있을 수 있습니다.'
            }), 500

        if len(saved_messages) == 0:
            logger.warning('⚠️ 저장된 메시지가 없습니다')
            return jsonify({
                'success': True,
                'saved_messages': [],
                'message': '저장된 메시지가 없습니다. 텔레그램에서 "Saved Messages"에 메시지를 저장해주세요.'
            })

        logger.info(f'✅ {len(saved_messages)}개의 저장된 메시지를 찾았습니다.')
        return jsonify({
            'success': True,
            'saved_messages': saved_messages,
            'message': f'{len(saved_messages)}개의 저장된 메시지를 찾았습니다.'
        })

    except Exception as error:
        logger.error(f'❌ 저장된 메시지 가져오기 실패: {error}')
        return jsonify({
            'success': False,
            'error': f'저장된 메시지 가져오기 실패: {str(error)}'
        }), 500

@app.route('/api/telegram/media/<path:filename>')
def serve_media_file(filename):
    """미디어 파일 서빙"""
    try:
        # 미디어 파일 경로 찾기
        media_dirs = ['temp_photos', 'temp_videos', 'temp_docs', 'temp_voices']
        
        for media_dir in media_dirs:
            file_path = os.path.join(media_dir, filename)
            if os.path.exists(file_path):
                return send_file(file_path)
        
        return jsonify({'error': 'File not found'}), 404
        
    except Exception as e:
        logger.error(f'❌ 미디어 파일 서빙 실패: {e}')
        return jsonify({'error': 'File serving failed'}), 500

@app.route('/api/telegram/send-message', methods=['POST'])
def send_telegram_message():
    """인증된 계정으로 텔레그램 그룹에 메시지 전송"""
    try:
        data = request.get_json()
        user_id = data.get('userId')
        group_id = data.get('groupId')
        message = data.get('message')
        
        if not user_id or not group_id:
            return jsonify({
                'success': False,
                'error': '사용자 ID, 그룹 ID가 모두 필요합니다.'
            }), 400
        
        # 메시지가 없어도 미디어 정보가 있으면 전송 가능
        if not message and not data.get('mediaInfo'):
            return jsonify({
                'success': False,
                'error': '메시지 또는 미디어 정보가 필요합니다.'
            }), 400
        
        logger.info(f'📤 메시지 전송 요청: 사용자={user_id}, 그룹={group_id}, 메시지={message[:50] if message else "None"}...')
        
        # 미디어 정보 가져오기
        media_info = data.get('mediaInfo')
        logger.info(f'📤 미디어 정보: {media_info}')
        
        # Firebase에서 계정 정보 조회
        account_info = get_account_from_firebase(user_id)
        if not account_info:
            logger.error(f'❌ 계정 정보 없음: {user_id}')
            return jsonify({
                'success': False,
                'error': '인증된 계정 정보를 찾을 수 없습니다. 다시 인증해주세요.'
            }), 404
        
        logger.info(f'📤 계정 정보 조회 성공: {account_info.get("first_name", "Unknown")}')
        logger.info(f'📤 전송할 메시지: {message}')
        logger.info(f'📤 전송할 그룹 ID: {group_id}')
        logger.info(f'📤 미디어 정보 상세: {media_info}')
        
        # 메시지 전송 실행 (미디어 정보 포함)
        result = send_message_to_telegram_group(account_info, group_id, message, media_info)
        logger.info(f'📤 메시지 전송 결과: {result}')
        
        if result:
            logger.info(f'✅ 메시지 전송 성공: 그룹={group_id}')
            return jsonify({
                'success': True,
                'message': '메시지가 성공적으로 전송되었습니다.',
                'group_id': group_id,
                'message_preview': (message[:100] + ('...' if len(message) > 100 else '')) if message else '저장된 메시지'
            })
        else:
            logger.error(f'❌ 메시지 전송 실패: 그룹={group_id}')
            return jsonify({
                'success': False,
                'error': '메시지 전송에 실패했습니다. 그룹 ID를 확인하거나 권한을 확인해주세요.'
            }), 500
        
    except Exception as error:
        logger.error(f'❌ 메시지 전송 실패: {error}')
        return jsonify({
            'success': False,
            'error': f'메시지 전송 실패: {str(error)}'
        }), 500

def get_telegram_saved_messages_with_session(account_info):
    """세션 데이터를 사용해서 텔레그램 저장된 메시지 목록 가져오기"""
    try:
        logger.info(f'💾 텔레그램 저장된 메시지 가져오기 시작: {account_info["user_id"]}')
        logger.info(f'💾 계정 정보: {account_info}')

        # 임시 세션 파일 생성
        temp_session_file = f'temp_saved_messages_{account_info["user_id"]}'

        # 세션 데이터 복원
        session_b64 = account_info.get('session_data')
        if not session_b64:
            logger.error('❌ 세션 데이터 없음')
            return None

        logger.info(f'💾 세션 데이터 길이: {len(session_b64)}')

        try:
            session_bytes = base64.b64decode(session_b64)
            logger.info(f'💾 세션 바이트 길이: {len(session_bytes)}')
        except Exception as e:
            logger.error(f'❌ 세션 데이터 디코딩 실패: {e}')
            return None

        # 임시 세션 파일 생성
        try:
            with open(f'{temp_session_file}.session', 'wb') as f:
                f.write(session_bytes)
            logger.info(f'💾 임시 세션 파일 생성 완료: {temp_session_file}.session')
        except Exception as e:
            logger.error(f'❌ 임시 세션 파일 생성 실패: {e}')
            return None

        # 미디어 디렉토리 생성
        media_dirs = ['temp_photos', 'temp_videos', 'temp_docs', 'temp_voices']
        for media_dir in media_dirs:
            os.makedirs(media_dir, exist_ok=True)

        # 비동기 저장된 메시지 가져오기 함수
        async def get_saved_messages_async():
            try:
                # 클라이언트 생성
                client = TelegramClient(temp_session_file, account_info['api_id'], account_info['api_hash'])
                logger.info('💾 텔레그램 클라이언트 생성 완료')

                # 연결
                await client.connect()
                logger.info('✅ 텔레그램 연결 성공')

                # 연결 상태 확인
                if not client.is_connected():
                    logger.error('❌ 클라이언트 연결 실패')
                    return None

                # 저장된 메시지 가져오기
                saved_messages = []

                try:
                    # "Saved Messages" 채팅 찾기 - 간단하고 직접적인 방법
                    me = await client.get_me()
                    logger.info(f'💾 현재 사용자: {me.first_name} (ID: {me.id})')
                    
                    # 가장 간단한 방법: InputPeerSelf 사용
                    from telethon.tl.types import InputPeerSelf
                    
                    try:
                        # 간단하고 확실한 방법: 저장된 메시지 가져오기
                        logger.info('💾 저장된 메시지 가져오기 시작')
                        logger.info(f'💾 현재 사용자 ID: {me.id}')
                        logger.info(f'💾 현재 사용자 이름: {me.first_name}')
                        
                        # 🚀 완전히 새로운 접근: 텔레그램의 원본 메시지 데이터를 직접 가져오기
                        logger.info('💾 🚀 완전히 새로운 접근: 원본 메시지 데이터 직접 가져오기')
                        
                        # 🚀 핵심: 원본 메시지 데이터를 직접 가져오기
                        logger.info('💾 🚀 원본 메시지 데이터 직접 가져오기 시도')
                        
                        # 방법 1: get_messages로 원본 데이터 가져오기
                        messages = await client.get_messages(InputPeerSelf(), limit=100)
                        logger.info(f'💾 저장된 메시지 {len(messages)}개를 찾았습니다.')
                        
                        # 🚀 추가: 원본 메시지 데이터를 직접 가져오기
                        if messages:
                            logger.info('💾 🚀 원본 메시지 데이터 직접 가져오기 시도')
                            for msg in messages[:3]:  # 처음 3개만 분석
                                logger.info(f'💾 원본 메시지 분석: ID={msg.id}')
                                logger.info(f'💾 원본 텍스트 (repr): {repr(msg.text)}')
                                logger.info(f'💾 원본 텍스트 (str): {msg.text}')
                                logger.info(f'💾 원본 엔티티: {msg.entities}')
                                
                                # 원본 메시지의 모든 속성 확인
                                raw_attrs = [attr for attr in dir(msg) if not attr.startswith('_')]
                                logger.info(f'💾 원본 메시지 속성들: {raw_attrs}')
                                
                                # 원본 메시지의 raw 데이터 확인
                                if hasattr(msg, 'raw_text'):
                                    logger.info(f'💾 원본 raw_text: {msg.raw_text}')
                                if hasattr(msg, 'message'):
                                    logger.info(f'💾 원본 message: {msg.message}')
                                if hasattr(msg, 'text'):
                                    logger.info(f'💾 원본 text: {msg.text}')
                                
                                # 원본 메시지의 엔티티 정보 확인
                                if msg.entities:
                                    for i, entity in enumerate(msg.entities[:5]):  # 처음 5개만
                                        logger.info(f'💾 원본 엔티티 {i}: {type(entity).__name__}')
                                        logger.info(f'💾   - offset: {entity.offset}, length: {entity.length}')
                                        if hasattr(entity, 'type'):
                                            logger.info(f'💾   - type: {entity.type}')
                                        if hasattr(entity, 'document_id'):
                                            logger.info(f'💾   - document_id: {entity.document_id}')
                                
                                break  # 첫 번째 메시지만 상세 분석
                        
                        
                        if len(messages) == 0:
                            logger.info('💾 InputPeerSelf에서 메시지가 없음, 대화 목록에서 찾기...')
                            # 대화 목록에서 자신과의 대화 찾기
                            dialogs = await client.get_dialogs()
                            logger.info(f'💾 총 {len(dialogs)}개의 대화 확인 중...')
                            
                            for i, dialog in enumerate(dialogs):
                                logger.info(f'💾 대화 {i+1}: {dialog.entity.id} - {getattr(dialog.entity, "title", "No Title")}')
                                if dialog.entity.id == me.id:
                                    logger.info(f'💾 자신과의 대화 발견: {dialog.entity.id}')
                                    messages = await client.get_messages(dialog.entity, limit=100)
                                    logger.info(f'💾 대화 목록에서 저장된 메시지 {len(messages)}개를 찾았습니다.')
                                    break
                        
                        # 추가 시도: 다른 방법으로 저장된 메시지 찾기
                        if len(messages) == 0:
                            logger.info('💾 다른 방법으로 저장된 메시지 찾기 시도...')
                            try:
                                # 자신의 ID로 직접 시도
                                messages = await client.get_messages(me.id, limit=100)
                                logger.info(f'💾 자신의 ID로 시도 결과: {len(messages)}개 메시지')
                            except Exception as e:
                                logger.error(f'❌ 자신의 ID로 시도 실패: {e}')
                        
                    except Exception as e:
                        logger.error(f'❌ 저장된 메시지 가져오기 실패: {e}')
                        logger.error(f'❌ 에러 타입: {type(e)}')
                        import traceback
                        logger.error(f'❌ 스택 트레이스: {traceback.format_exc()}')
                        messages = []
                    
                    if len(messages) == 0:
                        logger.error('❌ 저장된 메시지를 찾을 수 없습니다.')
                        return []
                    
                    logger.info(f'💾 최종 결과: {len(messages)}개의 저장된 메시지를 찾았습니다.')

                    for message in messages:
                        try:
                            logger.info(f'💾 메시지 처리 중: ID={message.id}, 텍스트={message.text[:50] if message.text else "None"}...')
                            logger.info(f'💾 원본 메시지 객체: {message}')
                            logger.info(f'💾 원본 메시지 타입: {type(message)}')
                            logger.info(f'💾 원본 메시지 속성: {dir(message)}')
                            
                            # 🚀 최종 해결책: 원본 메시지 객체 자체를 그대로 보존
                            original_text = message.text or ''
                            logger.info(f'💾 원본 텍스트: {original_text[:100]}...')
                            
                            # 원본 메시지 데이터 생성
                            original_message_data = {
                                'id': message.id,
                                'text': original_text,
                                'entities': [],
                                'date': message.date.isoformat() if message.date else None,
                                'from_id': str(getattr(message, 'from_id', None)) if getattr(message, 'from_id', None) else None,
                                'peer_id': str(getattr(message, 'peer_id', None)) if getattr(message, 'peer_id', None) else None,
                                'message_id': message.id,
                                'raw_text': original_text,
                                'preserve_original': True,
                                'original_message_object': True,
                                'use_forward_message': True
                            }
                            
                            logger.info(f'💾 원본 메시지 데이터 생성 완료: {original_message_data}')
                            
                            # 엔티티 정보만 저장 (복잡한 변환은 하지 않음)
                            custom_emoji_entities = []
                            has_custom_emoji = False
                            
                            if message.entities:
                                logger.info(f'💾 엔티티 개수: {len(message.entities)}')
                                
                                # 커스텀 이모지 엔티티 찾기
                                for entity in message.entities:
                                    entity_class_name = str(entity.__class__)
                                    logger.info(f'💾 엔티티 클래스: {entity_class_name}')
                                    
                                    if 'CustomEmoji' in entity_class_name:
                                        has_custom_emoji = True
                                        custom_emoji_entities.append({
                                            'offset': entity.offset,
                                            'length': entity.length,
                                            'type': entity_class_name,
                                            'document_id': getattr(entity, 'document_id', None)
                                        })
                                        logger.info(f'💾 커스텀 이모지 엔티티 발견: offset={entity.offset}, length={entity.length}, document_id={getattr(entity, "document_id", None)}')
                                
                                logger.info(f'💾 커스텀 이모지 엔티티 개수: {len(custom_emoji_entities)}')
                                logger.info(f'💾 커스텀 이모지 있음: {has_custom_emoji}')
                            else:
                                logger.info(f'💾 엔티티 없음')
                            
                            # 🚀 최종 해결책: 원본 메시지 객체를 그대로 저장
                            message_info = {
                                'id': message.id,
                                'date': message.date.isoformat() if message.date else '',
                                'text': original_text,  # 원본 텍스트 그대로 사용
                                'media_type': None,
                                'media_url': None,
                                'media_path': None,
                                'has_custom_emoji': has_custom_emoji,  # 실제 커스텀 이모지 여부
                                'custom_emoji_entities': custom_emoji_entities,  # 실제 커스텀 이모지 엔티티
                                'entities': [{'offset': e.offset, 'length': e.length, 'type': str(e.__class__)} for e in message.entities] if message.entities else [],
                                'raw_message_data': {
                                    'id': message.id,
                                    'text': original_text,  # 원본 텍스트 그대로 사용
                                    'entities': [{'offset': e.offset, 'length': e.length, 'type': str(e.__class__)} for e in message.entities] if message.entities else [],
                                    'original_message': {
                                        'id': message.id,
                                        'text': original_text,  # 원본 텍스트 그대로 사용
                                        'entities': [{'offset': e.offset, 'length': e.length, 'type': str(e.__class__)} for e in message.entities] if message.entities else [],
                                        'date': message.date.isoformat() if message.date else None,
                                        'from_id': str(getattr(message, 'from_id', None)) if getattr(message, 'from_id', None) else None,
                                        'peer_id': str(getattr(message, 'peer_id', None)) if getattr(message, 'peer_id', None) else None
                                    }
                                },
                                # 🚀 핵심: 원본 메시지 객체 전체를 그대로 보존
                                'original_message_object': original_message_data  # 위에서 생성한 원본 메시지 데이터 사용
                            }
                            
                            # 🚀 핵심: 원본 메시지의 모든 정보를 그대로 보존
                            logger.info(f'💾 원본 메시지 정보 저장 완료: ID={message.id}')
                            logger.info(f'💾 저장된 텍스트: {original_text[:100]}...')
                            
                            # 텔레그램 이모지 엔티티 정보 추출 (JSON 직렬화 가능한 형태로)
                            if message.entities:
                                logger.info(f'💾 메시지 엔티티 개수: {len(message.entities)}')
                                custom_emoji_entities = []
                                
                                for entity in message.entities:
                                    try:
                                        entity_info = {
                                            'offset': int(entity.offset),
                                            'length': int(entity.length),
                                            'type': entity.type.name if hasattr(entity, 'type') else str(type(entity))
                                        }
                                        
                                        # 커스텀 이모지인 경우
                                        if hasattr(entity, 'type') and entity.type.name == 'CUSTOM_EMOJI':
                                            entity_info['document_id'] = int(entity.document_id)
                                            custom_emoji_entities.append(entity_info)
                                            logger.info(f'💾 커스텀 이모지 발견: offset={entity.offset}, length={entity.length}, document_id={entity.document_id}')
                                        
                                        message_info['entities'].append(entity_info)
                                        message_info['raw_message_data']['entities'].append(entity_info)
                                        
                                    except Exception as e:
                                        logger.error(f'❌ 엔티티 처리 실패: {e}')
                                        # 엔티티 처리 실패 시 기본 정보만 저장
                                        entity_info = {
                                            'offset': 0,
                                            'length': 0,
                                            'type': 'UNKNOWN'
                                        }
                                        message_info['entities'].append(entity_info)
                                        message_info['raw_message_data']['entities'].append(entity_info)
                                
                                message_info['custom_emoji_entities'] = custom_emoji_entities
                                message_info['has_custom_emoji'] = len(custom_emoji_entities) > 0

                            # 미디어 처리 (원본 그대로)
                            if message.photo:
                                message_info['media_type'] = 'photo'
                                try:
                                    photo_path = await client.download_media(message.photo, file=f'temp_photos/photo_{message.id}.jpg')
                                    message_info['media_url'] = f'/api/telegram/media/photo_{message.id}.jpg'
                                    message_info['media_path'] = photo_path
                                    logger.info(f'💾 사진 다운로드 성공: {photo_path}')
                                except Exception as e:
                                    logger.error(f'❌ 사진 다운로드 실패: {e}')
                            elif message.video:
                                message_info['media_type'] = 'video'
                                try:
                                    video_path = await client.download_media(message.video, file=f'temp_videos/video_{message.id}.mp4')
                                    message_info['media_url'] = f'/api/telegram/media/video_{message.id}.mp4'
                                    message_info['media_path'] = video_path
                                    logger.info(f'💾 비디오 다운로드 성공: {video_path}')
                                except Exception as e:
                                    logger.error(f'❌ 비디오 다운로드 실패: {e}')
                            elif message.document:
                                message_info['media_type'] = 'document'
                                try:
                                    doc_path = await client.download_media(message.document, file=f'temp_docs/doc_{message.id}')
                                    message_info['media_url'] = f'/api/telegram/media/doc_{message.id}'
                                    message_info['media_path'] = doc_path
                                    logger.info(f'💾 문서 다운로드 성공: {doc_path}')
                                except Exception as e:
                                    logger.error(f'❌ 문서 다운로드 실패: {e}')
                            elif message.voice:
                                message_info['media_type'] = 'voice'
                                try:
                                    voice_path = await client.download_media(message.voice, file=f'temp_voices/voice_{message.id}.ogg')
                                    message_info['media_url'] = f'/api/telegram/media/voice_{message.id}.ogg'
                                    message_info['media_path'] = voice_path
                                    logger.info(f'💾 음성 다운로드 성공: {voice_path}')
                                except Exception as e:
                                    logger.error(f'❌ 음성 다운로드 실패: {e}')

                            saved_messages.append(message_info)
                            logger.info(f'✅ 저장된 메시지 추가: {message.id} - 텍스트: {message_info["text"][:50]}... - 이모지: {message_info["has_custom_emoji"]} - 미디어: {message_info["media_type"]}')

                        except Exception as e:
                            logger.error(f'❌ 메시지 처리 중 에러: {e}')
                            continue

                except Exception as e:
                    logger.error(f'❌ 저장된 메시지 가져오기 실패: {e}')
                    return None

                logger.info(f'✅ {len(saved_messages)}개의 저장된 메시지를 가져왔습니다.')
                return saved_messages

            except Exception as e:
                logger.error(f'❌ 저장된 메시지 가져오기 실패: {e}')
                logger.error(f'❌ 에러 타입: {type(e)}')
                return None

            finally:
                # 연결 해제
                try:
                    if client.is_connected():
                        await client.disconnect()
                        logger.info('💾 클라이언트 연결 해제 완료')
                except Exception as e:
                    logger.error(f'❌ 클라이언트 연결 해제 실패: {e}')

        # 새 이벤트 루프에서 실행
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)

        try:
            result = loop.run_until_complete(get_saved_messages_async())
            return result
        finally:
            loop.close()

            # 임시 파일 정리
            try:
                os.remove(f'{temp_session_file}.session')
                logger.info('💾 임시 세션 파일 정리 완료')
            except Exception as e:
                logger.error(f'❌ 임시 파일 정리 실패: {e}')

    except Exception as e:
        logger.error(f'❌ 저장된 메시지 가져오기 에러: {e}')
        logger.error(f'❌ 에러 타입: {type(e)}')
        return None

def send_message_to_telegram_group(account_info, group_id, message, media_info=None):
    """텔레그램 그룹에 메시지 전송"""
    try:
        logger.info(f'📤 텔레그램 메시지 전송 시작: {account_info["user_id"]} -> {group_id}')
        logger.info(f'📤 메시지 내용: {message[:100] if message else "None"}...')
        logger.info(f'📤 미디어 정보: {media_info}')
        
        # 세션 데이터 복원
        session_b64 = account_info.get('session_data')
        if not session_b64:
            logger.error('❌ 세션 데이터 없음')
            logger.error(f'❌ 계정 정보 키들: {list(account_info.keys())}')
            return False
        
        logger.info(f'📤 세션 데이터 길이: {len(session_b64)}')
            
        session_bytes = base64.b64decode(session_b64)
        temp_session_file = f'temp_message_{account_info["user_id"]}'
        
        # 임시 세션 파일 생성
        with open(f'{temp_session_file}.session', 'wb') as f:
            f.write(session_bytes)
        
        # 비동기 메시지 전송 함수
        async def send_message_async():
            try:
                # 클라이언트 생성
                client = TelegramClient(temp_session_file, account_info['api_id'], account_info['api_hash'])
                logger.info('🔍 텔레그램 클라이언트 생성 완료')
                
                # 연결
                await client.connect()
                logger.info('✅ 텔레그램 연결 성공')
                
                # 연결 상태 확인
                if not client.is_connected():
                    logger.error('❌ 클라이언트 연결 실패')
                    return False
                
                logger.info('✅ 클라이언트 연결 상태 확인 완료')
                
                # 그룹 ID를 정수로 변환
                try:
                    group_id_int = int(group_id)
                    logger.info(f'📤 원본 그룹 ID: {group_id_int}')
                except ValueError:
                    logger.error(f'❌ 잘못된 그룹 ID 형식: {group_id}')
                    return False
                
                # 그룹 엔티티 가져오기 (다양한 ID 형식 시도)
                group_entity = None
                
                # 1. 원본 ID로 시도
                try:
                    group_entity = await client.get_entity(group_id_int)
                    logger.info(f'📤 원본 ID로 엔티티 가져오기 성공: {group_entity.title}')
                except Exception as e:
                    logger.error(f'❌ 원본 ID로 엔티티 가져오기 실패: {e}')
                
                # 2. 음수 ID로 시도
                if not group_entity:
                    try:
                        negative_id = -group_id_int
                        group_entity = await client.get_entity(negative_id)
                        logger.info(f'📤 음수 ID로 엔티티 가져오기 성공: {group_entity.title}')
                    except Exception as e:
                        logger.error(f'❌ 음수 ID로 엔티티 가져오기 실패: {e}')
                
                # 3. 슈퍼그룹을 채널로 변환하여 시도
                if not group_entity:
                    try:
                        channel_id = group_id_int + 1000000000000
                        group_entity = await client.get_entity(channel_id)
                        logger.info(f'📤 채널 ID로 엔티티 가져오기 성공: {group_entity.title}')
                    except Exception as e:
                        logger.error(f'❌ 채널 ID로 엔티티 가져오기 실패: {e}')
                
                # 4. 슈퍼그룹을 채널로 변환한 후 음수로 시도
                if not group_entity:
                    try:
                        channel_negative_id = -(group_id_int + 1000000000000)
                        group_entity = await client.get_entity(channel_negative_id)
                        logger.info(f'📤 채널 음수 ID로 엔티티 가져오기 성공: {group_entity.title}')
                    except Exception as e:
                        logger.error(f'❌ 채널 음수 ID로 엔티티 가져오기 실패: {e}')
                
                if not group_entity:
                    logger.error(f'❌ 모든 ID 형식으로 엔티티 가져오기 실패: {group_id}')
                    return False
                
                # 메시지 전송 (미디어 포함)
                logger.info(f'📤 메시지 전송 중: 그룹={group_entity.title}, 메시지={message[:50] if message else "None"}...')
                
                # 원본 메시지 객체가 있는지 확인 (최우선 처리)
                if media_info and media_info.get('original_message_object'):
                    # 원본 메시지 객체로 전송
                    original_obj = media_info.get('original_message_object')
                    logger.info('📤 🚀 원본 메시지 객체로 전송 (최우선 처리)')
                    logger.info(f'📤 원본 객체: {original_obj}')
                    
                    # 원본 텍스트 사용
                    original_text = original_obj.get('text', message or '')
                    original_message_id = original_obj.get('id', 1)
                    
                    logger.info(f'📤 원본 텍스트: {original_text}')
                    logger.info(f'📤 원본 메시지 ID: {original_message_id}')
                    
                    # 🚀 최종 해결책: 원본 메시지 직접 전달
                    try:
                        logger.info('📤 🚀 최종 해결책: 원본 메시지 직접 전달')
                        
                        # 자신의 저장된 메시지에서 원본 메시지를 직접 전달
                        me = await client.get_me()
                        logger.info(f'📤 자신의 저장된 메시지에서 전달: {me.id}')
                        
                        # InputPeerSelf import
                        from telethon.tl.types import InputPeerSelf
                        
                        # InputPeerSelf import
                        from telethon.tl.types import InputPeerSelf
                        
                        # 원본 메시지를 직접 전달 (완전히 원본 그대로)
                        forwarded_messages = await client.forward_messages(
                            entity=group_entity,
                            messages=original_message_id,
                            from_peer=InputPeerSelf()
                        )
                        
                        if forwarded_messages:
                            forwarded_message = forwarded_messages[0] if isinstance(forwarded_messages, list) else forwarded_messages
                            logger.info(f'✅ 🎉 원본 메시지 직접 전달 성공! 완전히 원본 그대로: {forwarded_message.id}')
                        else:
                            logger.error('❌ 전달된 메시지가 없음')
                            raise Exception("전달된 메시지가 없음")
                        
                    except Exception as e:
                        logger.error(f'❌ 원본 메시지 직접 전달 실패: {e}')
                        logger.info('📤 백업: 원본 텍스트 전송')
                        
                        # 백업: 원본 텍스트 전송
                        if original_text:
                            sent_message = await client.send_message(group_entity, original_text)
                            logger.info(f'✅ 백업 성공: 원본 텍스트 전송 완료: {sent_message.id}')
                        else:
                            logger.warning('⚠️ 원본 텍스트가 없어서 전송할 수 없습니다.')
                
                # 기존 raw_message_data 방식도 지원
                elif media_info and media_info.get('raw_message_data'):
                    # 원본 메시지 데이터로 전송
                    raw_data = media_info.get('raw_message_data')
                    logger.info('📤 원본 메시지 데이터로 전송')
                    logger.info(f'📤 원본 데이터: {raw_data}')
                    
                    # 원본 텍스트와 엔티티 사용
                    original_text = raw_data.get('text', message or '')
                    original_entities = raw_data.get('entities', [])
                    
                    logger.info(f'📤 원본 텍스트: {original_text}')
                    logger.info(f'📤 원본 엔티티: {original_entities}')
                    
                    # 🚀 최종 해결책: 가장 간단하고 확실한 방법
                    try:
                        logger.info('📤 🚀 최종 해결책: 가장 간단하고 확실한 방법')
                        
                        # 원본 메시지 ID 사용
                        original_message_id = raw_data.get('id', 1)
                        logger.info(f'📤 원본 메시지 ID: {original_message_id}')
                        
                        # 자신의 저장된 메시지에서 원본 메시지를 직접 전달
                        me = await client.get_me()
                        logger.info(f'📤 자신의 저장된 메시지에서 전달: {me.id}')
                        
                        # InputPeerSelf import
                        from telethon.tl.types import InputPeerSelf
                        
                        # 원본 메시지를 직접 전달 (완전히 원본 그대로)
                        forwarded_messages = await client.forward_messages(
                            entity=group_entity,
                            messages=original_message_id,
                            from_peer=InputPeerSelf()
                        )
                        
                        if forwarded_messages:
                            forwarded_message = forwarded_messages[0] if isinstance(forwarded_messages, list) else forwarded_messages
                            logger.info(f'✅ 🎉 원본 메시지 직접 전달 성공! 완전히 원본 그대로: {forwarded_message.id}')
                        else:
                            logger.error('❌ 전달된 메시지가 없음')
                            raise Exception("전달된 메시지가 없음")
                        
                    except Exception as e:
                        logger.error(f'❌ 원본 메시지 직접 전달 실패: {e}')
                        logger.info('📤 백업: 단순 텍스트 전송')
                        
                        # 백업: 단순 텍스트 전송
                        if original_text:
                            sent_message = await client.send_message(group_entity, original_text)
                            logger.info(f'✅ 백업 성공: 단순 텍스트 전송 완료: {sent_message.id}')
                        else:
                            logger.warning('⚠️ 원본 텍스트가 없어서 전송할 수 없습니다.')
                
                # 커스텀 이모지가 있는 메시지인지 확인 (기존 방식)
                elif media_info and media_info.get('has_custom_emoji'):
                    # 커스텀 이모지가 포함된 메시지 전송
                    logger.info('📤 커스텀 이모지 포함 메시지 전송 (기존 방식)')
                    logger.info(f'📤 미디어 정보: {media_info}')
                    
                    # 커스텀 이모지 엔티티를 직접 사용
                    custom_emoji_entities = media_info.get('custom_emoji_entities', [])
                    if custom_emoji_entities:
                        logger.info(f'📤 커스텀 이모지 엔티티 {len(custom_emoji_entities)}개 처리 중')
                        
                        # 엔티티 정보를 텔레그램 형식으로 변환
                        from telethon.tl.types import MessageEntityCustomEmoji
                        telegram_entities = []
                        
                        for custom_emoji in custom_emoji_entities:
                            telegram_entities.append(MessageEntityCustomEmoji(
                                offset=custom_emoji['offset'],
                                length=custom_emoji['length'],
                                document_id=custom_emoji['document_id']
                            ))
                            logger.info(f'📤 커스텀 이모지 엔티티 추가: offset={custom_emoji["offset"]}, length={custom_emoji["length"]}, document_id={custom_emoji["document_id"]}')
                        
                        # 메시지와 엔티티 정보 로깅
                        logger.info(f'📤 전송할 메시지: {message or "None"}')
                        logger.info(f'📤 전송할 엔티티 개수: {len(telegram_entities)}')
                        
                        # formatting_entities 대신 entities 사용 시도
                        if message:
                            try:
                                sent_message = await client.send_message(group_entity, message, formatting_entities=telegram_entities)
                                logger.info(f'✅ 커스텀 이모지 메시지 전송 완료: {sent_message.id}')
                            except Exception as e:
                                logger.error(f'❌ formatting_entities 실패: {e}')
                                # entities로 재시도
                                try:
                                    sent_message = await client.send_message(group_entity, message, entities=telegram_entities)
                                    logger.info(f'✅ entities로 커스텀 이모지 메시지 전송 완료: {sent_message.id}')
                                except Exception as e2:
                                    logger.error(f'❌ entities도 실패: {e2}')
                                    # 일반 메시지로 전송
                                    sent_message = await client.send_message(group_entity, message)
                                    logger.info(f'⚠️ 일반 메시지로 전송 완료: {sent_message.id}')
                        else:
                            logger.warning('⚠️ 메시지가 없어서 커스텀 이모지만 전송할 수 없습니다.')
                    else:
                        logger.warning('⚠️ 커스텀 이모지 엔티티가 없습니다')
                        if message:
                            await client.send_message(group_entity, message)
                        else:
                            logger.warning('⚠️ 메시지가 없어서 전송할 수 없습니다.')
                    
                elif media_info and media_info.get('media_path'):
                    # 미디어와 함께 메시지 전송 (원본 이모지 포함)
                    media_path = media_info['media_path']
                    media_type = media_info.get('media_type')
                    
                    logger.info(f'📤 미디어 전송: 타입={media_type}, 경로={media_path}')
                    
                    # 미디어 파일 존재 확인
                    if os.path.exists(media_path):
                        logger.info(f'📤 미디어 파일 존재 확인: {media_path}')
                        
                        # 커스텀 이모지가 있는 경우 formatting_entities 사용
                        if media_info.get('has_custom_emoji'):
                            logger.info('📤 미디어와 함께 커스텀 이모지 전송')
                            
                            # 커스텀 이모지 엔티티를 직접 사용
                            custom_emoji_entities = media_info.get('custom_emoji_entities', [])
                            if custom_emoji_entities:
                                logger.info(f'📤 미디어와 함께 커스텀 이모지 엔티티 {len(custom_emoji_entities)}개 처리 중')
                                
                                # 엔티티 정보를 텔레그램 형식으로 변환
                                from telethon.tl.types import MessageEntityCustomEmoji
                                telegram_entities = []
                                
                                for custom_emoji in custom_emoji_entities:
                                    telegram_entities.append(MessageEntityCustomEmoji(
                                        offset=custom_emoji['offset'],
                                        length=custom_emoji['length'],
                                        document_id=custom_emoji['document_id']
                                    ))
                                    logger.info(f'📤 미디어 커스텀 이모지 엔티티 추가: offset={custom_emoji["offset"]}, length={custom_emoji["length"]}, document_id={custom_emoji["document_id"]}')
                                
                                # 미디어와 함께 커스텀 이모지 전송
                                try:
                                    if media_type == 'photo':
                                        sent_message = await client.send_file(group_entity, media_path, caption=message, formatting_entities=telegram_entities)
                                    elif media_type == 'video':
                                        sent_message = await client.send_file(group_entity, media_path, caption=message, formatting_entities=telegram_entities)
                                    elif media_type == 'document':
                                        sent_message = await client.send_file(group_entity, media_path, caption=message, formatting_entities=telegram_entities)
                                    elif media_type == 'voice':
                                        sent_message = await client.send_file(group_entity, media_path, caption=message, formatting_entities=telegram_entities)
                                    else:
                                        sent_message = await client.send_message(group_entity, message, formatting_entities=telegram_entities)
                                    
                                    logger.info(f'✅ 미디어와 함께 커스텀 이모지 전송 완료: {sent_message.id}')
                                except Exception as e:
                                    logger.error(f'❌ 미디어 formatting_entities 실패: {e}')
                                    # entities로 재시도
                                    try:
                                        if media_type == 'photo':
                                            sent_message = await client.send_file(group_entity, media_path, caption=message, entities=telegram_entities)
                                        elif media_type == 'video':
                                            sent_message = await client.send_file(group_entity, media_path, caption=message, entities=telegram_entities)
                                        elif media_type == 'document':
                                            sent_message = await client.send_file(group_entity, media_path, caption=message, entities=telegram_entities)
                                        elif media_type == 'voice':
                                            sent_message = await client.send_file(group_entity, media_path, caption=message, entities=telegram_entities)
                                        else:
                                            sent_message = await client.send_message(group_entity, message, entities=telegram_entities)
                                        
                                        logger.info(f'✅ 미디어 entities로 커스텀 이모지 전송 완료: {sent_message.id}')
                                    except Exception as e2:
                                        logger.error(f'❌ 미디어 entities도 실패: {e2}')
                                        # 일반 미디어 전송
                                        if media_type == 'photo':
                                            sent_message = await client.send_file(group_entity, media_path, caption=message)
                                        elif media_type == 'video':
                                            sent_message = await client.send_file(group_entity, media_path, caption=message)
                                        elif media_type == 'document':
                                            sent_message = await client.send_file(group_entity, media_path, caption=message)
                                        elif media_type == 'voice':
                                            sent_message = await client.send_file(group_entity, media_path, caption=message)
                                        else:
                                            sent_message = await client.send_message(group_entity, message)
                                        
                                        logger.info(f'⚠️ 미디어 일반 전송 완료: {sent_message.id}')
                            else:
                                logger.warning('⚠️ 미디어 커스텀 이모지 엔티티가 없습니다')
                                # 일반 미디어 전송
                                if media_type == 'photo':
                                    await client.send_file(group_entity, media_path, caption=message)
                                elif media_type == 'video':
                                    await client.send_file(group_entity, media_path, caption=message)
                                elif media_type == 'document':
                                    await client.send_file(group_entity, media_path, caption=message)
                                elif media_type == 'voice':
                                    await client.send_file(group_entity, media_path, caption=message)
                                else:
                                    await client.send_message(group_entity, message)
                        else:
                            # 일반 미디어 전송
                            if media_type == 'photo':
                                await client.send_file(group_entity, media_path, caption=message)
                            elif media_type == 'video':
                                await client.send_file(group_entity, media_path, caption=message)
                            elif media_type == 'document':
                                await client.send_file(group_entity, media_path, caption=message)
                            elif media_type == 'voice':
                                await client.send_file(group_entity, media_path, caption=message)
                            else:
                                await client.send_message(group_entity, message)
                    else:
                        logger.error(f'❌ 미디어 파일이 존재하지 않음: {media_path}')
                        # 파일이 없으면 텍스트만 전송 (커스텀 이모지 포함)
                        if media_info.get('has_custom_emoji'):
                            logger.info('📤 미디어 파일 없음 - 텍스트만 커스텀 이모지와 함께 전송')
                            
                            # 커스텀 이모지 엔티티를 직접 사용
                            custom_emoji_entities = media_info.get('custom_emoji_entities', [])
                            if custom_emoji_entities:
                                logger.info(f'📤 텍스트만 커스텀 이모지 엔티티 {len(custom_emoji_entities)}개 처리 중')
                                
                                from telethon.tl.types import MessageEntityCustomEmoji
                                telegram_entities = []
                                
                                for custom_emoji in custom_emoji_entities:
                                    telegram_entities.append(MessageEntityCustomEmoji(
                                        offset=custom_emoji['offset'],
                                        length=custom_emoji['length'],
                                        document_id=custom_emoji['document_id']
                                    ))
                                    logger.info(f'📤 텍스트 커스텀 이모지 엔티티 추가: offset={custom_emoji["offset"]}, length={custom_emoji["length"]}, document_id={custom_emoji["document_id"]}')
                                
                                try:
                                    sent_message = await client.send_message(group_entity, message, formatting_entities=telegram_entities)
                                    logger.info(f'✅ 텍스트만 커스텀 이모지 전송 완료: {sent_message.id}')
                                except Exception as e:
                                    logger.error(f'❌ 텍스트 formatting_entities 실패: {e}')
                                    # entities로 재시도
                                    try:
                                        sent_message = await client.send_message(group_entity, message, entities=telegram_entities)
                                        logger.info(f'✅ 텍스트 entities로 커스텀 이모지 전송 완료: {sent_message.id}')
                                    except Exception as e2:
                                        logger.error(f'❌ 텍스트 entities도 실패: {e2}')
                                        # 일반 메시지로 전송
                                        sent_message = await client.send_message(group_entity, message)
                                        logger.info(f'⚠️ 텍스트 일반 전송 완료: {sent_message.id}')
                            else:
                                logger.warning('⚠️ 텍스트 커스텀 이모지 엔티티가 없습니다')
                                await client.send_message(group_entity, message)
                        else:
                            await client.send_message(group_entity, message)
                else:
                    # 텍스트만 전송
                    logger.info('📤 텍스트만 전송')
                    if message:
                        await client.send_message(group_entity, message)
                    else:
                        logger.warning('⚠️ 메시지가 없어서 전송할 수 없습니다.')
                
                logger.info('✅ 메시지 전송 성공')
                
                return True
                
            except Exception as e:
                logger.error(f'❌ 메시지 전송 실패: {e}')
                logger.error(f'❌ 에러 타입: {type(e)}')
                logger.error(f'❌ 에러 상세: {str(e)}')
                import traceback
                logger.error(f'❌ 스택 트레이스: {traceback.format_exc()}')
                
                # 슬로우 모드 에러 감지 및 대기 시간 추출
                error_str = str(e).lower()
                if any(keyword in error_str for keyword in ['flood', 'slow', 'wait', 'rate', 'limit']):
                    logger.warning(f'⏳ 슬로우 모드 감지: {e}')
                    
                    # 대기 시간 추출 (초 단위)
                    import re
                    wait_time_match = re.search(r'wait of (\d+) seconds', error_str)
                    if wait_time_match:
                        wait_seconds = int(wait_time_match.group(1))
                        wait_minutes = wait_seconds / 60
                        logger.info(f'⏳ 대기 시간 추출: {wait_seconds}초 ({wait_minutes:.1f}분)')
                        return {'error': 'flood_control', 'message': str(e), 'wait_seconds': wait_seconds}
                    else:
                        # 대기 시간을 찾을 수 없으면 기본값 사용
                        logger.warning(f'⏳ 대기 시간을 찾을 수 없음, 기본값 8분 사용')
                        return {'error': 'flood_control', 'message': str(e), 'wait_seconds': 480}  # 8분
                
                return False
                
            finally:
                # 연결 해제
                try:
                    if client.is_connected():
                        await client.disconnect()
                        logger.info('🔍 클라이언트 연결 해제 완료')
                except Exception as e:
                    logger.error(f'❌ 클라이언트 연결 해제 실패: {e}')
        
        # 새 이벤트 루프에서 실행
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        
        try:
            result = loop.run_until_complete(send_message_async())
            return result
        finally:
            loop.close()
            
            # 임시 파일 정리
            try:
                os.remove(f'{temp_session_file}.session')
                logger.info('🔍 임시 세션 파일 정리 완료')
            except Exception as e:
                logger.error(f'❌ 임시 파일 정리 실패: {e}')
                
    except Exception as e:
        logger.error(f'❌ 메시지 전송 에러: {e}')
        logger.error(f'❌ 에러 타입: {type(e)}')
        return False

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

# 자동전송 관련 함수들
def save_auto_send_settings_to_firebase(user_id, settings):
    """Firebase에 자동전송 설정 저장"""
    try:
        logger.info(f'🔥 자동전송 설정 저장 시작: user_id={user_id}, settings={settings}')
        
        settings_data = {
            'user_id': user_id,
            'settings': settings,
            'created_at': datetime.now().isoformat(),
            'is_active': True
        }
        
        url = f"{FIREBASE_URL}/auto_send_settings/{user_id}.json"
        logger.info(f'🔥 Firebase URL: {url}')
        logger.info(f'🔥 전송할 데이터: {settings_data}')
        
        response = requests.put(url, json=settings_data, timeout=10)
        
        logger.info(f'🔥 Firebase 응답 상태: {response.status_code}')
        logger.info(f'🔥 Firebase 응답 내용: {response.text}')
        
        if response.status_code == 200:
            logger.info(f'🔥 Firebase 자동전송 설정 저장 성공: {user_id}')
            return True
        else:
            logger.error(f'🔥 Firebase 자동전송 설정 저장 실패: {response.status_code} - {response.text}')
            return False
            
    except Exception as e:
        logger.error(f'🔥 Firebase 자동전송 설정 저장 에러: {e}')
        return False

def get_auto_send_settings_from_firebase(user_id):
    """Firebase에서 자동전송 설정 조회"""
    try:
        url = f"{FIREBASE_URL}/auto_send_settings/{user_id}.json"
        response = requests.get(url, timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            if data and data.get('is_active'):
                logger.info(f'🔥 Firebase 자동전송 설정 조회 성공: {user_id}')
                return data.get('settings', {})
            else:
                logger.info(f'🔥 Firebase 자동전송 설정 없음: {user_id}')
                return None
        else:
            logger.error(f'🔥 Firebase 자동전송 설정 조회 실패: {response.status_code}')
            return None
            
    except Exception as e:
        logger.error(f'🔥 Firebase 자동전송 설정 조회 에러: {e}')
        return None

def save_auto_send_status_to_firebase(user_id, status_data):
    """Firebase에 자동전송 상태 저장"""
    try:
        logger.info(f'🔥 자동전송 상태 저장 시작: user_id={user_id}, status={status_data}')
        
        url = f"{FIREBASE_URL}/auto_send_status/{user_id}.json"
        logger.info(f'🔥 Firebase URL: {url}')
        
        response = requests.put(url, json=status_data, timeout=10)
        
        logger.info(f'🔥 Firebase 응답 상태: {response.status_code}')
        logger.info(f'🔥 Firebase 응답 내용: {response.text}')
        
        if response.status_code == 200:
            logger.info(f'🔥 Firebase 자동전송 상태 저장 성공: {user_id}')
            return True
        else:
            logger.error(f'🔥 Firebase 자동전송 상태 저장 실패: {response.status_code} - {response.text}')
            return False
            
    except Exception as e:
        logger.error(f'🔥 Firebase 자동전송 상태 저장 에러: {e}')
        return False

def get_auto_send_status_from_firebase(user_id):
    """Firebase에서 자동전송 상태 조회"""
    try:
        url = f"{FIREBASE_URL}/auto_send_status/{user_id}.json"
        response = requests.get(url, timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            if data:
                logger.info(f'🔥 Firebase 자동전송 상태 조회 성공: {user_id}')
                return data
            else:
                logger.info(f'🔥 Firebase 자동전송 상태 없음: {user_id}')
                return None
        else:
            logger.error(f'🔥 Firebase 자동전송 상태 조회 실패: {response.status_code}')
            return None
            
    except Exception as e:
        logger.error(f'🔥 Firebase 자동전송 상태 조회 에러: {e}')
        return None

def schedule_retry_for_group(user_id, group_id, message, media_info, wait_seconds=480):
    """슬로우 모드로 인한 재시도 스케줄링"""
    try:
        # 슬로우 모드 대기 시간 (초 단위)
        retry_delay_seconds = wait_seconds
        retry_delay_minutes = retry_delay_seconds / 60
        
        logger.info(f'⏰ 재시도 스케줄: {retry_delay_seconds}초 ({retry_delay_minutes:.1f}분) 후')
        
        def retry_job():
            logger.info(f'🔄 슬로우 모드 재시도: 그룹 {group_id}')
            
            # 계정 정보 조회
            account_info = get_account_from_firebase(user_id)
            if not account_info:
                logger.error(f'❌ 재시도 실패: 계정 정보 없음 - {user_id}')
                return
            
            # 재시도 전송
            result = send_message_to_telegram_group(account_info, group_id, message, media_info)
            if result:
                logger.info(f'✅ 슬로우 모드 재시도 성공: 그룹 {group_id}')
            else:
                logger.error(f'❌ 슬로우 모드 재시도 실패: 그룹 {group_id}')
                # 재시도도 실패하면 다시 스케줄링 (더 긴 대기 시간)
                if isinstance(result, dict) and result.get('error') == 'flood_control':
                    new_wait_seconds = result.get('wait_seconds', 900)  # 기본값 15분
                    new_wait_minutes = new_wait_seconds / 60
                    logger.info(f'⏳ 재시도도 슬로우 모드: 그룹 {group_id}, {new_wait_seconds}초 ({new_wait_minutes:.1f}분) 후 재시도')
                    schedule.every(new_wait_minutes).minutes.do(retry_job)
        
        # 재시도 스케줄 등록 (정확한 시간)
        if retry_delay_minutes >= 1:
            # 1분 이상이면 분 단위로 스케줄링
            schedule.every(retry_delay_minutes).minutes.do(retry_job)
            logger.info(f'⏰ 슬로우 모드 재시도 스케줄: 그룹 {group_id} ({retry_delay_minutes:.1f}분 후)')
        else:
            # 1분 미만이면 초 단위로 스케줄링
            schedule.every(retry_delay_seconds).seconds.do(retry_job)
            logger.info(f'⏰ 슬로우 모드 재시도 스케줄: 그룹 {group_id} ({retry_delay_seconds}초 후)')
        
    except Exception as e:
        logger.error(f'❌ 슬로우 모드 재시도 스케줄링 에러: {e}')

def update_last_send_time(user_id, group_id):
    """마지막 전송 시간 업데이트"""
    try:
        # Firebase에서 현재 상태 조회
        status_data = get_auto_send_status_from_firebase(user_id)
        if status_data:
            # 마지막 전송 시간 업데이트
            if 'last_send_times' not in status_data:
                status_data['last_send_times'] = {}
            
            status_data['last_send_times'][str(group_id)] = datetime.now().isoformat()
            
            # Firebase에 업데이트된 상태 저장
            save_auto_send_status_to_firebase(user_id, status_data)
            logger.info(f'⏰ 그룹 {group_id} 마지막 전송 시간 업데이트')
        
    except Exception as e:
        logger.error(f'❌ 마지막 전송 시간 업데이트 에러: {e}')

def execute_auto_send_job(user_id, group_ids, message, media_info=None):
    """자동전송 작업 실행"""
    try:
        logger.info(f'🤖 자동전송 작업 시작: {user_id}')
        # 안전 가드: OFF 상태면 즉시 중단
        try:
            status_guard = get_auto_send_status_from_firebase(user_id)
            if not status_guard or not status_guard.get('is_active', False):
                logger.info(f'⛔ 자동전송 비활성 상태 감지, 실행 중단: {user_id}')
                return False
        except Exception as _e:
            logger.error(f'⛔ 상태 가드 확인 실패(계속 시도): {user_id} - {_e}')
        
        # 계정 정보 조회
        account_info = get_account_from_firebase(user_id)
        if not account_info:
            logger.error(f'❌ 자동전송 실패: 계정 정보 없음 - {user_id}')
            return False
        
        # 설정 조회
        settings = get_auto_send_settings_from_firebase(user_id)
        if not settings:
            logger.error(f'❌ 자동전송 실패: 설정 없음 - {user_id}')
            return False
        
        group_interval = settings.get('groupInterval', 30)  # 초 단위
        max_repeats = settings.get('maxRepeats', 10)
        
        logger.info(f'⏰ 자동전송 설정 확인:')
        logger.info(f'   - 그룹 간격: {group_interval}초 (타입: {type(group_interval)})')
        logger.info(f'   - 최대 반복: {max_repeats}회')
        logger.info(f'   - 전체 설정: {settings}')
        
        # 그룹 간격이 숫자인지 확인
        if not isinstance(group_interval, (int, float)) or group_interval <= 0:
            logger.error(f'❌ 잘못된 그룹 간격 값: {group_interval} (타입: {type(group_interval)})')
            group_interval = 30  # 기본값으로 설정
            logger.info(f'🔧 그룹 간격을 기본값 30초로 설정')
        
        # 현재 반복 횟수 조회
        current_repeats = auto_send_jobs.get(f'{user_id}_repeats', 0)
        
        if max_repeats > 0 and current_repeats >= max_repeats:
            logger.info(f'✅ 자동전송 완료: 최대 반복 횟수 도달 - {user_id} (현재: {current_repeats}, 최대: {max_repeats})')
            stop_auto_send_job(user_id)
            return True
        elif max_repeats == 0:
            logger.info(f'🔄 무제한 반복 모드: {user_id} (현재: {current_repeats + 1}회차)')
        
        # 각 그룹에 메시지 전송 (메시지 개수 확인 포함)
        success_count = 0
        for i, group_id in enumerate(group_ids):
            try:
                # 두 가지 조건 확인: 메시지 개수 + 재전송 텀 (평탄화된 설정 사용)
                enable_message_check = settings.get('enableMessageCheck', False)
                message_threshold = settings.get('messageThreshold', 5)
                repeat_interval = settings.get('repeatInterval', 30)  # 분 단위
                
                # 조건 1: 메시지 개수 확인 (첫 발송이 아닌 경우에만)
                message_count_ok = True
                
                # Firebase에서 마지막 전송 시간 확인하여 첫 발송인지 판단
                status_data = get_auto_send_status_from_firebase(user_id)
                is_first_send = True
                if status_data and 'last_send_times' in status_data:
                    last_send_time_str = status_data['last_send_times'].get(str(group_id))
                    if last_send_time_str:
                        is_first_send = False
                
                if is_first_send:
                    logger.info(f'🚀 그룹 {group_id} 첫 발송: 메시지 개수 확인 생략')
                elif enable_message_check:
                    message_count = check_telegram_group_message_count(account_info, group_id)
                    logger.info(f'📊 그룹 {group_id} 메시지 개수: {message_count} (임계값: {message_threshold})')
                    
                    if message_count >= message_threshold:
                        logger.info(f'✅ 그룹 {group_id} 메시지 개수 충족: {message_count} >= {message_threshold}')
                        message_count_ok = True
                    else:
                        logger.info(f'⏭️ 그룹 {group_id} 메시지 개수 부족으로 전송 건너뜀: {message_count} < {message_threshold}')
                        message_count_ok = False
                
                # 조건 2: 재전송 텀 확인 (첫 발송이 아닌 경우에만)
                time_interval_ok = True
                if is_first_send:
                    logger.info(f'🚀 그룹 {group_id} 첫 발송: 재전송 텀 확인 생략')
                else:
                    # Firebase에서 마지막 전송 시간 조회
                    if status_data and 'last_send_times' in status_data:
                        last_send_time_str = status_data['last_send_times'].get(str(group_id))
                        if last_send_time_str:
                            last_send_time = datetime.fromisoformat(last_send_time_str)
                            time_since_last_send = datetime.now() - last_send_time
                            time_since_last_send_minutes = time_since_last_send.total_seconds() / 60
                            logger.info(f'⏰ 그룹 {group_id} 마지막 전송: {time_since_last_send_minutes:.1f}분 전 (필요: {repeat_interval}분)')
                            if time_since_last_send_minutes < repeat_interval:
                                logger.info(f'⏭️ 그룹 {group_id} 재전송 텀 미경과')
                                time_interval_ok = False
                
                # OR 로직: 둘 중 하나라도 통과하면 전송, 둘 다 미충족이면 건너뜀
                if (not message_count_ok) and (not time_interval_ok):
                    logger.info(f'⏭️ 그룹 {group_id} 전송 조건 미충족: 메시지={message_count_ok}, 시간={time_interval_ok}')
                    continue
                
                logger.info(f'✅ 그룹 {group_id} 전송 조건 충족: 메시지={message_count_ok}, 시간={time_interval_ok}')
                
                result = send_message_to_telegram_group(account_info, group_id, message, media_info)
                if result:
                    success_count += 1
                    logger.info(f'✅ 자동전송 성공: 그룹 {group_id}')
                    
                    # 마지막 전송 시간 업데이트
                    update_last_send_time(user_id, group_id)
                else:
                    logger.error(f'❌ 자동전송 실패: 그룹 {group_id}')
                    
                    # 슬로우 모드 감지 및 재시도 스케줄링
                    if isinstance(result, dict) and result.get('error') == 'flood_control':
                        wait_seconds = result.get('wait_seconds', 480)  # 기본값 8분
                        logger.info(f'⏳ 슬로우 모드 감지: 그룹 {group_id}, {wait_seconds}초 후 재시도')
                        schedule_retry_for_group(user_id, group_id, message, media_info, wait_seconds)
                
                # 그룹 간 대기
                if i < len(group_ids) - 1:  # 마지막 그룹이 아닌 경우에만 대기
                    logger.info(f'⏰ 그룹 간 대기 시작: {group_interval}초 (그룹 {i+1}/{len(group_ids)})')
                    logger.info(f'⏰ 실제 대기 시간: {group_interval}초')
                    time.sleep(group_interval)
                    logger.info(f'⏰ 그룹 간 대기 완료: {group_interval}초')
                
            except Exception as e:
                logger.error(f'❌ 자동전송 그룹 {group_id} 에러: {e}')
                continue
        
        # 반복 횟수 증가
        auto_send_jobs[f'{user_id}_repeats'] = current_repeats + 1
        
        logger.info(f'🤖 자동전송 완료: {success_count}/{len(group_ids)} 그룹 성공')
        return True
        
    except Exception as e:
        logger.error(f'❌ 자동전송 작업 에러: {e}')
        return False

def start_auto_send_job(user_id, group_ids, message, media_info=None):
    """자동전송 작업 시작"""
    try:
        logger.info(f'🤖 자동전송 작업 시작: {user_id}')
        
        # 기존 작업 중지
        stop_auto_send_job(user_id)
        
        # 설정 조회
        settings = get_auto_send_settings_from_firebase(user_id)
        if not settings:
            logger.warning(f'⚠️ 자동전송 설정 없음, 기본 설정으로 시작: {user_id}')
            # 기본 설정 생성
            default_settings = {
                'groupInterval': 30,
                'repeatInterval': 30,
                'maxRepeats': 10,
                'messageThreshold': 5,
                'enableMessageCheck': False
            }
            # Firebase에 기본 설정 저장
            save_auto_send_settings_to_firebase(user_id, default_settings)
            settings = default_settings
        
        logger.info(f'🔥 Firebase에서 가져온 설정: {settings}')
        
        repeat_interval = settings.get('repeatInterval', 30)  # 분 단위
        
        # 스케줄 작업 등록
        job_id = f'auto_send_{user_id}'

        # 먼저 메모리/Firebase 상태를 올려 프론트가 즉시 ON으로 인식하게 함
        auto_send_jobs[user_id] = {
            'job_id': job_id,
            'group_ids': group_ids,
            'message': message,
            'media_info': media_info,
            'started_at': datetime.now().isoformat()
        }
        
        # Firebase에 자동전송 상태 저장(선반영)
        save_auto_send_status_to_firebase(user_id, {
            'is_active': True,
            'group_ids': group_ids,
            'message': message,
            'media_info': media_info,
            'started_at': datetime.now().isoformat(),
            'job_id': job_id,
            'last_send_times': {group_id: None for group_id in group_ids}  # 각 그룹별 마지막 전송 시간
        })

        def job():
            execute_auto_send_job(user_id, group_ids, message, media_info)

        # 반복 스케줄 등록 (메인 스케줄만 사용)
        schedule.every(repeat_interval).minutes.do(job)
        logger.info(f'⏰ 메인 반복 스케줄 등록: {repeat_interval}분 간격')
        
        # 빠른 검사 스케줄 제거 (중복 실행 방지)
        # 30초마다 실행하면 반복 횟수가 계속 증가하는 문제 발생

        # 즉시 한 번 실행은 비동기로 트리거
        threading.Thread(target=execute_auto_send_job, args=(user_id, group_ids, message, media_info), daemon=True).start()
        
        logger.info(f'✅ 자동전송 작업 시작됨: {user_id} (간격: {repeat_interval}분)')
        return True
        
    except Exception as e:
        logger.error(f'❌ 자동전송 시작 에러: {e}')
        return False

def stop_auto_send_job(user_id):
    """자동전송 작업 중지"""
    try:
        logger.info(f'🛑 자동전송 작업 중지: {user_id}')
        
        # 스케줄 작업 제거
        schedule.clear()
        
        # 메모리에서 작업 제거
        if user_id in auto_send_jobs:
            del auto_send_jobs[user_id]
        
        if f'{user_id}_repeats' in auto_send_jobs:
            del auto_send_jobs[f'{user_id}_repeats']
        
        # Firebase에서 자동전송 상태 삭제
        try:
            url = f"{FIREBASE_URL}/auto_send_status/{user_id}.json"
            response = requests.delete(url, timeout=10)
            if response.status_code == 200:
                logger.info(f'🔥 Firebase 자동전송 상태 삭제 성공: {user_id}')
            else:
                logger.error(f'🔥 Firebase 자동전송 상태 삭제 실패: {response.status_code}')
        except Exception as e:
            logger.error(f'🔥 Firebase 자동전송 상태 삭제 에러: {e}')
        
        logger.info(f'✅ 자동전송 작업 중지됨: {user_id}')
        return True
            
    except Exception as e:
        logger.error(f'❌ 자동전송 중지 에러: {e}')
        return False

def check_telegram_group_message_count(account_info, group_id):
    """텔레그램 그룹에서 메시지 개수 확인 (내가 보낸 메시지 이후 다른 사람들의 메시지)"""
    try:
        logger.info(f'📊 그룹 메시지 개수 확인: {group_id}')
        
        # 세션 데이터 복원
        session_b64 = account_info.get('session_data')
        if not session_b64:
            logger.error('❌ 세션 데이터 없음')
            return 0
            
        session_bytes = base64.b64decode(session_b64)
        temp_session_file = f'temp_message_count_{account_info["user_id"]}'
        
        # 임시 세션 파일 생성
        with open(f'{temp_session_file}.session', 'wb') as f:
            f.write(session_bytes)
        
        # 비동기 메시지 개수 확인 함수
        async def check_message_count_async():
            try:
                # 클라이언트 생성
                client = TelegramClient(temp_session_file, account_info['api_id'], account_info['api_hash'])
                logger.info('📊 텔레그램 클라이언트 생성 완료')
                
                # 연결
                await client.connect()
                logger.info('✅ 텔레그램 연결 성공')
                
                # 연결 상태 확인
                if not client.is_connected():
                    logger.error('❌ 클라이언트 연결 실패')
                    return 0
                
                # 그룹 엔티티 가져오기
                try:
                    group_id_int = int(group_id)
                    group_entity = await client.get_entity(group_id_int)
                    logger.info(f'📊 그룹 엔티티 가져오기 성공: {group_entity.title}')
                except Exception as e:
                    logger.error(f'❌ 그룹 엔티티 가져오기 실패: {e}')
                    return 0
                
                # 최근 메시지들 가져오기 (최대 100개)
                messages = await client.get_messages(group_entity, limit=100)
                logger.info(f'📊 최근 메시지 {len(messages)}개 가져옴')
                
                # 내 사용자 정보 가져오기
                me = await client.get_me()
                my_user_id = me.id
                logger.info(f'📊 내 사용자 ID: {my_user_id}')
                
                # 내가 보낸 마지막 메시지 찾기
                my_last_message_index = -1
                for i, message in enumerate(messages):
                    if hasattr(message, 'from_id') and message.from_id and message.from_id.user_id == my_user_id:
                        my_last_message_index = i
                        logger.info(f'📊 내가 보낸 마지막 메시지 발견: 인덱스 {i}, 메시지 ID {message.id}')
                        break
                
                if my_last_message_index == -1:
                    logger.info('📊 내가 보낸 메시지를 찾을 수 없음 - 모든 메시지가 다른 사람들의 메시지')
                    return len(messages)
                
                # 내가 보낸 메시지 이후의 다른 사람들의 메시지 개수 계산
                other_people_messages = 0
                for i in range(my_last_message_index):
                    message = messages[i]
                    if hasattr(message, 'from_id') and message.from_id and message.from_id.user_id != my_user_id:
                        other_people_messages += 1
                
                logger.info(f'📊 내가 보낸 메시지 이후 다른 사람들의 메시지 개수: {other_people_messages} (내가 메시지를 보내면 0으로 리셋됨)')
                return other_people_messages
                
            except Exception as e:
                logger.error(f'❌ 메시지 개수 확인 실패: {e}')
                return 0
                
            finally:
                # 연결 해제
                try:
                    if client.is_connected():
                        await client.disconnect()
                        logger.info('📊 클라이언트 연결 해제 완료')
                except Exception as e:
                    logger.error(f'❌ 클라이언트 연결 해제 실패: {e}')
        
        # 새 이벤트 루프에서 실행
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        
        try:
            result = loop.run_until_complete(check_message_count_async())
            return result
        finally:
            loop.close()
            
            # 임시 파일 정리
            try:
                os.remove(f'{temp_session_file}.session')
                logger.info('📊 임시 세션 파일 정리 완료')
            except Exception as e:
                logger.error(f'❌ 임시 파일 정리 실패: {e}')
                
    except Exception as e:
        logger.error(f'❌ 메시지 개수 확인 에러: {e}')
        return 0

def run_scheduler():
    """스케줄러 실행 (백그라운드 스레드)"""
    logger.info('🤖 자동전송 스케줄러 루프 시작')
    while True:
        try:
            schedule.run_pending()
            time.sleep(1)
        except Exception as e:
            logger.error(f'❌ 스케줄러 에러: {e}')
            time.sleep(5)  # 에러 시 5초 대기 후 재시도

# 그룹 목록 API는 Flood Control 때문에 일단 비활성화

# 자동전송 설정 저장 API
@app.route('/api/auto-send/save-settings', methods=['POST'])
@cross_origin(origins=ALLOWED_ORIGINS, methods=['POST','OPTIONS'], allow_headers=['Content-Type','Authorization'], max_age=86400)
def save_auto_send_settings():
    """자동전송 설정 저장"""
    try:
        data = request.get_json()
        logger.info(f'🔥 자동전송 설정 저장 요청 받음: {data}')
        
        user_id = data.get('userId')
        settings = data.get('settings')
        
        logger.info(f'🔥 파싱된 데이터: user_id={user_id}, settings={settings}')
        
        if not user_id or not settings:
            logger.error(f'🔥 필수 데이터 누락: user_id={user_id}, settings={settings}')
            return jsonify({
                'success': False,
                'error': '사용자 ID와 설정이 필요합니다.'
            }), 400
        
        # Firebase에 설정 저장
        logger.info(f'🔥 Firebase 저장 시작: user_id={user_id}')
        result = save_auto_send_settings_to_firebase(user_id, settings)
        logger.info(f'🔥 Firebase 저장 결과: {result}')
        
        if result:
            logger.info(f'🔥 자동전송 설정 저장 성공: {user_id}')
            return jsonify({
                'success': True,
                'message': '자동전송 설정이 저장되었습니다.'
            })
        else:
            logger.error(f'🔥 자동전송 설정 저장 실패: {user_id}')
            return jsonify({
                'success': False,
                'error': '자동전송 설정 저장에 실패했습니다.'
            }), 500
            
    except Exception as error:
        logger.error(f'❌ 자동전송 설정 저장 실패: {error}')
        return jsonify({
            'success': False,
            'error': f'자동전송 설정 저장 실패: {str(error)}'
        }), 500

# 자동전송 시작 API
@app.route('/api/auto-send/start', methods=['POST'])
@cross_origin(origins=ALLOWED_ORIGINS, methods=['POST','OPTIONS'], allow_headers=['Content-Type','Authorization'], max_age=86400)
def start_auto_send():
    """자동전송 시작"""
    try:
        logger.info('🔥 자동전송 API 호출됨!')
        logger.info(f'🔥 요청 데이터: {request.get_json()}')
        
        data = request.get_json()
        account_name = (data.get('account_name') or '').strip()
        user_id = (data.get('userId') or '').strip()
        group_ids = data.get('group_ids', [])
        message = (data.get('message', '') or '').strip()
        media_info = data.get('media_info')
        
        logger.info(f'🚀 자동전송 시작 요청: account_name={account_name}, group_ids={group_ids}')
        
        if (not account_name and not user_id) or not group_ids:
            return jsonify({
                'success': False,
                'error': '사용자 ID 또는 계정명과 그룹 ID 목록이 필요합니다.'
            }), 400
        
        # userId가 없으면 계정명으로 user_id 찾기
        if not user_id and account_name:
            try:
                accounts_response = requests.get(f"{FIREBASE_URL}/authenticated_accounts.json", timeout=10)
                if accounts_response.status_code == 200:
                    accounts_data = accounts_response.json()
                    if accounts_data:
                        for uid, account_data in accounts_data.items():
                            if account_data and isinstance(account_data, dict):
                                full_name = f"{account_data.get('first_name', '')} {account_data.get('last_name', '')}".strip()
                                if full_name == account_name:
                                    user_id = uid
                                    break
            except Exception as e:
                logger.error(f'❌ 계정 조회 실패: {e}')
        
        if not user_id:
            return jsonify({
                'success': False,
                'error': '계정을 찾을 수 없습니다.'
            }), 404
        
        # 자동전송 작업 시작
        result = start_auto_send_job(user_id, group_ids, message, media_info)
        
        if result:
            return jsonify({
                'success': True,
                'message': '자동전송이 시작되었습니다.'
            })
        else:
            return jsonify({
                'success': False,
                'error': '자동전송 시작에 실패했습니다.'
            }), 500
            
    except Exception as error:
        logger.error(f'❌ 자동전송 시작 실패: {error}')
        return jsonify({
            'success': False,
            'error': f'자동전송 시작 실패: {str(error)}'
        }), 500

# 자동전송 중지 API
@app.route('/api/auto-send/stop', methods=['POST'])
def stop_auto_send():
    """자동전송 중지"""
    try:
        data = request.get_json()
        user_id = data.get('userId')
        
        if not user_id:
            return jsonify({
                'success': False,
                'error': '사용자 ID가 필요합니다.'
            }), 400
        
        # 자동전송 작업 중지
        result = stop_auto_send_job(user_id)
        
        if result:
            return jsonify({
                'success': True,
                'message': '자동전송이 중지되었습니다.'
            })
        else:
            return jsonify({
                'success': False,
                'error': '자동전송 중지에 실패했습니다.'
            }), 500
            
    except Exception as error:
        logger.error(f'❌ 자동전송 중지 실패: {error}')
        return jsonify({
            'success': False,
            'error': f'자동전송 중지 실패: {str(error)}'
        }), 500

# 자동전송 재개(필요 시) API: Firebase 상태가 활성인데 메모리에 작업이 없으면 복원
@app.route('/api/auto-send/resume-if-active', methods=['POST'])
def resume_auto_send_if_active():
    try:
        data = request.get_json() or {}
        user_id = (data.get('userId') or '').strip()
        if not user_id:
            return jsonify({'success': False, 'error': 'userId가 필요합니다.'}), 400

        # 이미 실행 중이면 그대로 성공 처리
        if user_id in auto_send_jobs:
            return jsonify({'success': True, 'resumed': False, 'message': '이미 실행 중입니다.'})

        # Firebase 상태 확인
        status = get_auto_send_status_from_firebase(user_id)
        if status and status.get('is_active'):
            group_ids = status.get('group_ids', [])
            message = status.get('message', '')
            media_info = status.get('media_info')
            if group_ids:
                ok = start_auto_send_job(user_id, group_ids, message, media_info)
                if ok:
                    return jsonify({'success': True, 'resumed': True, 'message': '자동전송을 재개했습니다.'})
        return jsonify({'success': True, 'resumed': False, 'message': '재개할 작업이 없습니다.'})
    except Exception as e:
        logger.error(f'❌ 자동전송 재개 실패: {e}')
        return jsonify({'success': False, 'error': f'재개 실패: {str(e)}'}), 500

# 그룹 메시지 개수 확인 API
@app.route('/api/telegram/check-message-count', methods=['POST'])
def check_group_message_count():
    """그룹의 메시지 개수 확인 (내가 보낸 메시지 이후 다른 사람들의 메시지)"""
    try:
        data = request.get_json()
        user_id = data.get('userId')
        group_id = data.get('groupId')
        
        if not user_id or not group_id:
            return jsonify({
                'success': False,
                'error': '사용자 ID와 그룹 ID가 필요합니다.'
            }), 400
        
        # 계정 정보 조회
        account_info = get_account_from_firebase(user_id)
        if not account_info:
            return jsonify({
                'success': False,
                'error': '계정 정보를 찾을 수 없습니다.'
            }), 404
        
        # 메시지 개수 확인
        message_count = check_telegram_group_message_count(account_info, group_id)
        
        return jsonify({
            'success': True,
            'messageCount': message_count,
            'groupId': group_id
        })
        
    except Exception as error:
        logger.error(f'❌ 메시지 개수 확인 실패: {error}')
        return jsonify({
            'success': False,
            'error': f'메시지 개수 확인 실패: {str(error)}'
        }), 500

# 자동전송 상태 조회 API
@app.route('/api/auto-send/status', methods=['POST'])
def get_auto_send_status():
    """자동전송 상태 조회"""
    try:
        data = request.get_json()
        user_id = (data.get('userId') or data.get('account_name') or '').strip()
        
        if not user_id:
            return jsonify({
                'success': False,
                'error': '사용자 ID 또는 계정명이 필요합니다.'
            }), 400
        
        # 현재 작업 상태 확인
        is_running = user_id in auto_send_jobs
        current_repeats = auto_send_jobs.get(f'{user_id}_repeats', 0)
        
        # 스케줄된 작업 개수 확인
        scheduled_jobs = len(schedule.jobs)
        
        # 설정 조회 (평탄화된 설정)
        settings = get_auto_send_settings_from_firebase(user_id)

        # Firebase에 저장된 최신 상태(그룹/메시지/미디어)를 함께 반환하여 프론트가 서버 상태를 1:1로 복원할 수 있게 함
        fb_status = get_auto_send_status_from_firebase(user_id) or {}
        fb_group_ids = fb_status.get('group_ids', [])
        fb_message = fb_status.get('message')
        fb_media_info = fb_status.get('media_info')
        
        logger.info(f'🤖 자동전송 상태 조회: user_id={user_id}, is_running={is_running}, scheduled_jobs={scheduled_jobs}')
        
        return jsonify({
            'success': True,
            'is_running': is_running,
            'current_repeats': current_repeats,
            'scheduled_jobs': scheduled_jobs,
            'settings': settings,
            'job_info': auto_send_jobs.get(user_id) if is_running else None,
            'group_ids': fb_group_ids,
            'message': fb_message,
            'media_info': fb_media_info
        })
        
    except Exception as error:
        logger.error(f'❌ 자동전송 상태 조회 실패: {error}')
        return jsonify({
            'success': False,
            'error': f'자동전송 상태 조회 실패: {str(error)}'
        }), 500

# Keep-Alive 엔드포인트 (Render Free Plan용)
@app.route('/ping')
def ping():
    return jsonify({
        'status': 'alive',
        'timestamp': datetime.now().isoformat()
    })

def restore_auto_send_jobs_from_firebase():
    """서버 시작 시 Firebase에서 자동전송 작업 복원"""
    try:
        logger.info('🔄 Firebase에서 자동전송 작업 복원 시작')
        
        url = f"{FIREBASE_URL}/auto_send_status.json"
        response = requests.get(url, timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            if data:
                for user_id, status_data in data.items():
                    if status_data.get('is_active'):
                        logger.info(f'🔄 자동전송 작업 복원: {user_id}')
                        
                        # 메모리에 작업 복원
                        auto_send_jobs[user_id] = {
                            'job_id': status_data.get('job_id'),
                            'group_ids': status_data.get('group_ids', []),
                            'message': status_data.get('message', ''),
                            'media_info': status_data.get('media_info'),
                            'started_at': status_data.get('started_at')
                        }
                        
                        # 스케줄 작업 재등록
                        settings = get_auto_send_settings_from_firebase(user_id)
                        if settings:
                            repeat_interval = settings.get('repeatInterval', 30)
                            
                            def job():
                                execute_auto_send_job(user_id, status_data.get('group_ids', []), 
                                                    status_data.get('message', ''), 
                                                    status_data.get('media_info'))
                            
                            schedule.every(repeat_interval).minutes.do(job)
                            logger.info(f'✅ 자동전송 스케줄 복원: {user_id} (간격: {repeat_interval}분)')
                            # 빠른 검사 스케줄 제거 (중복 실행 방지)
                            # 서버 재시작 직후에도 대기하지 않고 즉시 한 번 실행
                            try:
                                execute_auto_send_job(user_id, status_data.get('group_ids', []), 
                                                      status_data.get('message', ''), 
                                                      status_data.get('media_info'))
                                logger.info(f'🚀 복원 직후 1회 즉시 실행 완료: {user_id}')
                            except Exception as _e:
                                logger.error(f'❌ 복원 직후 즉시 실행 실패: {user_id} - {_e}')
                        
                logger.info(f'🔄 자동전송 작업 복원 완료: {len(data)}개')
            else:
                logger.info('🔄 복원할 자동전송 작업 없음')
        else:
            logger.error(f'🔥 Firebase 자동전송 상태 조회 실패: {response.status_code}')
            
    except Exception as e:
        logger.error(f'🔥 자동전송 작업 복원 에러: {e}')

def auto_resume_watchdog_loop():
    """주기적으로 Firebase를 스캔해 is_active인데 메모리에 작업이 없으면 재개"""
    logger.info('🛡️ 자동전송 워치독 시작(60초 주기)')
    while True:
        try:
            url = f"{FIREBASE_URL}/auto_send_status.json"
            response = requests.get(url, timeout=10)
            if response.status_code == 200:
                data = response.json() or {}
                for user_id, status_data in data.items():
                    if not status_data:
                        continue
                    if status_data.get('is_active') and user_id not in auto_send_jobs:
                        logger.info(f'🛡️ 워치독: 실행 누락 감지 → 재개 시도: {user_id}')
                        group_ids = status_data.get('group_ids', [])
                        message = status_data.get('message', '')
                        media_info = status_data.get('media_info')
                        if group_ids:
                            try:
                                start_auto_send_job(user_id, group_ids, message, media_info)
                            except Exception as _e:
                                logger.error(f'🛡️ 워치독 재개 실패: {user_id} - {_e}')
            time.sleep(60)
        except Exception as e:
            logger.error(f'🛡️ 워치독 루프 에러: {e}')
            time.sleep(60)
if __name__ == '__main__':
    port = int(os.environ.get('PORT', 3000))
    logger.info(f'🚀 WINT365 Python 서버 시작됨 - 포트: {port}')
    logger.info(f'📋 Telethon 모듈: {"✅ 로드됨" if TelegramClient else "❌ 로드 실패"}')
    
    if not TelegramClient:
        logger.error('⚠️  Telethon 모듈 로드 실패 - MTProto API 사용 불가')
    else:
        logger.info('✅ MTProto API 사용 준비 완료!')
    
    # Firebase에서 자동전송 작업 복원 (비동기)
    try:
        threading.Thread(target=restore_auto_send_jobs_from_firebase, daemon=True).start()
        logger.info('🔄 자동전송 작업 복원(백그라운드) 시작')
    except Exception as _e:
        logger.error(f'❌ 자동전송 작업 복원 스레드 시작 실패: {_e}')
    
    # 자동전송 스케줄러 백그라운드 실행
    scheduler_thread = threading.Thread(target=run_scheduler, daemon=True)
    scheduler_thread.start()
    logger.info('🤖 자동전송 스케줄러 시작됨')
    # 워치독 시작
    threading.Thread(target=auto_resume_watchdog_loop, daemon=True).start()
    
    # 서버 시작 (Render에서는 HTTP 사용)
    app.run(host='0.0.0.0', port=port, debug=False)
