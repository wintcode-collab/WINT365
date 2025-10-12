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
            
            # Telethon을 동기적으로 실행 (세션 파일 문제 해결)
            import asyncio
            import tempfile
            import os
            
            # 임시 세션 파일 생성
            session_file = os.path.join(tempfile.gettempdir(), f'telegram_session_{client_id}')
            logger.info(f'📁 세션 파일 경로: {session_file}')
            
            async def send_code_async():
                # Telethon 클라이언트 생성
                logger.info('🔧 Telethon 클라이언트 생성 중...')
                client = TelegramClient(session_file, api_id, api_hash)
                logger.info('✅ Telethon 클라이언트 생성 완료')
                
                try:
                    logger.info('🔌 Telegram 서버 연결 중...')
                    await client.connect()
                    logger.info('✅ Telegram 서버 연결 성공')
                    
                    logger.info('📱 인증코드 발송 요청 중...')
                    logger.info(f'📋 전화번호 형식: {phone_number}')
                    logger.info(f'📋 API ID: {api_id}')
                    logger.info(f'📋 API Hash: ***{api_hash[-4:]}')
                    
                    # 텔레그램 앱으로 인증코드 요청
                    result = await client.send_code_request(phone_number)
                    logger.info(f'✅ 인증코드 발송 성공: phone_code_hash=***{result.phone_code_hash[-4:]}')
                    logger.info(f'📋 결과 타입: {type(result)}')
                    logger.info(f'📋 결과 속성: {dir(result)}')
                    
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
                    
                    return client, result
                except Exception as e:
                    logger.error(f'❌ send_code_async 에러: {e}')
                    raise e
                finally:
                    # 연결 해제하지 않음 (세션 유지를 위해)
                    logger.info('🔌 클라이언트 연결 유지 (세션 보존)')
            
            # 새 이벤트 루프에서 실행
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            try:
                client, result = loop.run_until_complete(send_code_async())
            finally:
                loop.close()
            
            
            # 클라이언트 데이터 저장
            clients[client_id] = {
                'client': client,
                'api_id': api_id,
                'api_hash': api_hash,
                'phone_number': phone_number,
                'phone_code_hash': result.phone_code_hash,
                'session_file': session_file
            }
            logger.info('💾 클라이언트 데이터 저장 완료')
            
            return jsonify({
                'success': True,
                'phoneCodeHash': result.phone_code_hash,
                'clientId': client_id,
                'message': '인증코드가 텔레그램 앱으로 발송되었습니다! 텔레그램 앱을 확인해주세요.'
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
                    wait_minutes = wait_seconds // 60
                    error_message = f'요청이 너무 많습니다. {wait_minutes}분 {wait_seconds % 60}초 후에 다시 시도해주세요.'
                else:
                    error_message = '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.'
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
            
            # 기존 클라이언트를 사용하여 인증
            async def verify_code_async():
                # 기존 클라이언트 사용 (세션 유지)
                client = client_data['client']
                logger.info('🔧 기존 클라이언트 사용')
                
                # 클라이언트 연결 상태 확인
                if not client.is_connected():
                    logger.info('🔌 클라이언트 재연결 중...')
                    await client.connect()
                    logger.info('✅ 클라이언트 재연결 완료')
                
                # 실제 인증 수행
                logger.info('🔐 인증 수행 중...')
                phone_code_hash = client_data.get('phone_code_hash')
                if phone_code_hash:
                    logger.info(f'📋 인증 정보: phoneCode={phone_code}, phoneCodeHash=***{phone_code_hash[-4:]}')
                else:
                    logger.error('❌ phone_code_hash가 없습니다!')
                    raise Exception('phone_code_hash가 없습니다')
                
                # 클라이언트 연결 상태 재확인
                if not client.is_connected():
                    logger.info('🔌 클라이언트 재연결 중...')
                    await client.connect()
                    logger.info('✅ 클라이언트 재연결 완료')
                
                # 인증코드 형식 검증
                if not phone_code or len(phone_code) != 5 or not phone_code.isdigit():
                    logger.error(f'❌ 잘못된 인증코드 형식: {phone_code}')
                    raise ValueError(f'인증코드는 5자리 숫자여야 합니다: {phone_code}')
                
                # Telethon의 올바른 sign_in 사용법
                logger.info('🔐 sign_in 메서드 호출 중...')
                logger.info(f'📋 sign_in 파라미터: phone_code={phone_code}, phone_code_hash={phone_code_hash}')
                
                try:
                    result = await client.sign_in(phone_code, phone_code_hash=phone_code_hash)
                    logger.info(f'✅ 인증 성공: userId={result.id}, firstName={result.first_name}')
                except Exception as sign_in_error:
                    logger.error(f'❌ sign_in 실패: {sign_in_error}')
                    logger.error(f'  - 에러 타입: {type(sign_in_error).__name__}')
                    logger.error(f'  - 에러 메시지: {str(sign_in_error)}')
                    raise sign_in_error
                
                return result
            
            # 새 이벤트 루프에서 실행
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            try:
                result = loop.run_until_complete(verify_code_async())
            finally:
                loop.close()
            
            # 클라이언트 정리
            if client_id in clients:
                client_data = clients[client_id]
                # 세션 파일 삭제
                if 'session_file' in client_data:
                    try:
                        import os
                        if os.path.exists(client_data['session_file']):
                            os.remove(client_data['session_file'])
                            logger.info(f'🗑️ 세션 파일 삭제: {client_data["session_file"]}')
                    except Exception as e:
                        logger.warning(f'⚠️ 세션 파일 삭제 실패: {e}')
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
                'message': '실제 MTProto API로 개인 계정 인증이 완료되었습니다!'
            })
            
        except PhoneCodeInvalidError:
            logger.error('❌ 인증코드가 올바르지 않습니다.')
            if client_id in clients:
                client_data = clients[client_id]
                # 세션 파일 삭제
                if 'session_file' in client_data:
                    try:
                        import os
                        if os.path.exists(client_data['session_file']):
                            os.remove(client_data['session_file'])
                            logger.info(f'🗑️ 세션 파일 삭제: {client_data["session_file"]}')
                    except Exception as e:
                        logger.warning(f'⚠️ 세션 파일 삭제 실패: {e}')
                del clients[client_id]
            return jsonify({
                'success': False,
                'error': '인증코드가 올바르지 않습니다. 텔레그램 앱에서 받은 코드를 정확히 입력해주세요.'
            }), 400
            
        except PhoneCodeExpiredError:
            logger.error('❌ 인증코드가 만료되었습니다.')
            if client_id in clients:
                client_data = clients[client_id]
                # 세션 파일 삭제
                if 'session_file' in client_data:
                    try:
                        import os
                        if os.path.exists(client_data['session_file']):
                            os.remove(client_data['session_file'])
                            logger.info(f'🗑️ 세션 파일 삭제: {client_data["session_file"]}')
                    except Exception as e:
                        logger.warning(f'⚠️ 세션 파일 삭제 실패: {e}')
                del clients[client_id]
            return jsonify({
                'success': False,
                'error': '인증코드가 만료되었습니다. 새로운 인증코드를 요청해주세요.'
            }), 400
            
        except SessionPasswordNeededError:
            logger.error('❌ 2단계 인증이 필요합니다.')
            if client_id in clients:
                client_data = clients[client_id]
                # 세션 파일 삭제
                if 'session_file' in client_data:
                    try:
                        import os
                        if os.path.exists(client_data['session_file']):
                            os.remove(client_data['session_file'])
                            logger.info(f'🗑️ 세션 파일 삭제: {client_data["session_file"]}')
                    except Exception as e:
                        logger.warning(f'⚠️ 세션 파일 삭제 실패: {e}')
                del clients[client_id]
            return jsonify({
                'success': False,
                'error': '2단계 인증이 필요합니다. 비밀번호를 입력해주세요.'
            }), 400
            
        except Exception as api_error:
            logger.error(f'❌ 인증코드 검증 실패: {api_error}')
            logger.error(f'  - 에러 타입: {type(api_error).__name__}')
            logger.error(f'  - 에러 메시지: {str(api_error)}')
            logger.error(f'  - 클라이언트 연결 상태: N/A')
            logger.error(f'  - phone_code_hash 존재: {bool(client_data.get("phone_code_hash"))}')
            logger.error(f'  - phone_code_hash 값: {client_data.get("phone_code_hash", "None")}')
            
            if client_id in clients:
                client_data = clients[client_id]
                # 세션 파일 삭제
                if 'session_file' in client_data:
                    try:
                        import os
                        if os.path.exists(client_data['session_file']):
                            os.remove(client_data['session_file'])
                            logger.info(f'🗑️ 세션 파일 삭제: {client_data["session_file"]}')
                    except Exception as e:
                        logger.warning(f'⚠️ 세션 파일 삭제 실패: {e}')
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

# 헬스체크 엔드포인트
@app.route('/health')
def health():
    return jsonify({
        'status': 'healthy',
        'timestamp': datetime.now().isoformat(),
        'telethon_loaded': TelegramClient is not None
    })

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
