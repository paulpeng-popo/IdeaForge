# 給任何使用這支程式的人：這支程式是跨語言合成(台語、國語和英語) API 的 client 端。
# 支援在一同句話中包含兩種語言合成: 台語+英語 (language 使用 "tw") 和 國語+英語 (language 使用 "zh")
# 具體上會發送最下方變數 text, language, speaker 給伺服器，並接收一個回傳的 wav 檔，output.wav

import os
import socket
import struct
import argparse

class TTSCrossLanguage:
    def __init__(self, path):
        self.__host = "140.116.245.147"
        self.__port = 10000
        self.__token = "mi2stts"
        self.__path = path

    def askForService(self, text:str):
        '''
        Ask cross language synthesis server.
        Params:
            text        :(str) Text to be synthesized. 
        '''
        if not len(text):
            raise ValueError ("Length of text must be bigger than zero")
        
        try:
            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            sock.connect((self.__host, self.__port))
            msg = bytes(self.__token + "@@@" + text + '@@@' + self.__speaker + '@@@'+ self.__language, "utf-8")
            msg = struct.pack(">I", len(msg)) + msg
            sock.sendall(msg)
            
            filename = os.path.join(self.__path, "output.wav")
            with open(filename, "wb") as f:
                while True:
                    l = sock.recv(8192)
                    if not l: 
                        break
                    f.write(l)
            
            # print("File received complete")
        
        except Exception as e:
            print(e)
        
        finally:
            sock.close()

    def set_language(self, language:str, speaker:str):
        '''
        Params:
            language    :(str) Language to be synthesized, "tw" is Taiwanese or "zh" is Chinese or "en" is English.
            speaker     :(str) Target speaker to be synthesized.
        '''
        self.__language = language
        if self.__language not in ['tw', 'zh', 'en']:
            raise ValueError('Language must be "tw" or "zh" or "en".')
        
        if speaker:
            self.__speaker = speaker
        
        elif self.__language == 'tw':
            self.__speaker = 'F64'
        
        elif self.__language == 'zh':
            self.__speaker = 'F101'

        elif self.__language == 'en':
            self.__speaker = 'en10'

if __name__=='__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--text', type=str, default='Today is Friday，要去台南走走', help='Text to be synthesized.')

    parser.add_argument('--language', 
                        type=str, 
                        default='zh',
                        choices=['tw', 'zh', 'en'], 
                        help='Language to be synthesized, "tw" is Taiwanese, "zh" is Chinese or "en" is English.')
    
    parser.add_argument('--speaker',
                        type=str, 
                        default='UDN', 
                        choices=['F06', 'F07', 'F26', 'F52', 'F53', 'F64', 'F68',     # Taiwanese speaker
                                 'F100','F101','F102','F103','F106','UDN',            # Chinese speaker
                                 'en7', 'en9', 'en10','en11','en14','en16','en18'],   # English speaker
                        help='Target speaker to be synthesized.')
    args = parser.parse_args()
    
    tts_client = TTSCrossLanguage()
    tts_client.set_language(language=args.language, speaker=args.speaker)
    tts_client.askForService(args.text)
