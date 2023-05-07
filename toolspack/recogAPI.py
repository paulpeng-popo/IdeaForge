import os
import base64
import ffmpeg
import hashlib
import datetime
import requests


class ASRChineseAPI():
    def __init__(self, blob, path):
        self.blob = blob
        self.path = path
        self.response = None

    def recognize(self):
        hashing_str = hashlib.md5(self.blob).hexdigest()
        time_str = datetime.datetime.now().strftime("%Y%m%d%H%M%S")
        hashing_str = time_str + "_" + hashing_str

        temp_audio = os.path.join(self.path, "temp_" + hashing_str + ".wav")
        audio_file = os.path.join(self.path, hashing_str + ".wav")

        with open(temp_audio, "wb") as audio:
            audio.write(self.blob)

        # transform audio file into the right audio format
        # print("start transform")
        stream = ffmpeg.input(temp_audio)
        stream = ffmpeg.output(
            stream,
            audio_file,
            ac=1,
            ar=16000,
            loglevel="quiet"
        )
        ffmpeg.run(stream)
        os.remove(temp_audio)
        
        with open(audio_file, "rb") as _f:
            raw_data = _f.read()

        audio_data = base64.b64encode(raw_data)
        msg_dict = {
            "model_name": "DUMMY_NEW",
            "token": "xxx",
            "audio_data": audio_data,
            "source": "P"
        }

        os.remove(audio_file)
        self.response = requests.post(
            "http://140.116.245.149:2802/asr", data=msg_dict)
        self.response = self.response.json()
        
    def get_text(self):
        response = self.response["words"]
        if len(response) > 0:
            return response[0].strip().replace(" ", "").replace("<SPOKEN_NOISE>", "")
        else:
            return "ERROR"
