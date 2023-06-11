import os
import sys
import uuid
import base64

from flask_cors import CORS
from toolspack.color_speaker import *
from toolspack.crossAPI import TTSCrossLanguage
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
}

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
AudioPath = os.path.join(os.path.dirname(os.path.abspath(__file__)), "audio")

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
            "data": "檢查通過",
        }

        name_list = list(session["users"].values())
        if userName in name_list:
            response["status"] = "false"
            response["data"] = "此名稱已被使用"
        
        if post_type == "join":
            if roomId not in session["rooms"]:
                response["status"] = "false"
                response["data"] = "房間不存在"
            return jsonify(response)
        elif post_type == "create":
            if roomId in session["rooms"]:
                response["status"] = "false"
                response["data"] = "房間已存在，刷新頁面以取得新的房間代號"
            return jsonify(response)
        else:
            response["status"] = "false"
            response["data"] = "未知的請求"
            return jsonify(response)

    else:
        return redirect(url_for("home"))


@app.route("/room/<roomId>", methods=["GET"])
def room(roomId):
    return render_template("room.html", roomId=roomId)


def handle_text(text):
    # replace \n with space
    text = text.replace("\n", " ")
    # remove leading and trailing spaces
    text = text.strip()
    # remove non-printable characters
    text = "".join([c for c in text if c.isprintable()])
    # remove multiple spaces
    text = " ".join(text.split())
    return text


@app.route("/say", methods=["POST"])
def api():
    text = request.form.get("text")
    if text is None:
        result = {
            "status": "false",
            "data": "請求無效",
        }
        return jsonify(result)
    
    text = handle_text(text)
    
    # check text length
    if len(text) > 50:
        result = {
            "status": "false",
            "data": "字數超過上限",
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

    # remove audio file
    os.remove(filename)

    result = {
        "status": "true",
        "data": audio_b64.decode("utf-8"),
    }
    
    return jsonify(result)


### SocketIO ###

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
            emit("leave", {"userName": "<系統自動動作>", "roomId": roomId}, broadcast=True)
            userList({"roomId": roomId})


@socketio.on("message")
def message(data):
    say(data["userName"] + ": " + data["message"])
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
    userList(data)


@socketio.on("userList")
def userList(data):
    roomId = data["roomId"]
    userList = []
    for sid in session["rooms"][roomId]:
        user_item = {
            "socketId": sid,
            "userName": session["users"][sid],
        }
        userList.append(user_item)
    emit("userList", {"userList": userList}, broadcast=True)


@socketio.on("leave")
def leave(data):
    info(data["userName"] + " leave room " + data["roomId"])
    session["rooms"][data["roomId"]].remove(request.sid)
    session["users"].pop(request.sid, None)
    emit("leave", data, broadcast=True)
    userList(data)


@socketio.on("audio")
def audio(data):
    emit("peerConnection", data, broadcast=True, include_self=False)


@socketio.on("audio_connection")
def audio_connection(data):
    peerToSend = None
    if 'sid' in data:
        peerToSend = data['sid']
    data['sid'] = request.sid
    if peerToSend is None:
        emit("audio_connection", data, broadcast=True, include_self=False)
    else:
        emit("audio_connection", data, room=peerToSend)


@socketio.on("audio_stop")
def audio_stop(data):
    emit("hangup", data, broadcast=True, include_self=False)

### End SocketIO ###


if __name__ == "__main__":
    HOST = "0.0.0.0"
    PORT = 6093
    socketio.run(app, host=HOST, port=PORT, debug=True)
