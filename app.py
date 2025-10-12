from flask import Flask, request, jsonify, send_from_directory, send_file
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
import re

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
            return jsonify({
                'success': False,
                'error': '인증된 계정 정보를 찾을 수 없습니다. 다시 인증해주세요.'
            }), 404

        # 저장된 메시지 가져오기
        saved_messages = get_telegram_saved_messages_with_session(account_info)

        if saved_messages is None:
            logger.error('❌ 저장된 메시지 가져오기 실패')
            return jsonify({
                'success': False,
                'error': '저장된 메시지 가져오기에 실패했습니다. 세션이 만료되었거나 연결에 문제가 있을 수 있습니다.'
            }), 500

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
        
        if not user_id or not group_id or not message:
            return jsonify({
                'success': False,
                'error': '사용자 ID, 그룹 ID, 메시지가 모두 필요합니다.'
            }), 400
        
        logger.info(f'📤 메시지 전송 요청: 사용자={user_id}, 그룹={group_id}, 메시지={message[:50]}...')
        
        # 미디어 정보 가져오기
        media_info = data.get('mediaInfo')
        logger.info(f'📤 미디어 정보: {media_info}')
        
        # 커스텀 이모지 정보 가져오기
        custom_emojis = data.get('customEmojis', [])
        logger.info(f'😀 커스텀 이모지 개수: {len(custom_emojis)}')
        
        # Firebase에서 계정 정보 조회
        account_info = get_account_from_firebase(user_id)
        if not account_info:
            logger.error(f'❌ 계정 정보 없음: {user_id}')
            return jsonify({
                'success': False,
                'error': '인증된 계정 정보를 찾을 수 없습니다. 다시 인증해주세요.'
            }), 404
        
        logger.info(f'📤 계정 정보 조회 성공: {account_info.get("first_name", "Unknown")}')
        
        # 메시지 전송 실행 (미디어 정보 및 커스텀 이모지 포함)
        result = send_message_to_telegram_group(account_info, group_id, message, media_info, custom_emojis)
        
        if result:
            logger.info(f'✅ 메시지 전송 성공: 그룹={group_id}')
            return jsonify({
                'success': True,
                'message': '메시지가 성공적으로 전송되었습니다.',
                'group_id': group_id,
                'message_preview': message[:100] + ('...' if len(message) > 100 else '')
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
                        # 완전히 새로운 접근: 텔레그램의 원본 메시지 데이터를 직접 가져오기
                        logger.info('💾 🚀 최종 방법: 텔레그램 원본 메시지 데이터 직접 가져오기')
                        
                        # 방법 1: get_messages로 원본 데이터 가져오기
                        messages = await client.get_messages(InputPeerSelf(), limit=100)
                        logger.info(f'💾 저장된 메시지 {len(messages)}개를 찾았습니다.')
                        
                        # 원본 메시지 데이터를 더 상세하게 분석
                        if messages:
                            logger.info('💾 원본 메시지 데이터 상세 분석 시작')
                            for msg in messages[:3]:  # 처음 3개만 상세 분석
                                logger.info(f'💾 메시지 ID: {msg.id}')
                                logger.info(f'💾 원본 텍스트 (repr): {repr(msg.text)}')
                                logger.info(f'💾 원본 텍스트 (str): {msg.text}')
                                logger.info(f'💾 엔티티 개수: {len(msg.entities) if msg.entities else 0}')
                                
                                # 원본 메시지의 모든 속성 확인
                                logger.info(f'💾 메시지 속성들: {[attr for attr in dir(msg) if not attr.startswith("_")]}')
                                
                                if msg.entities:
                                    for i, entity in enumerate(msg.entities[:10]):  # 처음 10개 엔티티
                                        logger.info(f'💾 엔티티 {i}: {type(entity).__name__}')
                                        logger.info(f'💾   - offset: {entity.offset}, length: {entity.length}')
                                        if hasattr(entity, 'type'):
                                            logger.info(f'💾   - type: {entity.type}')
                                        if hasattr(entity, 'document_id'):
                                            logger.info(f'💾   - document_id: {entity.document_id}')
                                        if hasattr(entity, 'url'):
                                            logger.info(f'💾   - url: {entity.url}')
                                
                                # 원본 메시지의 raw 데이터 확인
                                logger.info(f'💾 원본 메시지 raw 데이터: {msg}')
                                
                                # 텔레그램의 원본 포맷팅을 그대로 사용해보기
                                if msg.entities:
                                    logger.info('💾 원본 포맷팅을 그대로 사용 시도')
                                    try:
                                        # 텔레그램의 원본 포맷팅을 마크다운으로 변환
                                        from telethon.tl.types import MessageEntityBold, MessageEntityItalic, MessageEntityCode, MessageEntityPre, MessageEntityTextUrl, MessageEntityCustomEmoji
                                        
                                        # 텍스트를 문자 배열로 변환
                                        text_chars = list(msg.text or '')
                                        
                                        # 엔티티를 offset 기준으로 정렬 (역순으로)
                                        sorted_entities = sorted(msg.entities, key=lambda x: x.offset, reverse=True)
                                        
                                        for entity in sorted_entities:
                                            start = entity.offset
                                            end = entity.offset + entity.length
                                            
                                            if isinstance(entity, MessageEntityBold):
                                                text_chars.insert(end, '**')
                                                text_chars.insert(start, '**')
                                            elif isinstance(entity, MessageEntityItalic):
                                                text_chars.insert(end, '*')
                                                text_chars.insert(start, '*')
                                            elif isinstance(entity, MessageEntityCode):
                                                text_chars.insert(end, '`')
                                                text_chars.insert(start, '`')
                                            elif isinstance(entity, MessageEntityPre):
                                                text_chars.insert(end, '```')
                                                text_chars.insert(start, '```')
                                            elif isinstance(entity, MessageEntityTextUrl):
                                                url = entity.url
                                                text_chars.insert(end, f']({url})')
                                                text_chars.insert(start, '[')
                                        
                                        # 복원된 텍스트
                                        restored_text = ''.join(text_chars)
                                        logger.info(f'💾 ✅ 복원된 텍스트: {restored_text[:100]}...')
                                        
                                    except Exception as e:
                                        logger.error(f'❌ 원본 포맷팅 복원 실패: {e}')
                        
                        if len(messages) == 0:
                            # 대화 목록에서 자신과의 대화 찾기
                            dialogs = await client.get_dialogs()
                            logger.info(f'💾 총 {len(dialogs)}개의 대화 확인 중...')
                            
                            for dialog in dialogs:
                                if dialog.entity.id == me.id:
                                    messages = await client.get_messages(dialog.entity, limit=100)
                                    logger.info(f'💾 대화 목록에서 저장된 메시지 {len(messages)}개를 찾았습니다.')
                                    break
                        
                    except Exception as e:
                        logger.error(f'❌ 저장된 메시지 가져오기 실패: {e}')
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
                            
                            # 🚀 최종 해결책: 원본 텍스트를 그대로 보존 (복잡한 변환 없이)
                            logger.info(f'💾 🚀 최종 해결책: 원본 텍스트 그대로 보존')
                            
                            # 가장 간단한 방법: 원본 텍스트를 그대로 사용
                            original_text = message.text or ''
                            logger.info(f'💾 원본 텍스트: {original_text[:100]}...')
                            
                            # 엔티티 정보만 저장 (복잡한 변환은 하지 않음)
                            if message.entities:
                                logger.info(f'💾 엔티티 개수: {len(message.entities)}')
                                # 엔티티 정보는 나중에 전송할 때 사용
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
                                'has_custom_emoji': False,
                                'custom_emoji_entities': [],
                                'entities': [],
                                'raw_message_data': {
                                    'id': message.id,
                                    'text': original_text,  # 원본 텍스트 그대로 사용
                                    'entities': [],
                                    'original_message': {
                                        'id': message.id,
                                        'text': original_text,  # 원본 텍스트 그대로 사용
                                        'entities': [],  # JSON 직렬화 문제로 빈 배열로 설정
                                        'date': message.date.isoformat() if message.date else None,
                                        'from_id': str(getattr(message, 'from_id', None)) if getattr(message, 'from_id', None) else None,
                                        'peer_id': str(getattr(message, 'peer_id', None)) if getattr(message, 'peer_id', None) else None
                                    }
                                }
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

def send_message_to_telegram_group(account_info, group_id, message, media_info=None, custom_emojis=None):
    """텔레그램 그룹에 메시지 전송"""
    try:
        logger.info(f'📤 텔레그램 메시지 전송 시작: {account_info["user_id"]} -> {group_id}')
        logger.info(f'📤 메시지 내용: {message[:100]}...')
        logger.info(f'📤 미디어 정보: {media_info}')
        logger.info(f'😀 커스텀 이모지 개수: {len(custom_emojis) if custom_emojis else 0}')
        
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
                logger.info(f'📤 메시지 전송 중: 그룹={group_entity.title}, 메시지={message[:50]}...')
                
                # 커스텀 이모지가 있는 경우 처리
                if custom_emojis and len(custom_emojis) > 0:
                    logger.info('😀 커스텀 이모지 포함 메시지 전송')
                    
                    # 커스텀 이모지 엔티티 생성
                    from telethon.tl.types import MessageEntityCustomEmoji
                    
                    telegram_entities = []
                    for emoji_info in custom_emojis:
                        try:
                            custom_emoji_entity = MessageEntityCustomEmoji(
                                offset=emoji_info['offset'],
                                length=emoji_info['length'],
                                document_id=emoji_info['document_id']
                            )
                            telegram_entities.append(custom_emoji_entity)
                            logger.info(f'😀 커스텀 이모지 엔티티 생성: offset={emoji_info["offset"]}, length={emoji_info["length"]}, document_id={emoji_info["document_id"]}')
                        except Exception as e:
                            logger.error(f'❌ 커스텀 이모지 엔티티 생성 실패: {e}')
                    
                    # 커스텀 이모지와 함께 메시지 전송
                    try:
                        logger.info('😀 커스텀 이모지와 함께 메시지 전송 시도')
                        sent_message = await client.send_message(
                            group_entity, 
                            message, 
                            formatting_entities=telegram_entities
                        )
                        logger.info(f'✅ 커스텀 이모지 메시지 전송 성공: {sent_message.id}')
                    except Exception as e:
                        logger.error(f'❌ 커스텀 이모지 메시지 전송 실패: {e}')
                        
                        # 백업: 일반 메시지 전송
                        try:
                            sent_message = await client.send_message(group_entity, message)
                            logger.info(f'✅ 백업 메시지 전송 성공: {sent_message.id}')
                        except Exception as e2:
                            logger.error(f'❌ 백업 메시지 전송도 실패: {e2}')
                            return False
                
                # 원본 메시지 데이터가 있는지 확인
                elif media_info and media_info.get('raw_message_data'):
                    # 원본 메시지 데이터로 전송
                    raw_data = media_info.get('raw_message_data')
                    logger.info('📤 원본 메시지 데이터로 전송')
                    logger.info(f'📤 원본 데이터: {raw_data}')
                    
                    # 원본 텍스트와 엔티티 사용
                    original_text = raw_data.get('text', message)
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
                        sent_message = await client.send_message(group_entity, original_text)
                        logger.info(f'✅ 백업 성공: 단순 텍스트 전송 완료: {sent_message.id}')
                
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
                        logger.info(f'📤 전송할 메시지: {message}')
                        logger.info(f'📤 전송할 엔티티 개수: {len(telegram_entities)}')
                        
                        # formatting_entities 대신 entities 사용 시도
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
                        logger.warning('⚠️ 커스텀 이모지 엔티티가 없습니다')
                        await client.send_message(group_entity, message)
                    
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
                    await client.send_message(group_entity, message)
                
                logger.info('✅ 메시지 전송 성공')
                
                return True
                
            except Exception as e:
                logger.error(f'❌ 메시지 전송 실패: {e}')
                logger.error(f'❌ 에러 타입: {type(e)}')
                logger.error(f'❌ 에러 상세: {str(e)}')
                import traceback
                logger.error(f'❌ 스택 트레이스: {traceback.format_exc()}')
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

def run_telethon_get_custom_emojis(account_info):
    """연동된 계정의 커스텀 이모지 가져오기"""
    try:
        # 새로운 이벤트 루프 생성
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        
        # 비동기 함수 실행
        result = loop.run_until_complete(get_custom_emojis_async(account_info))
        
        # 이벤트 루프 정리
        loop.close()
        
        return result
        
    except Exception as e:
        logger.error(f'❌ 커스텀 이모지 가져오기 실패: {e}')
        return None

async def get_custom_emojis_async(account_info):
    """연동된 계정의 커스텀 이모지 가져오기"""
    temp_session_file = None
    
    try:
        # 세션 데이터 디코딩
        session_data = base64.b64decode(account_info['session_data'])
        temp_session_file = f'temp_session_{account_info["user_id"]}.session'
        
        with open(temp_session_file, 'wb') as f:
            f.write(session_data)
        
        logger.info(f'😀 세션 데이터 길이: {len(session_data)}')
        
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
        
        logger.info('✅ 클라이언트 연결 상태 확인 완료')
        
        # 커스텀 이모지 팩들 가져오기 (간단한 방법)
        try:
            # 텔레그램의 커스텀 이모지 팩들 가져오기
            from telethon.tl.functions.messages import GetEmojiStickersRequest
            
            # 빈 스티커셋으로 요청하여 모든 커스텀 이모지 팩 가져오기
            result = await client(GetEmojiStickersRequest(
                hash=0
            ))
            
            logger.info(f'😀 커스텀 이모지 팩 개수: {len(result.sets)}')
            
            emoji_packs = []
            for sticker_set in result.sets:
                try:
                    pack_info = {
                        'id': str(sticker_set.id),
                        'title': sticker_set.title,
                        'short_name': sticker_set.short_name,
                        'emojis': []
                    }
                    
                    # 각 팩의 이모지들 가져오기 (올바른 방법)
                    try:
                        # 스티커셋 정보 가져오기
                        from telethon.tl.functions.messages import GetStickerSetRequest
                        from telethon.tl.types import InputStickerSetID
                        
                        input_sticker_set = InputStickerSetID(
                            id=sticker_set.id,
                            access_hash=sticker_set.access_hash
                        )
                        
                        # 스티커셋의 상세 정보 가져오기
                        sticker_set_info = await client(GetStickerSetRequest(
                            stickerset=input_sticker_set,
                            hash=0
                        ))
                        
                        # 스티커셋의 문서들 처리
                        for document in sticker_set_info.documents:
                            if hasattr(document, 'id') and document.id:
                                emoji_info = {
                                    'document_id': document.id,
                                    'access_hash': document.access_hash,
                                    'mime_type': document.mime_type,
                                    'size': document.size,
                                    'alt': '😀'  # 기본값
                                }
                                
                                # 문서 속성들에서 alt 텍스트 찾기
                                for attr in document.attributes:
                                    if hasattr(attr, 'alt') and attr.alt:
                                        emoji_info['alt'] = attr.alt
                                        break
                                
                                pack_info['emojis'].append(emoji_info)
                    
                    except Exception as e:
                        logger.error(f'❌ 스티커셋 {sticker_set.title} 처리 실패: {e}')
                        continue
                    
                    if pack_info['emojis']:
                        emoji_packs.append(pack_info)
                        logger.info(f'😀 팩 "{pack_info["title"]}" - 이모지 {len(pack_info["emojis"])}개')
                
                except Exception as e:
                    logger.error(f'❌ 이모지 팩 처리 실패: {e}')
                    continue
            
            logger.info(f'😀 총 {len(emoji_packs)}개 팩에서 {sum(len(pack["emojis"]) for pack in emoji_packs)}개 이모지 수집')
            return emoji_packs
            
        except Exception as e:
            logger.error(f'❌ 커스텀 이모지 팩 가져오기 실패: {e}')
            return None
        
    except Exception as e:
        logger.error(f'❌ 커스텀 이모지 가져오기 실패: {e}')
        return None
        
    finally:
        # 클라이언트 연결 해제
        if 'client' in locals() and client.is_connected():
            await client.disconnect()
            logger.info('🔍 클라이언트 연결 해제 완료')
        
        # 임시 세션 파일 정리
        if temp_session_file and os.path.exists(temp_session_file):
            os.remove(temp_session_file)
            logger.info('🔍 임시 세션 파일 정리 완료')

# 그룹 목록 API는 Flood Control 때문에 일단 비활성화

# Keep-Alive 엔드포인트 (Render Free Plan용)
@app.route('/api/telegram/get-custom-emojis', methods=['POST'])
def get_custom_emojis():
    """연동된 계정의 커스텀 이모지 가져오기"""
    try:
        data = request.get_json()
        user_id = data.get('userId')
        
        logger.info(f'😀 커스텀 이모지 가져오기 요청: 사용자={user_id}')
        
        if not user_id:
            return jsonify({'success': False, 'error': '사용자 ID가 필요합니다.'}), 400
        
        # Firebase에서 계정 정보 가져오기
        account_info = get_account_from_firebase(user_id)
        if not account_info:
            logger.error(f'❌ 계정 정보를 찾을 수 없습니다: {user_id}')
            return jsonify({'success': False, 'error': '계정 정보를 찾을 수 없습니다.'}), 404
        
        logger.info(f'😀 계정 정보 조회 성공: {account_info.get("first_name", "Unknown")}')
        
        # 커스텀 이모지 가져오기 실행
        with concurrent.futures.ThreadPoolExecutor() as executor:
            future = executor.submit(run_telethon_get_custom_emojis, account_info)
            result = future.result(timeout=60)
        
        if result:
            return jsonify({'success': True, 'emojis': result})
        else:
            return jsonify({'success': False, 'error': '커스텀 이모지 가져오기 실패'}), 500
            
    except Exception as e:
        logger.error(f'❌ 커스텀 이모지 가져오기 오류: {e}')
        return jsonify({'success': False, 'error': str(e)}), 500

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
