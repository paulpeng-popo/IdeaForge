import os
import sys
import base64

from flask_cors import CORS
from toolspack.crossAPI import TTSCrossLanguage
from toolspack.recogAPI import ASRChineseAPI
from flask import Flask, request, jsonify, render_template

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
AudioPath = os.path.join(os.path.dirname(os.path.abspath(__file__)), "audio")

# mkdir audio
if not os.path.exists(AudioPath):
    os.mkdir(AudioPath)

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})
app.config['CORS_HEADERS'] = 'Content-Type'


@app.route("/", methods=["GET"])
def home():
     return render_template("index.html")


@app.route("/say", methods=["POST"])
def api():
    text = request.form.get("text")
    tts_client = TTSCrossLanguage(AudioPath)
    tts_client.set_language(language="zh", speaker="UDN")
    tts_client.askForService(text)

    filename = os.path.join(AudioPath, "output.wav")
    with open(filename, "rb") as audio:
        audio_b64 = base64.b64encode(audio.read())

    result = {
        "status": "true",
        "data": audio_b64.decode("utf-8"),
    }
    return jsonify(result)


@app.route("/recog", methods=["POST"])
def recog():
    audio_blob = request.data
    recog_client = ASRChineseAPI(audio_blob, AudioPath)
    recog_client.recognize()
    text = recog_client.get_text()
    return jsonify(text=text)


if __name__ == "__main__":
    HOST = "0.0.0.0"
    PORT = 6093
    app.run(host=HOST, port=PORT, debug=True)
