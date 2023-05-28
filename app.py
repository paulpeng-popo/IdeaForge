import os
import sys
import uuid
import base64

from flask_cors import CORS
from toolspack.color_speaker import *
from toolspack.crossAPI import TTSCrossLanguage
# from toolspack.recogAPI import ASRChineseAPI
from flask import Flask, session, request, url_for, redirect
from flask import jsonify, render_template
from flask_session import Session
from flask_socketio import SocketIO, emit


### Set up Flask-SocketIO ###
app = Flask(__name__)
app.config["CORS_HEADERS"] = "Content-Type"
app.config["SECRET_KEY"] = os.urandom(24)
app.config["SESSION_PERMANENT"] = False
app.config["SESSION_TYPE"] = "filesystem"

CORS(app, resources={r"/*": {"origins": "*"}})
Session(app)

socketio = SocketIO(app)
socketio = SocketIO(app, cors_allowed_origins="*")
### Set up Flask-SocketIO ###


## Define global variables ##
session = {
    "rooms": {},
    "users": {},
    "messages": {},
}

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
AudioPath = os.path.join(os.path.dirname(os.path.abspath(__file__)), "audio")

# mkdir audio
if not os.path.exists(AudioPath):
    os.mkdir(AudioPath)

app.template_folder = os.path.join(os.path.dirname(os.path.abspath(__file__)), "templates")
app.static_folder = os.path.join(os.path.dirname(os.path.abspath(__file__)), "static")
## Define global variables ##


@app.route("/", methods=["GET"])
def home():
     return render_template("index.html")


@app.route("/check", methods=["POST"])
def check():
    if request.method == "POST":
        post_type = request.form.get("type")
        userName = request.form.get("userName")
        roomId = request.form.get("roomId")

        response = {
            "status": "true",
            "message": "檢查通過",
        }

        name_list = list(session["users"].values())
        if userName in name_list:
            response["status"] = "false"
            response["message"] = "此名稱已被使用"
        
        if post_type == "join":
            if roomId not in session["rooms"]:
                response["status"] = "false"
                response["message"] = "房間不存在"
            return jsonify(response)
        elif post_type == "create":
            if roomId in session["rooms"]:
                response["status"] = "false"
                response["message"] = "房間已存在，刷新頁面以取得新的房間代號"
            return jsonify(response)
        else:
            response["status"] = "false"
            response["message"] = "未知的請求"
            return jsonify(response)

    else:
        return redirect(url_for("home"))


@app.route("/room/<roomId>", methods=["GET"])
def room(roomId):
    return render_template("room.html", roomId=roomId)


@app.route("/say", methods=["POST"])
def api():
    text = request.form.get("text")
    # replace \n with space
    text = text.replace("\n", " ")
    
    if len(text) > 40:
        result = {
            "status": "false",
            "data": "text too long",
        }
        return jsonify(result)

    # use uuid to get unique filename
    filename = str(uuid.uuid4().hex) + ".wav"

    tts_client = TTSCrossLanguage(AudioPath)
    tts_client.set_language(language="zh", speaker="UDN")
    tts_client.askForService(text, filename)

    filename = os.path.join(AudioPath, filename)
    with open(filename, "rb") as audio:
        audio_b64 = base64.b64encode(audio.read())

    result = {
        "status": "true",
        "data": audio_b64.decode("utf-8"),
    }
    
    return jsonify(result)


@app.route("/get_default", methods=["POST"])
def get_default():
    filename = request.form.get("filename")
    try:
        with open(os.path.join(AudioPath, "default", filename), "rb") as audio:
            audio_b64 = base64.b64encode(audio.read())
    except:
        result = {
            "status": "false",
            "data": "file not found",
        }
        return jsonify(result)
    result = {
        "status": "true",
        "data": audio_b64.decode("utf-8"),
    }
    return jsonify(result)


# @app.route("/recog", methods=["POST"])
# def recog():
#     audio_blob = request.data
#     recog_client = ASRChineseAPI(audio_blob, AudioPath)
#     recog_client.recognize()
#     text = recog_client.get_text()
#     return jsonify(text=text)


@socketio.on("connect")
def connect():
    info(request.sid + " connected")


@socketio.on("disconnect")
def disconnect():
    info(request.sid + " disconnected")
    for roomId in session["rooms"]:
        if request.sid in session["rooms"][roomId]:
            session["rooms"][roomId].remove(request.sid)
            session["users"].pop(request.sid, None)
            emit("leave", {"userName": "系統", "roomId": roomId}, broadcast=True)

            # send user list to all users in the room
            userList({"roomId": roomId})


@socketio.on("message")
def message(data):
    roomId = data["roomId"]
    say(data["userName"] + ": " + data["message"])
    if roomId not in session["messages"]:
        session["messages"][roomId] = { "text": [] }
    session["messages"][roomId]["text"].append(data)
    emit("message", data, broadcast=True, include_self=False)


@socketio.on("join")
def join(data):
    info(data["userName"] + " join room " + data["roomId"])
    session["users"][request.sid] = data["userName"]
    if data["roomId"] not in session["rooms"]:
        session["rooms"][data["roomId"]] = [request.sid]
    else:
        session["rooms"][data["roomId"]].append(request.sid)
    emit("join", data, broadcast=True)
    
    # send user list to all users in the room
    userList(data)


@socketio.on("userList")
def userList(data):
    roomId = data["roomId"]
    userList = []
    for sid in session["rooms"][roomId]:
        userList.append(session["users"][sid])
    emit("userList", {"userList": userList}, broadcast=True)


@socketio.on("leave")
def leave(data):
    info(data["userName"] + " leave room " + data["roomId"])
    session["rooms"][data["roomId"]].remove(request.sid)
    session["users"].pop(request.sid, None)
    emit("leave", data, broadcast=True)

    # send user list to all users in the room
    userList(data)


if __name__ == "__main__":
    HOST = "0.0.0.0"
    PORT = 6093
    socketio.run(app, host=HOST, port=PORT, debug=True)
